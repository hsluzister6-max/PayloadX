import WorkflowCanvas from './WorkflowCanvas';
import NodeConfigPanel from './NodeConfigPanel';

export default function WorkflowBuilder() {
  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Canvas */}
      <div className="flex-1 h-full">
        <WorkflowCanvas />
      </div>

      {/* Config Panel */}
      <NodeConfigPanel />
    </div>
  );
}
