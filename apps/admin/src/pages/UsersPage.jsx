import { useEffect, useState } from 'react';
import { format, parseISO, isValid } from 'date-fns';
import { Download, Search, RefreshCw } from 'lucide-react';
import { useAdminStore } from '../store/adminStore';
import { PageHeader, Panel, Pagination } from '../components/ui';

function parseDate(value) {
  if (!value) return null;
  const d = typeof value === 'string' ? parseISO(value) : new Date(value);
  return isValid(d) ? d : null;
}

export default function UsersPage() {
  const {
    users,
    usersTotal,
    usersPage,
    usersPageSize,
    usersLoading,
    fetchUsers,
    exportUsersCsv,
    flash,
  } = useAdminStore();
  const [q, setQ] = useState('');

  useEffect(() => {
    fetchUsers({ page: 1, pageSize: usersPageSize });
  }, [fetchUsers, usersPageSize]);

  const onSearch = (e) => {
    e.preventDefault();
    fetchUsers({ q: q.trim(), page: 1 });
  };

  const copyEmail = async (email) => {
    try {
      await navigator.clipboard.writeText(email);
      flash('Email copied');
    } catch {
      flash('Clipboard unavailable');
    }
  };

  return (
    <div className="page">
      <PageHeader title="Users" description={`${usersTotal} accounts on the platform`}>
        <form className="search-form" onSubmit={onSearch}>
          <Search size={14} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name or email"
          />
        </form>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => fetchUsers({ q: q.trim() })}
          disabled={usersLoading}
        >
          <RefreshCw size={14} className={usersLoading ? 'spin' : ''} />
          Reload
        </button>
        <button type="button" className="btn-primary btn-primary--sm" onClick={exportUsersCsv}>
          <Download size={14} />
          Export CSV
        </button>
      </PageHeader>

      <Panel title="Directory" meta={`${usersTotal} total`} flush>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Status</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {usersLoading && users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    Loading users…
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-cell">
                    No users match your search
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const when = parseDate(u.createdAt);
                  return (
                    <tr key={u._id}>
                      <td>
                        <div className="user-cell">
                          <span className="avatar">
                            {(u.name || u.email || '?').slice(0, 1).toUpperCase()}
                          </span>
                          <strong>{u.name || '—'}</strong>
                        </div>
                      </td>
                      <td className="mono">{u.email}</td>
                      <td>
                        <span className={`status-pill ${u.isVerified ? 'is-ok' : 'is-warn'}`}>
                          {u.isVerified ? 'Verified' : 'Pending'}
                        </span>
                      </td>
                      <td className="mono">{when ? format(when, 'MMM d, yyyy') : '—'}</td>
                      <td>
                        <button
                          type="button"
                          className="btn-ghost btn-ghost--xs"
                          onClick={() => copyEmail(u.email)}
                        >
                          Copy email
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <Pagination
          page={usersPage}
          pageSize={usersPageSize}
          total={usersTotal}
          onPageChange={(page) => fetchUsers({ page })}
          onPageSizeChange={(pageSize) => fetchUsers({ page: 1, pageSize })}
        />
      </Panel>
    </div>
  );
}
