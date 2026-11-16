package com.omniflow.automation.graph;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Parsed, immutable view of the JSON graph stored in {@code workflow_versions.graph}.
 * Format:
 * <pre>
 * { "nodes": [{ "id": "trigger", "type": "trigger", "config": {} }],
 *   "edges": [{ "source": "trigger", "target": "n1", "sourceHandle": null }] }
 * </pre>
 */
public record WorkflowGraph(List<Node> nodes, List<Edge> edges) {

    public record Node(String id, String type, JsonNode config, BigDecimal positionX, BigDecimal positionY) {
    }

    public record Edge(String source, String target, String sourceHandle) {
    }

    public static WorkflowGraph parse(JsonNode graph) {
        List<Node> nodes = new ArrayList<>();
        List<Edge> edges = new ArrayList<>();
        if (graph == null || graph.isNull()) {
            return new WorkflowGraph(List.copyOf(nodes), List.copyOf(edges));
        }
        JsonNode nodesNode = graph.get("nodes");
        if (nodesNode != null && nodesNode.isArray()) {
            for (JsonNode raw : nodesNode) {
                String id = text(raw, "id");
                String type = text(raw, "type");
                if (id == null || id.isBlank() || type == null || type.isBlank()) {
                    continue;
                }
                JsonNode config = raw.get("config");
                if (config == null || config.isNull() || !config.isObject()) {
                    config = JsonNodeFactory.instance.objectNode();
                }
                JsonNode position = raw.get("position");
                BigDecimal x = decimal(position == null ? null : position.get("x"));
                BigDecimal y = decimal(position == null ? null : position.get("y"));
                nodes.add(new Node(id, type, config, x, y));
            }
        }
        JsonNode edgesNode = graph.get("edges");
        if (edgesNode != null && edgesNode.isArray()) {
            for (JsonNode raw : edgesNode) {
                String source = text(raw, "source");
                String target = text(raw, "target");
                if (source == null || target == null || source.isBlank() || target.isBlank()) {
                    continue;
                }
                edges.add(new Edge(source, target, text(raw, "sourceHandle")));
            }
        }
        return new WorkflowGraph(List.copyOf(nodes), List.copyOf(edges));
    }

    public Optional<Node> node(String id) {
        if (id == null) {
            return Optional.empty();
        }
        return nodes.stream().filter(n -> n.id().equals(id)).findFirst();
    }

    public Optional<Node> firstByType(String type) {
        if (type == null) {
            return Optional.empty();
        }
        return nodes.stream()
                .filter(n -> n.type() != null && n.type().equalsIgnoreCase(type))
                .findFirst();
    }

    public boolean hasType(String type) {
        return firstByType(type).isPresent();
    }

    public List<Edge> outgoing(String nodeId) {
        if (nodeId == null) {
            return List.of();
        }
        return edges.stream().filter(e -> e.source().equals(nodeId)).toList();
    }

    public Optional<Edge> firstOutgoing(String nodeId) {
        return outgoing(nodeId).stream().findFirst();
    }

    public Optional<Edge> outgoingByHandle(String nodeId, String handle) {
        if (handle == null) {
            return Optional.empty();
        }
        return outgoing(nodeId).stream()
                .filter(e -> e.sourceHandle() != null && e.sourceHandle().equalsIgnoreCase(handle))
                .findFirst();
    }

    public Optional<String> firstTarget(String nodeId) {
        return firstOutgoing(nodeId).map(Edge::target);
    }

    private static String text(JsonNode node, String field) {
        if (node == null) {
            return null;
        }
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) {
            return null;
        }
        return value.asText();
    }

    private static BigDecimal decimal(JsonNode value) {
        if (value == null || value.isNull()) {
            return BigDecimal.ZERO;
        }
        try {
            return new BigDecimal(value.asText());
        } catch (NumberFormatException ex) {
            return BigDecimal.ZERO;
        }
    }

    public static String normalizeType(String type) {
        return type == null ? "" : type.toLowerCase(Locale.ROOT);
    }
}
