import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useServerConfigStore } from '@/store/serverConfigStore';
import { useUIStore, THEME_LABELS } from '@/store/uiStore';
import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { open } from '@tauri-apps/api/shell';
import toast from 'react-hot-toast';
import PayloadX from '../core/logo';
import ForgotPassword from './ForgotPassword';

export default function AuthPage() {
  const { serverMode, customUrl, setServerMode, setCustomUrl } = useServerConfigStore();
  const { theme, setTheme } = useUIStore();
  // Default to 'login' to avoid showing the server selection screen to existing users
  const [mode, setMode] = useState('login');
  const [isInitialized, setIsInitialized] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', otp: '' });
  const [localUrl, setLocalUrl] = useState(customUrl || 'http://localhost:3001');
  const [isTestingUrl, setIsTestingUrl] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const { login, signup, loginWithGoogle, isLoading } = useAuthStore();

  const handleSelectServer = async (selectedMode) => {
    if (selectedMode === 'payloadx') {
      setServerMode('payloadx');
      setMode('login');
    } else {
      // For local, show the URL input — handled inline
    }
  };

  const handleConfirmLocalUrl = async () => {
    const url = localUrl.trim().replace(/\/$/, '');
    if (!url) return toast.error('Please enter your backend URL');

    setIsTestingUrl(true);
    try {
      const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(5000) });
      if (response.ok) {
        setCustomUrl(url);
        setServerMode('local');
        setMode('login');
        toast.success('Connected to local server!');
      } else {
        toast.error(`Server returned ${response.status}. Check your URL.`);
      }
    } catch {
      toast.error('Could not reach the server. Make sure it is running.');
    } finally {
      setIsTestingUrl(false);
    }
  };

  // Sync mode once server configuration is hydrated from storage
  useEffect(() => {
    if (!isInitialized) {
      const syncInitialMode = (state) => {
        setMode(state.serverMode ? 'login' : 'server-select');
        setIsInitialized(true);
      };

      if (useServerConfigStore.persist.hasHydrated()) {
        syncInitialMode(useServerConfigStore.getState());
      } else {
        const unsub = useServerConfigStore.persist.onFinishHydration((state) => {
          syncInitialMode(state);
        });
        return unsub;
      }
    }
  }, [isInitialized]);

  const processingOAuth = useRef(false);

  const GOOGLE_CLIENT_ID = "382570154047-3o3mts9ee2nnvlkg9dmq1hdqvs26249q.apps.googleusercontent.com";

  useEffect(() => {
    // Listen for the OAuth callback from Rust
    let unlisten;
    const setupListener = async () => {
      unlisten = await listen('oauth_callback', async (event) => {
        // Prevent duplicate processing
        if (processingOAuth.current) return;
        processingOAuth.current = true;

        const url = new URL(event.payload);
        const params = new URLSearchParams(url.search || url.hash.substring(1));
        const code = params.get('code');
        const port = url.port || url.origin.split(':').pop();
        const redirectUri = `http://localhost:${port}/`;

        if (code) {
          setIsGoogleLoading(true);
          const result = await loginWithGoogle({ code, redirectUri });
          setIsGoogleLoading(false);
          if (!result.success) {
            toast.error(result.error);
            processingOAuth.current = false; // Allow retry if failed
          }
        } else {
          console.error('[Google Auth] No code found in callback URL:', event.payload);
          processingOAuth.current = false;
        }
      });
    };

    setupListener();
    return () => {
      if (unlisten) unlisten().then(u => u && u());
    };
  }, [loginWithGoogle]);

  const handleGoogleLogin = async () => {
    if (isLoading || isGoogleLoading) return;

    try {
      setIsGoogleLoading(true);
      processingOAuth.current = false; // Reset for new attempt
      // 1. Start the local listener via Rust and get the port
      const port = await invoke('start_oauth_flow');
      const redirectUri = `http://localhost:${port}/`;

      // 2. Construct Google Auth URL
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${GOOGLE_CLIENT_ID}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('openid email profile')}`;

      // 3. Open in System Browser
      await invoke('system_open', { url: authUrl });
    } catch (error) {
      console.error('[Google Auth] Initialiation Failed:', error);
      toast.error('Failed to start Google login');
      setIsGoogleLoading(false);
    }
  };

  const validateForm = () => {
    const { email, password, name } = form;

    // Email validation
    if (!email.trim()) {
      toast.error('Email is required');
      return false;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error('Please enter a valid email address');
      return false;
    }

    // Password validation
    if (!password) {
      toast.error('Password is required');
      return false;
    }
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return false;
    }

    // Signup specific validation
    if (mode === 'signup' && !name.trim()) {
      toast.error('Full name is required');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!navigator.onLine) {
      toast.error('You are offline. Please check your connection.');
      return;
    }

    if (!validateForm()) return;

    if (mode === 'login') {
      const result = await login(form.email, form.password);
      if (!result.success) toast.error(result.error);
    } else {
      const result = await signup(form.name, form.email, form.password);
      if (result.success) {
        toast.success('Check your email for verification code!');
        setMode('verify-signup');
      } else {
        toast.error(result.error);
      }
    }
  };

  const handleVerifySignup = async (e) => {
    e.preventDefault();
    if (!form.otp) return toast.error('Verification code is required');
    const result = await useAuthStore.getState().verifySignup(form.email, form.otp);
    if (result.success) {
      toast.success('Email verified! Welcome to PayloadX.');
    } else {
      toast.error(result.error);
    }
  };

  // Google icon SVG
  const GoogleIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );

  // X (Twitter) icon SVG
  const XIcon = () => (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );

  // Check icon for password requirements
  const CheckIcon = () => (
    <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );

  // Eye icons for password visibility toggle
  const EyeOpenIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );

  const EyeClosedIcon = () => (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );

  return (
    <div className="flex h-screen overflow-hidden font-mono relative text-slate-400 bg-[color:var(--bg-primary)]">
      {/* Theme controls: Dark / Light */}
      <div className="absolute top-6 right-6 z-30 flex items-center gap-2">
        <div
          className="flex items-center gap-1 p-1 rounded-full border backdrop-blur-md"
          style={{
            background: 'rgba(255,255,255,0.04)',
            borderColor: 'rgba(255,255,255,0.08)',
          }}
        >
          {['dark', 'light'].map((modeId) => {
            const active = theme === modeId;
            return (
              <button
                key={modeId}
                type="button"
                onClick={() => setTheme(modeId)}
                className="px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all"
                style={{
                  background: active ? 'rgba(255,255,255,0.12)' : 'transparent',
                  color: active ? '#E8ECF4' : 'rgba(156,163,184,0.7)',
                  border: active
                    ? '1px solid rgba(255,255,255,0.15)'
                    : '1px solid transparent',
                }}
              >
                {THEME_LABELS[modeId]}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Left Side: Auth Form ── */}
      <div
        className="w-full lg:w-[35%] flex flex-col relative z-10 border-r"
        style={{
          background: 'rgba(6,6,6,0.78)',
          borderColor: 'rgba(255,255,255,0.06)',
        }}
      >
        {/* App Logo */}
        <div className="absolute top-10 left-10 flex items-center gap-3 z-20">
          <PayloadX />
          <span className="text-lg font-black tracking-tight metallic-app-name">
            PayloadX
          </span>
        </div>

        {/* Form Container */}
        <div className="flex-1 flex flex-col justify-center px-10 lg:px-16 max-w-[440px] mx-auto w-full relative z-10">
          {mode === 'server-select' ? (
            <div className="space-y-8 animate-in">
              {/* Heading */}
              <div className="space-y-2">
                <h1 className="text-2xl font-bold text-white tracking-tight leading-normal">Choose your server</h1>
                <p className="text-slate-500 text-[13px]">Where is your PayloadX backend running?</p>
              </div>

              {/* PayloadX Cloud Option */}
              <button
                id="server-select-payloadx"
                onClick={() => handleSelectServer('payloadx')}
                className="w-full p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15 transition-all duration-200 text-left group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500/20 to-indigo-500/20 border border-violet-500/20 flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-white">PayloadX Cloud</p>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded">Recommended</span>
                    </div>
                    <p className="text-[12px] text-slate-500">Use the managed PayloadX server. No setup required.</p>
                  </div>
                  <svg className="w-4 h-4 text-slate-600 group-hover:text-white transition-colors flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>

              {/* Self-Hosted Option */}
              <div className="space-y-3">
                <button
                  id="server-select-local"
                  onClick={() => handleSelectServer('local-input')}
                  className="w-full p-4 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/15 transition-all duration-200 text-left group"
                >
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/20 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                      </svg>
                    </div>
                    <div onClick={(e) => {
                      e.stopPropagation();
                      open("https://payload-x-landing.vercel.app/docs");
                    }} className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-white mb-0.5">Self-Hosted / Local</p>
                      <p className="text-[12px] text-slate-500">Full data ownership. Connect to your private Docker instance.</p>
                    </div>
                    <svg className="w-4 h-4 text-slate-600 group-hover:text-white transition-colors flex-shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </button>

                {/* Inline URL input for local server */}
                <div className="space-y-2 px-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">Backend URL</label>
                  <div className="flex gap-2">
                    <input
                      id="local-server-url-input"
                      className="flex-1 h-10 px-3 bg-white/[0.02] border border-white/5 rounded-lg text-white placeholder:text-slate-700 focus:border-white/20 focus:bg-white/[0.04] outline-none transition-all duration-200 text-sm font-mono"
                      type="url"
                      placeholder="http://localhost:3001"
                      value={localUrl}
                      onChange={(e) => setLocalUrl(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleConfirmLocalUrl()}
                    />
                    <button
                      id="connect-local-server-btn"
                      onClick={handleConfirmLocalUrl}
                      disabled={isTestingUrl}
                      className="h-10 px-4 btn-primary text-sm whitespace-nowrap"
                    >
                      {isTestingUrl ? (
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : 'Connect'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Back to login if already configured */}
              {serverMode && (
                <button
                  onClick={() => setMode('login')}
                  className="w-full text-[11px] text-slate-500 hover:text-white font-bold uppercase tracking-[0.1em] transition-colors pt-2"
                >
                  ← Back to login
                </button>
              )}
            </div>
          ) : mode === 'forgot-password' ? (
            <ForgotPassword onBack={() => setMode('login')} />
          ) : mode === 'verify-signup' ? (
            <div className="space-y-10 animate-in">
              <div className="space-y-1.5 text-center lg:text-left">
                <h1 className="text-2xl font-bold text-white tracking-tight pb-2 leading-normal">Verify your email</h1>
                <p className="text-slate-500 text-[13px]">We've sent a 6-digit code to <span className="text-slate-300">{form.email}</span>.</p>
              </div>
              <form onSubmit={handleVerifySignup} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em] ml-0.5">Verification Code</label>
                  <input
                    className="w-full h-11 px-4 bg-white/[0.02] border border-white/5 rounded-lg text-white placeholder:text-slate-700 focus:border-white/20 focus:bg-white/[0.04] outline-none transition-all duration-200 text-sm text-center tracking-[0.5em] font-bold"
                    type="text"
                    placeholder="000000"
                    maxLength={6}
                    value={form.otp}
                    onChange={(e) => setForm({ ...form, otp: e.target.value.replace(/\D/g, '') })}
                    required
                  />
                </div>
                <button type="submit" className="w-full h-11 btn-primary" disabled={isLoading}>
                  {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" /> : 'Verify Email'}
                </button>
                <button type="button" onClick={() => setMode('signup')} className="w-full text-[11px] text-slate-500 hover:text-white font-bold uppercase tracking-[0.1em] transition-colors">
                  Wrong email? Back to signup
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-10">
              {/* Heading */}
              <div className="space-y-1.5 text-center lg:text-left">
                <h1 className="text-2xl font-bold text-white tracking-tight pb-2 leading-normal">
                  {mode === 'login' ? 'Sign in' : 'Create account'}
                </h1>
                <p className="text-slate-500 text-[13px]">
                  {mode === 'login' ? 'Access your API workspace' : 'Start testing APIs with your team'}
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-6">
                {mode === 'signup' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em] ml-0.5">Full Name</label>
                    <input
                      className="w-full h-11 px-4 bg-white/[0.02] border border-white/5 rounded-lg text-white placeholder:text-slate-700 focus:border-white/20 focus:bg-white/[0.04] outline-none transition-all duration-200 text-sm"
                      type="text"
                      placeholder="John Doe"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em] ml-0.5">Email</label>
                  <input
                    className="w-full h-11 px-4 bg-white/[0.02] border border-white/5 rounded-lg text-white placeholder:text-slate-700 focus:border-white/20 focus:bg-white/[0.04] outline-none transition-all duration-200 text-sm"
                    type="email"
                    placeholder="name@example.com"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-end ml-0.5">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.1em]">Password</label>
                  </div>
                  <div className="relative">
                    <input
                      className="w-full h-11 px-4 pr-12 bg-white/[0.02] border border-white/5 rounded-lg text-white placeholder:text-slate-700 focus:border-white/20 focus:bg-white/[0.04] outline-none transition-all duration-200 text-sm"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      required
                      minLength={8}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-slate-300 transition-colors p-1.5"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOpenIcon /> : <EyeClosedIcon />}
                    </button>
                  </div>
                  {mode === 'login' && (
                    <div className="flex justify-end pr-0.5">
                      <button
                        type="button"
                        onClick={() => setMode('forgot-password')}
                        className="text-[10px] text-slate-500 hover:text-white transition-colors font-medium"
                      >
                        Forgot your password?
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full h-11 btn-primary"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                  ) : (
                    mode === 'login' ? 'Sign in' : 'Create account'
                  )}
                </button>
              </form>

              {/* Social Login Buttons */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 h-px bg-white/5"></div>
                  <span className="text-[9px] text-slate-600 font-bold uppercase tracking-widest">social sign in</span>
                  <div className="flex-1 h-px bg-white/5"></div>
                </div>

                <button
                  onClick={() => handleGoogleLogin()}
                  className="w-full h-11 flex items-center justify-center gap-3 bg-transparent border border-white/5 rounded-lg text-slate-300 hover:bg-white/[0.02] hover:border-white/10 transition-all duration-200"
                  disabled={isLoading || isGoogleLoading}
                >
                  {isGoogleLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span className="text-sm font-medium italic opacity-80">Check your browser...</span>
                    </div>
                  ) : (
                    <>
                      <GoogleIcon />
                      <span className="text-sm font-medium">Continue with Google</span>
                    </>
                  )}
                </button>
              </div>

              {/* Footer */}
              <div className="text-center pt-2">
                <p className="text-xs text-slate-500">
                  {mode === 'login' ? "New here?" : 'Back to login'}
                  <button
                    onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
                    className="ml-1.5 text-white font-bold hover:underline transition-all"
                  >
                    {mode === 'login' ? 'Create an account' : 'Sign in'}
                  </button>
                </p>
              </div>

              {/* Change Server Link */}
              <div className="text-center pt-2">
                <button
                  onClick={() => setMode('server-select')}
                  className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors font-medium"
                >
                  Running on <span className="text-slate-400 font-bold">{serverMode === 'local' ? localUrl : 'PayloadX Cloud'}</span> · <span className="underline decoration-slate-800 underline-offset-2 hover:decoration-slate-400 transition-all">Change Server</span>
                </button>
              </div>

              {/* Creator Attribution */}
              <div className="absolute bottom-10 left-0 right-0 text-center opacity-30">
                <p className="text-[10px] text-slate-500 uppercase tracking-[0.2em] font-medium">
                  Created by <span className="text-slate-300">Sundan Sharma</span>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Right Side: stage + copy ── */}
      <div className="hidden lg:flex lg:w-[65%] relative overflow-hidden items-center justify-center p-12 z-10 bg-transparent">
        <div className="relative z-10 w-full max-w-2xl flex flex-col gap-6 text-left">
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ color: '#C8CDD8' }}
          >
            Open source · Free forever
          </p>
          <h2
            className="text-4xl font-extrabold tracking-tight leading-tight"
            style={{ color: '#E8ECF4' }}
          >
            Everything you need to
            <br />
            build and test robust APIs.
          </h2>
          <p
            className="text-[15px] leading-relaxed max-w-md"
            style={{ color: 'rgba(156,163,184,0.85)' }}
          >
            The modern, lightweight alternative to Postman — crafted for developers who move fast.
          </p>
        </div>
      </div>
    </div>
  );
}
