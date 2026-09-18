import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuthStore } from '../store/authStore';
import { DEFAULT_API_URL } from '../config';
import { getApiBaseUrl, setApiBaseUrl } from '../lib/api';

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.9 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.5-.4-3.5z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7l6.6 4.8C14.7 16 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35.9 26.8 37 24 37c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.5 7.1l.1.1 6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.5-.4-3.5z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, loginWithGoogle, isLoading, error, user, token } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl() || DEFAULT_API_URL);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    if (token && user?.isPlatformAdmin) {
      navigate('/', { replace: true });
    }
  }, [token, user, navigate]);

  const onSubmit = async (e) => {
    e.preventDefault();
    const result = await login(email.trim(), password, apiUrl.trim());
    if (result.success) navigate('/', { replace: true });
  };

  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setGoogleLoading(true);
      if (apiUrl.trim()) setApiBaseUrl(apiUrl.trim());
      const result = await loginWithGoogle(tokenResponse.access_token, apiUrl.trim());
      setGoogleLoading(false);
      if (result.success) navigate('/', { replace: true });
    },
    onError: () => {
      setGoogleLoading(false);
      useAuthStore.setState({ error: 'Google sign-in was cancelled or failed' });
    },
    scope: 'openid email profile',
  });

  const busy = isLoading || googleLoading;

  return (
    <div className="login-page">
      <div className="login-backdrop" aria-hidden />
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-brand">
          <img src="/logo.png" alt="" className="login-logo" width={40} height={40} />
          <div>
            <h1>
              Payload<span className="brand-x">X</span> Admin
            </h1>
            <p>Platform analytics &amp; live load</p>
          </div>
        </div>

        <label className="field">
          <span>API base URL</span>
          <input
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="https://… or http://localhost:3001"
            autoComplete="url"
          />
        </label>

        <button
          type="button"
          className="btn-google"
          disabled={busy}
          onClick={() => {
            if (apiUrl.trim()) setApiBaseUrl(apiUrl.trim());
            googleLogin();
          }}
        >
          {googleLoading ? (
            <span className="btn-spinner" />
          ) : (
            <>
              <GoogleIcon />
              Continue with Google
            </>
          )}
        </button>

        <div className="login-divider">
          <span>or email</span>
        </div>

        <label className="field">
          <span>Admin email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="username"
            placeholder="sundansharma600@gmail.com"
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
          />
        </label>

        {error && <p className="login-error">{error}</p>}

        <button type="submit" className="btn-primary" disabled={busy}>
          {isLoading && !googleLoading ? 'Signing in…' : 'Sign in'}
        </button>

        <p className="login-hint">
          Admin access: <code>sundansharma600@gmail.com</code>
        </p>
      </form>
    </div>
  );
}
