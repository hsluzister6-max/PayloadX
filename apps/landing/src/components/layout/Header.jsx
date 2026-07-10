import React from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Sun, Moon } from "lucide-react";
import PayloadX from "../core/Logo";
import { useTheme } from "../../context/ThemeContext";
import styles from "./Layout.module.css";

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const isDocs = location.pathname.startsWith("/docs");
  const VERSION = "1.0.0";

  return (
    <nav className={`${styles.nav} ${isDocs ? styles.navSolid : styles.navTransparent}`}>
      <div className={styles.logoContainer} onClick={() => navigate("/")}>
        <PayloadX size={isDocs ? "22px" : "28px"} fontSize={isDocs ? "9px" : "10px"} />
        <div className={styles.logoTextGroup}>
          <span className={`${styles.logoName} metallic-app-name`}>PayloadX</span>
          <span className={styles.betaBadge}>Beta</span>
          {!isDocs && <span className={styles.versionText}>v{VERSION}</span>}
        </div>
      </div>

      <div className={styles.navSpacer} />

      {isDocs && (
        <button
          type="button"
          className={styles.themeToggle}
          onClick={toggleTheme}
          aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          title={theme === "dark" ? "Light mode" : "Dark mode"}
        >
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      )}

      {isDocs ? (
        <div className={styles.docsBadge}>
          <span className={styles.docsDot} />
          Docs v{VERSION}
        </div>
      ) : (
        <Link to="/docs" className={styles.navLink}>Docs</Link>
      )}
    </nav>
  );
}
