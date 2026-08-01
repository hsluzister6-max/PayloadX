import styles from "./StudioMock.module.css";

const FOLDERS = [
  { name: "Auth", count: 12 },
  { name: "Teams", count: 7 },
  { name: "Projects", count: 5 },
  { name: "Environments", count: 7 },
];

export default function StudioMock({ className = "" }) {
  return (
    <div className={`${styles.shell} ${className}`} aria-hidden="true">
      <div className={styles.titlebar}>
        <span className={styles.dot} data-c="r" />
        <span className={styles.dot} data-c="y" />
        <span className={styles.dot} data-c="g" />
        <span className={styles.title}>PayloadX · Login</span>
        <span className={styles.env}>Cloud</span>
      </div>

      <div className={styles.body}>
        <aside className={styles.rail}>
          <div className={styles.railItem} data-active />
          <div className={styles.railItem} />
          <div className={styles.railItem} />
          <div className={styles.railItem} />
        </aside>

        <aside className={styles.sidebar}>
          <p className={styles.sideLabel}>Collections</p>
          <p className={styles.sideRoot}>PayloadX Backend</p>
          {FOLDERS.map((f) => (
            <div key={f.name} className={styles.sideRow}>
              <span className={styles.folder} />
              <span>{f.name}</span>
              <em>{f.count}</em>
            </div>
          ))}
        </aside>

        <main className={styles.main}>
          <div className={styles.tabs}>
            <span className={styles.tab}>POST Signup</span>
            <span className={`${styles.tab} ${styles.tabActive}`}>POST Login</span>
          </div>

          <div className={styles.urlBar}>
            <span className={styles.method}>POST</span>
            <span className={styles.url}>
              <i>{"{{baseUrl}}"}</i>/api/auth/login
            </span>
            <span className={styles.send}>Send</span>
          </div>

          <div className={styles.subTabs}>
            <span>Params</span>
            <span>Headers</span>
            <span className={styles.subActive}>Body</span>
            <span>Auth</span>
          </div>

          <pre className={styles.code}>{`{
  "email": "{{email}}",
  "password": "{{password}}"
}`}</pre>

          <div className={styles.response}>
            <div className={styles.resMeta}>
              <span className={styles.ok}>200 OK</span>
              <span>184 ms</span>
              <span>1.2 KB</span>
            </div>
            <pre className={styles.resBody}>{`{
  "token": "pxat_••••••••",
  "user": { "name": "Sundan Sharma" }
}`}</pre>
          </div>
        </main>
      </div>
    </div>
  );
}
