import { useRequestStore } from '@/store/requestStore';
import KeyValueDescriptionTable from './KeyValueDescriptionTable';

export default function ParamsTab() {
  const { currentRequest, updateField } = useRequestStore();
  const params = currentRequest.params || [];

  const setParams = (newParams) => updateField('params', newParams);

  return (
    <div className="h-full flex flex-col min-h-0">
      <KeyValueDescriptionTable
        title="Query parameters"
        items={params}
        onItemsChange={setParams}
        keyPlaceholder="Key"
        valuePlaceholder="Value"
        descriptionPlaceholder="Description"
      />
    </div>
  );
}
