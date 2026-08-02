import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Boxes,
  Cloud,
  Code2,
  FolderTree,
  GitBranch,
  Globe2,
  KeyRound,
  Layers,
  Lock,
  Monitor,
  Network,
  Shield,
  Sparkles,
  Terminal,
  Workflow,
  Zap,
} from "lucide-react";
import FlowChart, { FlowBranches } from "./FlowChart.jsx";
import styles from "./ProductDocument.module.css";

const LANDING_URL = "https://payloadx.app";
const DOCS_URL = "https://payloadx.app/docs";
const RELEASES_URL =
  "https://github.com/hsluzister6-max/PayloadX/releases/tag/v1.0.6";

const TOC = [
  { id: "summary", label: "1. Summary" },
  { id: "what", label: "2. What is PayloadX" },
  { id: "how", label: "3. How it works" },
  { id: "tech", label: "4. Technologies" },
  { id: "flows", label: "5. System flows" },
  { id: "workflows", label: "6. Workflows" },
  { id: "features", label: "7. Features" },
  { id: "platforms", label: "8. Platforms" },
  { id: "start", label: "9. Getting started" },
];

const TECH_LAYERS = [
  {
    layer: "Desktop app",
    items: [
      { name: "Tauri", why: "Native window shell, small install size, system APIs" },
      { name: "React 18", why: "Studio UI: request builder, sidebar, panels" },
      { name: "Zustand", why: "Client state for collections, tabs, environments" },
      { name: "Monaco / viewers", why: "JSON editing and response inspection" },
      { name: "React Flow", why: "Visual workflow canvas" },
    ],
  },
  {
    layer: "Native core",
    items: [
      { name: "Rust", why: "Fast request send, env resolve, workflow run, Postman parse" },
      { name: "Tauri commands", why: "Safe bridge from React UI to Rust functions" },
    ],
  },
  {
    layer: "Optional backend",
    items: [
      { name: "Node + Express", why: "REST API for teams, sync, auth, MCP" },
      { name: "MongoDB", why: "Stores projects, collections, workflows, users" },
      { name: "Socket.IO", why: "Live presence and collaborative updates" },
      { name: "JWT + Firebase Auth", why: "Account sessions and secure API access" },
    ],
  },
  {
    layer: "AI and tooling",
    items: [
      { name: "MCP server", why: "Cursor / Claude can create APIs and workflows" },
      { name: "Express route CLI", why: "Scan backend routes into collections" },
    ],
  },
];

const FEATURE_GROUPS = [
  {
    title: "Request studio",
    icon: Zap,
    items: [
      {
        name: "REST client",
        detail:
          "Send HTTP with params, headers, auth, and body types (JSON, form data, urlencoded).",
      },
      {
        name: "WebSocket / Socket.IO",
        detail: "Realtime connections, emit, listen, and message history in the same workspace.",
      },
      {
        name: "Response studio",
        detail: "Status, timing, headers, JSON tree, HTML preview for fast debugging.",
      },
    ],
  },
  {
    title: "Organization",
    icon: FolderTree,
    items: [
      {
        name: "Collections and folders",
        detail: "Group APIs so large projects stay easy to navigate.",
      },
      {
        name: "Teams and projects",
        detail: "Shared workspace hierarchy for collaboration when sync is enabled.",
      },
      {
        name: "Import / export",
        detail: "Postman Collection v2.1 import and export for migration.",
      },
    ],
  },
  {
    title: "Environments",
    icon: Layers,
    items: [
      {
        name: "{{variables}}",
        detail: "Inject values into URL, headers, and body. Secrets can be masked in the UI.",
      },
      {
        name: "Rust resolution",
        detail: "Variable substitution runs in the native core for speed and consistency.",
      },
    ],
  },
  {
    title: "Collaboration",
    icon: Cloud,
    items: [
      {
        name: "Local first",
        detail: "Work offline. Sync is optional, never forced.",
      },
      {
        name: "Cloud or self host",
        detail: "Use PayloadX Cloud or run the Express backend with Docker on your servers.",
      },
      {
        name: "Offline queue",
        detail: "Changes queue when offline and retry when the network returns.",
      },
    ],
  },
];

export default function ProductDocument() {
  const [active, setActive] = useState("summary");

  useEffect(() => {
    const nodes = TOC.map((t) => document.getElementById(t.id)).filter(Boolean);
    if (!nodes.length) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) setActive(visible[0].target.id);
      },
      { rootMargin: "-18% 0px -62% 0px", threshold: [0.12, 0.4] }
    );

    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.page}>
      <aside className={styles.toc} aria-label="Document outline">
        <p className={styles.tocEyebrow}>Client document</p>
        <p className={styles.tocTitle}>PayloadX</p>
        <p className={styles.tocHint}>Clean guide to product, tech, and flows</p>
        <nav className={styles.tocNav}>
          {TOC.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              className={active === item.id ? styles.tocLinkOn : styles.tocLink}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className={styles.tocActions}>
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className={styles.tocSecondary}>
            Technical docs
          </a>
          <a href={RELEASES_URL} target="_blank" rel="noopener noreferrer" className={styles.tocPrimary}>
            Download
            <ArrowUpRight size={14} />
          </a>
        </div>
      </aside>

      <article className={styles.doc}>
        <header className={styles.hero}>
          <p className={styles.kicker}>Product document · v1.0.6</p>
          <h1 className={styles.title}>PayloadX explained</h1>
          <p className={styles.lead}>
            A simple, detailed guide to what PayloadX is, how it works, which
            technologies power it, and how requests, sync, and workflows move
            through the system.
          </p>
        </header>

        {/* 1 */}
        <section id="summary" className={styles.section}>
          <h2>1. Summary</h2>
          <p>
            PayloadX is a <strong>native desktop API studio</strong>. Developers
            use it to build, send, debug, and automate API calls. It is local
            first, open source, and built for speed with a Rust core inside a
            Tauri app.
          </p>
          <div className={styles.simpleGrid}>
            <div className={styles.simpleCard}>
              <span>Problem</span>
              <p>Heavy API tools feel slow, cloud locked, and hard to audit.</p>
            </div>
            <div className={styles.simpleCard}>
              <span>Solution</span>
              <p>A lean native studio with optional sync and built in workflows.</p>
            </div>
            <div className={styles.simpleCard}>
              <span>Result</span>
              <p>Faster testing, private by default, ready for teams and AI tools.</p>
            </div>
          </div>
          <div className={styles.callout}>
            <Lock size={16} />
            <p>
              Your data stays on your machine unless you choose cloud sync or a
              self hosted backend.
            </p>
          </div>
        </section>

        {/* 2 */}
        <section id="what" className={styles.section}>
          <h2>2. What is PayloadX</h2>
          <p>
            Think of PayloadX as a workbench for APIs. In one app you can:
          </p>
          <ul className={styles.bullets}>
            <li>Send REST, WebSocket, and Socket.IO requests</li>
            <li>Organize APIs in collections and folders</li>
            <li>Use environments with <code>{"{{variables}}"}</code></li>
            <li>Chain steps in visual workflows</li>
            <li>Optionally sync with a team backend</li>
            <li>Connect AI assistants through MCP</li>
          </ul>

          <h3 className={styles.h3}>Who it is for</h3>
          <div className={styles.cardGrid}>
            <div className={styles.card}>
              <Boxes size={18} />
              <h3>API developers</h3>
              <p>Daily testing and debugging of HTTP and realtime APIs.</p>
            </div>
            <div className={styles.card}>
              <GitBranch size={18} />
              <h3>Engineering teams</h3>
              <p>Shared collections and projects when sync is turned on.</p>
            </div>
            <div className={styles.card}>
              <Shield size={18} />
              <h3>Privacy focused orgs</h3>
              <p>Local first work or fully self hosted collaboration.</p>
            </div>
            <div className={styles.card}>
              <Terminal size={18} />
              <h3>AI assisted builders</h3>
              <p>Create requests and workflows from Cursor or Claude via MCP.</p>
            </div>
          </div>
        </section>

        {/* 3 */}
        <section id="how" className={styles.section}>
          <h2>3. How it works</h2>
          <p>
            PayloadX has two layers. You always use the desktop app. The backend
            is optional and only needed for sync, teams, and MCP cloud access.
          </p>

          <FlowChart
            title="Big picture"
            steps={[
              {
                label: "Desktop app",
                note: "UI + local storage. Where you work every day.",
              },
              {
                label: "Rust core",
                note: "Sends requests, resolves variables, runs workflows.",
              },
              {
                label: "Optional backend",
                note: "Auth, sync, teams, MCP, realtime events.",
              },
              {
                label: "Your APIs",
                note: "The services you test in any environment.",
              },
            ]}
          />

          <h3 className={styles.h3}>Day to day loop</h3>
          <ol className={styles.steps}>
            <li>
              <strong>Open a collection</strong> and pick or create a request.
            </li>
            <li>
              <strong>Fill URL, headers, auth, and body.</strong> Use environment
              variables for base URLs and tokens.
            </li>
            <li>
              <strong>Send.</strong> The UI calls a Rust command. Rust performs
              the network work and returns status, headers, body, and timing.
            </li>
            <li>
              <strong>Inspect the response</strong> and save the request if it
              should stay in the collection.
            </li>
            <li>
              <strong>Optional:</strong> sync the change to cloud or self hosted
              backend so teammates see it.
            </li>
          </ol>

          <FlowBranches
            title="Three ways to run PayloadX"
            branches={[
              {
                title: "Local only",
                steps: [
                  "Install desktop app",
                  "Work offline",
                  "History and collections stay local",
                  "No backend required",
                ],
              },
              {
                title: "PayloadX Cloud",
                steps: [
                  "Sign in to cloud",
                  "Sync teams and projects",
                  "Realtime collaboration",
                  "MCP tokens for AI tools",
                ],
              },
              {
                title: "Self hosted",
                steps: [
                  "Run Docker / Node backend",
                  "Point desktop to your URL",
                  "Data stays in your MongoDB",
                  "Same sync and team features",
                ],
              },
            ]}
          />
        </section>

        {/* 4 */}
        <section id="tech" className={styles.section}>
          <h2>4. Technologies</h2>
          <p>
            Each technology has one clear job. Together they keep the UI smooth
            and the heavy work fast and safe.
          </p>

          <div className={styles.stackGrid}>
            <div className={styles.stackCard}>
              <Monitor size={16} />
              <span>Shell</span>
              <strong>Tauri</strong>
            </div>
            <div className={styles.stackCard}>
              <Zap size={16} />
              <span>Core</span>
              <strong>Rust</strong>
            </div>
            <div className={styles.stackCard}>
              <Code2 size={16} />
              <span>UI</span>
              <strong>React</strong>
            </div>
            <div className={styles.stackCard}>
              <Network size={16} />
              <span>API</span>
              <strong>Express</strong>
            </div>
            <div className={styles.stackCard}>
              <Layers size={16} />
              <span>Data</span>
              <strong>MongoDB</strong>
            </div>
            <div className={styles.stackCard}>
              <Globe2 size={16} />
              <span>AI bridge</span>
              <strong>MCP</strong>
            </div>
          </div>

          {TECH_LAYERS.map((group) => (
            <div key={group.layer} className={styles.techBlock}>
              <h3>{group.layer}</h3>
              <div className={styles.techTable}>
                {group.items.map((item) => (
                  <div key={item.name} className={styles.techRow}>
                    <strong>{item.name}</strong>
                    <p>{item.why}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className={styles.note}>
            <Sparkles size={15} />
            <p>
              Hot paths (send request, resolve env, run workflow) prefer Rust.
              If a native call is unavailable, the app can fall back to JavaScript
              so the studio still works.
            </p>
          </div>
        </section>

        {/* 5 */}
        <section id="flows" className={styles.section}>
          <h2>5. System flows</h2>
          <p>
            These charts show the main paths inside PayloadX. Read them top to
            bottom or left to right.
          </p>

          <h3 className={styles.h3}>A. Send a REST request</h3>
          <FlowChart
            title="Request send path"
            direction="vertical"
            steps={[
              { label: "User clicks Send", note: "In the request studio" },
              {
                label: "UI prepares payload",
                note: "Method, URL, headers, body, auth, active environment",
              },
              {
                label: "Resolve {{variables}}",
                note: "Rust substitutes environment values (secrets included)",
              },
              {
                label: "Rust executes HTTP",
                note: "Native networking, timing captured",
              },
              {
                label: "Response returns to UI",
                note: "Status, headers, body, duration shown in response panel",
              },
              {
                label: "History updated",
                note: "Local history stores the run for later",
              },
            ]}
          />

          <h3 className={styles.h3}>B. Environment variable injection</h3>
          <FlowChart
            title="Variable path"
            steps={[
              { label: "Define env", note: "BASE_URL, TOKEN, ..." },
              { label: "Write {{TOKEN}}", note: "In URL, header, or body" },
              { label: "Resolve on send", note: "Rust replaces tokens" },
              { label: "Call real API", note: "Final values only leave the app" },
            ]}
          />

          <h3 className={styles.h3}>C. Sync and collaboration</h3>
          <FlowChart
            title="Optional sync path"
            direction="vertical"
            steps={[
              { label: "User edits locally", note: "Create or update a request" },
              {
                label: "Online check",
                note: "If offline, change goes into sync queue",
              },
              {
                label: "API call to backend",
                note: "Express + MongoDB stores the change",
              },
              {
                label: "Socket.IO event",
                note: "Teammates receive live updates",
              },
              {
                label: "UI refresh",
                note: "Other desktops update collections in place",
              },
            ]}
          />

          <h3 className={styles.h3}>D. MCP for AI tools</h3>
          <FlowChart
            title="AI assistant path"
            steps={[
              { label: "Create API token", note: "pxat_… in desktop settings" },
              { label: "Add to Cursor / Claude", note: "MCP config points to /mcp" },
              { label: "Ask the AI", note: "Create collection or workflow" },
              { label: "MCP tool runs", note: "Backend creates the asset" },
              { label: "Appears in PayloadX", note: "Ready to open and send" },
            ]}
          />
        </section>

        {/* 6 */}
        <section id="workflows" className={styles.section}>
          <h2>6. Workflows explained</h2>
          <p>
            A workflow is a chain of API steps. Instead of clicking Send on five
            requests by hand, you draw the path once and run it as a sequence.
          </p>

          <div className={styles.callout}>
            <Workflow size={16} />
            <p>
              Example: Login → get profile → wait 1 second → list teams. Each
              step can use data from earlier steps.
            </p>
          </div>

          <h3 className={styles.h3}>Building blocks</h3>
          <ul className={styles.bullets}>
            <li>
              <strong>API node:</strong> runs one request (method, URL, headers,
              body).
            </li>
            <li>
              <strong>Delay node:</strong> waits before the next step.
            </li>
            <li>
              <strong>Edges:</strong> connect nodes so order is clear.
            </li>
            <li>
              <strong>Data pass through:</strong> later nodes can read values
              from earlier responses (for example a login token).
            </li>
          </ul>

          <h3 className={styles.h3}>Workflow run flow</h3>
          <FlowChart
            title="Workflow execution"
            direction="vertical"
            steps={[
              {
                label: "Design on canvas",
                note: "Drag nodes, connect Login → Profile → Delay → Teams",
              },
              {
                label: "Click Run",
                note: "Desktop sends the graph to the Rust workflow engine",
              },
              {
                label: "Topological order",
                note: "Engine sorts nodes so parents finish before children",
              },
              {
                label: "Execute node by node",
                note: "Active node highlights. Status and latency update live",
              },
              {
                label: "Pass outputs forward",
                note: "Token from Login can fill Authorization on next calls",
              },
              {
                label: "Store execution record",
                note: "Results saved for review and debugging",
              },
            ]}
          />

          <h3 className={styles.h3}>Sample Auth → Team E2E flow</h3>
          <FlowChart
            title="Common client demo"
            steps={[
              { label: "Login", note: "POST /auth/login" },
              { label: "Get Me", note: "Uses token from Login" },
              { label: "Delay", note: "Short pause" },
              { label: "List Teams", note: "Authenticated GET" },
            ]}
          />

          <div className={styles.note}>
            <KeyRound size={15} />
            <p>
              Workflows are ideal for smoke tests, auth bootstraps, and any
              multi step path you repeat often. Keep one happy path workflow per
              service for quick confidence checks.
            </p>
          </div>
        </section>

        {/* 7 */}
        <section id="features" className={styles.section}>
          <h2>7. Features at a glance</h2>
          {FEATURE_GROUPS.map((group) => {
            const Icon = group.icon;
            return (
              <div key={group.title} className={styles.featureBlock}>
                <div className={styles.featureHead}>
                  <Icon size={18} />
                  <h3>{group.title}</h3>
                </div>
                <div className={styles.featureList}>
                  {group.items.map((item) => (
                    <div key={item.name} className={styles.featureItem}>
                      <h4>{item.name}</h4>
                      <p>{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        {/* 8 */}
        <section id="platforms" className={styles.section}>
          <h2>8. Platforms and delivery</h2>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Surface</th>
                  <th>Status</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>macOS Apple Silicon</td>
                  <td>Available</td>
                  <td>.dmg installer</td>
                </tr>
                <tr>
                  <td>Windows x64</td>
                  <td>Available</td>
                  <td>.exe setup and .msi</td>
                </tr>
                <tr>
                  <td>Linux</td>
                  <td>Available</td>
                  <td>AppImage and .deb</td>
                </tr>
                <tr>
                  <td>iOS</td>
                  <td>Roadmap</td>
                  <td>Coming soon</td>
                </tr>
                <tr>
                  <td>Cloud sync</td>
                  <td>Optional</td>
                  <td>Hosted collaboration</td>
                </tr>
                <tr>
                  <td>Self hosted backend</td>
                  <td>Optional</td>
                  <td>Docker / local Node</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 9 */}
        <section id="start" className={styles.section}>
          <h2>9. Getting started</h2>
          <ol className={styles.steps}>
            <li>
              <strong>Download</strong> the desktop build for your OS from GitHub
              Releases.
            </li>
            <li>
              <strong>Create a collection</strong> and add your first REST request.
            </li>
            <li>
              <strong>Add an environment</strong> with <code>BASE_URL</code> and
              auth values.
            </li>
            <li>
              <strong>Send and inspect</strong> the response in the studio.
            </li>
            <li>
              <strong>Optional:</strong> build a small workflow, or connect cloud /
              self host / MCP when your team needs it.
            </li>
          </ol>

          <div className={styles.ctaRow}>
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.ctaPrimary}
            >
              Download PayloadX
              <ArrowUpRight size={15} />
            </a>
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.ctaGhost}
            >
              Technical docs
            </a>
            <a
              href={LANDING_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.ctaGhost}
            >
              Website
            </a>
          </div>
        </section>

        <footer className={styles.docFoot}>
          <p>
            This client document is meant for product understanding. For API
            routes, Docker env vars, and MCP config samples, use the technical
            docs site.
          </p>
        </footer>
      </article>
    </div>
  );
}
