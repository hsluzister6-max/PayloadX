import { useEffect, useState } from 'react';
import PayloadX from '@/components/core/logo';

const steps = [
  { progress: 18, text: 'Initializing…' },
  { progress: 40, text: 'Loading workspace…' },
  { progress: 62, text: 'Connecting to services…' },
  { progress: 82, text: 'Restoring sessions…' },
  { progress: 100, text: 'Welcome to PayloadX' },
];

export default function SplashScreen({ onComplete }) {
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

  return (
    <div className="fixed inset-0 bg-[#07090D] flex flex-col items-center justify-center z-50 overflow-hidden font-mono">
      {/* Background gradients */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-white/[0.01] blur-[120px] rounded-full pointer-events-none" />

      <div className="relative flex flex-col items-center w-full max-w-lg">

        {/* Mockup Container (The "Pock up") */}
        <div className="relative w-full h-[320px] mb-12 animate-fade-up">
          {/* Subtle glow behind mockup */}
          <div className="absolute -inset-4 bg-white/[0.01] blur-3xl rounded-[30px]" />

          <div className="relative h-full bg-[#0B0D13] rounded-2xl border border-white/[0.04] shadow-2xl overflow-hidden flex flex-col">
            {/* Mock Header */}
            <div className="h-9 border-b border-white/[0.03] bg-white/[0.01] flex items-center px-4 gap-1.5">
              <div className="w-2 h-2 rounded-full bg-[#FF5F57]"></div>
              <div className="w-2 h-2 rounded-full bg-[#FEBC2E]"></div>
              <div className="w-2 h-2 rounded-full bg-[#28C840]"></div>
            </div>

            {/* Mock Content (Centered Logo) */}
            <div className="flex-1 flex flex-col items-center justify-center relative">
              <PayloadX className="w-16 h-16" fontSize="24px" />

              <div className="mt-6 text-center">
                <h1 className="text-4xl metallic-app-name">PayloadX</h1>
                <p className="text-[10px] text-[#4A5060] font-bold uppercase tracking-[0.3em] mt-1">API Studio</p>
              </div>
            </div>

            {/* Progress Bar (Integrated into mockup bottom) */}
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/[0.02]">
              <div
                className="h-full bg-[#9CA3B0] transition-all duration-700 ease-in-out"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Status Text (Below Mockup) */}
        <div className="flex flex-col items-center gap-4 animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 border border-white/5 border-t-white/20 rounded-full animate-spin"></div>
            <span className="text-[10px] text-[#2E3445] font-medium uppercase tracking-[0.2em]">{statusText}</span>
          </div>
        </div>

        {/* Footer Attribution */}
        <div className="absolute bottom-[-100px] left-0 right-0 text-center opacity-20">
          <p className="text-[9px] text-slate-500 uppercase tracking-[0.25em] font-medium">
            Project by <span className="text-slate-300">Sundan Sharma</span>
          </p>
        </div>
      </div>
    </div>
  );
}