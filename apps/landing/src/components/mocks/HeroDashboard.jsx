import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  BarChart2,
  FolderOpen,
  Workflow,
  Layers,
  Settings,
} from "lucide-react";
import { useMemo } from "react";
import { useMockPlayer } from "./useMockPlayer";
import styles from "./HeroDashboard.module.css";

const RAIL_ICONS = [
  { id: "analytics", Icon: BarChart2, active: true },
  { id: "collections", Icon: FolderOpen },
  { id: "workflow", Icon: Workflow },
  { id: "environments", Icon: Layers },
  { id: "settings", Icon: Settings },
];

const STATS = [
  { label: "Collections", value: 12 },
  { label: "Saved APIs", value: 69 },
  { label: "Runs", value: 28 },
  { label: "Success", value: 98, suffix: "%" },
];

const BARS = [32, 48, 40, 62, 55, 78, 92];
const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

const METHODS = [
  { name: "GET", n: 25, color: "#3FB950" },
  { name: "POST", n: 23, color: "#58A6FF" },
  { name: "PUT", n: 10, color: "#E3B341" },
  { name: "DEL", n: 11, color: "#F85149" },
];

const RECENT = [
  { method: "POST", name: "Login", status: "200", ms: "184ms" },
  { method: "GET", name: "Get Me", status: "200", ms: "92ms" },
  { method: "GET", name: "List Teams", status: "200", ms: "110ms" },
];

const STEPS = [
  { at: 0, reveal: 0.2, flash: -1 },
  { at: 800, reveal: 0.55, flash: 0 },
  { at: 2000, reveal: 0.85, flash: 1 },
  { at: 3400, reveal: 1, flash: 2 },
  { at: 5000, reveal: 1, flash: -1 },
];

export default function HeroDashboard({
  titleChars,
  downloadLink,
  downloadLabel,
}) {
  const steps = useMemo(() => STEPS, []);
  const { step } = useMockPlayer(steps, 7000, true);
  const reveal = step.reveal ?? 1;
  const max = Math.max(...BARS);
  const methodTotal = METHODS.reduce((a, m) => a + m.n, 0);

  return (
    <div className={`${styles.shell} hero-canvas`}>
      <div className={styles.body}>
        <aside className={styles.rail} aria-hidden="true">
          {RAIL_ICONS.map(({ id, Icon, active }) => (
            <span key={id} className={active ? styles.railOn : undefined}>
              <Icon size={15} strokeWidth={1.75} />
            </span>
          ))}
        </aside>

        <aside className={styles.sidebar} aria-hidden="true">
          <p className={styles.sideLabel}>Workspace</p>
          <p className={`${styles.navItem} ${styles.navOn}`}>Dashboard</p>
          <p className={styles.navItem}>Collections</p>
          <p className={styles.navItem}>Workflows</p>
          <p className={styles.navItem}>Environments</p>
          <p className={styles.sideLabel}>Recent</p>
          <p className={styles.recent}>
            <i style={{ color: "#58A6FF" }}>POST</i> Login
          </p>
          <p className={styles.recent}>
            <i style={{ color: "#3FB950" }}>GET</i> List Teams
          </p>
        </aside>

        <main className={styles.main}>
          <div className={`${styles.heroBlock} hero-content`}>
            <p className={`${styles.eyebrow} hero-brand hero-anim`}>PayloadX</p>
            <h1 className={`${styles.title} hero-title hero-anim`}>{titleChars}</h1>
            <p className={`${styles.lead} hero-lead hero-anim`}>
              Institutional-grade API studio — native speed, local-first custody,
              workflows that ship with you.
            </p>
            <div className={styles.ctaRow}>
              <a
                href={downloadLink}
                className={`${styles.btnPrimary} hero-cta hero-anim`}
                download
              >
                Download for {downloadLabel}
                <ArrowUpRight size={15} />
              </a>
              <Link to="/docs" className={`${styles.btnGhost} hero-cta hero-anim`}>
                Read the docs
              </Link>
            </div>
            <div className={`${styles.creator} hero-listed hero-anim`}>
              <img
                src="/sundan-sharma.png"
                alt="Sundan Sharma"
                className={styles.photo}
                width={44}
                height={44}
              />
              <div>
                <span className={styles.creatorLabel}>Created by</span>
                <span className={styles.creatorName}>Sundan Sharma</span>
              </div>
              <div className={styles.stack}>
                <span>Rust</span>
                <span>Tauri</span>
                <span>React</span>
              </div>
            </div>
          </div>

          <div className={styles.stats} aria-hidden="true">
            {STATS.map((s) => (
              <div key={s.label} className={styles.stat}>
                <p>{s.label}</p>
                <strong>
                  {Math.round(s.value * reveal)}
                  {s.suffix || ""}
                </strong>
              </div>
            ))}
          </div>

          <div className={styles.grid} aria-hidden="true">
            <div className={styles.panel}>
              <p className={styles.panelTitle}>Run activity</p>
              <div className={styles.bars}>
                {BARS.map((v, i) => (
                  <div key={DAYS[i]} className={styles.barCol}>
                    <div className={styles.track}>
                      <div style={{ height: `${(v / max) * 100 * reveal}%` }} />
                    </div>
                    <span>{DAYS[i]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={styles.panel}>
              <p className={styles.panelTitle}>Methods</p>
              {METHODS.map((m) => (
                <div key={m.name} className={styles.methodRow}>
                  <span style={{ color: m.color }}>{m.name}</span>
                  <div className={styles.meter}>
                    <i style={{ width: `${(m.n / methodTotal) * 100 * reveal}%`, background: m.color }} />
                  </div>
                  <em>{m.n}</em>
                </div>
              ))}
            </div>
            <div className={`${styles.panel} ${styles.wide}`}>
              <p className={styles.panelTitle}>Recent runs</p>
              {RECENT.map((r, i) => (
                <div
                  key={r.name}
                  className={`${styles.run} ${step.flash === i ? styles.runFlash : ""}`}
                >
                  <span
                    style={{
                      color:
                        r.method === "POST" ? "#58A6FF" : r.method === "GET" ? "#3FB950" : "#F85149",
                    }}
                  >
                    {r.method}
                  </span>
                  <b>{r.name}</b>
                  <em>{r.status}</em>
                  <small>{r.ms}</small>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
