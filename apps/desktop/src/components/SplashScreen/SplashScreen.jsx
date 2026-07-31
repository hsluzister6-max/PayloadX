import { useEffect, useState } from 'react';
import PayloadX from '@/components/core/logo';

const STEPS = [
  { progress: 22, text: 'Starting PayloadX' },
  { progress: 48, text: 'Loading workspace' },
  { progress: 72, text: 'Connecting services' },
  { progress: 90, text: 'Restoring sessions' },
  { progress: 100, text: 'Ready' },
];

export default function SplashScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState(STEPS[0].text);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const show = requestAnimationFrame(() => setVisible(true));
    let i = 0;
    let timers = [];

    const tick = () => {
      if (i >= STEPS.length) return;
      setProgress(STEPS[i].progress);
      setStatusText(STEPS[i].text);
      i += 1;
      if (i < STEPS.length) {
        timers.push(setTimeout(tick, 650));
      } else {
        timers.push(setTimeout(onComplete, 500));
      }
    };

    timers.push(setTimeout(tick, 280));

    return () => {
      cancelAnimationFrame(show);
      timers.forEach(clearTimeout);
    };
  }, [onComplete]);

  return (
    <div className="splash-screen" data-visible={visible ? 'true' : 'false'}>
      <div className="splash-screen__atmosphere" aria-hidden="true" />

      <div className="splash-screen__content">
        <div className="splash-screen__brand">
          <PayloadX className="splash-screen__mark" fontSize="22px" />
          <div className="splash-screen__wordmark">
            <h1 className="splash-screen__title metallic-app-name">PayloadX</h1>
            <p className="splash-screen__subtitle">API Studio</p>
          </div>
        </div>

        <div className="splash-screen__status" aria-live="polite">
          <div className="splash-screen__track" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
            <div className="splash-screen__fill" style={{ width: `${progress}%` }} />
          </div>
          <p className="splash-screen__label">{statusText}</p>
        </div>
      </div>

      <p className="splash-screen__credit">
        Project by <span>Sundan Sharma</span>
      </p>
    </div>
  );
}
