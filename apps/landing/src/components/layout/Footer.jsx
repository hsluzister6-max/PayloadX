import React from "react";
import styles from "./Layout.module.css";

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.footerBrand}>
        <span className={styles.footerCopy}>
          © PayloadX <span className={styles.betaBadge} style={{ marginLeft: '4px' }}>Beta</span>
        </span>
        <span className={styles.footerDivider}>·</span>
        <span className={styles.footerCreator}>
          Crafted by{" "}
          <a 
            href="https://www.linkedin.com/in/sundan-sharma/" 
            target="_blank" 
            rel="noopener noreferrer" 
            className={styles.metallicText}
          >
            Sundan Sharma
          </a>
        </span>
      </div>
      <div className={styles.footerLinks}>
      </div>
    </footer>
  );
}
