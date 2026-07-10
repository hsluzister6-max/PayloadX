import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { AnimatedText } from "./AnimatedText";
import styles from "./SplashScreen.module.css";

const MIN_MS = 2400;
const DUST_COUNT = 72;
const STAR_COUNT = 40;

function StarField() {
  const stars = useMemo(
    () =>
      Array.from({ length: STAR_COUNT }, (_, i) => ({
        id: i,
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
        size: Math.random() > 0.85 ? 2 : 1,
        delay: Math.random() * 3,
        duration: 1.8 + Math.random() * 2.5,
      })),
    []
  );

  return (
    <div className={styles.stars} aria-hidden="true">
      {stars.map((s) => (
        <span
          key={s.id}
          className={styles.star}
          style={{
            left: s.left,
            top: s.top,
            width: s.size,
            height: s.size,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

function DustField() {
  const particles = useMemo(
    () =>
      Array.from({ length: DUST_COUNT }, (_, i) => {
        const nearCenter = i < 36;
        return {
          id: i,
          left: nearCenter ? `${28 + Math.random() * 44}%` : `${Math.random() * 100}%`,
          top: nearCenter ? `${30 + Math.random() * 40}%` : `${Math.random() * 100}%`,
          size: nearCenter ? 1.5 + Math.random() * 3.5 : 1 + Math.random() * 2,
          delay: Math.random() * 2.5,
          duration: 2.8 + Math.random() * 4,
          driftX: (Math.random() - 0.5) * (nearCenter ? 90 : 50),
          driftY: -30 - Math.random() * (nearCenter ? 100 : 60),
          opacity: nearCenter ? 0.45 + Math.random() * 0.5 : 0.2 + Math.random() * 0.35,
        };
      }),
    []
  );

  return (
    <div className={styles.dust} aria-hidden="true">
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className={styles.dustParticle}
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
          }}
          animate={{
            x: [0, p.driftX * 0.5, p.driftX, p.driftX * 0.3],
            y: [0, p.driftY * 0.4, p.driftY, p.driftY * 1.1],
            opacity: [0, p.opacity, p.opacity * 0.7, 0],
            scale: [0.4, 1.15, 1, 0.3],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

/**
 * Premium dark splash — ambient glow, stars, ember dust, shimmer title.
 * No photo background. Minimum ~2.4s then fade out.
 */
export default function SplashScreen({ onDone }) {
  const startedAt = useRef(Date.now());
  const [progress, setProgress] = useState(0);
  const [exiting, setExiting] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    const tick = setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      const timeRatio = Math.min(elapsed / MIN_MS, 1);
      setProgress((prev) => {
        if (exiting) return 100;
        const eased = 1 - Math.pow(1 - timeRatio, 2.2);
        const target = 6 + eased * 90;
        return prev + (target - prev) * 0.16;
      });
    }, 32);
    return () => clearInterval(tick);
  }, [exiting]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (doneRef.current) return;
      doneRef.current = true;
      setExiting(true);
      setProgress(100);
      setTimeout(() => onDone?.(), 520);
    }, MIN_MS);

    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <motion.div
      className={styles.splash}
      initial={{ opacity: 1 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      aria-busy={!exiting}
      aria-label="Loading PayloadX"
    >
      <div className={styles.ambience} aria-hidden="true">
        <div className={styles.glowCore} />
        <div className={styles.glowRing} />
        <div className={styles.vignette} />
      </div>

      <StarField />
      <DustField />

      <div className={styles.center}>
        <motion.p
          className={styles.eyebrow}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          Open source · Free forever
        </motion.p>

        <div className={styles.titleStage}>
          <div className={styles.titleGlow} aria-hidden="true" />
          <AnimatedText
            text="PayloadX"
            gradientColors="linear-gradient(90deg, #FFF8F2 0%, #F0C4A0 25%, #E88C5A 50%, #C45C3A 75%, #FFF8F2 100%)"
            gradientAnimationDuration={2}
            hoverEffect
            className={styles.titleWrap}
          />
        </div>

        <motion.div
          className={styles.progressBlock}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.4 }}
        >
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
          <span className={styles.progressLabel}>Loading studio</span>
        </motion.div>
      </div>
    </motion.div>
  );
}
