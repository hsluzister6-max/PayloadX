import { useState, useEffect, useRef } from 'react';
import { useTeamStore } from '@/store/teamStore';
import { useProjectStore } from '@/store/projectStore';
import { useCollectionStore } from '@/store/collectionStore';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import { useSocketStore } from '@/store/socketStore';
import { useConnectivityStore } from '@/store/connectivityStore';
import ModalShell from './ModalShell';
import toast from 'react-hot-toast';
import { confirmDialog } from '@/utils/confirmDialog';

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
          <label className="block text-xs font-semibold text-tx-secondary mb-1.5">Team Name</label>
          <input className="input" placeholder="e.g., Backend Squad" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="block text-xs font-semibold text-tx-secondary mb-1.5">Description (optional)</label>
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
          <label className="block text-xs font-semibold text-tx-secondary mb-1.5">Project Name</label>
          <input className="input" placeholder="e.g., Payment API" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="block text-xs font-semibold text-tx-secondary mb-1.5">Description</label>
          <input className="input" placeholder="Optional description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-tx-secondary mb-1.5">Color</label>
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
          <label className="block text-xs font-semibold text-tx-secondary mb-1.5">Collection Name</label>
          <input className="input" placeholder="e.g., User Management APIs" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        </div>
        <div>
          <label className="block text-xs font-semibold text-tx-secondary mb-1.5">Description</label>
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
          <label className="block text-xs font-semibold text-tx-secondary mb-1.5">Folder Name</label>
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
  const [removing, setRemoving] = useState(null);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const roleDropdownRef = useRef(null);

  const ROLES = [
    { id: 'admin', label: 'Admin', icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-7.618 3.04c0 4.805 1.54 8.358 3.618 10.914a11.955 11.955 0 014.0 2.102c1.398-.626 2.67-1.356 3.618-2.102 2.078-2.556 3.618-6.109 3.618-10.914z" /></svg> },
    { id: 'developer', label: 'Developer', icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg> },
    { id: 'viewer', label: 'Viewer', icon: <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg> },
  ];

  useEffect(() => {
    const handleClick = (e) => {
      if (roleDropdownRef.current && !roleDropdownRef.current.contains(e.target)) {
        setShowRoleDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (currentTeam?._id) {
      fetchTeamDetails(currentTeam._id);
    }
  }, [currentTeam?._id]);

  const ownerId = currentTeam?.ownerId?._id || currentTeam?.ownerId || null;

  // Deduplicate: owner is often also listed in members[] as admin
  const members = (() => {
    if (!currentTeam) return [];
    const seen = new Set();
    const rows = [];

    if (ownerId) {
      const id = String(ownerId);
      seen.add(id);
      rows.push({
        id,
        name: currentTeam.ownerId?.name || 'Owner',
        email: currentTeam.ownerId?.email || '',
        role: 'owner',
        isOwner: true,
      });
    }

    for (const m of currentTeam.members || []) {
      const id = String(m.userId?._id || m.userId || '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      rows.push({
        id,
        name: m.userId?.name || m.userId?.email || 'Member',
        email: m.userId?.email || '',
        role: m.role || 'developer',
        isOwner: false,
      });
    }

    return rows;
  })();

  const onlineCount = members.filter((m) =>
    roomMembers.some((rm) => String(rm._id || rm.id) === m.id)
  ).length;

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

  const handleRemove = async (member) => {
    const confirmed = await confirmDialog({
      title: 'Remove Member',
      message: 'They will lose access to this team’s projects and collections.',
      itemName: member.name || member.email,
      confirmText: 'Remove',
      danger: true,
    });
    if (!confirmed) return;

    setRemoving(member.id);
    const result = await removeMember(currentTeam._id, member.id);
    setRemoving(null);
    if (result.success) toast.success('Member removed from team');
    else toast.error(result.error);
  };

  const isOwner =
    String(ownerId || '') === String(user?._id || '') ||
    String(ownerId || '') === String(user?.id || '');
  const isAdmin =
    isOwner ||
    currentTeam?.members?.some((m) => {
      const mid = String(m.userId?._id || m.userId || '');
      return mid === String(user?._id || user?.id || '') && m.role === 'admin';
    });

  const ROLE_STYLES = {
    owner: 'invite-role invite-role--owner',
    admin: 'invite-role invite-role--admin',
    developer: 'invite-role invite-role--developer',
    viewer: 'invite-role invite-role--viewer',
  };

  return (
    <ModalWrapper onClose={() => setShowInviteModal(false)} title="Team Members" wide showLogo>
      <div className="invite-layout">
        <div className="invite-members-col">
          <div className="invite-section-head">
            <h3 className="invite-section-title">Members</h3>
            <span className="invite-count-pill">{members.length}</span>
          </div>

          {!currentTeam ? (
            <p className="invite-empty">Select a team to manage members.</p>
          ) : members.length === 0 ? (
            <p className="invite-empty">No members yet.</p>
          ) : (
            <div className="invite-member-list custom-scrollbar">
              {members.map((member) => {
                const isYou = member.id === String(user?._id || user?.id || '');
                const isOnline = roomMembers.some((rm) => String(rm._id || rm.id) === member.id);
                const initial = (member.name || member.email || '?')[0]?.toUpperCase() || '?';

                return (
                  <div
                    key={member.id}
                    className={`invite-member-row ${member.isOwner ? 'invite-member-row--owner' : ''}`}
                  >
                    <div className="invite-avatar">
                      {initial}
                      {isOnline && <span className="invite-online-dot" title="Online" />}
                    </div>

                    <div className="invite-member-info">
                      <div className="invite-member-name-row">
                        <p className="invite-member-name">{member.name}</p>
                        {isYou && <span className="invite-you-badge">You</span>}
                      </div>
                      {member.email && <p className="invite-member-email">{member.email}</p>}
                    </div>

                    <span className={ROLE_STYLES[member.role] || ROLE_STYLES.viewer}>
                      {member.role}
                    </span>

                    {isAdmin && !isYou && !member.isOwner && (
                      <button
                        type="button"
                        onClick={() => handleRemove(member)}
                        disabled={removing === member.id}
                        className="invite-remove-btn"
                        title="Remove member"
                      >
                        {removing === member.id ? (
                          <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                          </svg>
                        ) : (
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                          </svg>
                        )}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <aside className="invite-side-col">
          {isAdmin ? (
            <form onSubmit={handleInvite} className="invite-form">
              <h3 className="invite-section-title">Invite by email</h3>
              <p className="invite-form-hint">They’ll get access to this team’s workspace.</p>

              <input
                className="input invite-email-input"
                type="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />

              <div className="relative" ref={roleDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowRoleDropdown(!showRoleDropdown)}
                  className="invite-role-select"
                >
                  <span className="invite-role-select-left">
                    <span className="invite-role-select-icon">{ROLES.find((r) => r.id === role)?.icon}</span>
                    <span>{ROLES.find((r) => r.id === role)?.label}</span>
                  </span>
                  <svg className={`w-4 h-4 transition-transform ${showRoleDropdown ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showRoleDropdown && (
                  <div className="invite-role-menu">
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
                          className={`invite-role-option ${isActive ? 'invite-role-option--active' : ''}`}
                        >
                          {r.icon}
                          <span>{r.label}</span>
                          {isActive && (
                            <svg className="w-3.5 h-3.5 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <button type="submit" className="invite-submit-btn" disabled={loading || !currentTeam}>
                {loading ? 'Inviting…' : 'Send invite'}
              </button>
            </form>
          ) : (
            <div className="invite-readonly-note">Only owners and admins can invite or remove members.</div>
          )}

          <div className="invite-stats">
            <h4 className="invite-section-title">Team stats</h4>
            <div className="invite-stat-row">
              <span>Online now</span>
              <strong className="invite-stat-online">{onlineCount}</strong>
            </div>
            <div className="invite-stat-row">
              <span>Members</span>
              <strong>{members.length}</strong>
            </div>
          </div>

          <button type="button" onClick={() => setShowInviteModal(false)} className="invite-close-btn">
            Close
          </button>
        </aside>
      </div>
    </ModalWrapper>
  );
}

function ModalWrapper({ children, onClose, title, wide = false, showLogo = false }) {
  return (
    <ModalShell onClose={onClose} title={title} wide={wide} showLogo={showLogo}>
      {children}
    </ModalShell>
  );
}
