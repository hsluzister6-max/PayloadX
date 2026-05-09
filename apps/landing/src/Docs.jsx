import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./Docs.module.css";
import PayloadX from "./components/core/Logo";
import {
  ChevronRight, Terminal, Cpu, Layers, Github, Zap,
  Server, Lock, Code, BookOpen, Keyboard, Menu, X
} from "lucide-react";

const NAV = [
  {
    group: "Getting Started",
    items: [
      { id: "localSetup", label: "Local Setup", icon: <Server size={14} /> },
    ],
  },
  {
    group: "Architecture",
    items: [
      { id: "architecture", label: "Overview", icon: <Layers size={14} /> },
      { id: "structure", label: "File Structure", icon: <Code size={14} /> },
    ],
  },
  {
    group: "Engine",
    items: [
      { id: "performance", label: "Performance", icon: <Zap size={14} /> },
      { id: "rust", label: "Rust Core", icon: <Cpu size={14} /> },
      { id: "protocols", label: "Protocols", icon: <Server size={14} /> },
      { id: "environments", label: "Environments", icon: <Lock size={14} /> },
      { id: "workflows", label: "Workflows", icon: <BookOpen size={14} /> },
      { id: "shortcuts", label: "Shortcuts", icon: <Keyboard size={14} /> },
    ],
  },
  {
    group: "Support",
    items: [
      { id: "github", label: "Report Issue", icon: <Github size={14} />, href: "https://github.com/Sundanpatyad/api-test/issues" },
    ],
  },
];

export default function Docs() {
  const navigate = useNavigate();
  const [active, setActive] = useState("localSetup");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const SECTIONS = {
    localSetup: <LocalSetup />,
    architecture: <Architecture />,
    structure: <Structure />,
    performance: <Performance />,
    rust: <Rust />,
    protocols: <Protocols />,
    environments: <Environments />,
    workflows: <Workflows />,
    shortcuts: <Shortcuts />,
  };

  const handleNav = (id) => {
    setActive(id);
    setSidebarOpen(false);
  };

  return (
    <div className={styles.root}>
      <div className={styles.scanlines} aria-hidden />

      {/* TOP NAV */}
      <nav className={styles.nav}>
        <div
          onClick={() => navigate("/")}
          style={{ display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}
        >
          <PayloadX size="22px" fontSize="9px" />
          <span className={styles.logoName}>PayloadX</span>
        </div>
        <div className={styles.navSpacer} />
        <div className={styles.navVersion}>
          <span className={styles.navDot} />
          Docs v1.0.0
        </div>
      </nav>

      {/* LAYOUT */}
      <div className={styles.layout}>

        {/* MOBILE OVERLAY */}
        <div
          className={`${styles.sidebarOverlay} ${sidebarOpen ? styles.open : ""}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* SIDEBAR */}
        <aside className={`${styles.sidebar} ${sidebarOpen ? styles.open : ""}`}>
          {NAV.map((group) => (
            <div key={group.group} className={styles.sidebarGroup}>
              <div className={styles.sidebarGroupTitle}>{group.group}</div>
              {group.items.map((item) =>
                item.href ? (
                  <a
                    key={item.id}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.sidebarItem}
                  >
                    {item.icon}
                    {item.label}
                  </a>
                ) : (
                  <div
                    key={item.id}
                    className={`${styles.sidebarItem} ${active === item.id ? styles.sidebarItemActive : ""}`}
                    onClick={() => handleNav(item.id)}
                  >
                    {item.icon}
                    {item.label}
                  </div>
                )
              )}
              <div className={styles.sidebarDivider} />
            </div>
          ))}
        </aside>

        {/* CONTENT */}
        <main className={styles.content}>
          {/* Mobile nav toggle */}
          <button className={styles.mobileNavToggle} onClick={() => setSidebarOpen(!sidebarOpen)}>
            {sidebarOpen ? <X size={14} /> : <Menu size={14} />}
            {NAV.flatMap(g => g.items).find(i => i.id === active)?.label ?? "Menu"}
          </button>

          <div className={styles.contentInner}>
            {SECTIONS[active] ?? SECTIONS.quickstart}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ============================================================
   SECTION COMPONENTS
   ============================================================ */

function LocalSetup() {
  return (
    <div className={styles.section}>

      {/* HEADER */}
      <div>
        <div className={styles.sectionBadge}><Server size={10} /> Self-Hosting</div>
        <h1 className={styles.metallicTitle}>Local Setup</h1>
        <p className={styles.lead}>
          Run the PayloadX backend on your own infrastructure using Docker.
          Your API keys, requests, and environment variables never leave your machine.
        </p>
      </div>

      {/* QUICK DEPLOY CARD */}
      <div className={styles.quickStartCard}>
        <div className={styles.quickStartHeader}>
          <Terminal size={13} />
          DEPLOYMENT FLOW — READY TO RUN
        </div>
        <div className={styles.quickStartBody}>
          <div className={styles.qsStep}>
            <div className={styles.qsNum}>01</div>
            <div className={styles.qsContent}>
              <label>PULL IMAGE</label>
              <code className={styles.qsCode}>docker pull sundanpatyadsharma/payloadx-backend:latest</code>
            </div>
          </div>
          <div className={styles.qsStep}>
            <div className={styles.qsNum}>02</div>
            <div className={styles.qsContent}>
              <label>CREATE YOUR .ENV FILE</label>
              <p className={styles.qsDesc}>Configure your environment variables — see the full reference below.</p>
            </div>
          </div>
          <div className={styles.qsStep}>
            <div className={styles.qsNum}>03</div>
            <div className={styles.qsContent}>
              <label>START ENGINE</label>
              <code className={styles.qsCode}>docker run -d -p 3001:3001 --env-file .env sundanpatyadsharma/payloadx-backend</code>
            </div>
          </div>
          <div className={styles.qsStep}>
            <div className={styles.qsNum}>04</div>
            <div className={styles.qsContent}>
              <label>CONNECT DESKTOP</label>
              <p className={styles.qsDesc}>
                Open PayloadX Desktop → Select <strong>"Self-Hosted / Local"</strong> → Enter <code>http://localhost:3001</code>
              </p>
            </div>
          </div>
        </div>
        <div className={styles.qsFooter}>
          <Server size={11} />
          Server live at http://localhost:3001 · All data stays on your machine
        </div>
      </div>

      {/* ENV VARS */}
      <div>
        <div className={styles.sectionTitle}>Environment Variables</div>
        <p className={styles.text}>
          Create a <code>.env</code> file in the same directory where you run Docker.
          These are all the keys PayloadX requires:
        </p>
        <div className={styles.codeBlock}>
          <div className={styles.codeHeader}><span>.env</span></div>
          <div className={styles.codeBody}>
            # ── Core ────────────────────────────────────────────<br />
            MONGODB_URI=mongodb://your-db-host:27017/payloadx<br />
            JWT_SECRET=your-minimum-32-character-secret-key<br />
            PORT=3001<br />
            CORS_ORIGIN=*<br />
            <br />
            # ── Firebase (Required for Workflows) ───────────────<br />
            FIREBASE_PROJECT_ID=your-project-id<br />
            FIREBASE_CLIENT_EMAIL=your-service-account@project.iam.gserviceaccount.com<br />
            FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"<br />
            <br />
            # ── SMTP (Optional — for email OTP) ─────────────────<br />
            SMTP_HOST=smtp.gmail.com<br />
            SMTP_USER=your-email@gmail.com<br />
            SMTP_PASS=your-app-password
          </div>
        </div>
      </div>

      {/* ENV KEY TABLE */}
      <div>
        <div className={styles.sectionTitle}>Key Reference</div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Key</th>
              <th>Required</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr><td><code>MONGODB_URI</code></td><td>✓</td><td>MongoDB connection string — local or Atlas</td></tr>
            <tr><td><code>JWT_SECRET</code></td><td>✓</td><td>Min 32-char secret for signing auth tokens</td></tr>
            <tr><td><code>PORT</code></td><td>✓</td><td>Port the server listens on (default: 3001)</td></tr>
            <tr><td><code>CORS_ORIGIN</code></td><td>✓</td><td>Allowed origins — use <code>*</code> for all</td></tr>
            <tr><td><code>FIREBASE_PROJECT_ID</code></td><td>Workflows</td><td>Your Firebase project ID</td></tr>
            <tr><td><code>FIREBASE_CLIENT_EMAIL</code></td><td>Workflows</td><td>Service account client email</td></tr>
            <tr><td><code>FIREBASE_PRIVATE_KEY</code></td><td>Workflows</td><td>PEM private key from Firebase service account JSON</td></tr>
            <tr><td><code>SMTP_HOST</code></td><td>Optional</td><td>SMTP server hostname for email OTP</td></tr>
            <tr><td><code>SMTP_USER</code></td><td>Optional</td><td>SMTP login email address</td></tr>
            <tr><td><code>SMTP_PASS</code></td><td>Optional</td><td>App-specific SMTP password</td></tr>
          </tbody>
        </table>
      </div>

      {/* FIREBASE EXPLAINER */}
      <div className={styles.firebaseCard}>
        <div className={styles.firebaseCardHeader}>
          <span className={styles.firebaseIcon}>🔥</span>
          <span>Why Firebase?</span>
        </div>
        <p className={styles.firebaseText}>
          PayloadX uses <strong>MongoDB</strong> as its primary database for all your collections,
          requests, environments, and team data. Firebase is <em>only</em> used for two things:
        </p>
        <div className={styles.firebasePoints}>
          <div className={styles.firebasePoint}>
            <span className={styles.firebasePointNum}>1</span>
            <div>
              <strong>Authentication</strong> — Firebase Auth secures user sessions with
              short-lived ID tokens. This means your users' credentials are never stored in plain text
              in MongoDB.
            </div>
          </div>
          <div className={styles.firebasePoint}>
            <span className={styles.firebasePointNum}>2</span>
            <div>
              <strong>Workflow execution</strong> — Background workflow tasks are coordinated
              via Firebase Admin SDK to securely verify the identity of the caller before running
              chained API nodes on the server.
            </div>
          </div>
        </div>
        <p className={styles.firebaseNote}>
          To get your Firebase service account credentials: Firebase Console → Project Settings →
          Service Accounts → Generate new private key. Copy the <code>project_id</code>,
          <code>client_email</code>, and <code>private_key</code> fields into your <code>.env</code>.
        </p>
      </div>

      {/* DOCKER COMPOSE */}
      <div>
        <div className={styles.sectionTitle}>Docker Compose (Recommended)</div>
        <p className={styles.text}>
          Use Compose to manage the container lifecycle. Place this alongside your <code>.env</code> file:
        </p>
        <div className={styles.codeBlock}>
          <div className={styles.codeHeader}><span>docker-compose.yml</span></div>
          <div className={styles.codeBody}>
            services:<br />
            &nbsp;&nbsp;payloadx-backend:<br />
            &nbsp;&nbsp;&nbsp;&nbsp;image: sundanpatyadsharma/payloadx-backend:latest<br />
            &nbsp;&nbsp;&nbsp;&nbsp;container_name: payloadx-backend<br />
            &nbsp;&nbsp;&nbsp;&nbsp;ports:<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- "3001:3001"<br />
            &nbsp;&nbsp;&nbsp;&nbsp;env_file:<br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- .env<br />
            &nbsp;&nbsp;&nbsp;&nbsp;restart: unless-stopped
          </div>
        </div>
        <div className={styles.codeBlock} style={{ marginTop: '12px' }}>
          <div className={styles.codeHeader}><span>Shell</span></div>
          <div className={styles.codeBody}>
            # Start in background<br />
            docker compose up -d<br />
            <br />
            # Tail live logs<br />
            docker logs -f payloadx-backend<br />
            <br />
            # Stop<br />
            docker compose down
          </div>
        </div>
      </div>

      {/* PRIVACY BADGE */}
      <div className={styles.badge}>
        🛡️ <strong>Privacy First.</strong> PayloadX Cloud has zero access to your local deployment.
        All API keys, secrets, requests, and team data are stored exclusively in your own MongoDB instance.
      </div>

    </div>
  );
}


function Architecture() {
  return (
    <div className={styles.section}>
      <div>
        <div className={styles.sectionBadge}><Layers size={10} /> Architecture</div>
        <h1 className={styles.metallicTitle}>Overview</h1>
        <p className={styles.lead}>PayloadX uses a hybrid architecture balancing performance and developer velocity.</p>
      </div>

      <div>
        <div className={styles.sectionTitle}>Desktop Client (apps/desktop)</div>
        <p className={styles.text}>A Tauri application with a React frontend and a Rust execution engine for maximum throughput on hot paths.</p>
      </div>
      <div>
        <div className={styles.sectionTitle}>Cloud Backend (apps/backend)</div>
        <p className={styles.text}>Node.js/Express service handling user authentication, workspace sync, and team management via MongoDB.</p>
      </div>
      <div>
        <div className={styles.sectionTitle}>Realtime Engine (apps/realtime)</div>
        <p className={styles.text}>Dedicated Socket.IO server for cursor presence, live request edits, and team synchronization.</p>
      </div>
    </div>
  );
}

function Structure() {
  return (
    <div className={styles.section}>
      <div>
        <div className={styles.sectionBadge}><Code size={10} /> Architecture</div>
        <h1 className={styles.metallicTitle}>File Structure</h1>
        <p className={styles.lead}>PayloadX is an NPM workspace monorepo with clean, modular boundaries.</p>
      </div>

      <div>
        <div className={styles.sectionTitle}>Repository Root</div>
        <div className={styles.codeBlock}>
          <div className={styles.codeHeader}><span>Monorepo</span></div>
          <div className={styles.codeBody}>
            .github/workflows/  # CI/CD pipelines<br />
            apps/<br />
            ├── backend/        # Node.js/Express API<br />
            ├── desktop/        # Tauri + React client<br />
            ├── landing/        # Marketing & docs site<br />
            └── realtime/       # Socket.IO server<br />
            package.json        # Workspace config
          </div>
        </div>
      </div>

      <div>
        <div className={styles.sectionTitle}>Desktop Client</div>
        <div className={styles.codeBlock}>
          <div className={styles.codeHeader}><span>apps/desktop</span></div>
          <div className={styles.codeBody}>
            src/<br />
            ├── components/   # UI components<br />
            ├── hooks/        # Shared React hooks<br />
            ├── lib/          # API clients, IPC bridges<br />
            └── store/        # Zustand state managers<br />
            src-tauri/<br />
            ├── commands/     # Rust Tauri commands<br />
            ├── core/         # Networking engine<br />
            └── utils/        # Parsers (postman.rs, env_tools.rs)
          </div>
        </div>
      </div>

      <div>
        <div className={styles.sectionTitle}>Backend</div>
        <div className={styles.codeBlock}>
          <div className={styles.codeHeader}><span>apps/backend</span></div>
          <div className={styles.codeBody}>
            config/       # DB & env setup<br />
            controllers/  # Business logic<br />
            middlewares/  # JWT auth & validation<br />
            models/       # Mongoose schemas<br />
            routes/       # Express route definitions
          </div>
        </div>
      </div>
    </div>
  );
}

function Performance() {
  return (
    <div className={styles.section}>
      <div>
        <div className={styles.sectionBadge}><Zap size={10} /> Engine</div>
        <h1 className={styles.metallicTitle}>Performance</h1>
        <p className={styles.lead}>Every hot path is backed by deliberate data structure choices and algorithmic justification.</p>
      </div>

      <div>
        <div className={styles.sectionTitle}>O(1) Store Operations</div>
        <p className={styles.text}>All Zustand stores maintain a companion <code>Map&lt;id, item&gt;</code> index, dropping lookups from O(n) to O(1).</p>
        <div className={styles.codeBlock}>
          <div className={styles.codeHeader}><span>collectionStore.js</span></div>
          <div className={styles.codeBody}>
            {`// Before — O(n)\nif (state.requests.find(r => r._id === id)) ...\n\n// After — O(1)\nif (state._requestsById.has(id)) ...`}
          </div>
        </div>
      </div>

      <div>
        <div className={styles.sectionTitle}>Memoized BFS — Workflow Layers</div>
        <p className={styles.text}><code>calculateLayers()</code> runs Kahn's topological sort memoized by a topology fingerprint — skipping the O(V+E) pass entirely when structure hasn't changed.</p>
        <div className={styles.featGrid}>
          {["Kahn's Algorithm (BFS)", "Topology Fingerprint Cache", "O(V+E) → O(1) on re-render"].map(t => (
            <span key={t} className={styles.featTag}>{t}</span>
          ))}
        </div>
      </div>

      <div>
        <div className={styles.sectionTitle}>structuredClone — Fast Deep Copy</div>
        <p className={styles.text}>All deep clones replaced with native <code>structuredClone()</code> — ~10× faster than <code>JSON.parse(JSON.stringify())</code>.</p>
      </div>

      <div>
        <div className={styles.sectionTitle}>RAF-Debounced localStorage</div>
        <p className={styles.text}><code>batchedLocalStorageWrite()</code> coalesces writes within a single animation frame, eliminating serialization on every keystroke.</p>
      </div>
    </div>
  );
}

function Rust() {
  return (
    <div className={styles.section}>
      <div>
        <div className={styles.sectionBadge}><Cpu size={10} /> Engine</div>
        <h1 className={styles.metallicTitle}>Rust Core</h1>
        <p className={styles.lead}>Critical hot-path functions implemented as native Rust Tauri commands with transparent JS fallbacks.</p>
      </div>

      <div>
        <div className={styles.sectionTitle}>IPC Bridge</div>
        <p className={styles.text}>Every Rust function is wrapped in <code>src/lib/rust.js</code> — tries Tauri IPC first, falls back to pure JS automatically.</p>
        <div className={styles.codeBlock}>
          <div className={styles.codeHeader}><span>src/lib/rust.js</span></div>
          <div className={styles.codeBody}>
            {`export async function rustResolveEnv(template, env) {\n  const result = await invoke('resolve_env_variables', {...});\n  return result ?? _jsResolveEnv(template, env); // fallback\n}`}
          </div>
        </div>
      </div>

      <div>
        <div className={styles.sectionTitle}>Native Commands</div>
        <div className={styles.featGrid}>
          {["url_parse_params","url_build_from_params","resolve_env_variables","resolve_env_in_object","parse_postman_collection","execute_request","execute_workflow","execute_single_node"].map(c => (
            <span key={c} className={styles.featTag}>{c}</span>
          ))}
        </div>
      </div>

      <div>
        <div className={styles.sectionTitle}>URL ↔ Params Sync</div>
        <p className={styles.text}>Rust's <code>url</code> crate enables zero-allocation, percent-correct query string parsing — ~5-8× faster than the JS equivalent.</p>
      </div>

      <div>
        <div className={styles.sectionTitle}>Env Variable Resolution</div>
        <p className={styles.text}><code>{'{{ VAR }}'}</code> substitution via a regex compiled once at startup using <code>OnceLock&lt;Regex&gt;</code>, eliminating repeated regex construction overhead.</p>
        <div className={styles.codeBlock}>
          <div className={styles.codeHeader}><span>env_tools.rs</span></div>
          <div className={styles.codeBody}>
            {`static ENV_REGEX: OnceLock<Regex> = OnceLock::new();\n// Compiled once — reused on every invocation`}
          </div>
        </div>
      </div>
    </div>
  );
}

function Protocols() {
  return (
    <div className={styles.section}>
      <div>
        <div className={styles.sectionBadge}><Server size={10} /> Engine</div>
        <h1 className={styles.metallicTitle}>Protocols</h1>
        <p className={styles.lead}>Unified interface for multiple network protocols from a single workspace.</p>
      </div>

      <div>
        <div className={styles.sectionTitle}>REST APIs</div>
        <p className={styles.text}>Full HTTP method support with automatic header generation, multi-part form data, raw body editors, and Bearer/Basic/API Key auth.</p>
      </div>
      <div>
        <div className={styles.sectionTitle}>WebSockets</div>
        <p className={styles.text}>Bi-directional connections with manual message sending, incoming stream monitoring, and connection lifecycle events.</p>
        <div className={styles.featGrid}>
          {["Live Connection Status","Message History","Ping/Pong Keep-Alive"].map(t => <span key={t} className={styles.featTag}>{t}</span>)}
        </div>
      </div>
      <div>
        <div className={styles.sectionTitle}>Socket.IO</div>
        <p className={styles.text}>Native Socket.IO client with event-name targeting for emit and selective listener subscriptions.</p>
      </div>
    </div>
  );
}

function Environments() {
  return (
    <div className={styles.section}>
      <div>
        <div className={styles.sectionBadge}><Lock size={10} /> Engine</div>
        <h1 className={styles.metallicTitle}>Environments</h1>
        <p className={styles.lead}>Define key-value pairs and inject them dynamically into any part of your requests.</p>
      </div>

      <div>
        <div className={styles.sectionTitle}>Variable Syntax</div>
        <p className={styles.text}>Use double-curly-brace syntax to inject variables into URLs, headers, and body.</p>
        <div className={styles.codeBlock}>
          <div className={styles.codeHeader}><span>Usage</span></div>
          <div className={styles.codeBody}>
            {`// URL\n{{BASE_URL}}/api/v1/users\n\n// Header\nAuthorization: Bearer {{API_TOKEN}}`}
          </div>
        </div>
      </div>

      <div>
        <div className={styles.sectionTitle}>Rust-Powered Resolution</div>
        <p className={styles.text}>Variable interpolation handled by a Rust regex compiled once at startup — massive JSON payloads resolved in under 1ms before dispatch.</p>
      </div>
    </div>
  );
}

function Workflows() {
  return (
    <div className={styles.section}>
      <div>
        <div className={styles.sectionBadge}><BookOpen size={10} /> Engine</div>
        <h1 className={styles.metallicTitle}>Workflows</h1>
        <p className={styles.lead}>Chain multiple APIs together in a drag-and-drop canvas to test complex multi-step scenarios.</p>
      </div>

      <div>
        <div className={styles.sectionTitle}>Node-Based Execution</div>
        <p className={styles.text}>Drag requests onto the canvas and connect nodes. PayloadX resolves execution order using Kahn's Topological Sort.</p>
      </div>
      <div>
        <div className={styles.sectionTitle}>Data Passing</div>
        <p className={styles.text}>Extract values from prior responses using JSONPath and inject them into subsequent request contexts.</p>
        <div className={styles.codeBlock}>
          <div className={styles.codeHeader}><span>Example</span></div>
          <div className={styles.codeBody}>
            {`Node A (Login)      → extracts '$.data.token'\nNode B (Get Profile) → uses '{{NodeA.token}}' in headers`}
          </div>
        </div>
      </div>
    </div>
  );
}

function Shortcuts() {
  const rows = [
    ["Send Request","⌘ Enter","Ctrl Enter"],
    ["Save Request","⌘ S","Ctrl S"],
    ["New Request","⌘ N","Ctrl N"],
    ["Close Tab","⌘ W","Ctrl W"],
    ["Next Tab","⌘ ]","Ctrl ]"],
    ["Previous Tab","⌘ [","Ctrl ["],
    ["Beautify Body","⌘ B","Ctrl B"],
    ["Global Search","⌘ ⇧ F","Ctrl Shift F"],
    ["Toggle History","⌘ ⇧ H","Ctrl Shift H"],
    ["Toggle Console","⌘ ⌥ C","Ctrl Alt C"],
    ["Toggle Environments","⌘ ⌥ E","Ctrl Alt E"],
    ["Clear Console","⌘ ⌥ L","Ctrl Alt L"],
    ["Toggle Sidebar","⌘ \\","Ctrl \\"],
  ];
  return (
    <div className={styles.section}>
      <div>
        <div className={styles.sectionBadge}><Keyboard size={10} /> Reference</div>
        <h1 className={styles.metallicTitle}>Shortcuts</h1>
        <p className={styles.lead}>PayloadX is built for power users. Keep your hands on the keyboard.</p>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Action</th>
            <th>Mac</th>
            <th>Windows / Linux</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([action, mac, win]) => (
            <tr key={action}>
              <td>{action}</td>
              <td><kbd>{mac}</kbd></td>
              <td><kbd>{win}</kbd></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
