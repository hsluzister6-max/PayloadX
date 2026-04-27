import { useRequestStore } from '@/store/requestStore';

const AUTH_TYPES = ['none', 'bearer', 'basic', 'apikey'];

export default function AuthTab() {
  const { currentRequest, updateAuth } = useRequestStore();
  const auth = currentRequest.auth || { type: 'none' };

  return (
    <div className="p-3 flex flex-col gap-4">
      {/* Auth type selector */}
      <div>
        <label className="block text-xs font-semibold text-surface-400 mb-2">Auth Type</label>
        <div className="flex flex-wrap gap-1.5">
          {AUTH_TYPES.map((type) => (
            <button
              key={type}
              onClick={() => updateAuth({ type })}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                auth.type === type
                  ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                  : 'bg-surface-800 text-surface-500 hover:text-tx-primary border border-surface-700'
              }`}
            >
              {type === 'apikey' ? 'API Key' : type === 'bearer' ? 'Bearer Token' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Bearer */}
      {auth.type === 'bearer' && (
        <div>
          <label className="block text-xs font-semibold text-surface-400 mb-1.5">Token</label>
          <input
            type="text"
            placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
            value={auth.bearer?.token || ''}
            onChange={(e) => updateAuth({ bearer: { token: e.target.value } })}
            className="input text-xs font-mono"
          />
          <p className="text-tx-muted text-xs mt-1">Sent as: Authorization: Bearer &lt;token&gt;</p>
        </div>
      )}

      {/* Basic */}
      {auth.type === 'basic' && (
        <div className="flex flex-col gap-2">
          <div>
            <label className="block text-xs font-semibold text-surface-400 mb-1.5">Username</label>
            <input
              type="text"
              placeholder="username"
              value={auth.basic?.username || ''}
              onChange={(e) => updateAuth({ basic: { ...auth.basic, username: e.target.value } })}
              className="input text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-400 mb-1.5">Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={auth.basic?.password || ''}
              onChange={(e) => updateAuth({ basic: { ...auth.basic, password: e.target.value } })}
              className="input text-xs"
            />
          </div>
        </div>
      )}

      {/* API Key */}
      {auth.type === 'apikey' && (
        <div className="flex flex-col gap-2">
          <div>
            <label className="block text-xs font-semibold text-surface-400 mb-1.5">Key</label>
            <input
              type="text"
              placeholder="X-API-Key"
              value={auth.apikey?.key || ''}
              onChange={(e) => updateAuth({ apikey: { ...auth.apikey, key: e.target.value } })}
              className="input text-xs"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-400 mb-1.5">Value</label>
            <input
              type="text"
              placeholder="your-api-key-here"
              value={auth.apikey?.value || ''}
              onChange={(e) => updateAuth({ apikey: { ...auth.apikey, value: e.target.value } })}
              className="input text-xs font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-surface-400 mb-1.5">Add to</label>
            <div className="flex gap-2">
              {['header', 'query'].map((loc) => (
                <button
                  key={loc}
                  onClick={() => updateAuth({ apikey: { ...auth.apikey, in: loc } })}
                  className={`text-xs px-3 py-1.5 rounded-lg transition-all capitalize ${
                    auth.apikey?.in === loc
                      ? 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                      : 'bg-surface-800 text-surface-500 border border-surface-700 hover:text-tx-primary'
                  }`}
                >
                  {loc === 'header' ? 'Header' : 'Query Param'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {auth.type === 'none' && (
        <p className="text-tx-muted text-xs py-2">No authentication configured for this request.</p>
      )}
    </div>
  );
}
