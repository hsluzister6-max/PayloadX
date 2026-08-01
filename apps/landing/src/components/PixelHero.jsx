import React, { useEffect, useState } from "react";
import { ArrowRight, Github } from "lucide-react";
import { Link } from "react-router-dom";
import { SiTypescript, SiRust, SiReact, SiTauri } from "react-icons/si";
import styles from "./PixelHero.module.css";

const BRAND_LOGOS = [
  () => (
    <div className={styles.brandWordmark}>
      <SiTypescript size={18} color="#3178C6" />
      TypeScript
    </div>
  ),
  () => (
    <div className={styles.brandWordmark}>
      <SiRust size={18} color="#DEA584" />
      Rust
    </div>
  ),
  () => (
    <div className={styles.brandWordmark}>
      <SiReact size={18} color="#61DAFB" />
      React
    </div>
  ),
  () => (
    <div className={styles.brandWordmark}>
      <SiTauri size={18} color="#FFC131" />
      Tauri
    </div>
  ),
];

function PlatformLinks({ platforms }) {
  return (
    <div className={styles.platforms}>
      {platforms.map((p, i) => {
        const isComingSoon = p.link === "#" || p.comingSoon;
        return (
          <a
            key={i}
            href={isComingSoon ? undefined : p.link}
            className={[styles.platformLink, isComingSoon ? styles.platformDisabled : ""]
              .filter(Boolean)
              .join(" ")}
            title={isComingSoon ? `${p.os} — Coming Soon` : `Download for ${p.os} (${p.arch})`}
          >
            <span className={styles.platformIcon}>{p.icon}</span>
            <span>{p.os}</span>
            <span className={styles.platformMeta}>
              {isComingSoon ? "Soon" : p.arch}
            </span>
          </a>
        );
      })}
    </div>
  );
}

function TechMarquee() {
  return (
    <div className={styles.marqueeMask}>
      <div className={styles.marqueeTrack}>
        <div className={styles.marqueeGroup}>
          {BRAND_LOGOS.map((Logo, i) => (
            <Logo key={i} />
          ))}
        </div>
        <div className={styles.marqueeGroup} aria-hidden="true">
          {BRAND_LOGOS.map((Logo, i) => (
            <Logo key={`c-${i}`} />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function PixelHero({
  description = "The modern, lightweight alternative to Postman — built for developers who move fast.",
  platforms = [],
  userOS,
  githubUrl = "https://github.com/hsluzister6-max/PayloadX",
}) {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadTimer = setTimeout(() => setIsLoaded(true), 40);
    return () => clearTimeout(loadTimer);
  }, []);

  const primaryDisabled = !userOS || userOS.link === "#";

  return (
    <div className={styles.hero}>
      <div className={styles.videoWrap} aria-hidden="true">
        <img
          className={styles.video}
          src="/payloadx-studio.png"
          alt=""
        />
        <div className={styles.videoOverlay} />
      </div>

      <div
        className={[
          styles.content,
          isLoaded ? styles.contentVisible : styles.contentHidden,
        ].join(" ")}
      >
        <p className={styles.eyebrow}>Open source · Free forever</p>

        <h1 className={styles.title}>PayloadX</h1>

        <p className={styles.description}>{description}</p>

        <div className={styles.ctaRow}>
          <a
            href={primaryDisabled ? undefined : userOS.link}
            className={[
              styles.btnPrimary,
              primaryDisabled ? styles.btnPrimaryDisabled : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className={styles.ctaLabel}>
              {userOS?.icon}
              {primaryDisabled
                ? `Coming Soon · ${userOS?.name ?? "macOS"}`
                : `Download for ${userOS?.name}`}
            </span>
            {!primaryDisabled && <ArrowRight size={15} strokeWidth={2.25} />}
          </a>

          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.btnSecondary}
          >
            <Github size={15} strokeWidth={2} />
            GitHub
          </a>

          <Link to="/docs" className={styles.btnSecondary}>
            Docs
          </Link>
        </div>

        <PlatformLinks platforms={platforms} />
      </div>

      <div
        className={[
          styles.footerStrip,
          isLoaded ? styles.footerVisible : styles.footerHidden,
        ].join(" ")}
      >
        <p className={styles.marqueeLabel}>Powered by</p>
        <TechMarquee />
      </div>
    </div>
  );
}
