package com.omniflow.automation.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.omniflow.automation.domain.Workflow;
import com.omniflow.automation.domain.WorkflowExecution;
import com.omniflow.automation.domain.WorkflowExecutionStep;
import com.omniflow.automation.domain.WorkflowVersion;
import com.omniflow.automation.graph.WorkflowGraph;
import com.omniflow.automation.repository.WorkflowExecutionRepository;
import com.omniflow.automation.repository.WorkflowExecutionStepRepository;
import com.omniflow.automation.repository.WorkflowRepository;
import com.omniflow.automation.repository.WorkflowVersionRepository;
import com.omniflow.common.domain.enums.Channel;
import com.omniflow.common.domain.enums.ConsentPurpose;
import com.omniflow.common.domain.enums.ExecutionStatus;
import com.omniflow.common.domain.enums.StepStatus;
import com.omniflow.common.domain.enums.WorkflowStatus;
import com.omniflow.common.exception.BadRequestException;
import com.omniflow.common.exception.NotFoundException;
import com.omniflow.common.port.ContactDirectory;
import com.omniflow.common.port.ContactInfo;
import com.omniflow.common.port.ConsentChecker;
import com.omniflow.common.port.MessageIntakePort;
import com.omniflow.common.port.OutboundMessageCommand;
import com.omniflow.common.port.RenderedTemplate;
import com.omniflow.common.port.SuppressionChecker;
import com.omniflow.common.port.TemplatePort;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Executes workflow graphs. Every run is bounded to {@value #MAX_STEPS} steps and every
 * side effect is recorded as a {@code workflow_execution_steps} row. A WAITING execution
 * stores its continuation in {@code context.nextNodeKey} and is resumed by the scheduler.
 */
@Service
@RequiredArgsConstructor
public class AutomationEngine {

    private static final Logger log = LoggerFactory.getLogger(AutomationEngine.class);

    private static final int MAX_STEPS = 50;
    private static final String CONTEXT_NEXT_NODE = "nextNodeKey";

    private final WorkflowRepository workflowRepository;
    private final WorkflowVersionRepository workflowVersionRepository;
    private final WorkflowExecutionRepository executionRepository;
    private final WorkflowExecutionStepRepository stepRepository;
    private final ContactDirectory contactDirectory;
    private final ConsentChecker consentChecker;
    private final SuppressionChecker suppressionChecker;
    private final TemplatePort templatePort;
    private final MessageIntakePort messageIntakePort;
    private final RestClient.Builder restClientBuilder;
    private final ObjectMapper objectMapper;

    /**
     * Starts an execution for an ACTIVE workflow.
     */
    @Transactional
    public UUID startExecution(UUID organizationId,
                               UUID workflowId,
                               UUID contactId,
                               Map<String, Object> triggerPayload) {
        Workflow workflow = workflowRepository
                .findByIdAndOrganizationIdAndDeletedAtIsNull(workflowId, organizationId)
                .orElseThrow(() -> new NotFoundException("Workflow", workflowId));
        if (workflow.getStatus() != WorkflowStatus.ACTIVE) {
            throw new BadRequestException("WORKFLOW_NOT_ACTIVE", "Workflow is not active");
        }
        WorkflowVersion version = latestVersion(workflowId);
        return createAndRun(workflow, version, contactId, triggerPayload);
    }

    /**
     * Runs a workflow against a contact regardless of the workflow status (used by POST /{id}/test).
     * Requires a published version.
     */
    @Transactional
    public UUID testExecution(UUID organizationId, UUID workflowId, UUID contactId) {
        Workflow workflow = workflowRepository
                .findByIdAndOrganizationIdAndDeletedAtIsNull(workflowId, organizationId)
                .orElseThrow(() -> new NotFoundException("Workflow", workflowId));
        WorkflowVersion version = latestVersion(workflowId);
        return createAndRun(workflow, version, contactId, Map.of("test", true));
    }

    /**
     * Resumes a WAITING execution after its {@code next_run_at} has passed.
     */
    @Transactional
    public void resume(UUID executionId) {
        WorkflowExecution execution = executionRepository.findById(executionId).orElse(null);
        if (execution == null || execution.getStatus() != ExecutionStatus.WAITING) {
            return;
        }
        String nextNode = asString(execution.getContext() == null
                ? null
                : execution.getContext().get(CONTEXT_NEXT_NODE));
        if (nextNode == null || nextNode.isBlank()) {
            completeExecution(execution);
            executionRepository.save(execution);
            return;
        }
        WorkflowVersion version = workflowVersionRepository.findById(execution.getWorkflowVersionId())
                .orElse(null);
        if (version == null) {
            failExecution(execution, "Workflow version no longer exists");
            executionRepository.save(execution);
            return;
        }
        execution.setStatus(ExecutionStatus.RUNNING);
        execution.setCurrentNodeKey(nextNode);
        execution.setNextRunAt(null);
        run(execution, WorkflowGraph.parse(version.getGraph()));
        executionRepository.save(execution);
    }

    private WorkflowVersion latestVersion(UUID workflowId) {
        return workflowVersionRepository.findFirstByWorkflowIdOrderByVersionDesc(workflowId)
                .orElseThrow(() -> new BadRequestException("WORKFLOW_NOT_PUBLISHED",
                        "Workflow has no published version"));
    }

    private UUID createAndRun(Workflow workflow,
                              WorkflowVersion version,
                              UUID contactId,
                              Map<String, Object> triggerPayload) {
        WorkflowGraph graph = WorkflowGraph.parse(version.getGraph());
        String start = graph.firstByType("trigger")
                .map(WorkflowGraph.Node::id)
                .orElseGet(() -> graph.nodes().isEmpty() ? null : graph.nodes().get(0).id());
        if (start == null) {
            throw new BadRequestException("EMPTY_WORKFLOW", "Workflow graph contains no nodes");
        }

        WorkflowExecution execution = new WorkflowExecution();
        execution.setOrganizationId(workflow.getOrganizationId());
        execution.setWorkflowId(workflow.getId());
        execution.setWorkflowVersionId(version.getId());
        execution.setContactId(contactId);
        execution.setStatus(ExecutionStatus.RUNNING);
        execution.setCurrentNodeKey(start);
        execution.setContext(triggerPayload == null
                ? new LinkedHashMap<>()
                : new LinkedHashMap<>(triggerPayload));
        execution.setStartedAt(Instant.now());
        executionRepository.save(execution);

        run(execution, graph);
        executionRepository.save(execution);
        return execution.getId();
    }

    private void run(WorkflowExecution execution, WorkflowGraph graph) {
        String current = execution.getCurrentNodeKey();
        int steps = 0;

        while (current != null && steps < MAX_STEPS && execution.getStatus() == ExecutionStatus.RUNNING) {
            WorkflowGraph.Node node = graph.node(current).orElse(null);
            if (node == null) {
                log.warn("Execution {} references unknown node '{}'; completing", execution.getId(), current);
                completeExecution(execution);
                current = null;
                break;
            }
            steps++;
            String type = WorkflowGraph.normalizeType(node.type());
            WorkflowExecutionStep step = beginStep(execution, node);

            switch (type) {
                case "trigger" -> {
                    finishStep(step, StepStatus.COMPLETED, output("triggeredAt", Instant.now().toString()));
                    current = graph.firstTarget(node.id()).orElse(null);
                }
                case "end" -> {
                    finishStep(step, StepStatus.COMPLETED, Map.of());
                    completeExecution(execution);
                    current = null;
                }
                case "wait" -> {
                    current = handleWait(execution, graph, node, step);
                }
                case "send_email", "send_whatsapp", "send_sms" -> {
                    StepResult result = handleSend(execution, node, type, step);
                    if (result.failed()) {
                        failExecution(execution, result.error());
                        current = null;
                    } else {
                        current = graph.firstTarget(node.id()).orElse(null);
                    }
                }
                case "condition" -> {
                    boolean matched = handleCondition(execution, node, step);
                    current = graph.outgoingByHandle(node.id(), matched ? "true" : "false")
                            .or(() -> graph.firstOutgoing(node.id()))
                            .map(WorkflowGraph.Edge::target)
                            .orElse(null);
                }
                case "add_tag" -> {
                    handleAddTag(execution, node, step);
                    current = graph.firstTarget(node.id()).orElse(null);
                }
                case "webhook" -> {
                    StepResult result = handleWebhook(execution, node, step);
                    if (result.failed()) {
                        failExecution(execution, result.error());
                        current = null;
                    } else {
                        current = graph.firstTarget(node.id()).orElse(null);
                    }
                }
                default -> {
                    finishStep(step, StepStatus.SKIPPED,
                            output("reason", "Unsupported node type: " + node.type()));
                    current = graph.firstTarget(node.id()).orElse(null);
                }
            }

            if (current == null && execution.getStatus() == ExecutionStatus.RUNNING) {
                completeExecution(execution);
            } else if (current != null) {
                execution.setCurrentNodeKey(current);
            }
            executionRepository.save(execution);
        }

        if (steps >= MAX_STEPS && execution.getStatus() == ExecutionStatus.RUNNING) {
            failExecution(execution, "Workflow exceeded the maximum step count (" + MAX_STEPS + ")");
            executionRepository.save(execution);
        }
    }

    private String handleWait(WorkflowExecution execution,
                              WorkflowGraph graph,
                              WorkflowGraph.Node node,
                              WorkflowExecutionStep step) {
        String next = graph.firstTarget(node.id()).orElse(null);
        int amount = node.config().path("amount").asInt(1);
        String unit = node.config().path("unit").asText("HOURS");
        Instant nextRunAt = computeNextRunAt(amount, unit);

        Map<String, Object> ctx = new LinkedHashMap<>(execution.getContext() == null
                ? Map.of()
                : execution.getContext());
        ctx.put(CONTEXT_NEXT_NODE, next);

        Map<String, Object> stepOutput = output(
                "amount", Math.max(1, amount),
                "unit", unit,
                "nextRunAt", nextRunAt.toString());
        stepOutput.put(CONTEXT_NEXT_NODE, next);

        if (next == null) {
            finishStep(step, StepStatus.COMPLETED, stepOutput);
            completeExecution(execution);
            return null;
        }

        execution.setStatus(ExecutionStatus.WAITING);
        execution.setNextRunAt(nextRunAt);
        execution.setCurrentNodeKey(next);
        execution.setContext(ctx);
        finishStep(step, StepStatus.COMPLETED, stepOutput);
        return null;
    }

    private StepResult handleSend(WorkflowExecution execution,
                                  WorkflowGraph.Node node,
                                  String type,
                                  WorkflowExecutionStep step) {
        UUID organizationId = execution.getOrganizationId();
        Channel channel = switch (type) {
            case "send_email" -> Channel.EMAIL;
            case "send_whatsapp" -> Channel.WHATSAPP;
            default -> Channel.SMS;
        };

        ContactInfo contact = contactDirectory.find(organizationId, execution.getContactId()).orElse(null);
        if (contact == null) {
            finishStep(step, StepStatus.SKIPPED, output("reason", "contact_not_found"));
            return StepResult.ok();
        }
        String address = contact.addressFor(channel);
        if (address == null || address.isBlank()) {
            finishStep(step, StepStatus.SKIPPED, output("reason", "contact_has_no_address"));
            return StepResult.ok();
        }
        boolean allowed = consentChecker.canSend(organizationId, contact.id(), channel, ConsentPurpose.MARKETING)
                && !suppressionChecker.isSuppressed(organizationId, contact.email(), contact.phone(), channel);
        if (!allowed) {
            finishStep(step, StepStatus.SKIPPED, output("reason", "consent_or_suppression"));
            return StepResult.ok();
        }

        JsonNode config = node.config();
        UUID templateId = uuidOrNull(config.path("templateId").asText(null));
        String subject = blankToNull(config.path("subject").asText(null));
        String body = blankToNull(config.path("body").asText(null));
        String htmlBody = blankToNull(config.path("htmlBody").asText(null));

        if (templateId != null) {
            Optional<RenderedTemplate> rendered = templatePort.render(
                    organizationId, templateId, templateVariables(contact));
            if (rendered.isPresent()) {
                RenderedTemplate template = rendered.get();
                subject = template.subject() == null ? subject : template.subject();
                body = template.body() == null ? body : template.body();
                htmlBody = template.htmlBody() == null ? htmlBody : template.htmlBody();
            }
        }

        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("workflowId", execution.getWorkflowId().toString());
        metadata.put("executionId", execution.getId().toString());
        metadata.put("nodeId", node.id());

        OutboundMessageCommand command = OutboundMessageCommand.builder()
                .organizationId(organizationId)
                .campaignId(null)
                .contactId(execution.getContactId())
                .channel(channel)
                .templateId(templateId)
                .subject(subject)
                .body(body)
                .htmlBody(htmlBody)
                .toAddress(address)
                .fromAddress(null)
                .providerAccountId(null)
                .idempotencyKey("automation:" + execution.getId() + ":" + node.id())
                .metadata(metadata)
                .scheduledAt(null)
                .build();

        try {
            UUID messageId = messageIntakePort.enqueue(command);
            Map<String, Object> stepOutput = output(
                    "channel", channel.name(),
                    "messageId", messageId == null ? null : messageId.toString());
            stepOutput.put("toAddress", address);
            finishStep(step, StepStatus.COMPLETED, stepOutput);
            return StepResult.ok();
        } catch (DataIntegrityViolationException ex) {
            // The idempotency key already exists: the message was enqueued by a previous attempt.
            finishStep(step, StepStatus.SKIPPED, output("reason", "duplicate_idempotency_key"));
            return StepResult.ok();
        } catch (RuntimeException ex) {
            log.warn("Failed to enqueue automation message for execution {}: {}",
                    execution.getId(), ex.getMessage());
            finishStep(step, StepStatus.FAILED, output("error", ex.getMessage()));
            return StepResult.failed("Failed to enqueue message: " + ex.getMessage());
        }
    }

    private boolean handleCondition(WorkflowExecution execution,
                                    WorkflowGraph.Node node,
                                    WorkflowExecutionStep step) {
        JsonNode config = node.config();
        String field = config.path("field").asText("");
        String operator = config.path("operator").asText("eq").toLowerCase(Locale.ROOT);
        JsonNode expected = config.get("value");

        ContactInfo contact = contactDirectory.find(execution.getOrganizationId(), execution.getContactId())
                .orElse(null);
        Object actual = resolveContactField(contact, field);
        boolean result = evaluate(actual, expected, operator);

        Map<String, Object> stepOutput = new LinkedHashMap<>();
        stepOutput.put("field", field);
        stepOutput.put("operator", operator);
        stepOutput.put("actual", actual);
        if (expected != null && !expected.isNull() && !expected.isMissingNode()) {
            stepOutput.put("expected", objectMapper.convertValue(expected, Object.class));
        }
        stepOutput.put("result", result);
        finishStep(step, StepStatus.COMPLETED, stepOutput);
        return result;
    }

    private void handleAddTag(WorkflowExecution execution,
                              WorkflowGraph.Node node,
                              WorkflowExecutionStep step) {
        String tagName = blankToNull(node.config().path("tagName").asText(null));
        if (tagName == null) {
            finishStep(step, StepStatus.SKIPPED, output("reason", "missing_tag_name"));
            return;
        }
        try {
            contactDirectory.addTag(execution.getOrganizationId(), execution.getContactId(), tagName);
            finishStep(step, StepStatus.COMPLETED, output("tagName", tagName));
        } catch (RuntimeException ex) {
            log.warn("Failed to add tag '{}' for execution {}: {}",
                    tagName, execution.getId(), ex.getMessage());
            finishStep(step, StepStatus.FAILED, output("error", ex.getMessage()));
        }
    }

    private StepResult handleWebhook(WorkflowExecution execution,
                                     WorkflowGraph.Node node,
                                     WorkflowExecutionStep step) {
        String url = blankToNull(node.config().path("url").asText(null));
        if (url == null) {
            finishStep(step, StepStatus.FAILED, output("error", "missing_webhook_url"));
            return StepResult.failed("Webhook node is missing a url");
        }

        ContactInfo contact = contactDirectory.find(execution.getOrganizationId(), execution.getContactId())
                .orElse(null);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("contact", contactMap(contact));
        payload.put("executionId", execution.getId().toString());
        payload.put("workflowId", execution.getWorkflowId().toString());

        try {
            ResponseEntity<String> response = restClientBuilder.build()
                    .post()
                    .uri(url)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(payload)
                    .retrieve()
                    .toEntity(String.class);
            int status = response.getStatusCode().value();
            if (status >= 200 && status < 300) {
                finishStep(step, StepStatus.COMPLETED, output("status", status));
                return StepResult.ok();
            }
            finishStep(step, StepStatus.FAILED, output("status", status));
            return StepResult.failed("Webhook returned HTTP " + status);
        } catch (RestClientResponseException ex) {
            int status = ex.getStatusCode().value();
            Map<String, Object> stepOutput = output("status", status);
            stepOutput.put("error", ex.getMessage());
            finishStep(step, StepStatus.FAILED, stepOutput);
            return StepResult.failed("Webhook returned HTTP " + status);
        } catch (RuntimeException ex) {
            finishStep(step, StepStatus.FAILED, output("error", ex.getMessage()));
            return StepResult.failed("Webhook call failed: " + ex.getMessage());
        }
    }

    private WorkflowExecutionStep beginStep(WorkflowExecution execution, WorkflowGraph.Node node) {
        WorkflowExecutionStep step = new WorkflowExecutionStep();
        step.setExecutionId(execution.getId());
        step.setNodeKey(node.id());
        step.setNodeType(node.type());
        step.setStatus(StepStatus.RUNNING);
        step.setInput(configMap(node.config()));
        step.setStartedAt(Instant.now());
        return stepRepository.save(step);
    }

    private void finishStep(WorkflowExecutionStep step, StepStatus status, Map<String, Object> output) {
        step.setStatus(status);
        step.setOutput(output == null ? new LinkedHashMap<>() : new LinkedHashMap<>(output));
        step.setFinishedAt(Instant.now());
        stepRepository.save(step);
    }

    private void completeExecution(WorkflowExecution execution) {
        execution.setStatus(ExecutionStatus.COMPLETED);
        execution.setFinishedAt(Instant.now());
        execution.setNextRunAt(null);
        execution.setErrorMessage(null);
    }

    private void failExecution(WorkflowExecution execution, String message) {
        execution.setStatus(ExecutionStatus.FAILED);
        execution.setErrorMessage(message == null ? "Workflow failed" : truncate(message, 2000));
        execution.setFinishedAt(Instant.now());
        execution.setNextRunAt(null);
    }

    private Map<String, Object> configMap(JsonNode config) {
        if (config == null || config.isNull()) {
            return new LinkedHashMap<>();
        }
        try {
            Map<String, Object> map = objectMapper.convertValue(
                    config, new TypeReference<Map<String, Object>>() {
                    });
            return map == null ? new LinkedHashMap<>() : new LinkedHashMap<>(map);
        } catch (IllegalArgumentException ex) {
            return new LinkedHashMap<>();
        }
    }

    private Map<String, Object> templateVariables(ContactInfo contact) {
        Map<String, Object> variables = new LinkedHashMap<>();
        if (contact.attributes() != null) {
            variables.putAll(contact.attributes());
        }
        putIfPresent(variables, "firstName", contact.firstName());
        putIfPresent(variables, "lastName", contact.lastName());
        putIfPresent(variables, "email", contact.email());
        putIfPresent(variables, "phone", contact.phone());
        putIfPresent(variables, "status", contact.status());
        return variables;
    }

    private Map<String, Object> contactMap(ContactInfo contact) {
        if (contact == null) {
            return new LinkedHashMap<>();
        }
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("id", contact.id() == null ? null : contact.id().toString());
        map.put("email", contact.email());
        map.put("phone", contact.phone());
        map.put("firstName", contact.firstName());
        map.put("lastName", contact.lastName());
        map.put("status", contact.status());
        map.put("attributes", contact.attributes() == null ? Map.of() : contact.attributes());
        return map;
    }

    private Object resolveContactField(ContactInfo contact, String field) {
        if (contact == null || field == null || field.isBlank()) {
            return null;
        }
        String key = field.trim();
        if (key.startsWith("contact.")) {
            key = key.substring("contact.".length());
        }
        return switch (key) {
            case "email" -> contact.email();
            case "phone" -> contact.phone();
            case "status" -> contact.status();
            case "firstName" -> contact.firstName();
            case "lastName" -> contact.lastName();
            case "id" -> contact.id() == null ? null : contact.id().toString();
            default -> {
                if (key.startsWith("attributes.")) {
                    key = key.substring("attributes.".length());
                }
                yield contact.attributes() == null ? null : contact.attributes().get(key);
            }
        };
    }

    private boolean evaluate(Object actual, JsonNode expected, String operator) {
        String op = operator == null ? "eq" : operator;
        return switch (op) {
            case "exists" -> actual != null && !String.valueOf(actual).isBlank();
            case "eq" -> valuesEqual(actual, expected);
            case "neq" -> !valuesEqual(actual, expected);
            case "contains" -> contains(actual, expected);
            case "gt" -> compare(actual, expected) > 0;
            case "gte" -> compare(actual, expected) >= 0;
            case "lt" -> compare(actual, expected) < 0;
            case "lte" -> compare(actual, expected) <= 0;
            default -> false;
        };
    }

    private boolean valuesEqual(Object actual, JsonNode expected) {
        if (actual == null) {
            return expected == null || expected.isNull() || expected.isMissingNode();
        }
        if (expected == null || expected.isNull() || expected.isMissingNode()) {
            return false;
        }
        String actualText = String.valueOf(actual).trim();
        if (expected.isNumber() && isNumeric(actualText)) {
            return new BigDecimal(actualText).compareTo(expected.decimalValue()) == 0;
        }
        String expectedText = expected.isTextual() ? expected.asText() : expected.asText();
        return actualText.equalsIgnoreCase(expectedText == null ? "" : expectedText.trim());
    }

    private boolean contains(Object actual, JsonNode expected) {
        if (actual == null || expected == null || expected.isNull()) {
            return false;
        }
        String expectedText = expected.asText("");
        return String.valueOf(actual).toLowerCase(Locale.ROOT)
                .contains(expectedText.toLowerCase(Locale.ROOT));
    }

    private int compare(Object actual, JsonNode expected) {
        if (actual == null || expected == null || expected.isNull() || expected.isMissingNode()) {
            return -1;
        }
        String actualText = String.valueOf(actual).trim();
        String expectedText = expected.asText("");
        if (isNumeric(actualText) && isNumeric(expectedText)) {
            return new BigDecimal(actualText).compareTo(new BigDecimal(expectedText));
        }
        return actualText.compareTo(expectedText);
    }

    private boolean isNumeric(String value) {
        if (value == null || value.isBlank()) {
            return false;
        }
        try {
            new BigDecimal(value.trim());
            return true;
        } catch (NumberFormatException ex) {
            return false;
        }
    }

    private Instant computeNextRunAt(int amount, String unit) {
        int value = Math.max(1, amount);
        String normalized = unit == null ? "HOURS" : unit.trim().toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "MINUTES" -> Instant.now().plus(value, ChronoUnit.MINUTES);
            case "HOURS" -> Instant.now().plus(value, ChronoUnit.HOURS);
            case "DAYS" -> Instant.now().plus(value, ChronoUnit.DAYS);
            case "WEEKS" -> Instant.now().plus(value * 7L, ChronoUnit.DAYS);
            default -> Instant.now().plus(value, ChronoUnit.HOURS);
        };
    }

    private static Map<String, Object> output(Object... keyValues) {
        Map<String, Object> map = new LinkedHashMap<>();
        for (int i = 0; i + 1 < keyValues.length; i += 2) {
            map.put(String.valueOf(keyValues[i]), keyValues[i + 1]);
        }
        return map;
    }

    private static void putIfPresent(Map<String, Object> target, String key, Object value) {
        if (value != null) {
            target.put(key, value);
        }
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static UUID uuidOrNull(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(value.trim());
        } catch (IllegalArgumentException ex) {
            return null;
        }
    }

    private static String asString(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private static String truncate(String value, int max) {
        return value.length() <= max ? value : value.substring(0, max);
    }

    private record StepResult(boolean failed, String error) {

        static StepResult ok() {
            return new StepResult(false, null);
        }

        static StepResult failed(String error) {
            return new StepResult(true, error);
        }
    }
}
