use super::models::*;
use anyhow::{Context, Result};
use regex::Regex;
use serde_json::Value;
use std::collections::HashMap;

pub struct DataMapper {
    context: HashMap<String, Value>,
}

impl DataMapper {
    pub fn new() -> Self {
        Self {
            context: HashMap::new(),
        }
    }

    pub fn with_context(context: HashMap<String, Value>) -> Self {
        Self { context }
    }

    /// Store node execution result for future reference
    pub fn store_node_result(&mut self, node_id: &str, data: HashMap<String, Value>) {
        let mut response_obj = serde_json::Map::new();
        for (k, v) in data {
            response_obj.insert(k, v);
        }
        
        let mut node_entry = serde_json::Map::new();
        node_entry.insert("response".to_string(), Value::Object(response_obj));
        
        self.context.insert(node_id.to_string(), Value::Object(node_entry));
    }

    /// Apply data mappings to a node's configuration
    pub fn apply_mappings(&self, node: &WorkflowNode) -> Result<WorkflowNode> {
        let mut mapped_node = node.clone();

        // Apply variable substitution to URL
        if let Some(ref url) = mapped_node.data.url {
            mapped_node.data.url = Some(self.substitute_variables(url)?);
        }

        // Apply variable substitution to headers
        if let Some(ref headers) = mapped_node.data.headers {
            mapped_node.data.headers = Some(
                headers.iter()
                    .map(|h| Ok(KeyValue {
                        key: self.substitute_variables(&h.key)?,
                        value: self.substitute_variables(&h.value)?,
                        enabled: h.enabled,
                    }))
                    .collect::<Result<Vec<_>>>()?  
            );
        }

        // Apply variable substitution to params
        if let Some(ref params) = mapped_node.data.params {
            mapped_node.data.params = Some(
                params.iter()
                    .map(|p| Ok(KeyValue {
                        key: self.substitute_variables(&p.key)?,
                        value: self.substitute_variables(&p.value)?,
                        enabled: p.enabled,
                    }))
                    .collect::<Result<Vec<_>>>()?  
            );
        }

        // Apply variable substitution to body
        if let Some(ref body) = mapped_node.data.body {
            mapped_node.data.body = Some(self.substitute_in_json(body)?);
        }

        // Apply explicit data mappings (highest priority, override substituted values)
        for mapping in &node.data.data_mappings {
            // Skip empty mappings
            if mapping.source_expression.is_empty() || mapping.target_field.is_empty() {
                continue;
            }
            let value = match self.extract_value(&mapping.source_expression) {
                Ok(v) => v,
                Err(_) => continue, // Skip if source not available yet
            };
            let transformed = self.apply_transform(value, mapping.transform.as_deref())?;
            self.set_field_value(&mut mapped_node, &mapping.target_field, transformed)?;
        }

        Ok(mapped_node)
    }

    /// Substitute variables in a string (e.g., "{{node1.response.token}}")
    fn substitute_variables(&self, input: &str) -> Result<String> {
        let re = Regex::new(r"\{\{([^}]+)\}\}").unwrap();
        let mut result = input.to_string();

        for cap in re.captures_iter(input) {
            let expression = &cap[1];
            let value = self.extract_value(expression)?;
            let value_str = match value {
                Value::String(s) => s,
                Value::Number(n) => n.to_string(),
                Value::Bool(b) => b.to_string(),
                v => v.to_string(),
            };
            result = result.replace(&cap[0], &value_str);
        }

        Ok(result)
    }

    /// Substitute variables in JSON
    fn substitute_in_json(&self, json: &Value) -> Result<Value> {
        match json {
            Value::String(s) => {
                Ok(Value::String(self.substitute_variables(s)?))
            }
            Value::Array(arr) => {
                Ok(Value::Array(
                    arr.iter()
                        .map(|v| self.substitute_in_json(v))
                        .collect::<Result<Vec<_>>>()?
                ))
            }
            Value::Object(obj) => {
                Ok(Value::Object(
                    obj.iter()
                        .map(|(k, v)| Ok((k.clone(), self.substitute_in_json(v)?)))
                        .collect::<Result<serde_json::Map<_, _>>>()?
                ))
            }
            other => Ok(other.clone()),
        }
    }

    /// Extract value from expression (e.g., "node1.response.body.token")
    fn extract_value(&self, expression: &str) -> Result<Value> {
        let parts: Vec<&str> = expression.trim().split('.').collect();
        
        if parts.is_empty() {
            anyhow::bail!("Empty expression");
        }

        // Get the node data
        let node_id = parts[0];
        let node_data = self.context.get(node_id)
            .context(format!("Node {} not found in context", node_id))?;

        // Navigate through the path
        let mut current = node_data;
        for part in &parts[1..] {
            current = current.get(part)
                .context(format!("Field {} not found", part))?;
        }

        Ok(current.clone())
    }

    /// Apply transformation to a value
    fn apply_transform(&self, value: Value, transform: Option<&str>) -> Result<Value> {
        match transform {
            None | Some("") => Ok(value),
            Some("uppercase") => {
                if let Value::String(s) = value {
                    Ok(Value::String(s.to_uppercase()))
                } else {
                    Ok(value)
                }
            }
            Some("lowercase") => {
                if let Value::String(s) = value {
                    Ok(Value::String(s.to_lowercase()))
                } else {
                    Ok(value)
                }
            }
            Some(t) => anyhow::bail!("Unknown transform: {}", t),
        }
    }

    /// Set a field value in the node using dot notation
    /// Supports:
    ///   params.<key>          → query param
    ///   headers.<key>         → request header
    ///   body                  → replace whole body
    ///   body.<key.path>       → set nested body field
    ///   url                   → replace URL entirely
    fn set_field_value(&self, node: &mut WorkflowNode, field_path: &str, value: Value) -> Result<()> {
        if field_path.starts_with("params.") {
            let param_key = field_path.strip_prefix("params.").unwrap();
            let params = node.data.params.get_or_insert_with(Vec::new);
            if let Some(param) = params.iter_mut().find(|p| p.key == param_key) {
                param.value = value_to_string(&value);
            } else {
                params.push(KeyValue {
                    key: param_key.to_string(),
                    value: value_to_string(&value),
                    enabled: true,
                });
            }
        } else if field_path.starts_with("headers.") {
            let header_name = field_path.strip_prefix("headers.").unwrap();
            let headers = node.data.headers.get_or_insert_with(Vec::new);
            if let Some(header) = headers.iter_mut().find(|h| h.key == header_name) {
                header.value = value_to_string(&value);
            } else {
                headers.push(KeyValue {
                    key: header_name.to_string(),
                    value: value_to_string(&value),
                    enabled: true,
                });
            }
        } else if field_path == "body" {
            node.data.body = Some(value);
        } else if field_path.starts_with("body.") {
            let path = field_path.strip_prefix("body.").unwrap();
            
            // Ensure body is an object
            if node.data.body.is_none() || !node.data.body.as_ref().unwrap().is_object() {
                node.data.body = Some(Value::Object(serde_json::Map::new()));
            }
            
            if let Some(ref mut body) = node.data.body {
                set_nested_json(body, path, value);
            }
        } else if field_path == "url" {
            node.data.url = Some(value_to_string(&value));
        }

        Ok(())
    }
}

fn value_to_string(v: &Value) -> String {
    match v {
        Value::String(s) => s.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        other => other.to_string(),
    }
}

/// Set a value deep in a JSON object using dot-separated path
fn set_nested_json(root: &mut Value, path: &str, value: Value) {
    let parts: Vec<&str> = path.splitn(2, '.').collect();
    if parts.len() == 1 {
        if let Value::Object(map) = root {
            map.insert(parts[0].to_string(), value);
        }
    } else if let Value::Object(map) = root {
        let child = map.entry(parts[0].to_string()).or_insert(Value::Object(Default::default()));
        set_nested_json(child, parts[1], value);
    }
}
