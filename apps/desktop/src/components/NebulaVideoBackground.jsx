import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * Full-bleed looping hero video for Nebula theme surfaces.
 * Portaled to document.body so it sits behind the transparent #root shell.
 */
export default function NebulaVideoBackground({ overlay = 'dashboard' }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    el.setAttribute('webkit-playsinline', 'true');
    el.muted = true;
    el.defaultMuted = true;

    const tryPlay = () => {
      el.muted = true;
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});
    };

    tryPlay();
    el.addEventListener('canplay', tryPlay);
    el.addEventListener('loadeddata', tryPlay);

    const onVis = () => {
      if (document.visibilityState === 'visible') tryPlay();
    };
    document.addEventListener('visibilitychange', onVis);

    return () => {
      el.removeEventListener('canplay', tryPlay);
      el.removeEventListener('loadeddata', tryPlay);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  // Clean veils — light mode uses a strong cream wash so UI stays crisp
  const overlays = {
    dashboard:
      'linear-gradient(180deg, rgba(8,4,3,0.35) 0%, rgba(8,4,3,0.12) 45%, rgba(8,4,3,0.4) 100%)',
    dashboardLight:
      'linear-gradient(180deg, rgba(250,246,242,0.82) 0%, rgba(247,241,234,0.72) 40%, rgba(243,237,231,0.88) 100%)',
    auth:
      'linear-gradient(to right, rgba(10,6,5,0.55) 0%, rgba(10,6,5,0.2) 42%, rgba(10,6,5,0.12) 100%)',
    splash:
      'linear-gradient(180deg, rgba(10,6,5,0.4) 0%, rgba(10,6,5,0.15) 45%, rgba(10,6,5,0.55) 100%)',
  };

  const node = (
    <div className="nebula-video-bg" aria-hidden="true">
      <video
        ref={videoRef}
        className="nebula-video-bg__video"
        src="/herobg.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
      />
      <div
        className="nebula-video-bg__overlay"
        style={{ background: overlays[overlay] || overlays.dashboard }}
      />
    </div>
  );

  if (typeof document === 'undefined') return null;
  return createPortal(node, document.body);
}
