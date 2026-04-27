import { useState, useCallback } from 'react';
import { executeHttpRequest } from '@/services/requestService';
import { useRequestStore } from '@/store/requestStore';
import { useEnvironmentStore } from '@/store/environmentStore';
import { useSocketStore } from '@/store/socketStore';
import { useTeamStore } from '@/store/teamStore';
import { useAuthStore } from '@/store/authStore';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import ParamsTab from './tabs/ParamsTab';
import HeadersTab from './tabs/HeadersTab';
import BodyTab from './tabs/BodyTab';
import AuthTab from './tabs/AuthTab';
import VariableUrlInput from './VariableUrlInput';

const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const METHOD_COLORS = {
  GET: 'text-success',
  POST: 'text-[#58A6FF]',
  PUT: 'text-warning',
  PATCH: 'text-[#A8A8A8]',
  DELETE: 'text-danger',
  HEAD: 'text-surface-500',
  OPTIONS: 'text-info',
};

export default function RESTRequestBuilder() {
  const { currentRequest, updateField, activeTab, setActiveTab, setIsExecuting, setResponse, addToHistory, saveRequest } = useRequestStore();
  const { resolveVariables, activeEnvironment } = useEnvironmentStore();
  const { emitRequestUpdate } = useSocketStore();
  const { currentTeam } = useTeamStore();
  const { user } = useAuthStore();
  const [showMethodDropdown, setShowMethodDropdown] = useState(false);

  const executeRequest = useCallback(async () => {
    if (!currentRequest.url.trim()) {
      toast.error('Enter a URL first');
      return;
    }

    // Always access setIsExecuting/setResponse via getState() to avoid stale closures
    const store = useRequestStore.getState;

    store().setIsExecuting(true);
    store().setResponse(null);
    let isCancelled = false;
    useRequestStore.setState({
      cancelCurrentRequest: () => {
        isCancelled = true;
        store().setIsExecuting(false);
        store().setResponse({ status: 'Cancelled', statusText: '', headers: {}, body: 'Request was cancelled by user.', responseTimeMs: 0, sizeBytes: 0 });
      }
    });

    try {
      const resolvedUrl = resolveVariables(currentRequest.url);
      const unresolvedVars = [...(resolvedUrl.matchAll(/\{\{([^}]+)\}\}/g))].map(m => m[1].trim());
      if (unresolvedVars.length > 0) {
        toast.error(`Variables not found in environment: ${unresolvedVars.join(', ')}`);
        store().setIsExecuting(false);
        return;
      }

      const resolvedHeaders = (currentRequest.headers || []).map((h) => ({
        ...h,
        value: resolveVariables(h.value),
      }));

      const payload = {
        method: currentRequest.method,
        url: resolvedUrl,
        headers: resolvedHeaders.filter((h) => h.enabled && h.key),
        params: (currentRequest.params || []).filter((p) => p.enabled && p.key).map((p) => ({
          ...p,
          value: resolveVariables(p.value),
        })),
        body: currentRequest.body,
        auth: currentRequest.auth,
        timeoutMs: 30000,
      };

      console.log('[ExecuteRequest] Starting request to:', resolvedUrl);
      const response = await executeHttpRequest(payload);
      console.log('[ExecuteRequest] Got response:', response?.status);

      if (isCancelled) {
        console.log('[ExecuteRequest] Request was cancelled, ignoring response');
        return;
      }

      store().setResponse(response);
      store().addToHistory({
        id: uuidv4(),
        request: { ...currentRequest, url: resolvedUrl },
        response: { ...response, body: '[Body hidden in history]' },
        timestamp: Date.now(),
      });

      if (currentTeam && user) {
        emitRequestUpdate(currentTeam._id, currentRequest, user.id);
      }
    } catch (err) {
      console.error('[ExecuteRequest] Error:', err);
      const errorMsg = typeof err === 'string' ? err : (err.message || 'Request failed');
      toast.error(`Error: ${errorMsg}`);
      if (!isCancelled) {
        store().setResponse({ status: 'Error', statusText: '', headers: {}, body: errorMsg, responseTimeMs: 0, sizeBytes: 0 });
      }
    } finally {
      console.log('[ExecuteRequest] Finally block, isCancelled:', isCancelled);
      // Use getState() to guarantee we always clear loading — avoids stale closure
      if (!isCancelled) {
        useRequestStore.getState().setIsExecuting(false);
      }
      useRequestStore.setState({ cancelCurrentRequest: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentRequest, activeEnvironment, resolveVariables, addToHistory, currentTeam, user, emitRequestUpdate]);

  const tabs = [
    { id: 'params', label: 'Params', count: currentRequest.params?.filter((p) => p.enabled && p.key).length },
    { id: 'headers', label: 'Headers', count: currentRequest.headers?.filter((h) => h.enabled && h.key).length },
    { id: 'body', label: 'Body', badge: currentRequest.body?.mode !== 'none' ? '●' : null },
    { id: 'auth', label: 'Auth', badge: currentRequest.auth?.type !== 'none' ? '●' : null },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* URL bar */}
      <div className="flex items-center gap-2 px-3 pb-2 pt-1">
        <div className="flex-1 min-w-0 flex items-center bg-[color:var(--surface-1)] border border-[color:var(--border-1)] rounded-md focus-within:border-[color:var(--accent)] focus-within:ring-1 focus-within:ring-[color:var(--accent)] hover:border-[color:var(--border-2)] transition-all overflow-visible h-8">
          <div className="relative h-full flex-shrink-0">
            <button
              onClick={() => setShowMethodDropdown(!showMethodDropdown)}
              className={`flex items-center gap-1.5 px-2.5 h-full text-[11px] font-bold ${METHOD_COLORS[currentRequest.method]} hover:bg-[color:var(--surface-2)] transition-colors min-w-[80px] justify-between border-r border-[color:var(--border-1)] rounded-l-md outline-none focus:outline-none`}
            >
              {currentRequest.method}
              <svg className="w-3 h-3 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showMethodDropdown && (
              <div className="absolute top-full left-0 mt-1 bg-[color:var(--surface-1)] border border-[color:var(--border-1)] rounded-lg shadow-glass z-50 py-1 min-w-[110px] animate-in">
                {METHODS.map((m) => (
                  <button
                    key={m}
                    onClick={() => { updateField('method', m); setShowMethodDropdown(false); }}
                    className={`flex items-center w-full px-2.5 py-1 text-[11px] font-bold hover:bg-surface-700 transition-colors ${METHOD_COLORS[m]}`}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 h-full">
            <VariableUrlInput
              value={currentRequest.url}
              onChange={(e) => updateField('url', e.target.value)}
              placeholder="https://api.example.com/endpoint"
            />
          </div>
        </div>
        <SendButton onSend={executeRequest} />
      </div>

      {/* Resolved URL preview */}
      {currentRequest.url?.includes('{{') && (
        <div className="px-3 pb-1.5 flex items-center gap-1.5">
          <svg className="w-3 h-3 text-tx-muted flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-[10px] text-tx-muted font-mono truncate">
            {resolveVariables(currentRequest.url)}
          </span>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-[var(--border-1)] px-3">
        <div className="flex items-center gap-0.5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-2 py-1.5 text-[11px] font-medium border-b-2 transition-all ${activeTab === tab.id
                ? 'border-[var(--accent)] text-[var(--text-primary)]'
                : 'border-transparent text-surface-500 hover:text-tx-secondary'
                }`}
            >
              {tab.label}
              {tab.count > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-surface-3 text-secondary">{tab.count}</span>}
              {tab.badge && <span className="text-[var(--text-muted)] text-xs">{tab.badge}</span>}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {activeTab === 'params' && <ParamsTab />}
        {activeTab === 'headers' && <HeadersTab />}
        {activeTab === 'body' && <BodyTab />}
        {activeTab === 'auth' && <AuthTab />}
      </div>
    </div>
  );
}

function SendButton({ onSend }) {
  const { isExecuting, cancelCurrentRequest } = useRequestStore();
  if (isExecuting) {
    return (
      <button onClick={() => cancelCurrentRequest?.()} className="btn-primary flex items-center gap-1.5 px-3 h-8 !bg-danger/90 hover:!bg-danger text-xs">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        Cancel
      </button>
    );
  }
  return (
    <button onClick={onSend} className="btn-primary flex items-center gap-1.5 px-4 h-8 text-xs">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" /></svg>
      Send
    </button>
  );
}
