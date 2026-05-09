import React, { useState, useEffect } from "react";
import { Routes, Route, Link, useLocation } from "react-router-dom";
import styles from "./App.module.css";
import { Zap, Lock, Users, Code, Download, Server, Terminal } from 'lucide-react';
import { FaApple, FaWindows, FaLinux } from 'react-icons/fa6';
import Header from "./components/layout/Header";
import Footer from "./components/layout/Footer";

const FEATURES = [
  { icon: <Zap size={18} />, tag: "PERFORMANCE", title: "Lightning Fast", desc: "TypeScript & Rust engine" },
  { icon: <Lock size={18} />, tag: "SECURITY", title: "Encrypted", desc: "JWT + local vault" },
  { icon: <Users size={18} />, tag: "TEAMS", title: "Sync", desc: "Real-time collab" },
  { icon: <Code size={18} />, tag: "DEV", title: "Type-Safe", desc: "Powered by TypeScript" },
];


const STACK = [
  { name: "TypeScript", percentage: 50, color: "#94a3b8", desc: "Type-Safe Frontend Logic" },
  { name: "Rust", percentage: 40, color: "#64748b", desc: "High-Performance Core Engine" },
  { name: "CSS", percentage: 10, color: "#563d7c", desc: "Premium Metallic Styling" },
];

const REPO_URL = "https://github.com/hsluzister6-max/PayloadX";
const VERSION = "1.0.0";
const STATIC_DL = `${REPO_URL}/releases/download/main`;

const PLATFORMS = [
  { os: "macOS", arch: "Apple Silicon", icon: <FaApple />, primary: true, link: "#", comingSoon: true },
  { os: "Windows", arch: "x64", icon: <FaWindows />, link: `${STATIC_DL}/PayloadX_x64-setup.exe` },
  { os: "iOS", arch: "Beta", icon: <FaApple />, link: "#", comingSoon: true },
  { os: "Linux", arch: "AppImage", icon: <FaLinux />, link: `${STATIC_DL}/payload-x_amd64.AppImage` },
  { os: "Linux", arch: "Debian", icon: <FaLinux />, link: `${STATIC_DL}/payload-x_amd64.deb` },
];


import Docs from "./Docs";

export default function App() {
  const [active, setActive] = useState(null);
  const [tick, setTick] = useState(0);
  const [userOS, setUserOS] = useState({ name: "Windows", link: `${STATIC_DL}/PayloadX_x64-setup.exe`, icon: <FaWindows /> });

  useEffect(() => {
    const id = setInterval(() => setTick(t => (t + 1) % 4), 2200);

    // Detect OS
    const ua = window.navigator.userAgent;

    if (/iPad|iPhone|iPod/.test(ua)) {
      setUserOS({ name: "iOS", link: "#", icon: <FaApple /> });
    } else if (ua.indexOf("Win") !== -1) {
      setUserOS({ name: "Windows", link: `${STATIC_DL}/PayloadX_x64-setup.exe`, icon: <FaWindows /> });
    } else if (ua.indexOf("Mac") !== -1) {
      setUserOS({ name: "macOS", link: "#", icon: <FaApple /> });
    } else if (ua.indexOf("Linux") !== -1) {
      setUserOS({ name: "Linux", link: `${STATIC_DL}/payload-x_amd64.AppImage`, icon: <FaLinux /> });
    }

    return () => clearInterval(id);
  }, []);

  const location = useLocation();
  const isDocs = location.pathname.startsWith("/docs");

  return (
    <div className={`${styles.root} ${isDocs ? styles.rootDocs : styles.rootHome}`}>
      <Header />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Routes>
          <Route path="/" element={<Hero active={active} setActive={setActive} userOS={userOS} VERSION={VERSION} />} />
          <Route path="/docs" element={<Docs />} />
          <Route path="/docs/:sectionId" element={<Docs />} />
        </Routes>
      </div>
      <Footer />
    </div>
  );
}

function Hero({ active, setActive, userOS, VERSION }) {
  return (
    <>
      {/* scanline overlay */}
      <div className={styles.scanlines} aria-hidden />

      {/* mesh background */}
      <div className={styles.mesh} aria-hidden />

      {/* MAIN GRID */}
      <main className={styles.main}>

        {/* LEFT COLUMN */}
        <section className={styles.left}>
          <div className={styles.badge}>
            <span className={styles.badgeDot} />
            OPEN SOURCE · FREE FOREVER
          </div>

          <h1 className={styles.title}>
            <span className={`${styles.titleChrome} metallic-app-name`}>Payload</span>
            <span className={`${styles.titleX} metallic-app-name`}>X</span>
          </h1>

          <h2 className={styles.tagline}>API Testing,<br />Simplified.</h2>

          <p className={styles.sub}>
            The modern, lightweight alternative to Postman —
            built for developers who move fast.
          </p>

          <div className={styles.ctaRow}>
            <a 
              href={userOS.link === "#" ? undefined : userOS.link} 
              className={`${styles.btnPrimary} ${userOS.link === "#" ? styles.btnDisabled : ""}`}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {userOS.icon}
                {userOS.link === "#" ? `Coming Soon for ${userOS.name}` : `Download for ${userOS.name}`}
              </span>
            </a>
            <Link to="/docs" className={styles.btnSecondary}>
              <Terminal size={18} />
              Local Setup
            </Link>
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

          {/* stat strip */}
          <div className={styles.stats}>
            <div className={styles.stat}><span className={styles.statNum}>2.4ms</span><span className={styles.statLabel}>avg latency</span></div>
            <div className={styles.statDiv} />
            <div className={styles.stat}><span className={styles.statNum}>4</span><span className={styles.statLabel}>platforms</span></div>
            <div className={styles.statDiv} />
            <div className={styles.stat}><span className={styles.statNum}>100%</span><span className={styles.statLabel}>free</span></div>
          </div>
        </section>

        {/* RIGHT COLUMN */}
        <div className={styles.right}>

          {/* APP MOCKUP */}
          <div className={styles.appMockup}>
            <div className={styles.mockHeader}>
              <div className={styles.mockDots}>
                <span className={styles.mockDot} style={{ background: '#ff5f57' }} />
                <span className={styles.mockDot} style={{ background: '#febc2e' }} />
                <span className={styles.mockDot} style={{ background: '#28c840' }} />
              </div>
              <div className={styles.mockTitle}>PayloadX Studio</div>
            </div>
            <div className={styles.mockBody}>
              <div className={styles.mockSidebar}>
                <div className={styles.mockSideItemActive}>
                  <Zap size={12} style={{ color: '#cbd5e1' }} />
                  <span>Get Users</span>
                </div>
                <div className={styles.mockSideItem}>
                  <Code size={12} style={{ color: '#94a3b8' }} />
                  <span>Auth User</span>
                </div>
                <div className={styles.mockSideItem}>
                  <Users size={12} style={{ color: '#94a3b8' }} />
                  <span>Team Sync</span>
                </div>
                <div className={styles.mockSideItem}>
                  <Lock size={12} style={{ color: '#94a3b8' }} />
                  <span>List Vaults</span>
                </div>
              </div>
              <div className={styles.mockMain}>
                <div className={styles.mockUrlBar}>
                  <div className={styles.mockMethod}>GET</div>
                  <div className={styles.mockUrl}>https://api.payloadx.app/v1/users</div>
                  <div className={styles.mockSend}>Send</div>
                </div>
                <div className={styles.mockResponse}>
                  <div className={styles.mockResHeader}>
                    <span>Response</span>
                    <span className={styles.mockStatus}>200 OK</span>
                    <span className={styles.mockTime}>12ms</span>
                  </div>
                  <div className={styles.mockCode}>
                    {`{
  "status": "success",
  "data": {
    "user": "sundan",
    "role": "architect",
    "region": "global-1"
  }
}`}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* DOWNLOAD STRIP */}
          <div className={styles.dlStrip}>
            <span className={styles.dlLabel}>DOWNLOAD FOR</span>
            <div className={styles.dlPills}>
              {PLATFORMS.map((p, i) => {
                const isComingSoon = p.link === "#" || p.comingSoon;
                return (
                  <a
                    key={i}
                    href={isComingSoon ? undefined : p.link}
                    className={`${styles.dlPill} ${active === i ? styles.dlPillActive : ""} ${p.primary ? styles.dlPillPrimary : ""} ${isComingSoon ? styles.pillDisabled : ""}`}
                    onMouseEnter={() => !isComingSoon && setActive(i)}
                    onMouseLeave={() => setActive(null)}
                  >
                    <span className={styles.pillOs}>
                      <span className={styles.pillIcon}>{p.icon}</span>
                      {p.os}
                    </span>
                    <span className={styles.pillArch}>{isComingSoon ? "Coming Soon" : p.arch}</span>
                  </a>
                );
              })}
            </div>
          </div>

          {/* QUICK START SECTION */}
          <div className={styles.setupCard}>
            <div className={styles.setupHeader}>
              <span className={styles.setupTitle}>PRIVATE SELF-HOSTED SETUP</span>
              <Link to="/docs" className={styles.setupLink}>VIEW FULL DOCS →</Link>
            </div>
            <div className={styles.steps}>
              <div className={styles.step}>
                <span className={styles.stepNum}>01</span>
                <div className={styles.stepContent}>
                  <span className={styles.stepLabel}>PULL</span>
                  <code>docker pull sundanpatyadsharma/payloadx-backend</code>
                </div>
              </div>
              <div className={styles.step}>
                <span className={styles.stepNum}>02</span>
                <div className={styles.stepContent}>
                  <span className={styles.stepLabel}>RUN</span>
                  <code>docker run -d -p 3001:3001 -e MONGODB_URI="..." sundanpatyadsharma/payloadx-backend</code>
                </div>
              </div>
              <div className={styles.step}>
                <span className={styles.stepNum}>03</span>
                <div className={styles.stepContent}>
                  <span className={styles.stepLabel}>USE</span>
                  <p>Connect Desktop App to http://localhost:3001</p>
                </div>
              </div>
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


        </div>
      </main>

    </>
  );
}
