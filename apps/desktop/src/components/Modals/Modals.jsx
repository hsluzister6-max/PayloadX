import { useState, useEffect, useRef } from 'react';
import { useTeamStore } from '@/store/teamStore';
import { useProjectStore } from '@/store/projectStore';
import { useCollectionStore } from '@/store/collectionStore';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useSocketStore } from '@/store/socketStore';
import { useConnectivityStore } from '@/store/connectivityStore';
import PayloadX from '@/components/core/logo';
import toast from 'react-hot-toast';

export default function CreateTeamModal() {
  const { createTeam, setCurrentTeam } = useTeamStore();
  const { setCurrentProject } = useProjectStore();
  const { setCurrentCollection } = useCollectionStore();
  const { setShowTeamModal } = useUIStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { hasInternet, isBackendReachable } = useConnectivityStore();
  const isOffline = !hasInternet || !isBackendReachable;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim() || isOffline) return;
    setLoading(true);
    const result = await createTeam(name.trim(), description.trim());
    setLoading(false);
    if (result.success) {
      setCurrentTeam(result.team);
      setCurrentProject(null);
      setCurrentCollection(null);
      toast.success(`Team "${result.team.name}" created!`);
      setShowTeamModal(false);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <ModalWrapper onClose={() => setShowTeamModal(false)} title="Create Team">
      <form onSubmit={handleCreate} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-semibold text-surface-400 mb-1.5">Team Name</label>
          <input className="input" placeholder="e.g., Backend Squad" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="block text-xs font-semibold text-surface-400 mb-1.5">Description (optional)</label>
          <input className="input" placeholder="What does this team work on?" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={() => setShowTeamModal(false)} className="btn-ghost flex-1">Cancel</button>
          <button type="submit" className="btn-primary flex-1" disabled={loading || isOffline} title={isOffline ? 'You are offline' : ''}>
            {loading ? 'Creating...' : isOffline ? 'Offline' : 'Create Team'}
          </button>
        </div>
      </form>

    </ModalWrapper>
  );
}

export function CreateProjectModal() {
  const { createProject } = useProjectStore();
  const { currentTeam } = useTeamStore();
  const { setShowProjectModal } = useUIStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [loading, setLoading] = useState(false);
  const { hasInternet, isBackendReachable } = useConnectivityStore();
  const isOffline = !hasInternet || !isBackendReachable;

  const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#f97316'];

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim() || !currentTeam || isOffline) return;
    setLoading(true);
    const result = await createProject(name.trim(), currentTeam._id, description.trim(), color);
    setLoading(false);
    if (result.success) {
      toast.success(`Project "${result.project.name}" created!`);
      setShowProjectModal(false);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <ModalWrapper onClose={() => setShowProjectModal(false)} title="Create Project">
      <form onSubmit={handleCreate} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-semibold text-surface-400 mb-1.5">Project Name</label>
          <input className="input" placeholder="e.g., Payment API" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="block text-xs font-semibold text-surface-400 mb-1.5">Description</label>
          <input className="input" placeholder="Optional description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-surface-400 mb-1.5">Color</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c} type="button"
                onClick={() => setColor(c)}
                className={`w-6 h-6 rounded-full transition-all ${color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-surface-850 scale-110' : 'hover:scale-105'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={() => setShowProjectModal(false)} className="btn-ghost flex-1">Cancel</button>
          <button type="submit" className="btn-primary flex-1" disabled={loading || !currentTeam || isOffline} title={isOffline ? 'You are offline' : ''}>
            {loading ? 'Creating...' : isOffline ? 'Offline' : 'Create Project'}
          </button>
        </div>

      </form>
    </ModalWrapper>
  );
}

export function CreateCollectionModal() {
  const { createCollection } = useCollectionStore();
  const { currentProject } = useProjectStore();
  const { currentTeam } = useTeamStore();
  const { setShowCollectionModal } = useUIStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const { hasInternet, isBackendReachable } = useConnectivityStore();
  const isOffline = !hasInternet || !isBackendReachable;

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim() || !currentProject || !currentTeam || isOffline) return;
    setLoading(true);
    const result = await createCollection(name.trim(), currentProject._id, currentTeam._id, description.trim());
    setLoading(false);
    if (result.success) {
      toast.success(`Collection "${result.collection.name}" created!`);
      setShowCollectionModal(false);
    } else {
      toast.error(result.error);
    }
  };

  return (
    <ModalWrapper onClose={() => setShowCollectionModal(false)} title="Create Collection">
      <form onSubmit={handleCreate} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-semibold text-surface-400 mb-1.5">Collection Name</label>
          <input className="input" placeholder="e.g., User Management APIs" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="block text-xs font-semibold text-surface-400 mb-1.5">Description</label>
          <input className="input" placeholder="Optional" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        {!currentProject && (
          <p className="text-warning text-xs bg-warning/10 border border-warning/30 rounded-xl px-3 py-2">
            ⚠️ Select a project first
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={() => setShowCollectionModal(false)} className="btn-ghost flex-1">Cancel</button>
          <button type="submit" className="btn-primary flex-1" disabled={loading || !currentProject || isOffline} title={isOffline ? 'You are offline' : ''}>
            {loading ? 'Creating...' : isOffline ? 'Offline' : 'Create Collection'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

export function CreateFolderModal() {
  const { createFolder, updateFolder } = useCollectionStore();
  const { setShowFolderModal, folderModalData } = useUIStore();
  const [name, setName] = useState(folderModalData?.name || '');
  const [loading, setLoading] = useState(false);
  const { hasInternet, isBackendReachable } = useConnectivityStore();
  const isOffline = !hasInternet || !isBackendReachable;

  const isEdit = !!folderModalData?.folderId;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || isOffline) return;
    setLoading(true);
    
    let result;
    if (isEdit) {
      result = await updateFolder(folderModalData.collectionId, folderModalData.folderId, name.trim());
    } else {
      result = await createFolder(folderModalData.collectionId, name.trim(), '', folderModalData.parentId);
    }
    
    setLoading(false);
    if (result.success) {
      setShowFolderModal(false);
    }
  };

  return (
    <ModalWrapper onClose={() => setShowFolderModal(false)} title={isEdit ? 'Rename Folder' : 'New Folder'}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-xs font-semibold text-surface-400 mb-1.5">Folder Name</label>
          <input className="input" placeholder="e.g., Auth APIs" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={() => setShowFolderModal(false)} className="btn-ghost flex-1">Cancel</button>
          <button type="submit" className="btn-primary flex-1" disabled={loading || isOffline} title={isOffline ? 'You are offline' : ''}>
            {loading ? 'Saving...' : isOffline ? 'Offline' : isEdit ? 'Rename' : 'Create Folder'}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}

export function InviteModal() {
  const { currentTeam, inviteMember, removeMember, fetchTeamDetails } = useTeamStore();
  const { user } = useAuthStore();
  const { setShowInviteModal } = useUIStore();
  const { roomMembers } = useSocketStore();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('developer');
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(null); // userId being removed
  const [confirmRemove, setConfirmRemove] = useState(null); // userId pending confirm
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const roleDropdownRef = useRef(null);

  const ROLES = [
    { id: 'admin', label: 'Admin', icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-7.618 3.04c0 4.805 1.54 8.358 3.618 10.914a11.955 11.955 0 014.0 2.102c1.398-.626 2.67-1.356 3.618-2.102 2.078-2.556 3.618-6.109 3.618-10.914z" /></svg> },
    { id: 'developer', label: 'Developer', icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg> },
    { id: 'viewer', label: 'Viewer', icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> },
  ];

  // Click outside to close dropdown
  useEffect(() => {
    const handleClick = (e) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target)) {
        setShowRoleDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Load fully-populated member list when modal opens
  useEffect(() => {
    if (currentTeam?._id) {
      fetchTeamDetails(currentTeam._id);
    }
  }, [currentTeam?._id]);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!email.trim() || !currentTeam) return;
    setLoading(true);
    const result = await inviteMember(currentTeam._id, email.trim(), role);
    setLoading(false);
    if (result.success) {
      toast.success(`${email} added to team!`);
      setEmail('');
    } else {
      toast.error(result.error);
    }
  };

  const handleRemove = async (userId) => {
    setRemoving(userId);
    const result = await removeMember(currentTeam._id, userId);
    setRemoving(null);
    setConfirmRemove(null);
    if (result.success) {
      toast.success('Member removed from team');
    } else {
      toast.error(result.error);
    }
  };

  const isOwner = currentTeam?.ownerId?._id === user?._id ||
    currentTeam?.ownerId === user?._id;
  const isAdmin = isOwner || currentTeam?.members?.some(
    (m) => (m.userId?._id || m.userId) === user?._id && m.role === 'admin'
  );

  const ROLE_COLORS = {
    admin: 'bg-brand-500/10 text-brand-300 border border-brand-500/20',
    developer: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    viewer: 'bg-surface-600/10 text-surface-400 border border-surface-600/20',
  };

  return (
    <ModalWrapper onClose={() => setShowInviteModal(false)} title="Team Members" wide showLogo>
      <div className="flex flex-col md:flex-row gap-8">
        {/* Left side: Member list */}
        <div className="flex-1 flex flex-col gap-4">

          {/* ── Current members list ── */}
          {currentTeam && (
            <div className="flex flex-col gap-2">
              <span className="text-[10px] text-surface-500 uppercase tracking-widest font-bold mb-1 px-1">
                {(currentTeam.members?.length || 0) + 1} member{(currentTeam.members?.length || 0) !== 0 ? 's' : ''}
              </span>

              <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1 custom-scrollbar">
                {/* Owner row */}
                {currentTeam.ownerId && (
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border-1)] relative overflow-hidden group transition-all hover:border-[var(--border-2)] hover:bg-[var(--surface-3)]">
                    {/* Subtle inner glow for owner */}
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-tx-primary text-sm font-bold flex-shrink-0 border border-[var(--border-2)] shadow-inner bg-gradient-to-br from-[var(--surface-3)] to-[var(--surface-1)]"
                    >
                      {(currentTeam.ownerId?.name || currentTeam.ownerId)?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-[13px] font-semibold text-tx-primary truncate">
                          {currentTeam.ownerId?.name || 'Owner'}
                        </p>
                        {(currentTeam.ownerId?._id || currentTeam.ownerId) === user?._id && (
                          <span className="text-[10px] text-surface-500 font-medium px-1.5 py-0.5 rounded-md bg-surface-800/50">you</span>
                        )}
                        {roomMembers.some(rm => (rm._id === (currentTeam.ownerId?._id || currentTeam.ownerId) || rm.id === (currentTeam.ownerId?._id || currentTeam.ownerId))) && (
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-surface-500 truncate font-mono opacity-80">{currentTeam.ownerId?.email || ''}</p>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md metallic-app-name !animate-none border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.1)]">
                      owner
                    </span>
                  </div>
                )}

                {/* Member rows */}
                {currentTeam.members?.map((m) => {
                  const memberId = m.userId?._id || m.userId;
                  const isYou = memberId === user?._id;
                  const memberName = m.userId?.name || 'Member';
                  const memberEmail = m.userId?.email || '';

                  return (
                    <div key={memberId} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-[var(--surface-1)] border border-[var(--border-1)] group transition-all hover:border-[var(--border-2)] hover:bg-[var(--surface-2)]">
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-tx-primary text-sm font-bold flex-shrink-0 border border-[var(--border-1)] bg-gradient-to-br from-[var(--surface-2)] to-[var(--bg-primary)]"
                      >
                        {memberName[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-[13px] font-semibold text-tx-primary truncate">
                            {memberName}
                          </p>
                          {isYou && <span className="text-[10px] text-surface-500 font-medium px-1.5 py-0.5 rounded-md bg-surface-800/50">you</span>}
                          {roomMembers.some(rm => (rm._id === memberId || rm.id === memberId)) && (
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-surface-500 truncate font-mono opacity-70">{memberEmail}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-medium flex-shrink-0 ${ROLE_COLORS[m.role] || ROLE_COLORS.viewer}`}>
                        {m.role}
                      </span>

                      {isAdmin && !isYou && (
                        confirmRemove === memberId ? (
                          <div className="flex gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => handleRemove(memberId)}
                              disabled={removing === memberId}
                              className="text-[10px] px-2 py-1 rounded-lg bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 transition-colors font-bold"
                            >
                              {removing === memberId ? '...' : 'YES'}
                            </button>
                            <button
                              onClick={() => setConfirmRemove(null)}
                              className="text-[10px] px-2 py-1 rounded-lg bg-surface-700/50 text-surface-400 hover:bg-surface-600 transition-colors font-bold"
                            >
                              NO
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmRemove(memberId)}
                            className="flex-shrink-0 text-tx-muted hover:text-danger transition-colors p-1.5 rounded-lg hover:bg-danger/10"
                            title="Remove member"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                            </svg>
                          </button>
                        )
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right side: Actions & Stats */}
        <div className="w-full md:w-[280px] flex flex-col gap-6">
          {/* ── Add member form ── */}
          {isAdmin ? (
            <form onSubmit={handleInvite} className="flex flex-col gap-3 mt-2">
              <span className="text-[10px] text-surface-500 uppercase tracking-widest font-bold px-1">Add member by email</span>
              <div className="flex flex-col gap-2.5">
                <input
                  className="input !h-10 text-[13px]"
                  type="email"
                  placeholder="colleague@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus
                />
                <div className="flex gap-2">
                  <div className="relative flex-1" ref={roleDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                      className="input !h-10 text-[12px] bg-[var(--surface-1)] flex items-center justify-between group px-4 border-[var(--border-2)] hover:border-[var(--accent)] transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-surface-500 group-hover:text-tx-primary transition-colors">
                          {ROLES.find(r => r.id === role)?.icon}
                        </span>
                        <span className="text-tx-primary font-bold">
                          {ROLES.find(r => r.id === role)?.label}
                        </span>
                      </div>
                      <svg className={`w-4 h-4 text-surface-500 transition-transform duration-300 ${showRoleDropdown ? 'rotate-180 text-[color:var(--accent)]' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {showRoleDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-[var(--surface-2)] border border-[var(--border-2)] rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.7)] z-[60] overflow-hidden animate-in">
                        {ROLES.map((r) => {
                          const isActive = role === r.id;
                          return (
                            <button
                              key={r.id}
                              type="button"
                              onClick={() => {
                                setRole(r.id);
                                setShowRoleDropdown(false);
                              }}
                              className={`w-full px-4 py-2.5 text-left transition-all flex items-center gap-3 border-b border-[var(--border-1)] last:border-0 ${isActive ? 'bg-[var(--surface-3)]' : 'hover:bg-[var(--surface-3)]'}`}
                            >
                              <div className={`${isActive ? 'text-[color:var(--accent)]' : 'text-surface-500'}`}>
                                {r.icon}
                              </div>
                              <span className={`text-[12px] font-bold ${isActive ? 'text-[var(--accent)]' : 'text-tx-primary'}`}>{r.label}</span>
                              {isActive && (
                                <div className="ml-auto">
                                  <svg className="w-3.5 h-3.5 text-[color:var(--accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                  </svg>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <button type="submit" className="btn-primary !h-10 px-5 flex items-center justify-center group" disabled={loading || !currentTeam}>
                    {loading ? (
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    ) : (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-widest">Invite</span>
                    </div>
                    )}
                  </button>
                </div>
              </div>
              {!currentTeam && (
                <p className="text-warning text-[11px] bg-warning/5 border border-warning/20 rounded-xl px-3 py-2">Select a team first</p>
              )}
            </form>
          ) : (
            <p className="text-surface-500 text-[11px] text-center py-4 bg-surface-800/30 rounded-xl border border-dashed border-surface-700">Only admins can add or remove members.</p>
          )}

          <div className="mt-auto space-y-4">
            <div className="p-4 rounded-2xl bg-surface-800/30 border border-[#1E2530] border-dashed">
              <h4 className="text-[10px] font-bold text-surface-500 uppercase tracking-widest mb-2">Team Statistics</h4>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-surface-500">Active Now</span>
                  <span className="text-[11px] font-mono text-emerald-400">{roomMembers.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[11px] text-surface-500">Total Seats</span>
                  <span className="text-[11px] font-mono text-tx-primary">{(currentTeam?.members?.length || 0) + 1} / ∞</span>
                </div>
              </div>
            </div>
            <button onClick={() => setShowInviteModal(false)} className="btn-ghost w-full !py-2.5">Close Panel</button>
          </div>
        </div>
      </div>
    </ModalWrapper>
  );
}

function ModalWrapper({ children, onClose, title, wide = false, showLogo = false }) {
  return (
    <div 
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300" 
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className={`bg-[#0b0d13]/95 backdrop-blur-2xl border border-white/5 rounded-[28px] shadow-[0_0_80px_rgba(0,0,0,0.9)] w-full ${wide ? 'max-w-4xl' : 'max-w-md'} relative flex flex-col animate-in zoom-in-95 duration-300 overflow-hidden`}>
        {/* Shimmering Top Highlight */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-gray-400 to-transparent opacity-30 pointer-events-none" />

        <div className="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-white/5 backdrop-blur-md relative z-10">
          <div className="flex items-center gap-4">
            {showLogo && (
              <div className="flex items-center gap-3">
                <PayloadX className="w-8 h-8" fontSize="10px" />
                <div className="w-px h-6 bg-surface-700/50" />
              </div>
            )}
            <div className="flex flex-col">
              <h2 className="text-[14px] font-bold bg-gradient-to-r from-gray-200 via-gray-400 to-gray-500 bg-clip-text text-transparent uppercase tracking-wider leading-none mb-1">{title}</h2>
              <p className="text-[9px] text-surface-500 font-bold uppercase tracking-[0.2em] opacity-50">PayloadX Studio Context</p>
            </div>
          </div>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-xl text-surface-500 hover:text-gray-200 hover:bg-surface-800 transition-all border border-transparent hover:border-surface-700/50">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-8 relative z-10">{children}</div>
      </div>
    </div>
  );
}
