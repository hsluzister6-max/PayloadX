# Workflow Automation Feature

## Overview
The Workflow Automation feature allows you to create visual API workflows by connecting multiple API calls together. Data from one API call can be used in subsequent calls, enabling complex automation scenarios.

## Features

### ✅ Implemented
- **Visual Canvas**: Drag-and-drop workflow builder using React Flow
- **API Nodes**: Configure HTTP requests (GET, POST, PUT, DELETE, PATCH)
- **Delay Nodes**: Add delays between API calls
- **Node Configuration**: Configure URL, method, headers, body, timeout
- **Data Mapping**: Reference previous node results using `{{nodeId.field}}` syntax
- **Workflow Execution**: Execute workflows locally (requires Rust backend)
- **Execution Results**: View success/failure status and timing for each node
- **Save/Load**: Save workflows to backend (requires API routes)

### 🚧 To Be Implemented
- **Rust Execution Engine**: Backend execution logic (see RUST_EXECUTOR_COMPLETE.md)
- **Backend API Routes**: Workflow persistence endpoints (see BACKEND_ROUTES.md)
- **Condition Nodes**: Conditional branching based on response
- **Transform Nodes**: Data transformation between nodes
- **Validation Rules**: Response validation with custom rules
- **Parallel Execution**: Execute independent nodes in parallel
- **Workflow History**: View past execution results

## Usage

### Accessing Workflow Builder
1. Click the **Workflow** icon (⚡) in the left sidebar
2. The workflow canvas will open

### Creating a Workflow
1. Click **"+ API Node"** to add an API request node
2. Click on the node to configure it in the right panel
3. Set the HTTP method, URL, headers, and body
4. Add more nodes and connect them by dragging from one node's bottom handle to another's top handle
5. Click **"Execute"** to run the workflow
6. Click **"Save"** to persist the workflow

### Data Mapping
Reference data from previous nodes using the syntax: `{{nodeId.field}}`

Example:
- Node 1 (ID: `node1`) returns: `{"userId": 123, "token": "abc"}`
- Node 2 can use: `{{node1.body.userId}}` in the URL or headers

## Components

### WorkflowCanvas.jsx
Main canvas component with React Flow integration. Handles node/edge management and execution.

### NodeConfigPanel.jsx
Right sidebar panel for configuring selected nodes. Shows different fields based on node type.

### nodes/ApiNode.jsx
Visual representation of an API request node. Shows method, URL, and execution status.

### nodes/DelayNode.jsx
Visual representation of a delay node. Shows wait duration.

## Store

### workflowStore.js
Zustand store managing:
- Current workflow state
- Node/edge CRUD operations
- Workflow execution
- Backend integration (save/load)

## Next Steps

To complete the workflow automation feature:

1. **Implement Rust Execution Engine** (Phase 1)
   - See `RUST_EXECUTOR_COMPLETE.md` for complete code
   - Implements graph parsing, data mapping, validation

2. **Add Backend API Routes** (Phase 4)
   - See `BACKEND_ROUTES.md` for implementation
   - Workflow and execution persistence

3. **Add Advanced Features**
   - Condition nodes
   - Transform nodes
   - Parallel execution
   - Workflow templates

## Documentation

Full documentation available in the root directory:
- `WORKFLOW_README.md` - Complete documentation index
- `QUICK_START.md` - Quick start guide
- `IMPLEMENTATION_GUIDE.md` - Step-by-step implementation
- `FRONTEND_IMPLEMENTATION.md` - Frontend details
- `BACKEND_ROUTES.md` - Backend API routes
- `RUST_EXECUTOR_COMPLETE.md` - Rust execution engine

## Testing

To test the workflow builder:
1. Open the app and navigate to the Workflow section
2. Create a simple workflow with 2 API nodes
3. Configure the first node to call a public API (e.g., https://jsonplaceholder.typicode.com/users/1)
4. Configure the second node to use data from the first node
5. Click Execute (will fail until Rust backend is implemented)

## Known Limitations

- Execution requires Rust backend implementation
- No workflow persistence without backend API routes
- No validation rules UI yet
- No condition/transform nodes yet
- No parallel execution yet
