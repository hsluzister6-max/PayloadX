import { useMemo } from "react";
import { useMockPlayer } from "./useMockPlayer";
import styles from "./WorkflowMock.module.css";

const NODES = [
  { id: "n1", method: "POST", name: "Login", url: "/api/auth/login", x: 14 },
  { id: "n2", method: "GET", name: "Get Me", url: "/api/auth/me", x: 38 },
  { id: "n3", method: "DELAY", name: "Wait", url: "400 ms", x: 62 },
  { id: "n4", method: "GET", name: "List Teams", url: "/api/teams", x: 86 },
];

const STEPS = [
  { at: 0, run: false, active: null, done: [] },
  { at: 700, run: true, active: null, done: [] },
  { at: 1400, run: true, active: "n1", done: [] },
  { at: 2600, run: true, active: "n2", done: ["n1"] },
  { at: 3800, run: true, active: "n3", done: ["n1", "n2"] },
  { at: 5000, run: true, active: "n4", done: ["n1", "n2", "n3"] },
  { at: 6200, run: false, active: null, done: ["n1", "n2", "n3", "n4"] },
];

const METHOD_COLOR = {
  GET: "#3FB950",
  POST: "#58A6FF",
  DELAY: "#E3B341",
};

export default function WorkflowMock({ className = "" }) {
  const steps = useMemo(() => STEPS, []);
  const { step } = useMockPlayer(steps, 8500, true);

  const edgeOn = (fromId) => step.done.includes(fromId) || step.active === fromId;

  return (
    <div className={`${styles.shell} ${className}`} aria-hidden="true">
      <div className={styles.toolbar}>
        <div className={styles.toolLeft}>
          <span className={styles.wfName}>Auth → Team E2E</span>
          <span className={styles.badge}>4 steps</span>
        </div>
        <div className={styles.toolRight}>
          <span className={styles.ghost}>Save</span>
          <span className={`${styles.runBtn} ${step.run ? styles.runHot : ""}`}>
            {step.done.length === 4 ? "Completed" : step.run ? "Running…" : "Run Workflow"}
          </span>
        </div>
      </div>

      <div className={styles.canvas}>
        <svg className={styles.edges} viewBox="0 0 100 40" preserveAspectRatio="none">
          {[
            ["n1", "M20 20 C 26 20, 28 20, 32 20"],
            ["n2", "M44 20 C 50 20, 52 20, 56 20"],
            ["n3", "M68 20 C 74 20, 76 20, 80 20"],
          ].map(([id, d]) => (
            <path
              key={id}
              d={d}
              className={edgeOn(id) ? styles.edgeOn : styles.edge}
            />
          ))}
        </svg>

        {NODES.map((n, i) => {
          const isActive = step.active === n.id;
          const isDone = step.done.includes(n.id);
          return (
            <article
              key={n.id}
              className={[
                styles.node,
                isActive ? styles.nodeActive : "",
                isDone ? styles.nodeDone : "",
              ].join(" ")}
              style={{ left: `${n.x}%` }}
            >
              <div className={styles.nodeTop}>
                <span className={styles.step}>Step {i + 1}</span>
                <span
                  className={styles.statusDot}
                  data-state={isActive ? "run" : isDone ? "ok" : "idle"}
                />
              </div>
              <p className={styles.nodeName}>{n.name}</p>
              <div className={styles.nodeMeta}>
                <span style={{ color: METHOD_COLOR[n.method] }}>{n.method}</span>
                <code>{n.url}</code>
              </div>
              {(isDone || isActive) && (
                <div className={styles.latency}>
                  {n.method === "DELAY" ? "400ms" : `${80 + i * 36}ms`}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
