use super::models::*;
use anyhow::{Context, Result};
use petgraph::graph::{DiGraph, NodeIndex};
use petgraph::visit::EdgeRef;
use std::collections::HashMap;

pub struct WorkflowParser {
    workflow: Workflow,
    node_map: HashMap<String, NodeIndex>,
}

impl WorkflowParser {
    pub fn new(workflow: Workflow) -> Self {
        Self {
            workflow,
            node_map: HashMap::new(),
        }
    }

    /// Parse workflow and build execution graph
    pub fn parse(&mut self) -> Result<DiGraph<WorkflowNode, WorkflowEdge>> {
        let mut graph = DiGraph::new();

        // Add all nodes to graph
        for node in &self.workflow.nodes {
            let idx = graph.add_node(node.clone());
            self.node_map.insert(node.id.clone(), idx);
        }

        // Add edges
        for edge in &self.workflow.edges {
            let source_idx = self.node_map.get(&edge.source)
                .context(format!("Source node {} not found", edge.source))?;
            let target_idx = self.node_map.get(&edge.target)
                .context(format!("Target node {} not found", edge.target))?;
            
            graph.add_edge(*source_idx, *target_idx, edge.clone());
        }

        // Validate graph (no cycles for now)
        self.validate_graph(&graph)?;

        Ok(graph)
    }

    /// Validate workflow graph structure
    fn validate_graph(&self, graph: &DiGraph<WorkflowNode, WorkflowEdge>) -> Result<()> {
        // Check for cycles using DFS
        if petgraph::algo::is_cyclic_directed(graph) {
            anyhow::bail!("Workflow contains cycles");
        }

        // Ensure at least one node
        if graph.node_count() == 0 {
            anyhow::bail!("Workflow must contain at least one node");
        }

        Ok(())
    }

    /// Get execution order using topological sort
    pub fn get_execution_order(&self, graph: &DiGraph<WorkflowNode, WorkflowEdge>) -> Result<Vec<NodeIndex>> {
        petgraph::algo::toposort(graph, None)
            .map_err(|_| anyhow::anyhow!("Failed to determine execution order"))
    }

    /// Get execution order organized into parallel-safe layers
    pub fn get_execution_layers(&self, graph: &DiGraph<WorkflowNode, WorkflowEdge>) -> Result<Vec<Vec<NodeIndex>>> {
        let mut layers = Vec::new();
        let mut in_degree: HashMap<NodeIndex, usize> = HashMap::new();
        let mut current_layer = Vec::new();

        // Initialize in-degrees
        for node in graph.node_indices() {
            let degree = graph.edges_directed(node, petgraph::Direction::Incoming).count();
            in_degree.insert(node, degree);
            if degree == 0 {
                current_layer.push(node);
            }
        }

        let mut processed_count = 0;
        let total_nodes = graph.node_count();

        while !current_layer.is_empty() {
            let mut next_layer = Vec::new();
            
            for &node in &current_layer {
                processed_count += 1;
                // Decrement in-degree for all outgoing neighbors
                for edge in graph.edges_directed(node, petgraph::Direction::Outgoing) {
                    let target = edge.target();
                    if let Some(deg) = in_degree.get_mut(&target) {
                        *deg -= 1;
                        if *deg == 0 {
                            next_layer.push(target);
                        }
                    }
                }
            }

            layers.push(current_layer);
            current_layer = next_layer;
        }

        if processed_count < total_nodes {
            anyhow::bail!("Failed to group into execution layers (possible cycle)");
        }

        Ok(layers)
    }
}
