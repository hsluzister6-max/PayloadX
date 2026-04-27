use super::data_mapper::DataMapper;
use super::models::*;
use super::parser::WorkflowParser;
use super::validator::ResponseValidator;
use anyhow::{Context, Result};
use chrono::Utc;
use reqwest::Client;
use reqwest::header::{HeaderMap, HeaderName, HeaderValue};
use std::collections::HashMap;
use std::time::Instant;
use std::str::FromStr;
use tauri::Window;
use crate::AppCookieJar;
use petgraph::graph::NodeIndex;
use petgraph::visit::EdgeRef;
use petgraph::Direction;

pub struct WorkflowExecutor {
    workflow: Workflow,
    client: Client,
    cookie_jar: Option<AppCookieJar>,
    data_mapper: DataMapper,
    window: Option<Window>,
    state: Option<crate::WorkflowState>,
}

impl WorkflowExecutor {
    pub fn new(workflow: Workflow, client: Client, cookie_jar: Option<AppCookieJar>, window: Option<Window>) -> Self {
        Self {
            workflow,
            client,
            cookie_jar,
            data_mapper: DataMapper::new(),
            window,
            state: None,
        }
    }

    pub fn with_state(mut self, state: crate::WorkflowState) -> Self {
        self.state = Some(state);
        self
    }

    pub fn with_context(workflow: Workflow, client: Client, cookie_jar: Option<AppCookieJar>, window: Option<Window>, context: HashMap<String, serde_json::Value>) -> Self {
        Self {
            workflow,
            client,
            cookie_jar,
            data_mapper: DataMapper::with_context(context),
            window,
            state: None,
        }
    }

    /// Execute the entire workflow
    pub async fn execute(&mut self) -> Result<WorkflowExecution> {
        let execution_start = Instant::now();
        let start_time = Utc::now().to_rfc3339();

        // Parse workflow and build execution graph
        let mut parser = WorkflowParser::new(self.workflow.clone());
        let graph = parser.parse()?;
        let execution_layers = parser.get_execution_layers(&graph)?;

        if let Some(state) = &self.state {
            state.is_cancelled.store(false, std::sync::atomic::Ordering::SeqCst);
            state.is_paused.store(false, std::sync::atomic::Ordering::SeqCst);
        }

        // Execute nodes in parallel layers
        let mut node_results = Vec::new();
        let mut success_count = 0;
        let mut failed_count = 0;
        let mut skipped_count = 0;
        let mut completed_nodes = 0;

        for layer in &execution_layers {
            // Check for pause/cancel between layers
            if let Some(state) = &self.state {
                while state.is_paused.load(std::sync::atomic::Ordering::SeqCst) {
                    if state.is_cancelled.load(std::sync::atomic::Ordering::SeqCst) {
                        break;
                    }
                    tokio::time::sleep(std::time::Duration::from_millis(200)).await;
                }

                if state.is_cancelled.load(std::sync::atomic::Ordering::SeqCst) {
                    break;
                }
            }

            // Emit all node IDs in this layer at once so the frontend can show loading on all simultaneously
            let layer_node_ids: Vec<String> = layer.iter().map(|&idx| graph[idx].id.clone()).collect();
            if let Some(window) = &self.window {
                let _ = window.emit("layer_execution_started", &layer_node_ids);
            }

            let mut futures: Vec<std::pin::Pin<Box<dyn futures::Future<Output = NodeExecutionResult> + Send>>> = Vec::new();

            for &node_idx in layer {
                let node = &graph[node_idx];
                let executor_ref = &*self;
                
                // Check if this node should be executed based on conditions
                let is_satisfied = self.is_node_satisfied(&node.id, &graph, &node_results);

                futures.push(Box::pin(async move {
                    if !is_satisfied {
                        return NodeExecutionResult {
                            node_id: node.id.clone(),
                            node_name: node.data.name.clone(),
                            start_time: Utc::now().to_rfc3339(),
                            end_time: Utc::now().to_rfc3339(),
                            duration: 0,
                            status: NodeStatus::Skipped,
                            request: None,
                            response: None,
                            validations: vec![],
                            error: None,
                            extracted_data: HashMap::new(),
                        };
                    }

                    match executor_ref.execute_node(node).await {
                        Ok(result) => result,
                        Err(e) => NodeExecutionResult {
                            node_id: node.id.clone(),
                            node_name: node.data.name.clone(),
                            start_time: Utc::now().to_rfc3339(),
                            end_time: Utc::now().to_rfc3339(),
                            duration: 0,
                            status: NodeStatus::Failed,
                            request: None,
                            response: None,
                            validations: vec![],
                            error: Some(ErrorDetails {
                                message: e.to_string(),
                                error_type: "execution".to_string(),
                                stack: None,
                            }),
                            extracted_data: HashMap::new(),
                        },
                    }
                }));
            }

            // Execute all nodes in this layer concurrently
            let layer_results = futures::future::join_all(futures).await;

            // Emit layer finished so frontend clears those loaders
            if let Some(window) = &self.window {
                let _ = window.emit("layer_execution_finished", &layer_node_ids);
            }

            // Process results and update data mapper
            for result in layer_results {
                completed_nodes += 1;
                self.emit_progress(completed_nodes, graph.node_count()).await;

                if result.status == NodeStatus::Success {
                    success_count += 1;
                } else if result.status == NodeStatus::Failed {
                    failed_count += 1;
                } else {
                    skipped_count += 1;
                }

                // Store result for data mapping for subsequent layers
                self.data_mapper.store_node_result(&result.node_id, result.extracted_data.clone());
                node_results.push(result);
            }
        }

        let duration = execution_start.elapsed().as_millis() as u64;
        let end_time = Utc::now().to_rfc3339();

        let status = if failed_count == 0 {
            ExecutionStatus::Success
        } else if success_count > 0 {
            ExecutionStatus::Partial
        } else {
            ExecutionStatus::Failed
        };

        Ok(WorkflowExecution {
            id: uuid::Uuid::new_v4().to_string(),
            workflow_id: self.workflow.id.clone(),
            workflow_name: self.workflow.name.clone(),
            start_time,
            end_time,
            duration,
            status,
            total_nodes: graph.node_count(),
            success_count,
            failed_count,
            skipped_count,
            node_results,
        })
    }

    /// Execute a single node
    pub async fn execute_node(&self, node: &WorkflowNode) -> Result<NodeExecutionResult> {
        if node.data.skipped {
            println!("DEBUG: Skipping node {}", node.data.name);
            return Ok(NodeExecutionResult {
                node_id: node.id.clone(),
                node_name: node.data.name.clone(),
                start_time: Utc::now().to_rfc3339(),
                end_time: Utc::now().to_rfc3339(),
                duration: 0,
                status: NodeStatus::Skipped,
                request: None,
                response: None,
                validations: Vec::new(),
                error: None,
                extracted_data: HashMap::new(),
            });
        }

        let node_start = Instant::now();
        let start_time = Utc::now().to_rfc3339();

        match node.node_type {
            NodeType::Api => self.execute_api_node(node, node_start, start_time).await,
            NodeType::Delay => self.execute_delay_node(node, node_start, start_time).await,
            _ => anyhow::bail!("Node type {:?} not implemented", node.node_type),
        }
    }

    /// Execute an API node
    async fn execute_api_node(
        &self,
        node: &WorkflowNode,
        node_start: Instant,
        start_time: String,
    ) -> Result<NodeExecutionResult> {
        // Apply data mappings
        let mapped_node = self.data_mapper.apply_mappings(node)?;

        let method = mapped_node.data.method.as_ref()
            .context("API node missing method")?;
        let url = mapped_node.data.url.as_ref()
            .context("API node missing URL")?;

        // 3. HTTP method and URL
        let url_obj = ::url::Url::parse(url).context("Invalid URL format")?;
        let host = url_obj.host_str().unwrap_or("").to_string();

        let mut request = self.client.request(
            method.parse().context("Invalid HTTP method")?,
            url,
        );

        // Add headers
        let mut header_map = HeaderMap::new();
        if let Some(headers) = &mapped_node.data.headers {
            for header in headers {
                if header.enabled {
                    if let (Ok(name), Ok(val)) = (
                        HeaderName::from_str(&header.key),
                        HeaderValue::from_str(&header.value),
                    ) {
                        header_map.insert(name, val);
                    }
                }
            }
        }

        // Attach cookies from jar
        if !host.is_empty() {
            if let Some(jar_wrapper) = &self.cookie_jar {
                if let Ok(jar) = jar_wrapper.0.lock() {
                    if let Some(cookies) = jar.get(&host) {
                        if !cookies.is_empty() {
                            println!("DEBUG: Attaching {} cookies from jar for host {}", cookies.len(), host);
                            let mut cookie_components = Vec::new();
                            for (k, v) in cookies.iter() {
                                if v.is_empty() {
                                    cookie_components.push(k.clone());
                                } else {
                                    cookie_components.push(format!("{}={}", k, v));
                                }
                            }
                            if let Ok(val) = HeaderValue::from_str(&cookie_components.join("; ")) {
                                header_map.insert(reqwest::header::COOKIE, val);
                            }
                        }
                    }
                }
            }
        }

        // Add query parameters
        if let Some(params) = &mapped_node.data.params {
            let mut query_params = Vec::new();
            for param in params {
                if param.enabled {
                    query_params.push((&param.key, &param.value));
                }
            }
            if !query_params.is_empty() {
                request = request.query(&query_params);
            }
        }

        request = request.headers(header_map.clone());

        // Logging Request
        println!("--- WORKFLOW API REQUEST ---");
        println!("Node: {} ({})", mapped_node.data.name, mapped_node.id);
        println!("Method: {}", method);
        println!("URL: {}", url);
        println!("Headers: {:?}", header_map);
        if let Some(params) = &mapped_node.data.params {
            let enabled: Vec<_> = params.iter().filter(|p| p.enabled).collect();
            if !enabled.is_empty() {
                println!("Query Params: {:?}", enabled);
            }
        }
        if let Some(body) = &mapped_node.data.body {
            println!("Body: {}", serde_json::to_string_pretty(body).unwrap_or_else(|_| "Invalid JSON".to_string()));
        }
        println!("---------------------------");

        // Emit to frontend for console.log
        if let Some(window) = &self.window {
            let _ = window.emit("workflow_log", serde_json::json!({
                "type": "request",
                "node_name": mapped_node.data.name,
                "node_id": mapped_node.id,
                "method": method,
                "url": url,
                "headers": header_map.iter().map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string())).collect::<HashMap<String, String>>(),
                "params": mapped_node.data.params.as_ref().map(|p| p.iter().filter(|i| i.enabled).collect::<Vec<_>>()),
                "body": mapped_node.data.body
            }));
        }

        // Set body
        if let Some(body) = &mapped_node.data.body {
            request = request.json(body);
        }

        // Set timeout
        let timeout = mapped_node.data.timeout.unwrap_or(30);
        request = request.timeout(std::time::Duration::from_secs(timeout));

        // Execute request
        let response = request.send().await
            .context("Failed to execute request")?;

        // Handle saving session
        if mapped_node.data.save_session.unwrap_or(false) && !host.is_empty() {
            if let Some(jar_wrapper) = &self.cookie_jar {
                let set_cookies = response.headers().get_all(reqwest::header::SET_COOKIE);
                for cookie in set_cookies.iter() {
                    if let Ok(c_str) = cookie.to_str() {
                        // Parse key=value
                        let parts: Vec<&str> = c_str.split(';').collect();
                        if let Some(first_part) = parts.first() {
                            let kv: Vec<&str> = first_part.splitn(2, '=').collect();
                            if let Ok(mut jar) = jar_wrapper.0.lock() {
                                let host_jar = jar.entry(host.clone()).or_insert_with(HashMap::new);
                                let key = kv[0].trim().to_string();
                                let val = if kv.len() > 1 { kv[1].trim().to_string() } else { "".to_string() };
                                println!("DEBUG: Saving cookie {}={} for host {}", key, val, host);
                                host_jar.insert(key, val);
                            }
                        }
                    }
                }
            }
        }

        // Extract response details
        let status = response.status().as_u16();
        let status_text = response.status().to_string();
        let headers: HashMap<String, String> = response.headers()
            .iter()
            .map(|(k, v)| (k.to_string(), v.to_str().unwrap_or("").to_string()))
            .collect();

        let body_bytes = response.bytes().await?;
        let body_size = body_bytes.len();
        let body: serde_json::Value = serde_json::from_slice(&body_bytes)
            .unwrap_or_else(|_| serde_json::Value::String(
                String::from_utf8_lossy(&body_bytes).to_string()
            ));

        let response_details = ResponseDetails {
            status,
            status_text: status_text.clone(),
            headers: headers.clone(),
            body: body.clone(),
            size: body_size,
        };

        // Logging Response
        println!("--- WORKFLOW API RESPONSE ---");
        println!("Node: {}", mapped_node.data.name);
        println!("Status: {} {}", status, status_text);
        println!("Headers: {:?}", headers);
        // println!("Body: {}", serde_json::to_string_pretty(&body).unwrap_or_else(|_| "Binary or invalid JSON".to_string()));
        println!("----------------------------");

        // Emit to frontend for console.log
        if let Some(window) = &self.window {
            let _ = window.emit("workflow_log", serde_json::json!({
                "type": "response",
                "node_name": mapped_node.data.name,
                "status": status,
                "status_text": status_text,
                "headers": headers,
                "body": body
            }));
        }

        // Run validations
        let validations = ResponseValidator::validate(
            &mapped_node.data.validations,
            &response_details,
        );

        let all_passed = if validations.is_empty() {
            status < 400
        } else {
            validations.iter().all(|v| v.passed)
        };

        let node_status = if all_passed {
            NodeStatus::Success
        } else {
            NodeStatus::Failed
        };

        // Extract data for future nodes
        let mut extracted_data = HashMap::new();
        extracted_data.insert("status".to_string(), serde_json::json!(status));
        extracted_data.insert("body".to_string(), body.clone());
        extracted_data.insert("headers".to_string(), serde_json::json!(headers));

        let duration = node_start.elapsed().as_millis() as u64;
        let end_time = Utc::now().to_rfc3339();

        Ok(NodeExecutionResult {
            node_id: node.id.clone(),
            node_name: node.data.name.clone(),
            start_time,
            end_time,
            duration,
            status: node_status,
            request: Some(RequestDetails {
                method: method.clone(),
                url: url.clone(),
                headers: mapped_node.data.headers.as_ref()
                    .map(|h| h.iter()
                        .filter(|kv| kv.enabled)
                        .map(|kv| (kv.key.clone(), kv.value.clone()))
                        .collect())
                    .unwrap_or_default(),
                body: mapped_node.data.body.clone(),
            }),
            response: Some(response_details),
            validations,
            error: None,
            extracted_data,
        })
    }

    /// Execute a delay node
    async fn execute_delay_node(
        &self,
        node: &WorkflowNode,
        node_start: Instant,
        start_time: String,
    ) -> Result<NodeExecutionResult> {
        // Extract delay duration from node data
        let delay_ms = node.data.timeout.unwrap_or(1000);
        
        tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;

        let duration = node_start.elapsed().as_millis() as u64;
        let end_time = Utc::now().to_rfc3339();

        Ok(NodeExecutionResult {
            node_id: node.id.clone(),
            node_name: node.data.name.clone(),
            start_time,
            end_time,
            duration,
            status: NodeStatus::Success,
            request: None,
            response: None,
            validations: vec![],
            error: None,
            extracted_data: HashMap::new(),
        })
    }

    /// Emit progress event to frontend
    async fn emit_progress(&self, completed: usize, total: usize) {
        if let Some(window) = &self.window {
            let _ = window.emit("workflow_progress", serde_json::json!({
                "completed": completed,
                "total": total,
                "percentage": (completed as f64 / total as f64 * 100.0) as u32,
            }));
        }
    }

    /// Check if a node should be executed based on its incoming edge conditions
    fn is_node_satisfied(&self, node_id: &str, graph: &petgraph::graph::DiGraph<WorkflowNode, WorkflowEdge>, node_results: &[NodeExecutionResult]) -> bool {
        let node_idx = match graph.node_indices().find(|&i| graph[i].id == node_id) {
            Some(idx) => idx,
            None => return true,
        };

        let mut incoming_edges = graph.edges_directed(node_idx, Direction::Incoming);
        
        // If no incoming edges, it's a starting node
        let first_edge = incoming_edges.next();
        if first_edge.is_none() {
            return true;
        }

        // Re-iterate (since we consumed one)
        let incoming_edges = graph.edges_directed(node_idx, Direction::Incoming);
        let mut any_satisfied = false;

        for edge_ref in incoming_edges {
            let parent_idx = edge_ref.source();
            let edge = edge_ref.weight();
            let parent_node = &graph[parent_idx];
            
            // Find parent result
            let parent_result = node_results.iter().find(|r| r.node_id == parent_node.id);
            
            if let Some(res) = parent_result {
                let satisfied = match edge.condition.as_deref() {
                    Some("success") => res.status == NodeStatus::Success,
                    Some("failure") => res.status == NodeStatus::Failed,
                    _ => res.status != NodeStatus::Skipped, // "always" or None
                };
                
                if satisfied {
                    any_satisfied = true;
                    break; // OR logic: if any incoming path is satisfied, run it
                }
            }
        }

        any_satisfied
    }
}
