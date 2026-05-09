import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import PayloadX from "../core/Logo";
import styles from "./Layout.module.css";

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const isDocs = location.pathname.startsWith("/docs");
  const VERSION = "1.0.0";

  return (
    <nav className={styles.nav}>
      <div className={styles.logoContainer} onClick={() => navigate("/")}>
        <PayloadX size={isDocs ? "22px" : "28px"} fontSize={isDocs ? "9px" : "10px"} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span className={`${styles.logoName} metallic-app-name`}>PayloadX</span>
          <span className={styles.betaBadge}>Beta</span>
          {!isDocs && (
            <span className={styles.versionText}>v{VERSION}</span>
          )}
        </div>
      </div>
      
      <div className={styles.navSpacer} />
      
      {isDocs ? (
        <div className={styles.versionText} style={{ opacity: 1, color: '#3d4455', fontSize: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#fff', boxShadow: '0 0 6px rgba(255, 255, 255, 0.5)' }} />
          Docs v{VERSION}
        </div>
      ) : (
        <Link to="/docs" className={styles.navLink}>Docs</Link>
      )}
    </nav>
  );
}
