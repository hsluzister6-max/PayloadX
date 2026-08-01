import { useMemo } from "react";
import { useMockPlayer } from "./useMockPlayer";
import styles from "./DashboardMock.module.css";

const STATS = [
  { label: "Collections", value: 12 },
  { label: "Saved APIs", value: 69 },
  { label: "Runs today", value: 28 },
  { label: "Success", value: 98, suffix: "%" },
];

const METHODS = [
  { name: "GET", n: 25, color: "#3FB950" },
  { name: "POST", n: 23, color: "#58A6FF" },
  { name: "PUT", n: 10, color: "#E3B341" },
  { name: "DELETE", n: 11, color: "#F85149" },
];

const BARS = [28, 42, 35, 58, 46, 72, 90];
const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const RECENT = [
  { method: "POST", name: "Login", status: "200", ms: "184ms" },
  { method: "GET", name: "List Teams", status: "200", ms: "92ms" },
  { method: "POST", name: "Create Project", status: "201", ms: "210ms" },
  { method: "DELETE", name: "Delete Comment", status: "204", ms: "76ms" },
];

const methodClass = {
  GET: styles.mGet,
  POST: styles.mPost,
  PUT: styles.mPut,
  DELETE: styles.mDel,
};

const STEPS = [
  { at: 0, reveal: 0.15, flash: -1 },
  { at: 600, reveal: 0.45, flash: -1 },
  { at: 1400, reveal: 0.75, flash: 0 },
  { at: 2600, reveal: 1, flash: 1 },
  { at: 4000, reveal: 1, flash: 2 },
  { at: 5500, reveal: 1, flash: 3 },
  { at: 7000, reveal: 1, flash: -1 },
];

export default function DashboardMock({ className = "" }) {
  const steps = useMemo(() => STEPS, []);
  const { step } = useMockPlayer(steps, 9000, true);
  const max = Math.max(...BARS);
  const methodTotal = METHODS.reduce((a, m) => a + m.n, 0);
  const reveal = step.reveal ?? 1;

  return (
    <div className={`${styles.shell} ${className}`} aria-hidden="true">
      <div className={styles.titlebar}>
        <span className={styles.dot} data-c="r" />
        <span className={styles.dot} data-c="y" />
        <span className={styles.dot} data-c="g" />
        <span className={styles.title}>PayloadX · Analytics</span>
        <span className={styles.live}>
          <i /> Live
        </span>
      </div>

      <div className={styles.head}>
        <div>
          <p className={styles.greet}>Workspace overview</p>
          <p className={styles.sub}>PayloadX Backend · last 7 days</p>
        </div>
        <div className={styles.headActions}>
          <span>Refresh</span>
          <span className={styles.primary}>Import</span>
        </div>
      </div>

      <div className={styles.stats}>
        {STATS.map((s) => (
          <div key={s.label} className={styles.stat}>
            <p className={styles.statLabel}>{s.label}</p>
            <p className={styles.statValue}>
              {Math.round(s.value * reveal)}
              {s.suffix || ""}
            </p>
          </div>
        ))}
      </div>

      <div className={styles.grid}>
        <div className={styles.panel}>
          <p className={styles.panelTitle}>Run activity</p>
          <div className={styles.bars}>
            {BARS.map((v, i) => (
              <div key={DAYS[i]} className={styles.barCol}>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ height: `${(v / max) * 100 * reveal}%` }}
                  />
                </div>
                <span>{DAYS[i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.panel}>
          <p className={styles.panelTitle}>Methods</p>
          <div className={styles.methods}>
            {METHODS.map((m) => (
              <div key={m.name} className={styles.methodRow}>
                <span className={`${styles.badge} ${methodClass[m.name]}`}>{m.name}</span>
                <div className={styles.meter}>
                  <div
                    style={{
                      width: `${(m.n / methodTotal) * 100 * reveal}%`,
                      background: m.color,
                    }}
                  />
                </div>
                <em>{m.n}</em>
              </div>
            ))}
          </div>
        </div>

        <div className={`${styles.panel} ${styles.wide}`}>
          <p className={styles.panelTitle}>Recent runs</p>
          <div className={styles.runs}>
            {RECENT.map((r, i) => (
              <div
                key={r.name}
                className={`${styles.runRow} ${step.flash === i ? styles.runFlash : ""}`}
              >
                <span className={`${styles.badge} ${methodClass[r.method]}`}>{r.method}</span>
                <span className={styles.runName}>{r.name}</span>
                <span className={styles.runStatus}>{r.status}</span>
                <span className={styles.runMs}>{r.ms}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className={styles.foot}>PayloadX Engine · Created by Sundan Sharma</p>
    </div>
  );
}
