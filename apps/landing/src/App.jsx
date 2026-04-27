import React, { useState, useEffect } from "react";
import styles from "./App.module.css";
import { Zap, Lock, Users, Code, Download } from 'lucide-react';
import { FaApple, FaWindows, FaLinux } from 'react-icons/fa6';
import PayloadX from "./components/core/Logo";

const FEATURES = [
  { icon: <Zap size={18} />, tag: "PERFORMANCE", title: "Lightning Fast", desc: "TypeScript & Rust engine" },
  { icon: <Lock size={18} />, tag: "SECURITY", title: "Encrypted", desc: "JWT + local vault" },
  { icon: <Users size={18} />, tag: "TEAMS", title: "Sync", desc: "Real-time collab" },
  { icon: <Code size={18} />, tag: "DEV", title: "Type-Safe", desc: "Powered by TypeScript" },
];

const STACK = [
  { name: "TypeScript", percentage: 50, color: "#3178c6", desc: "Type-Safe Frontend Logic" },
  { name: "Rust", percentage: 40, color: "#dea584", desc: "High-Performance Core Engine" },
  { name: "CSS", percentage: 10, color: "#563d7c", desc: "Premium Metallic Styling" },
];

const REPO_URL = "https://github.com/hsluzister6-max/PayloadX";
const LATEST_DL = `${REPO_URL}/releases/latest/download`;
const DOWNLOAD_LINK = "https://github.com/hsluzister6-max/PayloadX/releases/download/v1.0.0/PayloadX_1.0.0_aarch64.dmg";

const PLATFORMS = [
  { os: "macOS", arch: "Apple Silicon", icon: <FaApple />, primary: true, link: DOWNLOAD_LINK },
  { os: "Windows", arch: "x64", icon: <FaWindows />, link: `${LATEST_DL}/PayloadX_x64-setup.exe` },
  { os: "iOS", arch: "Beta", icon: <FaApple />, link: DOWNLOAD_LINK },
  { os: "Linux", arch: "AppImage", icon: <FaLinux />, link: `${LATEST_DL}/payload-x_amd64.AppImage` },
  { os: "Linux", arch: "Debian", icon: <FaLinux />, link: `${LATEST_DL}/payload-x_amd64.deb` },
];


import Docs from "./Docs";

export default function App() {
  const [active, setActive] = useState(null);
  const [tick, setTick] = useState(0);
  const [view, setView] = useState("hero"); // "hero" or "docs"
  const [userOS, setUserOS] = useState({ name: "Windows", link: `${LATEST_DL}/PayloadX_x64-setup.exe`, icon: <FaWindows /> });

  useEffect(() => {
    const id = setInterval(() => setTick(t => (t + 1) % 4), 2200);

    // Detect OS
    const ua = window.navigator.userAgent;

    if (/iPad|iPhone|iPod/.test(ua)) {
      setUserOS({ name: "iOS", link: DOWNLOAD_LINK, icon: <FaApple /> });
    } else if (ua.indexOf("Win") !== -1) {
      setUserOS({ name: "Windows", link: `${LATEST_DL}/PayloadX_x64-setup.exe`, icon: <FaWindows /> });
    } else if (ua.indexOf("Mac") !== -1) {
      setUserOS({ name: "macOS", link: DOWNLOAD_LINK, icon: <FaApple /> });
    } else if (ua.indexOf("Linux") !== -1) {
      setUserOS({ name: "Linux", link: `${LATEST_DL}/payload-x_amd64.AppImage`, icon: <FaLinux /> });
    }

    return () => clearInterval(id);
  }, []);

  if (view === "docs") {
    return <Docs onBack={() => setView("hero")} />;
  }

  return (
    <div className={styles.root}>
      {/* scanline overlay */}
      <div className={styles.scanlines} aria-hidden />

      {/* mesh background */}
      <div className={styles.mesh} aria-hidden />

      {/* NAV */}
      <nav className={styles.nav}>
        <PayloadX size="28px" fontSize="10px" />
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span className={`${styles.logoName} metallic-app-name py-2 px-1`}>PayloadX</span>
          <span className={styles.betaBadge}>Beta</span>
        </div>
        <div className={styles.navSpacer} />
        <span onClick={() => setView("docs")} className={styles.navLink}>Docs</span>
      </nav>

      {/* MAIN GRID */}
      <main className={styles.main}>

        {/* LEFT COLUMN */}
        <div className={styles.left}>
          <div className={styles.badge}>
            <span className={styles.badgeDot} />
            OPEN SOURCE · FREE FOREVER
          </div>

          <h1 className={styles.title}>
            <span className={`${styles.titleChrome} metallic-app-name`} style={{ display: 'block', paddingBottom: '0.2em' }}>Payload</span>
            <span className={`${styles.titleX} metallic-app-name`} style={{ display: 'block', position: 'relative', width: 'fit-content' }}>
              X
            </span>
          </h1>

          <p className={styles.tagline}>API Testing,<br />Simplified.</p>

          <p className={styles.sub}>
            The modern, lightweight alternative to Postman —
            built for developers who move fast.
          </p>

          <div className={styles.ctaRow}>
            <a href={userOS.link} className={styles.btnPrimary}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {userOS.icon}
                Download for {userOS.name}
              </span>
            </a>
            {/* <a href={`${REPO_URL}/releases`} target="_blank" rel="noreferrer" className={styles.btnGhost}>
              All Platforms →
            </a> */}
          </div>

          {/* stat strip */}
          <div className={styles.stats}>
            <div className={styles.stat}><span className={styles.statNum}>2.4ms</span><span className={styles.statLabel}>avg latency</span></div>
            <div className={styles.statDiv} />
            <div className={styles.stat}><span className={styles.statNum}>4</span><span className={styles.statLabel}>platforms</span></div>
            <div className={styles.statDiv} />
            <div className={styles.stat}><span className={styles.statNum}>100%</span><span className={styles.statLabel}>free</span></div>
          </div>
        </div>

        {/* RIGHT COLUMN */}
        <div className={styles.right}>

          {/* FEATURE TILES */}
          <div className={styles.featGrid}>
            {FEATURES.map((f, i) => (
              <div
                key={i}
                className={`${styles.featCard} ${tick === i ? styles.featCardActive : ""}`}
              >
                <span className={styles.featTag}>{f.tag}</span>
                <div className={styles.featIcon}>{f.icon}</div>
                <div className={styles.featTitle}>{f.title}</div>
                <div className={styles.featDesc}>{f.desc}</div>
              </div>
            ))}
          </div>

          {/* DOWNLOAD STRIP */}
          <div className={styles.dlStrip}>
            <span className={styles.dlLabel}>DOWNLOAD FOR</span>
            <div className={styles.dlPills}>
              {PLATFORMS.map((p, i) => (
                <a
                  key={i}
                  href={p.link}
                  className={`${styles.dlPill} ${active === i ? styles.dlPillActive : ""} ${p.primary ? styles.dlPillPrimary : ""}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                >
                  <span className={styles.pillOs}>
                    <span className={styles.pillIcon}>{p.icon}</span>
                    {p.os}
                  </span>
                  <span className={styles.pillArch}>{p.arch}</span>
                </a>
              ))}
            </div>
          </div>

          {/* STACK SECTION */}
          <div className={styles.stackSection}>
            <div className={styles.stackHeader}>
              <span className={styles.stackTitle}>ENGINE ARCHITECTURE</span>
              <span className={styles.stackLabel}>TAURI · RUST · REACT</span>
            </div>
            <div className={styles.stackBar}>
              {STACK.map((s, i) => (
                <div
                  key={i}
                  className={styles.stackSegment}
                  style={{ width: `${s.percentage}%`, background: s.color }}
                  title={`${s.name}: ${s.percentage}%`}
                />
              ))}
            </div>
            <div className={styles.stackLegend}>
              {STACK.map((s, i) => (
                <div key={i} className={styles.stackItem}>
                  <div className={styles.stackDot} style={{ background: s.color }} />
                  <span className={styles.stackItemName}>{s.name}</span>
                  <span className={styles.stackItemPct}>{s.percentage}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* TERMINAL PREVIEW */}
          <div className={styles.terminal}>
            <div className={styles.termHeader}>
              <span className={styles.termDot} style={{ background: "#ff5f57" }} />
              <span className={styles.termDot} style={{ background: "#febc2e" }} />
              <span className={styles.termDot} style={{ background: "#28c840" }} />
              <span className={styles.termTitle}>payloadx — bash</span>
            </div>
            <div className={styles.termBody}>
              <span className={styles.termPrompt}>$ </span>
              <span className={styles.termCmd}>payloadx run collection.json</span>
              <br />
              <span className={styles.termOk}>✓</span>
              <span className={styles.termMuted}> GET /api/users </span>
              <span className={styles.termStatus}>200</span>
              <span className={styles.termTime}> 12ms</span>
              <br />
              <span className={styles.termOk}>✓</span>
              <span className={styles.termMuted}> POST /api/auth </span>
              <span className={styles.termStatus}>201</span>
              <span className={styles.termTime}> 8ms</span>
              <br />
              <span className={styles.termErr}>✗</span>
              <span className={styles.termMuted}> DELETE /api/item </span>
              <span className={styles.termStatusErr}>404</span>
              <span className={styles.termTime}> 3ms</span>
              <br />
              <span className={styles.termPrompt}>$ <span className={styles.termCursor}>▋</span></span>
            </div>
          </div>

        </div>
      </main>

      {/* FOOTER */}
      <footer className={styles.footer}>
        <div className={styles.footerBrand}>
          <span className={styles.footerCopy}>© 2024 PayloadX <span className={styles.betaBadge} style={{ marginLeft: '4px' }}>Beta</span></span>
          <span className={styles.footerDivider}>·</span>
          <span className={styles.footerCreator}>
            Crafted by <span className={styles.metallicText}>Sundan Sharma</span>
          </span>
        </div>
        <div className={styles.footerLinks}>
        </div>
      </footer>
    </div>
  );
}
