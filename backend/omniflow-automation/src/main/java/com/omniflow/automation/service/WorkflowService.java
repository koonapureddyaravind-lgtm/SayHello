package com.omniflow.automation.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.omniflow.automation.domain.Workflow;
import com.omniflow.automation.domain.WorkflowExecution;
import com.omniflow.automation.domain.WorkflowNode;
import com.omniflow.automation.domain.WorkflowVersion;
import com.omniflow.automation.dto.ExecutionView;
import com.omniflow.automation.dto.UpsertWorkflowRequest;
import com.omniflow.automation.dto.WorkflowView;
import com.omniflow.automation.graph.WorkflowGraph;
import com.omniflow.automation.repository.WorkflowExecutionRepository;
import com.omniflow.automation.repository.WorkflowNodeRepository;
import com.omniflow.automation.repository.WorkflowRepository;
import com.omniflow.automation.repository.WorkflowVersionRepository;
import com.omniflow.common.api.PageQuery;
import com.omniflow.common.api.PageResponse;
import com.omniflow.common.domain.enums.WorkflowStatus;
import com.omniflow.common.domain.enums.WorkflowTriggerType;
import com.omniflow.common.exception.BadRequestException;
import com.omniflow.common.exception.NotFoundException;
import com.omniflow.common.util.PageMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class WorkflowService {

    private final WorkflowRepository workflowRepository;
    private final WorkflowVersionRepository workflowVersionRepository;
    private final WorkflowNodeRepository workflowNodeRepository;
    private final WorkflowExecutionRepository workflowExecutionRepository;
    private final AutomationEngine automationEngine;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public PageResponse<WorkflowView> list(UUID organizationId, PageQuery pageQuery, WorkflowStatus status, String q) {
        PageRequest pageable = pageQuery.toPageRequest(Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<Workflow> page;
        if (q == null || q.isBlank()) {
            if (status == null) {
                page = workflowRepository.findByOrganizationIdAndDeletedAtIsNull(organizationId, pageable);
            } else {
                page = workflowRepository.findByOrganizationIdAndStatusAndDeletedAtIsNull(organizationId, status, pageable);
            }
        } else {
            page = workflowRepository.search(organizationId, status, "%" + q.trim().toLowerCase(Locale.ROOT) + "%", pageable);
        }
        return PageMapper.of(page, WorkflowView::of);
    }

    @Transactional(readOnly = true)
    public WorkflowView get(UUID organizationId, UUID workflowId) {
        Workflow workflow = findWorkflow(organizationId, workflowId);
        JsonNode graph = workflowVersionRepository.findFirstByWorkflowIdOrderByVersionDesc(workflowId)
                .map(WorkflowVersion::getGraph)
                .orElse(null);
        return WorkflowView.of(workflow, graph);
    }

    @Transactional
    public WorkflowView create(UUID organizationId, UUID actorId, UpsertWorkflowRequest request) {
        if (request.name() == null || request.name().isBlank()) {
            throw new BadRequestException("VALIDATION_ERROR", "Workflow name is required");
        }
        Workflow workflow = new Workflow();
        workflow.setOrganizationId(organizationId);
        workflow.setName(request.name().trim());
        workflow.setDescription(request.description());
        workflow.setStatus(WorkflowStatus.DRAFT);
        workflow.setTriggerType(request.triggerType() == null
                ? WorkflowTriggerType.CONTACT_CREATED
                : request.triggerType());
        workflow.setTriggerConfig(request.triggerConfig() == null
                ? new LinkedHashMap<>()
                : new LinkedHashMap<>(request.triggerConfig()));
        workflow.setCurrentVersion(0);
        workflow.setCreatedBy(actorId);
        workflowRepository.save(workflow);
        return WorkflowView.of(workflow);
    }

    @Transactional
    public WorkflowView update(UUID organizationId, UUID workflowId, UpsertWorkflowRequest request) {
        Workflow workflow = findWorkflow(organizationId, workflowId);
        if (request.name() != null) {
            if (request.name().isBlank()) {
                throw new BadRequestException("VALIDATION_ERROR", "Workflow name cannot be blank");
            }
            workflow.setName(request.name().trim());
        }
        if (request.description() != null) {
            workflow.setDescription(request.description());
        }
        if (request.triggerType() != null) {
            workflow.setTriggerType(request.triggerType());
        }
        if (request.triggerConfig() != null) {
            workflow.setTriggerConfig(new LinkedHashMap<>(request.triggerConfig()));
        }
        workflowRepository.save(workflow);
        return WorkflowView.of(workflow);
    }

    @Transactional
    public void delete(UUID organizationId, UUID workflowId) {
        Workflow workflow = findWorkflow(organizationId, workflowId);
        workflow.setDeletedAt(Instant.now());
        workflow.setStatus(WorkflowStatus.ARCHIVED);
        workflowRepository.save(workflow);
    }

    @Transactional
    public WorkflowView publish(UUID organizationId, UUID actorId, UUID workflowId, JsonNode graph) {
        Workflow workflow = findWorkflow(organizationId, workflowId);
        if (graph == null || !graph.isObject() || graph.get("nodes") == null || !graph.get("nodes").isArray()) {
            throw new BadRequestException("INVALID_GRAPH", "graph.nodes must be an array");
        }
        WorkflowGraph parsed = WorkflowGraph.parse(graph);
        if (parsed.nodes().size() != graph.get("nodes").size()) {
            throw new BadRequestException("INVALID_GRAPH",
                    "Every node requires a non-blank id and type");
        }
        validateGraph(parsed);

        int nextVersion = workflow.getCurrentVersion() + 1;
        WorkflowVersion version = new WorkflowVersion();
        version.setWorkflowId(workflow.getId());
        version.setVersion(nextVersion);
        version.setGraph(graph);
        version.setCreatedBy(actorId);
        version.setPublishedAt(Instant.now());
        workflowVersionRepository.save(version);

        workflowNodeRepository.deleteByWorkflowVersionId(version.getId());
        for (WorkflowGraph.Node node : parsed.nodes()) {
            WorkflowNode row = new WorkflowNode();
            row.setWorkflowVersionId(version.getId());
            row.setNodeKey(node.id());
            row.setType(node.type());
            row.setConfig(configMap(node.config()));
            row.setPositionX(node.positionX());
            row.setPositionY(node.positionY());
            workflowNodeRepository.save(row);
        }

        workflow.setCurrentVersion(nextVersion);
        if (workflow.getStatus() == WorkflowStatus.DRAFT) {
            workflow.setStatus(WorkflowStatus.ACTIVE);
        }
        workflowRepository.save(workflow);
        return WorkflowView.of(workflow, graph);
    }

    @Transactional
    public WorkflowView activate(UUID organizationId, UUID workflowId) {
        Workflow workflow = findWorkflow(organizationId, workflowId);
        if (workflowVersionRepository.findFirstByWorkflowIdOrderByVersionDesc(workflowId).isEmpty()) {
            throw new BadRequestException("WORKFLOW_NOT_PUBLISHED",
                    "Publish the workflow before activating it");
        }
        workflow.setStatus(WorkflowStatus.ACTIVE);
        workflowRepository.save(workflow);
        return WorkflowView.of(workflow);
    }

    @Transactional
    public WorkflowView pause(UUID organizationId, UUID workflowId) {
        Workflow workflow = findWorkflow(organizationId, workflowId);
        workflow.setStatus(WorkflowStatus.PAUSED);
        workflowRepository.save(workflow);
        return WorkflowView.of(workflow);
    }

    @Transactional(readOnly = true)
    public PageResponse<ExecutionView> executions(UUID organizationId,
                                                  UUID workflowId,
                                                  PageQuery pageQuery) {
        findWorkflow(organizationId, workflowId);
        PageRequest pageable = pageQuery.toPageRequest(Sort.by(Sort.Direction.DESC, "createdAt"));
        Page<WorkflowExecution> page = workflowExecutionRepository
                .findByOrganizationIdAndWorkflowId(organizationId, workflowId, pageable);
        return PageMapper.of(page, ExecutionView::of);
    }

    @Transactional
    public ExecutionView test(UUID organizationId, UUID workflowId, UUID contactId) {
        UUID executionId = automationEngine.testExecution(organizationId, workflowId, contactId);
        WorkflowExecution execution = workflowExecutionRepository.findById(executionId)
                .orElseThrow(() -> new NotFoundException("WorkflowExecution", executionId));
        return ExecutionView.of(execution);
    }

    private Workflow findWorkflow(UUID organizationId, UUID workflowId) {
        return workflowRepository.findByIdAndOrganizationIdAndDeletedAtIsNull(workflowId, organizationId)
                .orElseThrow(() -> new NotFoundException("Workflow", workflowId));
    }

    private void validateGraph(WorkflowGraph graph) {
        if (graph.nodes().isEmpty()) {
            throw new BadRequestException("INVALID_GRAPH", "Workflow graph must contain nodes");
        }
        Set<String> ids = new HashSet<>();
        for (WorkflowGraph.Node node : graph.nodes()) {
            if (!ids.add(node.id())) {
                throw new BadRequestException("INVALID_GRAPH", "Duplicate node id: " + node.id());
            }
        }
        if (!graph.hasType("trigger")) {
            throw new BadRequestException("INVALID_GRAPH", "Workflow graph requires a trigger node");
        }
        if (!graph.hasType("end")) {
            throw new BadRequestException("INVALID_GRAPH", "Workflow graph requires an end node");
        }
        for (WorkflowGraph.Edge edge : graph.edges()) {
            if (!ids.contains(edge.source())) {
                throw new BadRequestException("INVALID_GRAPH",
                        "Edge references unknown source node: " + edge.source());
            }
            if (!ids.contains(edge.target())) {
                throw new BadRequestException("INVALID_GRAPH",
                        "Edge references unknown target node: " + edge.target());
            }
        }
    }

    private Map<String, Object> configMap(JsonNode config) {
        if (config == null || config.isNull()) {
            return new LinkedHashMap<>();
        }
        try {
            Map<String, Object> map = objectMapper.convertValue(config, new com.fasterxml.jackson.core.type.TypeReference<Map<String, Object>>() {
            });
            return map == null ? new LinkedHashMap<>() : new LinkedHashMap<>(map);
        } catch (IllegalArgumentException ex) {
            return new LinkedHashMap<>();
        }
    }
}
