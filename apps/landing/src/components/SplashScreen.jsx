import React, { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import styles from "./SplashScreen.module.css";

const MIN_MS = 2200;
const RING_COUNT = 3;

/**
 * Cinematic splash — flash rings, title cascade, signal progress.
 */
export default function SplashScreen({ onDone }) {
  const startedAt = useRef(Date.now());
  const rootRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  const doneRef = useRef(false);

  const rings = useMemo(
    () => Array.from({ length: RING_COUNT }, (_, i) => i),
    []
  );

  useEffect(() => {
    const tick = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      const timeRatio = Math.min(elapsed / MIN_MS, 1);
      setProgress((prev) => {
        if (exiting) return 100;
        const eased = 1 - Math.pow(1 - timeRatio, 2.4);
        const target = 4 + eased * 94;
        return prev + (target - prev) * 0.18;
      });
    }, 28);
    return () => clearInterval(tick);
  }, [exiting]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const ctx = gsap.context(() => {
      if (reduce) {
        gsap.set([".splash-title .ch", ".splash-eye", ".splash-progress", ".splash-ring"], {
          autoAlpha: 1,
          clearProps: "transform",
        });
        return;
      }

      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(".splash-flash", { autoAlpha: 0, scale: 0.6, duration: 0.35 })
        .to(".splash-flash", { autoAlpha: 0, scale: 1.8, duration: 0.55 }, "-=0.05")
        .from(
          ".splash-ring",
          { scale: 0.4, autoAlpha: 0, stagger: 0.12, duration: 0.7, ease: "power2.out" },
          "-=0.45"
        )
        .from(".splash-eye", { autoAlpha: 0, y: 16, duration: 0.45 }, "-=0.35")
        .from(
          ".splash-title .ch",
          { autoAlpha: 0, y: 48, rotateX: -55, stagger: 0.035, duration: 0.65, ease: "power4.out" },
          "-=0.2"
        )
        .from(".splash-progress", { autoAlpha: 0, y: 12, duration: 0.4 }, "-=0.25");

      gsap.to(".splash-ring", {
        rotate: 180,
        duration: 8,
        repeat: -1,
        ease: "none",
        stagger: { each: 0.4, from: "end" },
      });
    }, el);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      setExiting(true);
      setProgress(100);

      const el = rootRef.current;
      if (!el) {
        onDone?.();
        return;
      }

      gsap.to(el, {
        autoAlpha: 0,
        scale: 1.04,
        filter: "blur(8px)",
        duration: 0.55,
        ease: "power2.inOut",
        onComplete: () => onDone?.(),
      });
    }, MIN_MS);

    return () => clearTimeout(timer);
  }, [onDone]);

  const title = "PayloadX";

  return (
    <div
      ref={rootRef}
      className={styles.splash}
      aria-busy={!exiting}
      aria-label="Loading PayloadX"
    >
      <div className={styles.voidBg} aria-hidden="true" />
      <div className={`${styles.flash} splash-flash`} aria-hidden="true" />

      <div className={styles.rings} aria-hidden="true">
        {rings.map((i) => (
          <div
            key={i}
            className={`${styles.ring} splash-ring`}
            style={{
              width: `${180 + i * 90}px`,
              height: `${180 + i * 90}px`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}
      </div>

      <div className={styles.center}>
        <p className={`${styles.eyebrow} splash-eye`}>Open source · Local-first</p>
        <h1 className={`${styles.title} splash-title`} aria-label={title}>
          {title.split("").map((ch, i) => (
            <span key={i} className="ch">
              {ch}
            </span>
          ))}
        </h1>

        <div className={`${styles.progressBlock} splash-progress`}>
          <div
            className={styles.progressTrack}
            role="progressbar"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className={styles.progressFill}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <span className={styles.progressLabel}>Initializing studio</span>
        </div>
      </div>
    </div>
  );
}
