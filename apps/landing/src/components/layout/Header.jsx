import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { Sun, Moon, Menu, X } from "lucide-react";
import PayloadX from "../core/Logo";
import { useTheme } from "../../context/ThemeContext";
import styles from "./Layout.module.css";

const HOME_LINKS = [
  { href: "#home", label: "Home" },
  { href: "#features", label: "Product" },
  { href: "#opportunity", label: "Opportunity" },
  { href: "#download", label: "Download" },
  { href: "#faq", label: "FAQ" },
];

const GITHUB_URL = "https://github.com/hsluzister6-max/PayloadX";

export default function Header() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();
  const isDocs = location.pathname.startsWith("/docs");
  const [open, setOpen] = useState(false);
  const VERSION = "1.0.6";

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const goHomeHash = (href) => {
    setOpen(false);
    if (location.pathname !== "/") {
      navigate({ pathname: "/", hash: href.replace("#", "") });
      return;
    }
    const id = href.replace("#", "");
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className={`${styles.nav} ${isDocs ? styles.navSolid : styles.navHome}`}>
      <div className={styles.navInner}>
        <button
          type="button"
          className={styles.logoContainer}
          onClick={() => {
            setOpen(false);
            navigate("/");
          }}
          aria-label="PayloadX home"
        >
          <PayloadX size={isDocs ? "22px" : "26px"} fontSize={isDocs ? "9px" : "10px"} />
          <div className={styles.logoTextGroup}>
            <span className={`${styles.logoName} metallic-app-name`}>PayloadX</span>
            {!isDocs && <span className={styles.betaBadge}>Beta</span>}
          </div>
        </button>

        {!isDocs && (
          <>
            <nav className={`${styles.navLinks} ${open ? styles.navLinksOpen : ""}`} aria-label="Primary">
              <div className={styles.navLinksInner}>
                {HOME_LINKS.map((l) => (
                  <button
                    key={l.href}
                    type="button"
                    className={styles.navTextLink}
                    onClick={() => goHomeHash(l.href)}
                  >
                    {l.label}
                  </button>
                ))}
                <Link
                  to="/docs"
                  className={styles.navTextLink}
                  onClick={() => setOpen(false)}
                >
                  Docs
                </Link>
              </div>

              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.navCta}
                onClick={() => setOpen(false)}
              >
                GitHub
              </a>
            </nav>

            {open && (
              <button
                type="button"
                className={styles.navBackdrop}
                aria-label="Close menu"
                onClick={() => setOpen(false)}
              />
            )}
          </>
        )}

        <div className={styles.navRight}>
          <button
            type="button"
            className={styles.themeToggle}
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Light mode" : "Dark mode"}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {isDocs && (
            <>
              <div className={styles.docsBadge}>
                <span className={styles.docsDot} />
                Docs v{VERSION}
              </div>
              <Link to="/" className={styles.navCtaCompact}>
                Home
              </Link>
            </>
          )}

          {!isDocs && (
            <>
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.navCtaDesktop}
              >
                GitHub
              </a>
              <button
                type="button"
                className={styles.menuBtn}
                aria-label={open ? "Close menu" : "Open menu"}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
              >
                {open ? <X size={18} /> : <Menu size={18} />}
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
