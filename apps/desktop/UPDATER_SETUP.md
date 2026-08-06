# PayloadX OTA Updates Setup

PayloadX uses [Tauri's built-in updater](https://v1.tauri.app/v1/guides/distribution/updater/) to deliver over-the-air updates from GitHub Releases.

## How it works

1. You push a **version tag** (e.g. `v1.0.7`) to GitHub.
2. The **Release** workflow builds signed installers **and** updater bundles (`latest.json`, `.tar.gz`, `.sig`, etc.).
   - `tauri.conf.json` → `bundle.targets` **must include `"updater"`** or CI will skip generating `latest.json`.
3. Installed desktop apps check:
   `https://github.com/hsluzister6-max/PayloadX/releases/latest/download/latest.json`
4. If a newer version exists, users see an in-app prompt (or can check under **Account → App updates**).

---

## One-time setup (your side)

### 1. Generate updater signing keys

From `apps/desktop`:

```bash
npm run updater:generate-keys
```

This creates:

| File | Purpose |
|------|---------|
| `.tauri/payloadx-updater.key` | **Private key** — never commit, never share |
| `.tauri/payloadx-updater.key.pub` | **Public key** — goes in `tauri.conf.json` |

### 2. Put the public key in Tauri config

Copy the **entire contents** of `.tauri/payloadx-updater.key.pub` into:

`apps/desktop/src-tauri/tauri.conf.json` → `tauri.updater.pubkey`

(A pubkey is already committed for the project; skip this if you use the same key pair.)

### 3. Add GitHub Actions secrets

In **GitHub → PayloadX repo → Settings → Secrets and variables → Actions**, add:

| Secret | Value |
|--------|--------|
| `TAURI_PRIVATE_KEY` | Full contents of `.tauri/payloadx-updater.key` |
| `TAURI_KEY_PASSWORD` | Password you chose when generating the key |

**Existing secrets still required for macOS builds:**

| Secret | Purpose |
|--------|---------|
| `APPLE_CERTIFICATE` | Base64 `.p12` Developer ID cert |
| `APPLE_CERTIFICATE_PASSWORD` | P12 password |
| `APPLE_ID` | Apple ID email |
| `APPLE_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | Apple Team ID |

### 4. Print private key for GitHub (helper)

```bash
cd apps/desktop
npm run updater:print-private-key
```

Copy the output into the `TAURI_PRIVATE_KEY` secret.

---

## Shipping an update to users

1. Bump version in `tauri.conf.json`, `package.json`, and `Cargo.toml`.
2. Commit and push to `main`.
3. Tag and push:

```bash
git tag -a v1.0.7 -m "PayloadX v1.0.7"
git push origin v1.0.7
```

4. Wait for the **Release** GitHub Action to finish.

> Users who installed **before** OTA was enabled need **one manual install** of an OTA-enabled build. After that, updates are automatic.

---

## User experience

- **On launch:** check after login → toast with **Install** / **Later**
- **Account page:** **App updates** section
- **Classic layout:** Settings panel in the icon rail
