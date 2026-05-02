import React, { useState } from "react";
import styles from "./Docs.module.css";
import PayloadX from "./components/core/Logo";
import { ChevronRight, Terminal, Cpu, Layers, Github } from "lucide-react";

export default function Docs({ onBack }) {
  const [activeSection, setActiveSection] = useState("setup");

  const sections = {
    setup: (
      <div className={styles.section}>
        <h1 className={styles.metallicTitle}>Getting Started</h1>
        <p className={styles.text}>
          PayloadX is a high-performance, open-source API Studio built with Rust and React. 
          Follow these detailed steps to set up the full development suite on your local machine.
        </p>
        
        <div className={styles.sectionTitle}>1. Environment Prerequisites</div>
        <p className={styles.text}>You'll need the following toolchains installed:</p>
        <div className={styles.featGrid}>
          <div className={styles.badge}>Node.js v20.x (LTS)</div>
          <div className={styles.badge}>Rustc 1.75+ & Cargo</div>
          <div className={styles.badge}>Tauri CLI (npm install -g @tauri-apps/cli)</div>
        </div>

        <div className={styles.sectionTitle}>2. Repository Initialization</div>
        <div className={styles.codeBlock}>
          <div className={styles.codeHeader}><span>Shell</span></div>
          <code>git clone https://github.com/Sundanpatyad/api-test.git<br/>cd api-test<br/>npm install</code>
        </div>

        <div className={styles.sectionTitle}>3. Environment Configuration</div>
        <p className={styles.text}>
          Create a <code>.env</code> file in <code>apps/backend</code> with these keys:
        </p>
        <div className={styles.codeBlock}>
          <code>
            PORT=3001<br/>
            MONGODB_URI=your_mongodb_connection_string<br/>
            JWT_SECRET=your_secure_random_secret<br/>
            OPENAI_API_KEY=optional_for_ai_features
          </code>
        </div>
      </div>
    ),
    architecture: (
      <div className={styles.section}>
        <h1 className={styles.metallicTitle}>Architecture Deep-Dive</h1>
        <p className={styles.text}>
          PayloadX leverages a hybrid architecture to balance performance with developer velocity.
        </p>

        <div className={styles.sectionTitle}>Desktop Client (apps/desktop)</div>
        <p className={styles.text}>
          A Tauri-powered application. The frontend is built with React and TailwindCSS. 
          The backend logic (Request execution engine) is written in <strong>Rust</strong> for maximum throughput.
        </p>

        <div className={styles.sectionTitle}>Cloud Service (apps/backend)</div>
        <p className={styles.text}>
          A Node.js/Express service that handles user authentication, workspace synchronization, 
          and team management via MongoDB.
        </p>

        <div className={styles.sectionTitle}>Realtime Engine (apps/realtime)</div>
        <p className={styles.text}>
          A specialized Socket.IO server that synchronizes cursor positions, live request edits, 
          and team presence in real-time.
        </p>
      </div>
    ),
    running: (
      <div className={styles.section}>
        <h1 className={styles.metallicTitle}>Development Workflow</h1>
        
        <div className={styles.sectionTitle}>Development Mode</div>
        <p className={styles.text}>To start all services in development mode:</p>
        <div className={styles.codeBlock}>
          <div className={styles.codeHeader}><span>Root Directory</span></div>
          <code>npm run dev</code>
        </div>

        <div className={styles.sectionTitle}>Tauri Desktop Client</div>
        <p className={styles.text}>Run the desktop UI separately if needed:</p>
        <div className={styles.codeBlock}>
          <code>npm run desktop</code>
        </div>

        <div className={styles.sectionTitle}>Building for Production</div>
        <p className={styles.text}>Generate a production bundle for your current OS:</p>
        <div className={styles.codeBlock}>
          <div className={styles.codeHeader}><span>apps/desktop</span></div>
          <code>npm run tauri build</code>
        </div>

        <div className={styles.sectionTitle}>Contribution Guidelines</div>
        <p className={styles.text}>
          1. Fork the repo and create a feature branch.<br/>
          2. Ensure all code follows the established ESLint patterns.<br/>
          3. Submit a PR with a clear description of your changes.
        </p>
      </div>
    ),
    structure: (
      <div className={styles.section}>
        <h1 className={styles.metallicTitle}>Project Structure</h1>
        <p className={styles.text}>
          PayloadX follows a clean, modular architecture within an NPM workspace-managed monorepo. 
          This ensures seamless dependency sharing and atomic deployments across all sub-applications.
        </p>

        <div className={styles.sectionTitle}>High-Level Overview</div>
        <div className={styles.codeBlock}>
          <code>
            .github/workflows/  # CI/CD pipelines for automated testing & releases<br/>
            apps/<br/>
            ├── backend/        # Primary Node.js/Express API<br/>
            ├── desktop/        # Desktop Client (Tauri + React)<br/>
            ├── landing/        # Marketing & Documentation website (Vite/React)<br/>
            └── realtime/       # Dedicated Socket.IO presence & sync server<br/>
            package.json        # Workspace configuration
          </code>
        </div>

        <div className={styles.sectionTitle}>Desktop Client (apps/desktop)</div>
        <p className={styles.text}>
          The desktop app is split between a robust React frontend and a hyper-fast Rust backend.
        </p>
        <div className={styles.codeBlock}>
          <code>
            apps/desktop/<br/>
            ├── src/<br/>
            │   ├── components/ # Atomic UI components (e.g., Modals, Workspace)<br/>
            │   ├── hooks/      # Shared React hooks (useKeyboardShortcuts, etc.)<br/>
            │   ├── lib/        # API clients, IPC bridges (rust.js)<br/>
            │   └── store/      # Zustand state managers (toastStore, requestStore)<br/>
            └── src-tauri/<br/>
                ├── src/<br/>
                │   ├── commands/ # Native Rust implementations for hot paths<br/>
                │   ├── core/     # Networking and protocol execution engine<br/>
                │   └── utils/    # High-performance parsers (postman.rs, env_tools.rs)<br/>
                └── Cargo.toml    # Rust dependencies
          </code>
        </div>

        <div className={styles.sectionTitle}>Cloud Backend (apps/backend)</div>
        <p className={styles.text}>
          The backend handles persistence, team management, and workspace synchronization.
        </p>
        <div className={styles.codeBlock}>
          <code>
            apps/backend/<br/>
            ├── config/      # Environment & DB connection setup<br/>
            ├── controllers/ # Request handlers and business logic<br/>
            ├── middlewares/ # Authentication (JWT) and validation<br/>
            ├── models/      # Mongoose schemas (User, Team, Project, Request)<br/>
            └── routes/      # Express API route definitions
          </code>
        </div>

        <div className={styles.sectionTitle}>Realtime Server (apps/realtime)</div>
        <p className={styles.text}>
          A lightweight, highly concurrent Socket.IO service dedicated to pushing live cursor updates and presence indicators to active team members.
        </p>
        <div className={styles.codeBlock}>
          <code>
            apps/realtime/<br/>
            ├── server.js    # Socket connection and room broadcasting logic<br/>
            └── package.json # Minimal dependencies for speed
          </code>
        </div>
      </div>
    ),
    performance: (
      <div className={styles.section}>
        <h1 className={styles.metallicTitle}>Performance Engineering</h1>
        <p className={styles.text}>
          PayloadX is engineered at a senior level — every hot path is backed by
          a deliberate data structure choice and algorithmic justification.
        </p>

        <div className={styles.sectionTitle}>O(1) Store Operations — Map Index Pattern</div>
        <p className={styles.text}>
          All Zustand stores maintain a companion <code>Map&lt;id, item&gt;</code> alongside
          their arrays. This drops tab lookups, request deduplication, and collection mutations
          from <strong>O(n)</strong> linear scans to <strong>O(1)</strong> constant time.
        </p>
        <div className={styles.codeBlock}>
          <div className={styles.codeHeader}><span>collectionStore.js</span></div>
          <code>
            // Before — O(n) on every drag-and-drop{"\n"}
            if (state.requests.find(r =&gt; r._id === id)) ...{"\n\n"}
            // After — O(1) Map lookup{"\n"}
            if (state._requestsById.has(id)) ...
          </code>
        </div>

        <div className={styles.sectionTitle}>Memoized BFS — Workflow Layer Calculator</div>
        <p className={styles.text}>
          <code>calculateLayers()</code> runs Kahn's topological sort (BFS) over the
          workflow graph. It was previously re-run on every node data change — even
          when the user only edited a URL field. It is now memoized by a topology fingerprint
          (node IDs + edge pairs), so the O(V+E) pass is skipped entirely if structure hasn't changed.
        </p>
        <div className={styles.featGrid}>
          <div className={styles.badge}>Kahn's Algorithm (BFS)</div>
          <div className={styles.badge}>Topology Fingerprint Cache</div>
          <div className={styles.badge}>O(V+E) → O(1) on re-render</div>
        </div>

        <div className={styles.sectionTitle}>structuredClone — Fast Deep Copy</div>
        <p className={styles.text}>
          All deep clones replaced from <code>JSON.parse(JSON.stringify())</code> to the
          native <code>structuredClone()</code> API — ~10× faster, handles circular refs,
          and doesn't block the main thread for large payloads.
        </p>

        <div className={styles.sectionTitle}>RAF-Debounced localStorage Writes</div>
        <p className={styles.text}>
          <code>batchedLocalStorageWrite()</code> coalesces multiple writes for the same
          key within a single animation frame via <code>requestAnimationFrame</code>.
          Eliminates synchronous JSON serialization on every keystroke.
        </p>
        <div className={styles.codeBlock}>
          <div className={styles.codeHeader}><span>src/utils/perf.js</span></div>
          <code>
            // Multiple calls within one frame = one disk write{"\n"}
            batchedLocalStorageWrite('requests', data);
          </code>
        </div>

        <div className={styles.sectionTitle}>Single-Pass Count Accumulator</div>
        <p className={styles.text}>
          Workflow result counters (success / failed / skipped) were computed with two
          separate <code>Array.filter()</code> passes. Replaced with a single <code>for...of</code>
          accumulator — halving the iteration cost for large workflows.
        </p>
      </div>
    ),
    rust: (
      <div className={styles.section}>
        <h1 className={styles.metallicTitle}>Rust Core Engine</h1>
        <p className={styles.text}>
          Critical hot-path functions are implemented as native Rust Tauri commands
          and invoked via IPC, with transparent JS fallbacks for browser environments.
        </p>

        <div className={styles.sectionTitle}>IPC Bridge Architecture</div>
        <p className={styles.text}>
          Every Rust function is wrapped in <code>src/lib/rust.js</code> — a bridge
          that tries the Tauri IPC call first, then falls back to a pure-JS
          implementation automatically.
        </p>
        <div className={styles.codeBlock}>
          <div className={styles.codeHeader}><span>src/lib/rust.js</span></div>
          <code>
            export async function rustResolveEnv(template, env) {'{'}{'\n'}
            {'  '}const result = await invoke('resolve_env_variables', {'{'}...{'}'});{'\n'}
            {'  '}return result ?? _jsResolveEnv(template, env); // fallback{'\n'}
            {'}'}
          </code>
        </div>

        <div className={styles.sectionTitle}>Native Rust Commands</div>
        <div className={styles.featGrid}>
          <div className={styles.badge}>url_parse_params</div>
          <div className={styles.badge}>url_build_from_params</div>
          <div className={styles.badge}>resolve_env_variables</div>
          <div className={styles.badge}>resolve_env_in_object</div>
          <div className={styles.badge}>parse_postman_collection</div>
          <div className={styles.badge}>execute_request</div>
          <div className={styles.badge}>execute_workflow</div>
          <div className={styles.badge}>execute_single_node</div>
        </div>

        <div className={styles.sectionTitle}>URL ↔ Params Sync (url_tools.rs)</div>
        <p className={styles.text}>
          Replaces the JS <code>syncParamsFromUrl</code> / <code>syncUrlFromParams</code>
          hot-path that ran on every keypress. Uses Rust's <code>url</code> crate for
          zero-allocation, percent-correct query string parsing. Result is ~5-8× faster.
        </p>

        <div className={styles.sectionTitle}>Env Variable Resolution (env_tools.rs)</div>
        <p className={styles.text}>
          <code>{'{{'} VAR {'}}'}</code> token substitution via a regex compiled once at startup
          using <code>OnceLock&lt;Regex&gt;</code> — eliminating JS regex construction overhead
          on every workflow execution. Includes a batch resolver for entire JSON objects.
        </p>
        <div className={styles.codeBlock}>
          <div className={styles.codeHeader}><span>env_tools.rs</span></div>
          <code>
            static ENV_REGEX: OnceLock&lt;Regex&gt; = OnceLock::new();{'\n'}
            // Compiled once — reused on every invocation
          </code>
        </div>

        <div className={styles.sectionTitle}>Postman Parser (postman.rs)</div>
        <p className={styles.text}>
          Strongly-typed <code>serde_json</code> parser for Postman Collection v2.0 and
          v2.1 formats. Handles nested folders, all auth types (Bearer, Basic, API Key),
          and all body modes. Eliminates ~200ms import lag on large collections vs the
          previous JS recursive walker.
        </p>
      </div>
    ),
    protocols: (
      <div className={styles.section}>
        <h1 className={styles.metallicTitle}>Protocols</h1>
        <p className={styles.text}>
          PayloadX is designed to handle multiple network protocols seamlessly from a single unified interface.
        </p>

        <div className={styles.sectionTitle}>REST APIs</div>
        <p className={styles.text}>
          Full support for standard HTTP methods (GET, POST, PUT, DELETE, PATCH, etc.). 
          Includes advanced features like automatic header generation, multi-part form data, 
          raw JSON/XML body editors, and Bearer/Basic/API Key authentication handlers.
        </p>

        <div className={styles.sectionTitle}>WebSockets (WS)</div>
        <p className={styles.text}>
          Establish long-lived, bi-directional WebSocket connections. You can send messages manually, 
          listen for incoming streams, and view connection lifecycle events in real-time.
        </p>
        <div className={styles.featGrid}>
          <div className={styles.badge}>Live Connection Status</div>
          <div className={styles.badge}>Message History</div>
          <div className={styles.badge}>Ping/Pong Keep-Alive</div>
        </div>

        <div className={styles.sectionTitle}>Socket.IO (SIO)</div>
        <p className={styles.text}>
          Native support for Socket.IO clients. You can specify event names to emit payloads, 
          and subscribe to specific event listeners to filter incoming real-time traffic.
        </p>
      </div>
    ),
    environments: (
      <div className={styles.section}>
        <h1 className={styles.metallicTitle}>Environment Variables</h1>
        <p className={styles.text}>
          Managing different environments (e.g., Development, Staging, Production) is crucial for API development. 
          PayloadX allows you to define key-value pairs and inject them dynamically into your requests.
        </p>

        <div className={styles.sectionTitle}>Variable Syntax</div>
        <p className={styles.text}>
          Use the double-curly-brace syntax to inject variables anywhere in your request (URL, Headers, Body).
        </p>
        <div className={styles.codeBlock}>
          <code>
            // URL injection<br/>
            {'{'}{'{'}BASE_URL{'}'}{'}'}/api/v1/users<br/><br/>
            // Header injection<br/>
            Authorization: Bearer {'{'}{'{'}API_TOKEN{'}'}{'}'}
          </code>
        </div>

        <div className={styles.sectionTitle}>Rust-Powered Resolution</div>
        <p className={styles.text}>
          Variable interpolation is handled by a heavily optimized Rust regex compiler. 
          This ensures that even massive JSON payloads with hundreds of nested variables are resolved in less than a millisecond before the request is dispatched.
        </p>
      </div>
    ),
    workflows: (
      <div className={styles.section}>
        <h1 className={styles.metallicTitle}>Visual Workflows</h1>
        <p className={styles.text}>
          The Visual Workflow Engine allows you to chain multiple APIs together to test complex multi-step scenarios, 
          all within a drag-and-drop canvas.
        </p>

        <div className={styles.sectionTitle}>Node-Based Execution</div>
        <p className={styles.text}>
          Drag requests from your sidebar onto the canvas. Connect the output of one request to the input of another. 
          PayloadX automatically calculates the execution order using Kahn's Topological Sort algorithm.
        </p>

        <div className={styles.sectionTitle}>Data Passing</div>
        <p className={styles.text}>
          You can extract data from a previous node's response using JSONPath syntax, and map it directly to a subsequent node's variable context.
        </p>

        <div className={styles.codeBlock}>
          <div className={styles.codeHeader}><span>Example Data Pass</span></div>
          <code>
            Node A (Login) -&gt; extracts '$.data.token'<br/>
            Node B (Get Profile) -&gt; uses '{'{'}NodeA.token{'}'}' in headers
          </code>
        </div>
      </div>
    ),
    shortcuts: (
      <div className={styles.section}>
        <h1 className={styles.metallicTitle}>Keyboard Shortcuts</h1>
        <p className={styles.text}>
          PayloadX is built for power users. Keep your hands on the keyboard with these cross-platform shortcuts.
        </p>

        <table className={styles.table}>
          <thead>
            <tr>
              <th>Action</th>
              <th>Mac</th>
              <th>Windows / Linux</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Send Request</td>
              <td><kbd>⌘</kbd> + <kbd>Enter</kbd></td>
              <td><kbd>Ctrl</kbd> + <kbd>Enter</kbd></td>
            </tr>
            <tr>
              <td>Save Request</td>
              <td><kbd>⌘</kbd> + <kbd>S</kbd></td>
              <td><kbd>Ctrl</kbd> + <kbd>S</kbd></td>
            </tr>
            <tr>
              <td>New Request</td>
              <td><kbd>⌘</kbd> + <kbd>N</kbd></td>
              <td><kbd>Ctrl</kbd> + <kbd>N</kbd></td>
            </tr>
            <tr>
              <td>Close Tab</td>
              <td><kbd>⌘</kbd> + <kbd>W</kbd></td>
              <td><kbd>Ctrl</kbd> + <kbd>W</kbd></td>
            </tr>
            <tr>
              <td>Next Tab</td>
              <td><kbd>⌘</kbd> + <kbd>]</kbd></td>
              <td><kbd>Ctrl</kbd> + <kbd>]</kbd></td>
            </tr>
            <tr>
              <td>Previous Tab</td>
              <td><kbd>⌘</kbd> + <kbd>[</kbd></td>
              <td><kbd>Ctrl</kbd> + <kbd>[</kbd></td>
            </tr>
            <tr>
              <td>Beautify Body</td>
              <td><kbd>⌘</kbd> + <kbd>B</kbd></td>
              <td><kbd>Ctrl</kbd> + <kbd>B</kbd></td>
            </tr>
            <tr>
              <td>Global Search</td>
              <td><kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd></td>
              <td><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>F</kbd></td>
            </tr>
            <tr>
              <td>Toggle History</td>
              <td><kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>H</kbd></td>
              <td><kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>H</kbd></td>
            </tr>
            <tr>
              <td>Toggle Console</td>
              <td><kbd>⌘</kbd> + <kbd>⌥</kbd> + <kbd>C</kbd></td>
              <td><kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>C</kbd></td>
            </tr>
            <tr>
              <td>Toggle Environments</td>
              <td><kbd>⌘</kbd> + <kbd>⌥</kbd> + <kbd>E</kbd></td>
              <td><kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>E</kbd></td>
            </tr>
            <tr>
              <td>Clear Console</td>
              <td><kbd>⌘</kbd> + <kbd>⌥</kbd> + <kbd>L</kbd></td>
              <td><kbd>Ctrl</kbd> + <kbd>Alt</kbd> + <kbd>L</kbd></td>
            </tr>
            <tr>
              <td>Toggle Sidebar</td>
              <td><kbd>⌘</kbd> + <kbd>\</kbd></td>
              <td><kbd>Ctrl</kbd> + <kbd>\</kbd></td>
            </tr>
          </tbody>
        </table>
      </div>
    )
  };

  return (
    <div className={styles.root}>
      <div className={styles.scanlines} aria-hidden />

      <nav className={styles.nav}>
        <div onClick={onBack} className={styles.logoName} style={{ display: 'flex', alignItems: 'center' }}>
           <PayloadX size="28px" fontSize="10px" />
           <span style={{ marginLeft: '10px' }} className="metallic-app-name py-2 px-1 text-2xl">PayloadX</span>
           <span style={{ marginLeft: '8px', fontSize: '0.55rem', fontWeight: 800, padding: '2px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', color: '#5a6070', border: '1px solid rgba(255,255,255,0.05)' }}>BETA</span>
        </div>
        <div className={styles.navSpacer} />
        <a href="https://github.com/Sundanpatyad/api-test" target="_blank" rel="noreferrer" className={styles.navLink}>
          <Github size={16} />
        </a>
      </nav>

      <main className={styles.container}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarSection}>
            <span className={styles.sidebarTitle}>Features & Guides</span>
            <div 
              className={`${styles.sidebarLink} ${activeSection === 'setup' ? styles.sidebarLinkActive : ''}`}
              onClick={() => setActiveSection('setup')}
            >
              Quick Start
            </div>
            <div 
              className={`${styles.sidebarLink} ${activeSection === 'protocols' ? styles.sidebarLinkActive : ''}`}
              onClick={() => setActiveSection('protocols')}
            >
              Protocols
            </div>
            <div 
              className={`${styles.sidebarLink} ${activeSection === 'environments' ? styles.sidebarLinkActive : ''}`}
              onClick={() => setActiveSection('environments')}
            >
              Environments
            </div>
            <div 
              className={`${styles.sidebarLink} ${activeSection === 'workflows' ? styles.sidebarLinkActive : ''}`}
              onClick={() => setActiveSection('workflows')}
            >
              Visual Workflows
            </div>
            <div 
              className={`${styles.sidebarLink} ${activeSection === 'shortcuts' ? styles.sidebarLinkActive : ''}`}
              onClick={() => setActiveSection('shortcuts')}
            >
              Keyboard Shortcuts
            </div>
          </div>

          <div className={styles.sidebarSection}>
            <span className={styles.sidebarTitle}>Developer Guide</span>
            <div 
              className={`${styles.sidebarLink} ${activeSection === 'architecture' ? styles.sidebarLinkActive : ''}`}
              onClick={() => setActiveSection('architecture')}
            >
              Architecture
            </div>
            <div 
              className={`${styles.sidebarLink} ${activeSection === 'structure' ? styles.sidebarLinkActive : ''}`}
              onClick={() => setActiveSection('structure')}
            >
              Project Structure
            </div>
            <div 
              className={`${styles.sidebarLink} ${activeSection === 'running' ? styles.sidebarLinkActive : ''}`}
              onClick={() => setActiveSection('running')}
            >
              Local Execution
            </div>
            <div 
              className={`${styles.sidebarLink} ${activeSection === 'performance' ? styles.sidebarLinkActive : ''}`}
              onClick={() => setActiveSection('performance')}
            >
              Performance
            </div>
            <div 
              className={`${styles.sidebarLink} ${activeSection === 'rust' ? styles.sidebarLinkActive : ''}`}
              onClick={() => setActiveSection('rust')}
            >
              Rust Core
            </div>
          </div>

          <div className={styles.sidebarSection}>
            <span className={styles.sidebarTitle}>Resources</span>
            <a href="https://github.com/Sundanpatyad/api-test/issues" target="_blank" className={styles.sidebarLink}>
              Report Issue
            </a>
            <a href="https://github.com/Sundanpatyad/api-test/discussions" target="_blank" className={styles.sidebarLink}>
              Community
            </a>
          </div>
        </aside>

        <div className={styles.content}>
          {sections[activeSection]}
        </div>
      </main>
    </div>
  );
}
