use crate::workflow::{Workflow, WorkflowExecution, WorkflowExecutor};
use reqwest::Client;
use tauri::{State, Window};

#[tauri::command]
pub async fn execute_workflow(
    workflow_json: String,
    client: State<'_, Client>,
    cookie_jar: State<'_, crate::AppCookieJar>,
    workflow_state: State<'_, crate::WorkflowState>,
    window: Window,
) -> Result<WorkflowExecution, String> {
    // Parse workflow from JSON
    let workflow: Workflow = serde_json::from_str(&workflow_json)
        .map_err(|e| format!("Failed to parse workflow: {}", e))?;

    // Create executor
    let mut executor = WorkflowExecutor::new(
        workflow,
        client.inner().clone(),
        Some(cookie_jar.inner().clone()),
        Some(window),
    ).with_state(workflow_state.inner().clone());

    // Execute workflow
    executor.execute()
        .await
        .map_err(|e| format!("Workflow execution failed: {}", e))
}

#[tauri::command]
pub async fn execute_single_node(
    node_json: String,
    context_json: String,
    client: State<'_, Client>,
    cookie_jar: State<'_, crate::AppCookieJar>,
    window: Window,
) -> Result<crate::workflow::NodeExecutionResult, String> {
    let node: crate::workflow::WorkflowNode = serde_json::from_str(&node_json)
        .map_err(|e| format!("Failed to parse node: {}", e))?;
        
    let context: std::collections::HashMap<String, serde_json::Value> = serde_json::from_str(&context_json)
        .unwrap_or_default();

    let dummy_workflow = Workflow {
        id: "single".into(),
        name: "Single Node".into(),
        description: None,
        team_id: None,
        project_id: None,
        nodes: vec![node.clone()],
        edges: vec![],
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    let executor = WorkflowExecutor::with_context(
        dummy_workflow,
        client.inner().clone(),
        Some(cookie_jar.inner().clone()),
        Some(window),
        context,
    );

    executor.execute_node(&node)
        .await
        .map_err(|e| format!("Single node execution failed: {}", e))
}

#[tauri::command]
pub async fn validate_workflow(workflow_json: String) -> Result<bool, String> {
    // Parse workflow
    let workflow: Workflow = serde_json::from_str(&workflow_json)
        .map_err(|e| format!("Failed to parse workflow: {}", e))?;

    // Validate structure
    let mut parser = crate::workflow::parser::WorkflowParser::new(workflow);
    parser.parse()
        .map(|_| true)
        .map_err(|e| format!("Workflow validation failed: {}", e))
}

#[tauri::command]
pub async fn cancel_workflow_execution(workflow_state: State<'_, crate::WorkflowState>) -> Result<(), String> {
    workflow_state.is_cancelled.store(true, std::sync::atomic::Ordering::SeqCst);
    workflow_state.is_paused.store(false, std::sync::atomic::Ordering::SeqCst);
    Ok(())
}
