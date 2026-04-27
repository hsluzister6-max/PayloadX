import { useState, useEffect } from 'react';
import { useEnvironmentStore } from '@/store/environmentStore';
import { useProjectStore } from '@/store/projectStore';
import { useTeamStore } from '@/store/teamStore';
import { useUIStore } from '@/store/uiStore';
import toast from 'react-hot-toast';
import {
  Layers, X, Plus, Trash2, Copy, Eye, EyeOff,
  CheckCircle2, Lock, ChevronRight, Save, AlertCircle
} from 'lucide-react';

const ENV_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#f97316'];

export default function EnvironmentPanel() {
  const {
    environments, activeEnvironment,
    setActiveEnvironment, fetchEnvironments,
    createEnvironment, updateEnvironment,
    saveVariables, deleteEnvironment,
    duplicateEnvironment,
  } = useEnvironmentStore();
  const { projects, currentProject, setCurrentProject } = useProjectStore();
  const { currentTeam } = useTeamStore();
  const { setShowEnvironmentPanel } = useUIStore();

  const [selectedEnvId, setSelectedEnvId] = useState(activeEnvironment?._id || null);
  const [editedVars, setEditedVars] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', color: '#6366f1' });
  const [isCreating, setIsCreating] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [visible, setVisible] = useState(false);

  const selectedEnv = environments.find((e) => e._id === selectedEnvId);

  // Animate in
  useEffect(() => {
    const t = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(t);
  }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => setShowEnvironmentPanel(false), 300);
  };

  useEffect(() => {
    if (!currentProject && projects.length > 0) setCurrentProject(projects[0]);
  }, [projects]);

  useEffect(() => {
    if (currentProject?._id) fetchEnvironments(currentProject._id, currentTeam?._id, true);
  }, [currentProject?._id]);

  useEffect(() => {
    if (selectedEnv) {
      setEditedVars(JSON.parse(JSON.stringify(selectedEnv.variables || [])));
      setIsDirty(false);
      setNewName(selectedEnv.name);
    }
  }, [selectedEnvId, environments]);

  const handleSelectEnv = (env) => {
    if (isDirty && selectedEnvId) {
      if (!window.confirm('You have unsaved changes. Discard?')) return;
    }
    setSelectedEnvId(env._id);
    setIsDirty(false);
  };

  const handleActivate = (env) => {
    setActiveEnvironment(env);
    toast.success(`Active: ${env.name}`);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!createForm.name.trim() || !currentProject || !currentTeam) return;
    setIsCreating(true);
    const result = await createEnvironment(
      createForm.name.trim(),
      currentProject._id,
      currentTeam._id,
      { description: createForm.description, color: createForm.color }
    );
    setIsCreating(false);
    if (result.success) {
      setShowCreate(false);
      setCreateForm({ name: '', description: '', color: '#6366f1' });
      setSelectedEnvId(result.environment._id);
      toast.success(`"${result.environment.name}" created`);
    } else {
      toast.error(result.error);
    }
  };

  const handleSaveVars = async () => {
    if (!selectedEnvId) return;
    setIsSaving(true);
    const result = await saveVariables(selectedEnvId, editedVars);
    setIsSaving(false);
    if (result.success) { setIsDirty(false); toast.success('Variables saved'); }
    else toast.error(result.error);
  };

  const handleRename = async () => {
    if (!newName.trim() || newName === selectedEnv.name) { setEditingName(false); return; }
    const result = await updateEnvironment(selectedEnvId, { name: newName.trim() });
    if (result.success) { toast.success('Renamed'); setEditingName(false); }
    else toast.error(result.error);
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete "${selectedEnv.name}"? This cannot be undone.`)) return;
    const result = await deleteEnvironment(selectedEnvId);
    if (result.success) { setSelectedEnvId(null); toast.success('Deleted'); }
    else toast.error(result.error);
  };

  const handleDuplicate = async () => {
    const result = await duplicateEnvironment(selectedEnvId);
    if (result.success) {
      setSelectedEnvId(result.environment._id);
      toast.success(`Duplicated as "${result.environment.name}"`);
    } else toast.error(result.error);
  };

  const setVars = (vars) => { setEditedVars(vars); setIsDirty(true); };
  const addVar = () => setVars([...editedVars, { key: '', value: '', description: '', isSecret: false, enabled: true }]);
  const updateVar = (i, upd) => setVars(editedVars.map((v, idx) => (idx === i ? upd : v)));
  const deleteVar = (i) => setVars(editedVars.filter((_, idx) => idx !== i));

  return (
    <>
      {/* Dim backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{
          background: visible ? 'rgba(0,0,0,0.4)' : 'transparent',
          transition: 'background 0.3s ease',
          backdropFilter: visible ? 'blur(4px)' : 'none',
        }}
        onClick={handleClose}
      />

      {/* Right-side Drawer */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col"
        style={{
          width: '680px',
          background: 'var(--bg-secondary)',
          borderLeft: '1px solid var(--border-1)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          fontFamily: "'DM Mono', monospace",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-primary)' }}>
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg"
              style={{ background: 'linear-gradient(135deg, var(--surface-2), var(--surface-3))', border: '1px solid var(--border-1)' }}>
              <Layers size={16} style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h2 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 900, fontSize: '14px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Environments
              </h2>
              <p style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '1px' }}>
                {currentProject?.name || 'No project selected'}
              </p>
            </div>
          </div>
          <button onClick={handleClose}
            style={{ color: 'var(--text-muted)', padding: '6px', borderRadius: '6px', background: 'var(--surface-2)', border: '1px solid var(--border-1)' }}
            className="hover:text-[var(--text-primary)] transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Body — split layout */}
        <div className="flex flex-1 overflow-hidden">

          {/* Left: Env List */}
          <div className="flex flex-col flex-shrink-0 overflow-hidden"
            style={{ width: '200px', borderRight: '1px solid var(--border-1)', background: 'var(--bg-primary)' }}>

            <div className="px-4 py-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border-1)' }}>
              <p style={{ fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-muted)' }}>
                Environments
              </p>
            </div>

            <div className="flex-1 overflow-y-auto py-2">
              {environments.map((env) => {
                const isSelected = selectedEnvId === env._id;
                const isActive = activeEnvironment?._id === env._id;
                return (
                  <button
                    key={env._id}
                    onClick={() => handleSelectEnv(env)}
                    className="w-full text-left transition-all group"
                    style={{
                      padding: '10px 16px',
                      background: isSelected ? 'var(--surface-2)' : 'transparent',
                      borderLeft: isSelected ? '3px solid var(--accent)' : '3px solid transparent',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: env.color || '#6366f1', boxShadow: isActive ? `0 0 6px ${env.color || '#6366f1'}` : 'none' }} />
                      <span className="truncate" style={{ fontSize: '11px', fontWeight: isSelected ? 700 : 400, color: isSelected ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {env.name}
                      </span>
                      {isActive && (
                        <CheckCircle2 size={10} className="flex-shrink-0" style={{ color: 'var(--success)' }} />
                      )}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', paddingLeft: '16px' }}>
                      {env.variables?.filter(v => v.enabled).length || 0} vars
                    </div>
                  </button>
                );
              })}

              {environments.length === 0 && (
                <div className="text-center py-8 px-4">
                  <Layers size={24} style={{ color: 'var(--text-muted)', opacity: 0.3, margin: '0 auto 8px' }} />
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>No environments yet</p>
                </div>
              )}
            </div>

            {/* New Env Form / Button */}
            <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid var(--border-1)' }}>
              {showCreate ? (
                <form onSubmit={handleCreate} className="flex flex-col gap-2">
                  <input
                    autoFocus
                    className="input py-1.5 text-xs"
                    placeholder="Environment name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    required
                  />
                  <div className="flex gap-1 flex-wrap">
                    {ENV_COLORS.map((c) => (
                      <button
                        key={c} type="button"
                        onClick={() => setCreateForm({ ...createForm, color: c })}
                        className="w-4 h-4 rounded-full transition-all"
                        style={{ backgroundColor: c, outline: createForm.color === c ? `2px solid white` : 'none', outlineOffset: '1px' }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <button type="submit" className="btn-primary text-[10px] py-1 flex-1" disabled={isCreating}>
                      {isCreating ? '...' : 'Create'}
                    </button>
                    <button type="button" onClick={() => setShowCreate(false)} className="btn-ghost text-[10px] py-1 flex-1">
                      Cancel
                    </button>
                  </div>
                </form>
              ) : currentProject ? (
                <button
                  onClick={() => setShowCreate(true)}
                  className="w-full flex items-center justify-center gap-1.5 transition-all"
                  style={{
                    padding: '8px',
                    borderRadius: '6px',
                    border: '1px dashed var(--border-2)',
                    color: 'var(--text-muted)',
                    fontSize: '11px',
                  }}
                >
                  <Plus size={12} />
                  New Environment
                </button>
              ) : (
                <p style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'center', lineHeight: 1.4 }}>
                  Select a project to create environments
                </p>
              )}
            </div>
          </div>

          {/* Right: Variable Editor */}
          {selectedEnv ? (
            <div className="flex-1 flex flex-col overflow-hidden">

              {/* Env Header */}
              <div className="flex items-center justify-between px-5 py-3 flex-shrink-0"
                style={{ borderBottom: '1px solid var(--border-1)', background: 'var(--bg-secondary)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedEnv.color || '#6366f1' }} />
                  {editingName ? (
                    <input
                      autoFocus
                      className="input py-0.5 text-sm font-bold"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onBlur={handleRename}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') setEditingName(false); }}
                    />
                  ) : (
                    <button
                      onDoubleClick={() => setEditingName(true)}
                      style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '13px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}
                      title="Double-click to rename"
                    >
                      {selectedEnv.name}
                    </button>
                  )}
                  {activeEnvironment?._id === selectedEnvId && (
                    <span style={{ fontSize: '8px', background: 'rgba(62,210,120,0.15)', color: 'var(--success)', padding: '2px 8px', borderRadius: '20px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', border: '1px solid rgba(62,210,120,0.2)' }}>
                      Active
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {activeEnvironment?._id !== selectedEnvId && (
                    <button
                      onClick={() => handleActivate(selectedEnv)}
                      className="flex items-center gap-1.5 transition-all"
                      style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--success)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(62,210,120,0.2)', background: 'rgba(62,210,120,0.05)' }}
                    >
                      <CheckCircle2 size={12} /> Set Active
                    </button>
                  )}
                  <button onClick={handleDuplicate}
                    className="flex items-center gap-1.5 transition-all"
                    style={{ fontSize: '10px', fontWeight: 600, color: 'var(--text-muted)', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border-1)', background: 'var(--surface-2)' }}
                    title="Duplicate">
                    <Copy size={12} /> Clone
                  </button>
                  <button onClick={handleDelete}
                    className="flex items-center gap-1.5 transition-all"
                    style={{ fontSize: '10px', fontWeight: 600, color: 'var(--error)', padding: '4px 10px', borderRadius: '6px', border: '1px solid rgba(255,80,80,0.2)', background: 'rgba(255,80,80,0.05)' }}>
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>

              {/* Variables Table */}
              <div className="flex-1 overflow-y-auto">
                {/* Column Labels */}
                <div className="grid items-center px-5 py-2 flex-shrink-0 sticky top-0"
                  style={{
                    gridTemplateColumns: '28px 1fr 1fr 36px 30px',
                    gap: '8px',
                    fontSize: '9px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em',
                    color: 'var(--text-muted)',
                    borderBottom: '1px solid var(--border-1)',
                    background: 'var(--bg-primary)',
                  }}>
                  <span>On</span>
                  <span>Key</span>
                  <span>Value</span>
                  <span className="text-center">Secret</span>
                  <span />
                </div>

                <div className="px-4 py-3 space-y-2">
                  {editedVars.map((v, i) => (
                    <div
                      key={i}
                      className="grid items-center group"
                      style={{
                        gridTemplateColumns: '28px 1fr 1fr 36px 30px',
                        gap: '8px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        background: v.enabled !== false ? 'var(--surface-2)' : 'transparent',
                        border: '1px solid',
                        borderColor: v.enabled !== false ? 'var(--border-1)' : 'transparent',
                        opacity: v.enabled !== false ? 1 : 0.4,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={v.enabled !== false}
                        onChange={(e) => updateVar(i, { ...v, enabled: e.target.checked })}
                        className="w-3.5 h-3.5"
                        style={{ accentColor: 'var(--accent)' }}
                      />
                      <input
                        type="text"
                        placeholder="variable_key"
                        value={v.key}
                        onChange={(e) => updateVar(i, { ...v, key: e.target.value })}
                        className="input py-1 text-xs font-mono"
                        autoCapitalize="off" autoCorrect="off" spellCheck={false}
                      />
                      <input
                        type={v.isSecret ? 'password' : 'text'}
                        placeholder={v.isSecret ? '••••••••' : 'value'}
                        value={v.value}
                        onChange={(e) => updateVar(i, { ...v, value: e.target.value })}
                        className="input py-1 text-xs font-mono"
                        autoCapitalize="off" autoCorrect="off" spellCheck={false}
                      />
                      <button
                        onClick={() => updateVar(i, { ...v, isSecret: !v.isSecret })}
                        className="flex items-center justify-center transition-all rounded-lg"
                        style={{
                          padding: '4px',
                          color: v.isSecret ? 'var(--warning)' : 'var(--text-muted)',
                          background: v.isSecret ? 'rgba(210,153,34,0.1)' : 'transparent',
                          border: `1px solid ${v.isSecret ? 'rgba(210,153,34,0.3)' : 'var(--border-1)'}`,
                        }}
                        title={v.isSecret ? 'Secret — click to reveal' : 'Mark as secret'}
                      >
                        {v.isSecret ? <EyeOff size={12} /> : <Eye size={12} />}
                      </button>
                      <button
                        onClick={() => deleteVar(i)}
                        className="flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"
                        style={{ color: 'var(--text-muted)', padding: '4px' }}
                      >
                        <Trash2 size={12} className="hover:text-red-400" />
                      </button>
                    </div>
                  ))}

                  {editedVars.length === 0 && (
                    <div className="text-center py-16">
                      <Layers size={32} style={{ color: 'var(--text-muted)', opacity: 0.2, margin: '0 auto 12px' }} />
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>No variables defined</p>
                      <p style={{ fontSize: '10px', color: 'var(--text-muted)', opacity: 0.6 }}>
                        Use <code style={{ background: 'var(--surface-2)', padding: '1px 6px', borderRadius: '4px', color: 'var(--accent)' }}>{'{{variable_name}}'}</code> in your requests
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-5 py-4 flex-shrink-0"
                style={{ borderTop: '1px solid var(--border-1)', background: 'var(--bg-primary)' }}>
                <button
                  onClick={addVar}
                  className="flex items-center gap-1.5 transition-all"
                  style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', padding: '6px 12px', borderRadius: '6px', border: '1px dashed var(--border-2)' }}
                >
                  <Plus size={13} /> Add Variable
                </button>
                <div className="flex items-center gap-3">
                  {isDirty && (
                    <div className="flex items-center gap-1.5" style={{ fontSize: '10px', color: 'var(--warning)' }}>
                      <AlertCircle size={12} /> Unsaved changes
                    </div>
                  )}
                  <button
                    onClick={handleSaveVars}
                    disabled={isSaving || !isDirty}
                    className="btn-primary flex items-center gap-2"
                    style={{ opacity: (!isDirty || isSaving) ? 0.4 : 1 }}
                  >
                    <Save size={13} />
                    {isSaving ? 'Saving…' : 'Save Variables'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <Layers size={40} style={{ color: 'var(--text-muted)', opacity: 0.15, marginBottom: '16px' }} />
              <h3 style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: '14px', color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                {environments.length === 0 ? 'No Environments' : 'Select Environment'}
              </h3>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)', maxWidth: '240px', lineHeight: 1.6 }}>
                {environments.length === 0
                  ? 'Create an environment to start defining variables for your requests.'
                  : 'Pick an environment from the list to manage its variables.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
