import { useState, useEffect } from 'react';
import { useEnvironmentStore } from '@/store/environmentStore';
import { useProjectStore } from '@/store/projectStore';
import { useTeamStore } from '@/store/teamStore';
import { useUIStore } from '@/store/uiStore';
import toast from 'react-hot-toast';
import {
  Layers, Plus, Trash2, Copy, Eye, EyeOff,
  CheckCircle2, Save, AlertCircle, ChevronLeft, MoreVertical, X, RefreshCw
} from 'lucide-react';

const ENV_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#f97316'];

export default function EnvironmentPanelContent() {
  const {
    environments, activeEnvironment,
    setActiveEnvironment, fetchEnvironments,
    createEnvironment, updateEnvironment,
    saveVariables, deleteEnvironment,
    duplicateEnvironment, isLoading
  } = useEnvironmentStore();
  const { setShowConfirmDialog } = useUIStore();
  const { projects, currentProject, setCurrentProject } = useProjectStore();
  const { currentTeam } = useTeamStore();

  const [selectedEnvId, setSelectedEnvId] = useState(activeEnvironment?._id || null);
  const [view, setView] = useState('list'); // 'list' | 'detail'
  const [editedVars, setEditedVars] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', description: '', color: '#6366f1' });
  const [isCreating, setIsCreating] = useState(false);
  const [showEnvMenu, setShowEnvMenu] = useState(null);

  const selectedEnv = environments.find((e) => e._id === selectedEnvId);

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
    }
  }, [selectedEnvId, environments]);

  const handleSelectEnv = (env) => {
    if (isDirty && selectedEnvId && selectedEnvId !== env._id) {
      setShowConfirmDialog(true, {
        title: 'Discard Changes?',
        message: 'You have unsaved variable changes in this environment.',
        confirmText: 'Discard',
        danger: true,
        onConfirm: () => {
          setSelectedEnvId(env._id);
          setView('detail');
          setIsDirty(false);
        },
      });
      return;
    }
    setSelectedEnvId(env._id);
    setView('detail');
    setIsDirty(false);
  };

  const handleBackToList = () => {
    if (isDirty) {
      setShowConfirmDialog(true, {
        title: 'Discard Changes?',
        message: 'You have unsaved variable changes. Going back will lose them.',
        confirmText: 'Discard',
        danger: true,
        onConfirm: () => {
          setView('list');
          setIsDirty(false);
        },
      });
      return;
    }
    setView('list');
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

  const handleRename = async (newName) => {
    if (!newName.trim() || newName === selectedEnv.name) return;
    const result = await updateEnvironment(selectedEnvId, { name: newName.trim() });
    if (result.success) { toast.success('Renamed'); }
    else toast.error(result.error);
  };

  const handleDelete = (env) => {
    const target = env || selectedEnv;
    if (!target) return;
    setShowConfirmDialog(true, {
      title: 'Delete Environment?',
      message: 'This will permanently delete the environment and all its variables.',
      itemName: target.name,
      danger: true,
      onConfirm: async () => {
        const result = await deleteEnvironment(target._id);
        if (result.success) {
          if (selectedEnvId === target._id) {
            setSelectedEnvId(null);
            setView('list');
          }
          toast.success(`"${target.name}" deleted`);
        } else {
          toast.error(result.error);
        }
      },
    });
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
  const deleteVar = (i) => {
    const v = editedVars[i];
    const label = v.key?.trim() || `Variable #${i + 1}`;
    setShowConfirmDialog(true, {
      title: 'Delete Variable?',
      message: 'This variable will be removed. Save changes to persist the deletion.',
      itemName: label,
      danger: true,
      onConfirm: () => setVars(editedVars.filter((_, idx) => idx !== i)),
    });
  };

  // VIEW: Environment List
  if (view === 'list' || !selectedEnv) {
    return (
      <div className="flex flex-col h-full bg-[color:var(--bg-secondary)]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--border-1)] bg-[color:var(--bg-primary)]">
          <div className="flex items-center gap-2">
            <Layers size={16} className="text-[color:var(--accent)]" />
            <span className="text-xs font-semibold text-[color:var(--text-primary)]">Environments</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[color:var(--surface-2)] text-[color:var(--text-muted)]">
              {environments.length}
            </span>
          </div>
          {currentProject && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => fetchEnvironments(currentProject._id, currentTeam?._id, true, true)}
                disabled={isLoading}
                className="p-1.5 rounded-md hover:bg-[color:var(--surface-2)] text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] transition-colors disabled:opacity-50"
                title="Refresh Environments"
              >
                <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="p-1.5 rounded-md hover:bg-[color:var(--surface-2)] text-[color:var(--text-muted)] hover:text-[color:var(--accent)] transition-colors"
                title="New Environment"
              >
                <Plus size={16} />
              </button>
            </div>
          )}
        </div>

        {/* Create Form */}
        {showCreate && (
          <div className="p-3 border-b border-[color:var(--border-1)] bg-[color:var(--surface-1)]">
            <form onSubmit={handleCreate} className="flex flex-col gap-2">
              <input
                autoFocus
                className="input py-1.5 text-xs"
                placeholder="Environment name"
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                required
              />
              <div className="flex items-center justify-between">
                <div className="flex gap-1">
                  {ENV_COLORS.slice(0, 6).map((c) => (
                    <button
                      key={c} type="button"
                      onClick={() => setCreateForm({ ...createForm, color: c })}
                      className="w-4 h-4 rounded-full transition-all"
                      style={{ backgroundColor: c, outline: createForm.color === c ? `2px solid white` : 'none', outlineOffset: '1px' }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setShowCreate(false)} className="text-[10px] px-2 py-1 text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)]">
                    Cancel
                  </button>
                  <button type="submit" className="btn-primary text-[10px] py-1 px-3" disabled={isCreating}>
                    {isCreating ? '...' : 'Create'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Environment List */}
        <div className="flex-1 overflow-y-auto">
          {environments.map((env) => {
            const isActive = activeEnvironment?._id === env._id;
            return (
              <div
                key={env._id}
                onClick={() => handleSelectEnv(env)}
                className="group flex items-center gap-3 px-4 py-3 border-b border-[color:var(--border-1)] hover:bg-[color:var(--surface-1)] cursor-pointer transition-colors"
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: env.color || '#6366f1', boxShadow: isActive ? `0 0 8px ${env.color || '#6366f1'}` : 'none' }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[color:var(--text-primary)] truncate">{env.name}</span>
                    {isActive && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
                        Active
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-[color:var(--text-muted)]">
                    {env.variables?.filter(v => v.enabled).length || 0} variables
                  </span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleActivate(env); }}
                    className="p-1.5 rounded hover:bg-[color:var(--surface-2)] text-[color:var(--text-muted)] hover:text-green-500"
                    title="Set Active"
                  >
                    <CheckCircle2 size={14} />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowEnvMenu(showEnvMenu === env._id ? null : env._id); }}
                    className="p-1.5 rounded hover:bg-[color:var(--surface-2)] text-[color:var(--text-muted)]"
                  >
                    <MoreVertical size={14} />
                  </button>
                </div>

                {/* Dropdown Menu */}
                {showEnvMenu === env._id && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowEnvMenu(null)} />
                    <div className="absolute right-4 top-10 z-50 w-32 py-1 rounded-lg bg-[color:var(--bg-primary)] border border-[color:var(--border-1)] shadow-lg">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDuplicate(); setShowEnvMenu(null); }}
                        className="w-full px-3 py-1.5 text-left text-xs text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-2)] flex items-center gap-2"
                      >
                        <Copy size={12} /> Duplicate
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(env); setShowEnvMenu(null); }}
                        className="w-full px-3 py-1.5 text-left text-xs text-red-500 hover:bg-[color:var(--surface-2)] flex items-center gap-2"
                      >
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            );
          })}

          {environments.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <Layers size={40} className="text-[color:var(--text-muted)] opacity-20 mb-4" />
              <p className="text-sm text-[color:var(--text-muted)] mb-2">No environments yet</p>
              <p className="text-xs text-[color:var(--text-muted)] opacity-70">
                {currentProject ? 'Click + to create your first environment' : 'Select a project to create environments'}
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // VIEW: Environment Detail (Variables Editor)
  return (
    <div className="flex flex-col h-full bg-[color:var(--bg-secondary)]">
      {/* Header with back button */}
      <div className="flex items-center gap-3 px-3 py-2.5 border-b border-[color:var(--border-1)] bg-[color:var(--bg-primary)]">
        <button
          onClick={handleBackToList}
          className="p-1 rounded hover:bg-[color:var(--surface-2)] text-[color:var(--text-muted)] transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: selectedEnv.color || '#6366f1' }} />
          <span className="text-sm font-semibold text-[color:var(--text-primary)] truncate">{selectedEnv.name}</span>
          {activeEnvironment?._id === selectedEnvId && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20 flex-shrink-0">
              Active
            </span>
          )}
        </div>
        {isDirty && (
          <div className="flex items-center gap-1 text-[10px] text-[color:var(--warning)]">
            <AlertCircle size={12} /> Unsaved
          </div>
        )}
      </div>

      {/* Variables List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {editedVars.map((v, i) => (
          <div
            key={i}
            className="rounded-lg border border-[color:var(--border-1)] bg-[color:var(--surface-2)] p-3 space-y-2"
            style={{ opacity: v.enabled !== false ? 1 : 0.5 }}
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={v.enabled !== false}
                onChange={(e) => updateVar(i, { ...v, enabled: e.target.checked })}
                className="w-4 h-4"
                style={{ accentColor: 'var(--accent)' }}
              />
              <input
                type="text"
                placeholder="VARIABLE_KEY"
                value={v.key}
                onChange={(e) => updateVar(i, { ...v, key: e.target.value })}
                className="flex-1 input py-1 text-xs font-mono font-medium"
                autoCapitalize="off" autoCorrect="off" spellCheck={false}
              />
              <button
                onClick={() => deleteVar(i)}
                className="p-1.5 rounded hover:bg-[color:var(--surface-3)] text-[color:var(--text-muted)] hover:text-red-500 transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <div className="flex items-center gap-2 pl-6">
              <input
                type={v.isSecret ? 'password' : 'text'}
                placeholder={v.isSecret ? '••••••••' : 'value'}
                value={v.value}
                onChange={(e) => updateVar(i, { ...v, value: e.target.value })}
                className="flex-1 input py-1 text-xs font-mono"
                autoCapitalize="off" autoCorrect="off" spellCheck={false}
              />
              <button
                onClick={() => updateVar(i, { ...v, isSecret: !v.isSecret })}
                className={`p-1.5 rounded transition-colors ${v.isSecret ? 'text-[color:var(--warning)] bg-[color:var(--warning)]/10' : 'text-[color:var(--text-muted)] hover:bg-[color:var(--surface-3)]'}`}
                title={v.isSecret ? 'Secret' : 'Make secret'}
              >
                {v.isSecret ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
        ))}

        {editedVars.length === 0 && (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Layers size={32} className="text-[color:var(--text-muted)] opacity-20 mb-3" />
            <p className="text-xs text-[color:var(--text-muted)] mb-1">No variables defined</p>
            <p className="text-[10px] text-[color:var(--text-muted)] opacity-60">
              Use {'{{variable_name}}'} in your requests
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-3 border-t border-[color:var(--border-1)] bg-[color:var(--bg-primary)]">
        <button
          onClick={addVar}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-dashed border-[color:var(--border-2)] text-[color:var(--text-muted)] hover:text-[color:var(--text-primary)] hover:border-[color:var(--text-muted)] transition-colors text-xs"
        >
          <Plus size={14} /> Add Variable
        </button>
        <button
          onClick={handleSaveVars}
          disabled={isSaving || !isDirty}
          className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5"
          style={{ opacity: (!isDirty || isSaving) ? 0.4 : 1 }}
        >
          <Save size={14} />
          {isSaving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
