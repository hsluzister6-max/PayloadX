"use client";
import React, { useState, useEffect } from "react";
import styles from "./page.module.css";

import {
  Box, Atom, Triangle, Leaf, Hexagon, Settings,
  Zap, Lock, Package, Users, Cpu, Globe
} from "lucide-react";
import * as FaIcons from "react-icons/fa";

const getIcon = (name, size) => {
  switch (name) {
    case "Tauri": return <Box size={size} />;
    case "React": return <Atom size={size} />;
    case "Next.js": return <Triangle size={size} />;
    case "MongoDB": return <Leaf size={size} />;
    case "Socket.IO": return <Hexagon size={size} />;
    case "Rust": return <Settings size={size} />;
    case "Zap": return <Zap size={size} />;
    case "Lock": return <Lock size={size} />;
    case "Package": return <Package size={size} />;
    case "Users": return <Users size={size} />;
    case "Cpu": return <Cpu size={size} />;
    case "Globe": return <Globe size={size} />;
    case "Apple": return FaIcons.FaApple ? <FaIcons.FaApple size={size} /> : <Box size={size} />;
    case "Windows": return FaIcons.FaWindows ? <FaIcons.FaWindows size={size} /> : <Box size={size} />;
    case "Linux": return FaIcons.FaLinux ? <FaIcons.FaLinux size={size} /> : <Box size={size} />;
    default: return null;
  }
};

const TECH_STRIP = [
  { name: "Tauri", iconName: "Tauri" },
  { name: "React", iconName: "React" },
  { name: "Next.js", iconName: "Next.js" },
  { name: "MongoDB", iconName: "MongoDB" },
  { name: "Socket.IO", iconName: "Socket.IO" },
  { name: "Rust", iconName: "Rust" },
];

const FEATURES = [
  { iconName: "Zap", label: "Real-time Sync" },
  { iconName: "Lock", label: "JWT Auth" },
  { iconName: "Package", label: "Postman Import" },
  { iconName: "Users", label: "Workspaces" },
  { iconName: "Cpu", label: "Rust-powered" },
  { iconName: "Globe", label: "Open Source" },
];

const ORBIT_ICONS = [
  { id: "o-tauri", label: "Tauri", iconName: "Tauri", ring: 0, dur: "18s", rev: false },
  { id: "o-rust", label: "Rust", iconName: "Rust", ring: 1, dur: "22s", rev: true },
  { id: "o-react", label: "React", iconName: "React", ring: 2, dur: "30s", rev: false },
  { id: "o-next", label: "Next.js", iconName: "Next.js", ring: 3, dur: "38s", rev: true },
  { id: "o-mongo", label: "MongoDB", iconName: "MongoDB", ring: 4, dur: "46s", rev: false },
  { id: "o-socket", label: "Socket.IO", iconName: "Socket.IO", ring: 5, dur: "54s", rev: true },
];

const RING_RADII = ["16%", "23%", "30%", "37%", "44%", "51%"];

const BASE_DOWNLOADS = [
  { id: "dl-mac-silicon", platform: "macOS", name: "Apple Silicon", iconName: "Apple", ext: ".dmg" },
  { id: "dl-mac-intel", platform: "macOS", name: "Intel", iconName: "Apple", ext: ".dmg" },
  { id: "dl-windows", platform: "Windows", name: "x64", iconName: "Windows", ext: ".exe" },
  { id: "dl-linux-appimage", platform: "Linux", name: "AppImage", iconName: "Linux", ext: ".AppImage" },
  { id: "dl-linux-deb", platform: "Linux", name: "Ubuntu", iconName: "Linux", ext: ".deb" },
];

export default function LandingPage() {
  const [downloads, setDownloads] = useState(BASE_DOWNLOADS);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [latestTag, setLatestTag] = useState("v1.0.0");
  const [userOS, setUserOS] = useState("Windows");
  const [hasMounted, setHasMounted] = useState(false);

  const fallback = "https://github.com/Sundanpatyad/api-test/releases/latest";

  useEffect(() => {
    setHasMounted(true);
    const checkMobile = () => setIsMobile(window.innerWidth <= 900);
    checkMobile();
    window.addEventListener("resize", checkMobile);

    const ua = navigator.userAgent;
    if (ua.includes("Win")) setUserOS("Windows");
    else if (ua.includes("Mac")) setUserOS("macOS");
    else setUserOS("Linux");

    fetch("https://api.github.com/repos/Sundanpatyad/api-test/releases/latest")
      .then(r => r.json())
      .then(data => {
        if (!data?.assets) { setIsLoading(false); return; }
        setLatestTag(data.tag_name || "latest");

        const enriched = BASE_DOWNLOADS.map(d => {
          let asset = null;
          if (d.id === "dl-mac-silicon")
            asset = data.assets.find(a => a.name.toLowerCase().endsWith(".dmg") && (a.name.toLowerCase().includes("aarch64") || a.name.toLowerCase().includes("arm64")));
          else if (d.id === "dl-mac-intel")
            asset = data.assets.find(a => a.name.toLowerCase().endsWith(".dmg") && !a.name.toLowerCase().includes("aarch64") && !a.name.toLowerCase().includes("arm64"));
          else if (d.id === "dl-windows")
            asset = data.assets.find(a => a.name.toLowerCase().endsWith(".exe") || a.name.toLowerCase().endsWith(".msi"));
          else if (d.id === "dl-linux-appimage")
            asset = data.assets.find(a => a.name.toLowerCase().endsWith(".appimage"));
          else if (d.id === "dl-linux-deb")
            asset = data.assets.find(a => a.name.toLowerCase().endsWith(".deb"));

          return {
            ...d,
            href: asset?.browser_download_url ?? fallback,
            size: asset ? (asset.size / 1024 / 1024).toFixed(1) + " MB" : null,
          };
        });
        setDownloads(enriched);
        setIsLoading(false);
      })
      .catch(() => {
        setDownloads(BASE_DOWNLOADS.map(d => ({ ...d, href: fallback })));
        setIsLoading(false);
      });

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // On the server and during the FIRST client render, hasMounted is false.
  // We MUST ensure the UI matches the server during that first render.
  const activeOS = hasMounted ? userOS : "Windows";
  const primaryDl = downloads.find(d => d.platform === activeOS) ?? downloads[2];

  return (
    <main className={styles.root}>
      {/* ════════════ NAV ════════════ */}
      <nav className={styles.nav}>
        <div className={styles.navLogo}>
          <img src="/logo.png" alt="PayloadX" className={styles.navBrandImg} />
          <span className={styles.navBrand}>PayloadX</span>
        </div>
        <div className={styles.navLinks}>
          <a href="#" className={styles.navLink}>Features</a>
          <a href="#" className={styles.navLink}>Changelog</a>
          <a href="https://github.com/Sundanpatyad/api-test" target="_blank" rel="noreferrer" className={styles.navLink}>GitHub</a>
          <a href="https://api-test-desktop.vercel.app/" target="_blank" rel="noreferrer" className={styles.navLink}>Web App</a>
        </div>
        <div className={styles.navRight}>
          <a href={primaryDl?.href || fallback} className={styles.navCta}>Free Download</a>
        </div>
      </nav>

      {/* ════════════ HERO ════════════ */}
      <section className={styles.hero}>
        {/* ── LEFT ── */}
        <div className={styles.heroLeft}>
          <div className={styles.badge}>
            <span className={styles.badgeDot} />
            Open Source · Free Forever · {latestTag}
          </div>

          <h1 className={styles.heroTitle}>
            The API Studio<br />
            <em>Built for Teams</em><br />
            That Ship Fast
          </h1>

          <p className={styles.heroSub}>
            PayloadX is a blazing-fast, Rust-powered desktop app for testing, collaborating, and managing APIs — the Postman alternative your team actually deserves.
          </p>

          <div className={styles.featurePills}>
            {FEATURES.map(f => (
              <span key={f.label} className={styles.pill}>
                <span className={styles.pillIcon}>{getIcon(f.iconName, 16)}</span>
                {f.label}
              </span>
            ))}
          </div>

          <div className={styles.dlSection}>
            <div className={styles.dlLabel}>Download for your platform</div>
            <div className={styles.dlButtons}>
              {downloads.map((d, i) => {
                const isPrimary = hasMounted ? d.platform === userOS : i === 0;
                return (
                  <a
                    key={d.id}
                    id={d.id}
                    href={d.href ?? fallback}
                    className={`${styles.dlBtn} ${isPrimary ? styles.dlBtnPrimary : ""}`}
                  >
                    <span className={styles.dlBtnIcon}>{getIcon(d.iconName, 22)}</span>
                    <div className={styles.dlBtnLabel}>
                      <span className={styles.dlBtnPlatform}>{d.platform}</span>
                      <span className={styles.dlBtnName}>
                        {d.name} {d.ext}
                        {!isLoading && d.size && ` · ${d.size}`}
                        {isLoading && " ···"}
                      </span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>

          <div className={styles.storyNote}>
            <div className={styles.storyQuote}>
              "Why build PayloadX? Because Postman's pricing is a feature I'd rather skip."
            </div>
            <div className={styles.storyText}>
              Built for <strong>engineers</strong> who want speed, local-first collaboration, and zero corporate bloat.
            </div>
            <div className={styles.storyFooter}>
              <div className={styles.signature}>
                <span className={styles.signatureName}>Sundan Sharma</span>
                <span className={styles.signatureTitle}>Creator / Engineer</span>
              </div>
              <div className={styles.creatorAvatar}>SS</div>
            </div>
          </div>
        </div>

        {/* ── RIGHT — ORBIT ── */}
        {hasMounted && (
          <div className={styles.heroRight}>
            <div className={styles.orbitScene}>
              {/* Dynamic orbital rings */}
              {RING_RADII.map((radius, idx) => (
                <div
                  key={idx}
                  className={styles.dynamicRing}
                  style={{
                    width: `calc(${radius} * 2)`,
                    height: `calc(${radius} * 2)`,
                    opacity: 1 - (idx * 0.12)
                  }}
                />
              ))}

              {/* Center */}
              <div className={styles.orbitCenter}>
                <div className={styles.centerStat}>PayloadX</div>
                <div className={styles.centerStatLabel}>Free Forever</div>
              </div>

              {/* Tech stack orbiting icons */}
              {ORBIT_ICONS.map((item, i) => {
                const sameRingIcons = ORBIT_ICONS.filter(x => x.ring === item.ring);
                const posInTrain = sameRingIcons.findIndex(x => x.id === item.id);
                const angle = posInTrain * 25;
                const radius = RING_RADII[item.ring];

                return (
                  <div
                    key={item.id}
                    className={`${styles.orbitArm} ${item.rev ? styles.rev : ""}`}
                    style={{
                      "--dur": item.dur,
                      width: radius,
                      transform: `rotate(${angle}deg)`,
                    }}
                  >
                    <span className={styles.armIcon} title={item.label}>
                      {getIcon(item.iconName, 16)}
                      <span className={styles.armLabel}>{item.label}</span>
                    </span>
                  </div>
                );
              })}

              {/* Floating version tag */}
              <div className={styles.orbitTag}>
                🚀 {isLoading ? "Loading…" : latestTag}
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ════════════ FOOTER ════════════ */}
      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <img src="/logo.png" alt="" className={styles.footerLogo} />
          <span className={styles.footerCopyright}>© 2025 PayloadX · by Sundan Sharma</span>
        </div>
        <div className={styles.techStrip}>
          {TECH_STRIP.map(t => (
            <div key={t.name} className={styles.techItem}>
              <span className={styles.techIcon}>{getIcon(t.iconName, 18)}</span>
              <span className={styles.techName}>{t.name}</span>
            </div>
          ))}
        </div>
      </footer>
    </main>
  );
}
