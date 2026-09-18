import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import OverviewPage from './pages/OverviewPage';
import UsersPage from './pages/UsersPage';
import LivePage from './pages/LivePage';
import AnalyticsPage from './pages/AnalyticsPage';
import SystemPage from './pages/SystemPage';
import Shell from './components/Shell';

function Protected({ children }) {
  const { user, token, fetchMe } = useAuthStore();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (token && !user) await fetchMe();
      if (!cancelled) setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [token, user, fetchMe]);

  if (!ready) {
    return (
      <div className="boot">
        <div className="boot-spinner" />
        <p>Loading PayloadX Admin…</p>
      </div>
    );
  }

  if (!token || !user?.isPlatformAdmin) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <Protected>
            <Shell>
              <Routes>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/users" element={<UsersPage />} />
                <Route path="/live" element={<LivePage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/system" element={<SystemPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Shell>
          </Protected>
        }
      />
    </Routes>
  );
}
