import { create } from 'zustand';
import api from '../lib/api';

function downloadCsv(filename, rows) {
  const blob = new Blob([rows], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const useAdminStore = create((set, get) => ({
  data: null,
  users: [],
  usersTotal: 0,
  usersPage: 1,
  usersPageSize: 10,
  usersQuery: '',
  days: 14,
  isLoading: false,
  usersLoading: false,
  error: null,
  notice: null,

  setDays: (days) => set({ days }),

  flash: (notice) => {
    set({ notice });
    window.clearTimeout(get()._noticeTimer);
    const timer = window.setTimeout(() => set({ notice: null }), 2800);
    set({ _noticeTimer: timer });
  },

  fetchOverview: async (days) => {
    const range = days ?? get().days;
    set({ isLoading: true, error: null, days: range });
    try {
      const { data } = await api.get('/api/admin/overview', { params: { days: range } });
      set({ data, isLoading: false, error: null });
      return data;
    } catch (err) {
      const message = err.response?.data?.error || err.message || 'Failed to load overview';
      set({ isLoading: false, error: message });
      return null;
    }
  },

  pollLive: async () => {
    try {
      const { data } = await api.get('/api/admin/live');
      const prev = get().data;
      if (!prev) {
        set({ data: { live: data.live, load: data.load } });
      } else {
        set({ data: { ...prev, live: data.live, load: data.load } });
      }
      return data;
    } catch {
      return null;
    }
  },

  fetchUsers: async ({ q, page, pageSize } = {}) => {
    const query = q != null ? q : get().usersQuery;
    const nextPage = page != null ? page : get().usersPage;
    const limit = pageSize != null ? pageSize : get().usersPageSize;
    set({
      usersLoading: true,
      usersQuery: query,
      usersPage: nextPage,
      usersPageSize: limit,
    });
    try {
      const { data } = await api.get('/api/admin/users', {
        params: {
          limit,
          page: nextPage,
          q: query || undefined,
        },
      });
      set({
        users: data.users || [],
        usersTotal: data.total || 0,
        usersPage: data.page || nextPage,
        usersLoading: false,
      });
      return data;
    } catch (err) {
      set({ usersLoading: false });
      get().flash(err.response?.data?.error || 'Failed to load users');
      return null;
    }
  },

  exportOverviewCsv: () => {
    const data = get().data;
    if (!data?.stats) {
      get().flash('Nothing to export yet');
      return;
    }
    const lines = [
      'metric,value',
      ...Object.entries(data.stats).map(([k, v]) => `${k},${v}`),
      '',
      'section,views,clicks,actions,clickRate,total',
      ...(data.sectionEvents || []).map(
        (s) => `${s.section},${s.views},${s.clicks},${s.actions},${s.clickRate},${s.total}`,
      ),
    ];
    downloadCsv(`payloadx-overview-${get().days}d.csv`, lines.join('\n'));
    get().flash('Overview CSV downloaded');
  },

  exportUsersCsv: () => {
    const users = get().users;
    if (!users.length) {
      get().flash('Load users first');
      return;
    }
    const lines = [
      'name,email,verified,createdAt',
      ...users.map(
        (u) =>
          `"${(u.name || '').replace(/"/g, '""')}","${u.email}",${u.isVerified ? 'yes' : 'no'},${u.createdAt || ''}`,
      ),
    ];
    downloadCsv('payloadx-users.csv', lines.join('\n'));
    get().flash('Users CSV downloaded');
  },

  copySummary: async () => {
    const s = get().data?.stats;
    const live = get().data?.live;
    if (!s) {
      get().flash('No data to copy');
      return;
    }
    const text = [
      `PayloadX Admin · ${get().days}d`,
      `Users: ${s.totalUsers} (${s.liveUsers ?? live?.liveUsers ?? 0} live)`,
      `CTR: ${s.clickRate}% · Load: ${s.requestsPerMinute} rpm`,
      `Teams: ${s.totalTeams} · Projects: ${s.totalProjects} · Runs: ${s.totalRuns}`,
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      get().flash('Summary copied');
    } catch {
      get().flash('Clipboard unavailable');
    }
  },
}));
