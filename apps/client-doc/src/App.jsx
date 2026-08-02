import { Moon, Sun } from "lucide-react";
import ProductDocument from "./ProductDocument.jsx";
import { useTheme } from "./ThemeContext.jsx";
import styles from "./App.module.css";

const LANDING_URL = "https://payloadx.app";
const GITHUB_URL = "https://github.com/hsluzister6-max/PayloadX";

export default function App() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <img src="/logo.png" alt="" width={22} height={22} />
          <div>
            <p className={styles.brandName}>PayloadX</p>
            <p className={styles.brandSub}>Client product document</p>
          </div>
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.themeBtn}
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <a href={LANDING_URL} target="_blank" rel="noopener noreferrer" className={styles.link}>
            Website
          </a>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={styles.cta}>
            GitHub
          </a>
        </div>
      </header>
      <main className={styles.main}>
        <ProductDocument />
      </main>
    </div>
  );
}
