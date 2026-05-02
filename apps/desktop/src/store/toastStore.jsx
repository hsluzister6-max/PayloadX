import React, { useEffect, useState } from 'react';
import { create } from 'zustand';

// ----------------------------------------------------------------------
// 1. ZUSTAND STORE FOR TOAST STATE
// ----------------------------------------------------------------------
const useToastStore = create((set, get) => ({
  toasts: [],
  addToast: (toast) => {
    set((state) => {
      // If a toast with this ID already exists, update it
      const exists = state.toasts.find((t) => t.id === toast.id);
      if (exists) {
        return { toasts: state.toasts.map((t) => (t.id === toast.id ? { ...t, ...toast } : t)) };
      }
      return { toasts: [...state.toasts, toast] };
    });
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  dismissAll: () => set({ toasts: [] }),
}));

// ----------------------------------------------------------------------
// 2. API METHODS (MIRRORS react-hot-toast)
// ----------------------------------------------------------------------
let toastIdCounter = 0;

const createToast = (message, options, type = 'default') => {
  const id = options?.id || `toast-${++toastIdCounter}`;
  const duration = options?.duration !== undefined ? options.duration : type === 'loading' ? Infinity : 4000;

  useToastStore.getState().addToast({ id, message, type, duration, ...options });

  if (duration !== Infinity) {
    setTimeout(() => {
      useToastStore.getState().removeToast(id);
    }, duration);
  }
  return id;
};

export const toast = (message, options) => createToast(message, options, 'default');
toast.success = (message, options) => createToast(message, options, 'success');
toast.error = (message, options) => createToast(message, options, 'error');
toast.loading = (message, options) => createToast(message, options, 'loading');
toast.dismiss = (id) => {
  if (id) useToastStore.getState().removeToast(id);
  else useToastStore.getState().dismissAll();
};

export default toast;

// ----------------------------------------------------------------------
// 3. TOASTER & TOAST ITEM COMPONENTS (METALLIC THEME)
// ----------------------------------------------------------------------
function ToastItem({ toast }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Slight delay for entry animation to trigger
    const t = setTimeout(() => setVisible(true), 10);
    return () => clearTimeout(t);
  }, []);

  const getIcon = () => {
    if (toast.icon) return toast.icon;
    if (toast.type === 'success') {
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      );
    }
    if (toast.type === 'error') {
      return (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <line x1="15" y1="9" x2="9" y2="15"></line>
          <line x1="9" y1="9" x2="15" y2="15"></line>
        </svg>
      );
    }
    if (toast.type === 'loading') {
      return (
        <svg width="18" height="18" className="animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ opacity: 0.7 }}>
          <path d="M21 12a9 9 0 11-6.219-8.56"></path>
        </svg>
      );
    }
    return null;
  };

  return (
    <div
      style={{
        pointerEvents: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 14px',
        // PayloadX Theme Integration
        background: 'var(--surface-2)',
        borderRadius: '6px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        border: '1px solid var(--border-1)',
        color: 'var(--text-primary)',
        fontFamily: "'DM Mono', monospace",
        fontSize: '11.5px',
        fontWeight: 500,
        letterSpacing: '0.02em',
        minWidth: '240px',
        maxWidth: '400px',
        transform: visible ? 'translateX(0) scale(1)' : 'translateX(20px) scale(0.98)',
        opacity: visible ? 1 : 0,
        transition: 'all 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)',
        ...toast.style,
      }}
    >
      {getIcon() && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.9 }}>
          {getIcon()}
        </div>
      )}
      <div style={{ flex: 1 }}>
        {toast.message}
      </div>
    </div>
  );
}

export function Toaster({ position = 'bottom-right' }) {
  const toasts = useToastStore((state) => state.toasts);

  const posStyle = {
    position: 'fixed',
    zIndex: 9999999,
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    pointerEvents: 'none',
  };

  if (position.includes('bottom')) posStyle.bottom = '32px';
  if (position.includes('top')) posStyle.top = '32px';
  if (position.includes('right')) posStyle.right = '32px';
  if (position.includes('left')) posStyle.left = '32px';
  
  if (position === 'top-center' || position === 'bottom-center') {
    posStyle.left = '50%';
    posStyle.transform = 'translateX(-50%)';
    posStyle.alignItems = 'center';
  } else if (position.includes('right')) {
    posStyle.alignItems = 'flex-end';
  } else {
    posStyle.alignItems = 'flex-start';
  }

  return (
    <div style={posStyle}>
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} />
      ))}
    </div>
  );
}
