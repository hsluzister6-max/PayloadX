import { useMemo } from "react";
import { useMockPlayer } from "./useMockPlayer";
import styles from "./DesktopShellMock.module.css";

const REQUESTS = [
  { id: "signup", method: "POST", name: "Signup", color: "#58A6FF" },
  { id: "login", method: "POST", name: "Login", color: "#58A6FF" },
  { id: "me", method: "GET", name: "Get Me", color: "#3FB950" },
  { id: "teams", method: "GET", name: "List Teams", color: "#3FB950" },
];

const STEPS = [
  { at: 0, phase: "idle", activeReq: "login", tab: "Body", sending: false, status: null },
  { at: 1200, phase: "focus", activeReq: "login", tab: "Body", sending: false, status: null },
  { at: 2200, phase: "type", activeReq: "login", tab: "Body", sending: false, status: null, urlProgress: 1 },
  { at: 3800, phase: "send", activeReq: "login", tab: "Body", sending: true, status: null },
  { at: 5200, phase: "done", activeReq: "login", tab: "Body", sending: false, status: "200 OK", ms: "184ms" },
  { at: 7000, phase: "switch", activeReq: "me", tab: "Params", sending: false, status: null },
  { at: 8200, phase: "send2", activeReq: "me", tab: "Params", sending: true, status: null },
  { at: 9000, phase: "done2", activeReq: "me", tab: "Params", sending: false, status: "200 OK", ms: "92ms" },
];

const BODIES = {
  login: `{\n  "email": "{{email}}",\n  "password": "{{password}}"\n}`,
  me: `// no body`,
};

const RESPONSES = {
  login: `{\n  "token": "pxat_8f3c…",\n  "user": {\n    "name": "Sundan Sharma",\n    "email": "{{email}}"\n  }\n}`,
  me: `{\n  "_id": "usr_01",\n  "name": "Sundan Sharma",\n  "role": "owner"\n}`,
};

export default function DesktopShellMock({ variant = "hero", className = "" }) {
  const steps = useMemo(() => STEPS, []);
  const { step } = useMockPlayer(steps, 11000, true);

  const active = REQUESTS.find((r) => r.id === step.activeReq) || REQUESTS[1];
  const showResponse = Boolean(step.status);
  const url =
    active.id === "login"
      ? "{{baseUrl}}/api/auth/login"
      : "{{baseUrl}}/api/auth/me";

  return (
    <div
      className={[styles.shell, styles[`shell_${variant}`], className].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.logo}>PX</span>
          <span>PayloadX</span>
          <em>BETA</em>
        </div>
        <div className={styles.search}>
          <span>Search APIs, endpoints…</span>
          <kbd>⌘K</kbd>
        </div>
        <div className={styles.topRight}>
          <span className={styles.pillOnline}>Online</span>
          <span className={styles.pillEnv}>Cloud</span>
          <span className={styles.avatar}>S</span>
        </div>
      </header>

      <div className={styles.body}>
        <aside className={styles.sidebar}>
          <p className={styles.sideLabel}>All Collections</p>
          <p className={styles.sideRoot}>PayloadX Backend</p>
          <p className={styles.folder}>Auth</p>
          {REQUESTS.map((r) => (
            <div
              key={r.id}
              className={`${styles.req} ${step.activeReq === r.id ? styles.reqActive : ""}`}
            >
              <span style={{ color: r.color }}>{r.method}</span>
              {r.name}
            </div>
          ))}
          <p className={styles.folder}>Teams</p>
          <div className={styles.req}>
            <span style={{ color: "#3FB950" }}>GET</span>
            List Teams
          </div>
        </aside>

        <main className={styles.main}>
          <div className={styles.tabBar}>
            {REQUESTS.slice(0, 2).map((r) => (
              <div
                key={r.id}
                className={`${styles.wsTab} ${step.activeReq === r.id ? styles.wsTabActive : ""}`}
              >
                <span style={{ color: r.color }}>{r.method}</span>
                {r.name}
              </div>
            ))}
          </div>

          <div className={styles.urlBar}>
            <span className={styles.method} style={{ color: active.color }}>
              {active.method}
            </span>
            <div className={styles.url}>
              <i>{"{{baseUrl}}"}</i>
              {url.replace("{{baseUrl}}", "")}
            </div>
            <span className={`${styles.send} ${step.sending ? styles.sendBusy : ""}`}>
              {step.sending ? "…" : "Send"}
            </span>
          </div>

          <div className={styles.subTabs}>
            {["Params", "Headers", "Body", "Auth"].map((t) => (
              <span key={t} className={step.tab === t ? styles.subActive : ""}>
                {t}
              </span>
            ))}
          </div>

          <div className={styles.split}>
            <div className={styles.pane}>
              <div className={styles.paneLabel}>Request</div>
              <pre>{BODIES[active.id] || BODIES.login}</pre>
            </div>
            <div className={`${styles.pane} ${styles.paneRes}`}>
              <div className={styles.paneLabel}>
                Response
                {showResponse && (
                  <em>
                    {step.status} · {step.ms}
                  </em>
                )}
              </div>
              {step.sending && <div className={styles.loading}>Executing request…</div>}
              {showResponse && <pre className={styles.fadeIn}>{RESPONSES[active.id]}</pre>}
              {!step.sending && !showResponse && (
                <div className={styles.empty}>
                  <strong>Ready for action</strong>
                  <span>Press Send to fetch response data</span>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
