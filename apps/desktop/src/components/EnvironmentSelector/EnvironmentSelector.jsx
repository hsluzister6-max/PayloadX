import { useState, useRef, useEffect } from 'react';
import { useEnvironmentStore } from '@/store/environmentStore';
import { useProjectStore } from '@/store/projectStore';
import { useTeamStore } from '@/store/teamStore';
import { useUIStore } from '@/store/uiStore';
import { Layers, ChevronDown, X, CheckCircle2, Settings, Plus, Eye, EyeOff, Cookie, RefreshCw } from 'lucide-react';

export default function EnvironmentSelector() {
  const { environments, activeEnvironment, setActiveEnvironment, fetchEnvironments, isLoading } = useEnvironmentStore();
  const { currentProject } = useProjectStore();
  const { currentTeam } = useTeamStore();
  const [open, setOpen] = useState(false);
  const [showVars, setShowVars] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (currentProject?._id) fetchEnvironments(currentProject._id, currentTeam?._id, true);
  }, [currentProject?._id, currentTeam?._id]);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = (env) => {
    setActiveEnvironment(env);
    setOpen(false);
  };

  const handleClear = (e) => {
    e.stopPropagation();
    setActiveEnvironment(null);
    setOpen(false);
  };

  const activeVars = activeEnvironment?.variables?.filter(v => v.enabled !== false && v.key) || [];

  return (
    <div className="relative" ref={ref} style={{ fontFamily: "'DM Mono', monospace" }}>

      {/* Trigger */}
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
          padding: '5px 10px',
          borderRadius: '7px',
          border: '1px solid',
          borderColor: activeEnvironment ? 'var(--border-2)' : 'var(--border-1)',
          background: activeEnvironment
            ? 'linear-gradient(180deg, var(--surface-3) 0%, var(--surface-2) 100%)'
            : 'var(--surface-2)',
          color: activeEnvironment ? 'var(--text-primary)' : 'var(--text-muted)',
          fontSize: '11px',
          fontWeight: activeEnvironment ? 600 : 400,
          cursor: 'pointer',
          transition: 'all 0.15s',
          boxShadow: activeEnvironment ? 'inset 0 1px 0 rgba(255,255,255,0.05)' : 'none',
          position: 'relative',
          overflow: 'hidden',
        }}
        title="Select active environment"
      >
        {/* Active indicator dot */}
        <div style={{
          width: '7px',
          height: '7px',
          borderRadius: '50%',
          flexShrink: 0,
          backgroundColor: activeEnvironment
            ? (activeEnvironment.color || 'var(--success)')
            : 'var(--text-muted)',
          opacity: activeEnvironment ? 1 : 0.4,
          boxShadow: activeEnvironment ? `0 0 6px ${activeEnvironment.color || 'var(--success)'}` : 'none',
        }} />

        <span style={{ maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {activeEnvironment ? activeEnvironment.name : 'No Env'}
        </span>

        {activeEnvironment && (
          <span
            onClick={handleClear}
            title="Clear environment"
            style={{ color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center' }}
          >
            <X size={11} />
          </span>
        )}

        <ChevronDown
          size={12}
          style={{
            flexShrink: 0,
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            width: '320px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border-1)',
            borderRadius: '10px',
            boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
            zIndex: 100,
            overflow: 'hidden',
            animation: 'slideUp 0.15s ease',
          }}
        >
          {/* Dropdown Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 14px 8px',
            borderBottom: '1px solid var(--border-1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Layers size={12} style={{ color: 'var(--accent)' }} />
              <span style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)' }}>
                Environments
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (currentProject?._id) fetchEnvironments(currentProject._id, currentTeam?._id, true, true);
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: '10px', fontWeight: 600,
                  color: 'var(--text-muted)',
                  padding: '3px 8px', borderRadius: '5px',
                  background: 'var(--surface-2)', border: '1px solid var(--border-1)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--surface-3)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'var(--surface-2)'; }}
                disabled={isLoading}
                title="Refresh Environments"
              >
                <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => { setOpen(false); useUIStore.getState().openRightSidebarTab('cookies'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: '10px', fontWeight: 600,
                  color: 'var(--text-muted)',
                  padding: '3px 8px', borderRadius: '5px',
                  background: 'var(--surface-2)', border: '1px solid var(--border-1)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                title="Manage Cookies"
              >
                <Cookie size={10} />
                Cookies
              </button>
              <button
                onClick={() => { setOpen(false); useUIStore.getState().openRightSidebarTab('environment'); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '4px',
                  fontSize: '10px', fontWeight: 600,
                  color: 'var(--text-muted)',
                  padding: '3px 8px', borderRadius: '5px',
                  background: 'var(--surface-2)', border: '1px solid var(--border-1)',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
                title="Manage Environments"
              >
                <Settings size={10} />
                Manage
              </button>
            </div>
          </div>

          {/* None option */}
          <button
            onClick={() => { setActiveEnvironment(null); setOpen(false); }}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              width: '100%', padding: '9px 14px',
              background: !activeEnvironment ? 'var(--surface-2)' : 'transparent',
              borderLeft: !activeEnvironment ? '3px solid var(--accent)' : '3px solid transparent',
              color: !activeEnvironment ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '11px', fontWeight: !activeEnvironment ? 600 : 400,
              transition: 'all 0.12s', cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--border-2)', flexShrink: 0 }} />
            None
          </button>

          {environments.length === 0 ? (
            <div style={{ padding: '20px 14px', textAlign: 'center' }}>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>No environments yet</p>
              <button
                onClick={() => { setOpen(false); useUIStore.getState().openRightSidebarTab('environment'); }}
                style={{
                  fontSize: '10px', fontWeight: 600,
                  color: 'var(--accent)', padding: '5px 12px',
                  borderRadius: '6px', border: '1px solid var(--border-1)',
                  background: 'var(--surface-2)', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                }}
              >
                <Plus size={11} /> Create one
              </button>
            </div>
          ) : (
            <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
              {environments.map((env) => {
                const isActive = activeEnvironment?._id === env._id;
                return (
                  <button
                    key={env._id}
                    onClick={() => handleSelect(env)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px',
                      width: '100%', padding: '9px 14px',
                      background: isActive ? 'var(--surface-2)' : 'transparent',
                      borderLeft: isActive ? '3px solid var(--accent)' : '3px solid transparent',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                      fontSize: '11px', fontWeight: isActive ? 600 : 400,
                      transition: 'all 0.12s', cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <div style={{
                      width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
                      backgroundColor: env.color || '#6366f1',
                      boxShadow: isActive ? `0 0 6px ${env.color || '#6366f1'}` : 'none',
                    }} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {env.name}
                    </span>
                    {isActive && <CheckCircle2 size={11} style={{ color: 'var(--success)', flexShrink: 0 }} />}
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>
                      {env.variables?.filter(v => v.enabled !== false).length || 0}v
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Active Variable Preview */}
          {activeVars.length > 0 && (
            <div style={{ borderTop: '1px solid var(--border-1)' }}>
              <button
                onClick={() => setShowVars(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '8px 14px',
                  fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                  color: 'var(--text-muted)', cursor: 'pointer', background: 'transparent',
                }}
              >
                <span>Active Variables ({activeVars.length})</span>
                {showVars ? <EyeOff size={11} /> : <Eye size={11} />}
              </button>

              {showVars && (
                <div style={{ maxHeight: '140px', overflowY: 'auto', padding: '4px 14px 10px' }}>
                  {activeVars.slice(0, 8).map((v, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '4px 0',
                      borderBottom: i < Math.min(activeVars.length, 8) - 1 ? '1px solid var(--border-1)' : 'none',
                    }}>
                      <code style={{ fontSize: '10px', color: 'var(--accent)', fontFamily: 'inherit', flexShrink: 0 }}>
                        {`{{${v.key}}}`}
                      </code>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0 }}>→</span>
                      <span style={{ fontSize: '10px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {v.isSecret ? '••••••••' : v.value || '(empty)'}
                      </span>
                    </div>
                  ))}
                  {activeVars.length > 8 && (
                    <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px', opacity: 0.6 }}>
                      +{activeVars.length - 8} more — open Manage to see all
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
