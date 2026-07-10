import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useTeamStore } from '@/store/teamStore';
import { useProjectStore } from '@/store/projectStore';
import { useCollectionStore } from '@/store/collectionStore';
import { useRequestStore } from '@/store/requestStore';
import { useUIStore } from '@/store/uiStore';
import { useAuthStore } from '@/store/authStore';
import toast from 'react-hot-toast';
import RefreshButton from '@/components/RefreshButton/RefreshButton';

function useMenuPosition(open, triggerRef) {
  const [pos, setPos] = useState(null);

  const update = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: r.left });
  }, [triggerRef]);

  useEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, update]);

  return pos;
}

export default function ContextSelector() {
  const { user } = useAuthStore();
  const { teams, currentTeam, setCurrentTeam, refreshTeams, updateTeamName, deleteTeam, isRefreshing: isRefreshingTeams } = useTeamStore();
  const { projects, currentProject, setCurrentProject, getFilteredProjects, refreshProjects, updateProjectName, deleteProject, isRefreshing: isRefreshingProjects } = useProjectStore();
  const { setCurrentCollection } = useCollectionStore();
  const { setShowTeamModal, setShowProjectModal, setContextMenu, setShowConfirmDialog, setShowEditNameModal } = useUIStore();

  const isTeamOwner = (team) => team?.ownerId?._id === user?._id || team?.ownerId === user?._id;
  const isTeamAdmin = (team) => {
    if (isTeamOwner(team)) return true;
    return team?.members?.some(m =>
      (m.userId?._id || m.userId) === user?._id && m.role === 'admin'
    );
  };
  const isProjectAdmin = (project) => {
    if (project?.ownerId?._id === user?._id || project?.ownerId === user?._id) return true;
    return project?.members?.some(m =>
      (m.userId?._id || m.userId) === user?._id && m.role === 'admin'
    );
  };

  const [teamOpen, setTeamOpen] = useState(false);
  const [projectOpen, setProjectOpen] = useState(false);

  const teamRef = useRef(null);
  const projRef = useRef(null);
  const teamMenuRef = useRef(null);
  const projMenuRef = useRef(null);

  const teamPos = useMenuPosition(teamOpen, teamRef);
  const projPos = useMenuPosition(projectOpen, projRef);

  const handleTeamChange = (team) => {
    if (currentTeam?._id !== team._id) {
      setCurrentTeam(team);
      setCurrentProject(null);
    } else {
      setCurrentTeam(null);
      setCurrentProject(null);
      setCurrentCollection(null);
    }
    setTeamOpen(false);
  };

  const handleProjectChange = (proj) => {
    if (currentProject?._id !== proj._id) {
      setCurrentProject(proj);
    } else {
      setCurrentProject(null);
      setCurrentCollection(null);
    }
    setProjectOpen(false);
  };

  useEffect(() => {
    const handler = (e) => {
      const t = e.target;
      if (
        teamOpen &&
        !teamRef.current?.contains(t) &&
        !teamMenuRef.current?.contains(t)
      ) {
        setTeamOpen(false);
      }
      if (
        projectOpen &&
        !projRef.current?.contains(t) &&
        !projMenuRef.current?.contains(t)
      ) {
        setProjectOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [teamOpen, projectOpen]);

  const filteredProjects = useMemo(() =>
    currentTeam ? getFilteredProjects(currentTeam._id) : [],
    [currentTeam?._id, projects]
  );

  const teamMenu = teamOpen && teamPos && createPortal(
    <div
      ref={teamMenuRef}
      className="v2-glass-dropdown"
      style={{ top: teamPos.top, left: teamPos.left }}
    >
      <div className="v2-glass-dropdown__header">
        <span className="v2-glass-dropdown__label">Teams</span>
        <div className="flex items-center gap-2">
          <RefreshButton
            onRefresh={async () => {
              const result = await refreshTeams();
              if (result.fromCache) toast(result.error, { icon: '📦', style: { background: '#E3B341', color: '#000' } });
              else if (result.success) toast.success('Teams synced');
              else toast.error(result.error || 'Refresh failed');
            }}
            loading={isRefreshingTeams}
            tooltip="Refresh teams"
            size={12}
          />
          <button onClick={() => { setShowTeamModal(true); setTeamOpen(false); }} className="v2-glass-dropdown__action">+ New</button>
        </div>
      </div>
      <div className="v2-glass-dropdown__list">
        {teams.length === 0 && <p className="v2-glass-dropdown__empty">No teams available</p>}
        {teams.map(team => (
          <button
            key={team._id}
            type="button"
            onClick={() => handleTeamChange(team)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isTeamAdmin(team)) return;
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                items: [
                  {
                    id: 'edit',
                    label: 'Edit Name',
                    icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
                    onClick: () => setShowEditNameModal(true, {
                      title: 'Edit Team Name',
                      itemType: 'Team',
                      currentName: team.name,
                      onSave: async (name) => {
                        const result = await updateTeamName(team._id, name);
                        if (result.success) toast.success('Team renamed');
                        else toast.error(result.error);
                      }
                    })
                  },
                  { id: 'divider', divider: true },
                  {
                    id: 'delete',
                    label: 'Delete Team',
                    danger: true,
                    icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
                    onClick: () => setShowConfirmDialog(true, {
                      title: 'Delete Team?',
                      message: 'This will permanently delete the team and all its projects, collections, and requests.',
                      itemName: team.name,
                      onConfirm: async () => {
                        const result = await deleteTeam(team._id);
                        if (result.success) toast.success('Team deleted');
                        else toast.error(result.error);
                      }
                    })
                  }
                ]
              });
            }}
            className={`v2-glass-dropdown__item ${currentTeam?._id === team._id ? 'is-active' : ''}`}
          >
            <span className="truncate flex-1 text-left">{team.name}</span>
            {currentTeam?._id === team._id && <span className="v2-glass-dropdown__dot" />}
          </button>
        ))}
      </div>
    </div>,
    document.body
  );

  const projectMenu = projectOpen && projPos && createPortal(
    <div
      ref={projMenuRef}
      className="v2-glass-dropdown"
      style={{ top: projPos.top, left: projPos.left }}
    >
      <div className="v2-glass-dropdown__header">
        <span className="v2-glass-dropdown__label">Projects</span>
        <div className="flex items-center gap-2">
          <RefreshButton
            onRefresh={async () => {
              const result = await refreshProjects(currentTeam._id);
              if (result.fromCache) toast(result.error, { icon: '📦', style: { background: '#E3B341', color: '#000' } });
              else if (result.success) toast.success('Projects synced');
              else toast.error(result.error || 'Refresh failed');
            }}
            loading={isRefreshingProjects}
            tooltip="Refresh projects"
            size={12}
          />
          <button onClick={() => { setShowProjectModal(true); setProjectOpen(false); }} className="v2-glass-dropdown__action">+ New</button>
        </div>
      </div>
      <div className="v2-glass-dropdown__list">
        {filteredProjects.length === 0 && <p className="v2-glass-dropdown__empty">No projects in this team</p>}
        {filteredProjects.map(proj => (
          <button
            key={proj._id}
            type="button"
            onClick={() => handleProjectChange(proj)}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!isProjectAdmin(proj)) return;
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                items: [
                  {
                    id: 'edit',
                    label: 'Edit Name',
                    icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
                    onClick: () => setShowEditNameModal(true, {
                      title: 'Edit Project Name',
                      itemType: 'Project',
                      currentName: proj.name,
                      onSave: async (name) => {
                        const result = await updateProjectName(proj._id, name);
                        if (result.success) toast.success('Project renamed');
                        else toast.error(result.error);
                      }
                    })
                  },
                  { id: 'divider', divider: true },
                  {
                    id: 'delete',
                    label: 'Delete Project',
                    danger: true,
                    icon: <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>,
                    onClick: () => setShowConfirmDialog(true, {
                      title: 'Delete Project?',
                      message: 'This will permanently delete the project and all its collections and requests.',
                      itemName: proj.name,
                      onConfirm: async () => {
                        const result = await deleteProject(proj._id);
                        if (result.success) toast.success('Project deleted');
                        else toast.error(result.error);
                      }
                    })
                  }
                ]
              });
            }}
            className={`v2-glass-dropdown__item ${currentProject?._id === proj._id ? 'is-active' : ''}`}
          >
            <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: proj.color || '#6366f1' }} />
            <span className="truncate flex-1 text-left">{proj.name}</span>
            {currentProject?._id === proj._id && <span className="v2-glass-dropdown__dot" />}
          </button>
        ))}
      </div>
    </div>,
    document.body
  );

  return (
    <div className="flex items-center gap-1 ml-2">
      <div className="relative" ref={teamRef}>
        <button
          type="button"
          onClick={() => { setTeamOpen(!teamOpen); setProjectOpen(false); }}
          className="flex items-center gap-1.5 px-2 py-1 rounded border border-transparent text-xs font-semibold text-tx-secondary hover:bg-[color:var(--surface-2)] hover:text-tx-primary transition-all"
        >
          <div className="w-4 h-4 rounded bg-[color:var(--surface-3)] text-[8px] flex items-center justify-center flex-shrink-0 border border-[color:var(--border-1)] text-tx-primary">
            {currentTeam?.name?.[0]?.toUpperCase() || 'T'}
          </div>
          <span className="max-w-[100px] truncate">{currentTeam?.name || 'Select Team'}</span>
          <svg className={`w-3 h-3 opacity-60 transition-transform ${teamOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
      </div>

      <span className="text-tx-muted opacity-50 text-xs">/</span>

      <div className="relative" ref={projRef}>
        <button
          type="button"
          onClick={() => { if (currentTeam) { setProjectOpen(!projectOpen); setTeamOpen(false); } else { toast.error("Select a team first"); } }}
          className={`flex items-center gap-1.5 px-2 py-1 rounded border border-transparent text-xs font-semibold transition-all ${currentTeam ? 'text-tx-secondary hover:bg-[color:var(--surface-2)] hover:text-tx-primary cursor-pointer' : 'text-tx-muted opacity-50 cursor-not-allowed'}`}
        >
          {currentProject && (
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: currentProject.color || '#6366f1' }} />
          )}
          <span className="max-w-[100px] truncate">{currentProject?.name || 'Select Project'}</span>
          <svg className={`w-3 h-3 opacity-60 transition-transform ${projectOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
      </div>

      {teamMenu}
      {projectMenu}
    </div>
  );
}
