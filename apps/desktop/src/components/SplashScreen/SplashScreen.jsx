import { useEffect, useState } from 'react';
import PayloadX from '@/components/core/logo';
import { useUIStore, isNebulaTheme } from '@/store/uiStore';
import NebulaVideoBackground from '@/components/NebulaVideoBackground';

const steps = [
  { progress: 18, text: 'Initializing…' },
  { progress: 40, text: 'Loading workspace…' },
  { progress: 62, text: 'Connecting to services…' },
  { progress: 82, text: 'Restoring sessions…' },
  { progress: 100, text: 'Welcome to PayloadX' },
];

export default function SplashScreen({ onComplete }) {
  const theme = useUIStore((s) => s.theme);
  const isNebula = isNebulaTheme(theme);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');

  useEffect(() => {
    let i = 0;
    const tick = () => {
      if (i >= steps.length) return;
      setProgress(steps[i].progress);
      setStatusText(steps[i].text);
      i++;
      if (i < steps.length) setTimeout(tick, 700);
      else setTimeout(onComplete, 600);
    };
    setTimeout(tick, 600);
  }, [onComplete]);

  if (isNebula) {
    return (
      <div className="fixed inset-0 z-50 overflow-hidden flex flex-col items-center justify-center font-mono">
        <NebulaVideoBackground overlay="splash" />

        <div className="relative z-10 flex flex-col items-center w-full max-w-md px-6">
          <div
            className="relative w-full rounded-2xl overflow-hidden animate-fade-up"
            style={{
              background: 'rgba(18, 10, 8, 0.45)',
              border: '1px solid rgba(232, 160, 122, 0.22)',
              boxShadow:
                '0 24px 64px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,248,242,0.08)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
            }}
          >
            <div
              className="h-10 flex items-center px-4 gap-1.5"
              style={{ borderBottom: '1px solid rgba(232, 160, 122, 0.12)' }}
            >
              <div className="w-2 h-2 rounded-full" style={{ background: '#FF5F57' }} />
              <div className="w-2 h-2 rounded-full" style={{ background: '#FEBC2E' }} />
              <div className="w-2 h-2 rounded-full" style={{ background: '#28C840' }} />
            </div>

            <div className="flex flex-col items-center justify-center px-8 py-12">
              <PayloadX className="w-16 h-16" fontSize="24px" />

              <div className="mt-6 text-center">
                <h1
                  className="text-4xl font-black tracking-tight"
                  style={{ fontFamily: 'Syne, sans-serif', color: '#F6EFE8' }}
                >
                  PayloadX
                </h1>
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.28em] mt-2"
                  style={{ color: 'rgba(232, 140, 90, 0.85)' }}
                >
                  API Studio
                </p>
              </div>

              <p
                className="mt-5 text-[12px] text-center leading-relaxed max-w-[240px]"
                style={{ color: 'rgba(244, 235, 227, 0.65)' }}
              >
                Open source · Free forever
              </p>
            </div>

            <div className="h-1 w-full" style={{ background: 'rgba(232, 160, 122, 0.12)' }}>
              <div
                className="h-full transition-all duration-700 ease-in-out"
                style={{
                  width: `${progress}%`,
                  background: 'linear-gradient(90deg, #C45C3A 0%, #E88C5A 50%, #F0C4A0 100%)',
                  boxShadow: '0 0 12px rgba(232, 140, 90, 0.45)',
                }}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 mt-8 animate-fade-in">
            <div
              className="w-3.5 h-3.5 rounded-full animate-spin"
              style={{
                border: '1.5px solid rgba(232, 160, 122, 0.2)',
                borderTopColor: 'rgba(232, 140, 90, 0.9)',
              }}
            />
            <span
              className="text-[10px] font-medium uppercase tracking-[0.2em]"
              style={{ color: 'rgba(244, 235, 227, 0.7)' }}
            >
              {statusText}
            </span>
          </div>

          <p
            className="mt-14 text-[9px] uppercase tracking-[0.25em] font-medium"
            style={{ color: 'rgba(232, 160, 122, 0.4)' }}
          >
            Project by{' '}
            <span style={{ color: 'rgba(244, 235, 227, 0.65)' }}>Sundan Sharma</span>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-[#07090D] flex flex-col items-center justify-center z-50 overflow-hidden font-mono">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.01] blur-[120px] rounded-full pointer-events-none" />

      <div className="relative flex flex-col items-center w-full max-w-lg">
        <div className="relative w-full h-[320px] mb-12 animate-fade-up">
          <div className="absolute -inset-4 bg-white/[0.01] blur-3xl rounded-[30px]" />

          <div className="relative h-full bg-[#0B0D13] rounded-2xl border border-white/[0.04] shadow-2xl overflow-hidden flex flex-col">
            <div className="h-9 border-b border-white/[0.03] bg-white/[0.01] flex items-center px-4 gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#FF5F57]" />
              <div className="w-2 h-2 rounded-full bg-[#FEBC2E]" />
              <div className="w-2 h-2 rounded-full bg-[#28C840]" />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center relative">
              <PayloadX className="w-16 h-16" fontSize="24px" />

              <div className="mt-6 text-center">
                <h1 className="text-4xl metallic-app-name">PayloadX</h1>
                <p className="text-[10px] text-[#4A5060] font-bold uppercase tracking-[0.3em] mt-1">
                  API Studio
                </p>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/[0.02]">
              <div
                className="h-full bg-[#9CA3B0] transition-all duration-700 ease-in-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 border border-white/5 border-t-white/20 rounded-full animate-spin" />
            <span className="text-[10px] text-[#2E3445] font-medium uppercase tracking-[0.2em]">
              {statusText}
            </span>
          </div>
        </div>

        <div className="absolute bottom-[-100px] left-0 right-0 text-center opacity-20">
          <p className="text-[9px] text-slate-500 uppercase tracking-[0.25em] font-medium">
            Project by <span className="text-slate-300">Sundan Sharma</span>
          </p>
        </div>
      </div>
    </div>
  );
}
