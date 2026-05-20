import * as XLSX from 'xlsx';

/**
 * Build tabular rows for workflow API node results (same shape as the Execution Report export).
 * @param {{ node_results?: Array<Record<string, unknown>> } | null | undefined} executionResult
 */
export function buildWorkflowTestSheetRows(executionResult) {
  if (!executionResult?.node_results?.length) return [];

  return executionResult.node_results
    .filter((res) => res.request)
    .map((res) => {
      const validationErrors = (res.validations || [])
        .filter((v) => !v.passed)
        .map((v) => v.message || `${v.type} check failed`)
        .join('; ');

      const executionError = res.error?.message || '';
      const combinedError = [executionError, validationErrors].filter(Boolean).join(' | ');

      return {
        'Node Name': res.node_name,
        Method: res.request?.method || 'N/A',
        Status: String(res.status || '').toUpperCase(),
        'HTTP Status': res.response?.status ?? 'N/A',
        'Duration (ms)': res.duration,
        URL: res.request?.url || 'N/A',
        Payload: res.request?.body ? JSON.stringify(res.request.body, null, 2) : 'No Body',
        Error:
          combinedError || (String(res.status).toUpperCase() === 'FAILED' ? 'Unknown Failure' : ''),
        'Execution Time': res.start_time ? new Date(res.start_time).toLocaleString() : '',
      };
    });
}

/**
 * Write an XLSX test report for the given workflow run.
 * @returns {{ ok: true, fileName: string } | { ok: false, reason: 'no_results' | 'no_api_nodes' | 'error', message?: string }}
 */
export function writeWorkflowTestSheet(executionResult, workflowName = 'workflow') {
  const data = buildWorkflowTestSheetRows(executionResult);
  if (!executionResult?.node_results?.length) {
    return { ok: false, reason: 'no_results' };
  }
  if (data.length === 0) {
    return { ok: false, reason: 'no_api_nodes' };
  }

  try {
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Test Results');

    worksheet['!cols'] = [
      { wch: 25 },
      { wch: 10 },
      { wch: 12 },
      { wch: 12 },
      { wch: 15 },
      { wch: 40 },
      { wch: 50 },
      { wch: 30 },
      { wch: 20 },
    ];

    const safeName = String(workflowName || 'workflow').replace(/\s+/g, '_').replace(/[/\\?%*:|"<>]/g, '-');
    const fileName = `PayloadX_WorkflowTest_${safeName}_${Date.now()}.xlsx`;
    XLSX.writeFile(workbook, fileName);
    return { ok: true, fileName };
  } catch (e) {
    return { ok: false, reason: 'error', message: e?.message || String(e) };
  }
}
