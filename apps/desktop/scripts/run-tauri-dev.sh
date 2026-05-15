#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DESKTOP_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SSD_VOLUME="/Volumes/SSD-OFFICE"
SSD_RUSTUP_HOME="$SSD_VOLUME/rustup-home"
SSD_CARGO_HOME="$SSD_VOLUME/cargo-home"

# rustup reads RUSTUP_HOME; cargo-home/env only adjusts PATH. If Rust lives on the SSD, pin both so nested tools don't fall back to ~/.rustup.
if [[ -d "$SSD_RUSTUP_HOME/toolchains" && -x "$SSD_CARGO_HOME/bin/cargo" ]]; then
  export RUSTUP_HOME="$SSD_RUSTUP_HOME"
  export CARGO_HOME="$SSD_CARGO_HOME"
  # shellcheck disable=1090
  source "$SSD_CARGO_HOME/env"
elif [[ -n "${CARGO_HOME:-}" && -f "${CARGO_HOME}/env" ]]; then
  # shellcheck disable=1090
  source "${CARGO_HOME}/env"
elif [[ -f "${HOME}/.cargo/env" ]]; then
  # shellcheck disable=1090
  source "${HOME}/.cargo/env"
fi

if ! command -v cargo >/dev/null 2>&1; then
  echo "cargo not found. Install Rust from https://rustup.rs" >&2
  exit 1
fi

# Force target dir: agents often inject CARGO_TARGET_DIR pointing at a full system volume.
export CARGO_TARGET_DIR="$DESKTOP_ROOT/src-tauri/target"
if [[ -d "$SSD_VOLUME" && -w "$SSD_VOLUME" ]]; then
  SSD_TMP="$SSD_VOLUME/project-tmp"
  mkdir -p "$SSD_TMP"
  export TMPDIR="$SSD_TMP"
fi

cd "$DESKTOP_ROOT"
REPO_ROOT="$(cd "$DESKTOP_ROOT/../.." && pwd)"
TAURI_BIN="$DESKTOP_ROOT/node_modules/.bin/tauri"
if [[ ! -x "$TAURI_BIN" ]]; then
  TAURI_BIN="$REPO_ROOT/node_modules/.bin/tauri"
fi
if [[ ! -x "$TAURI_BIN" ]]; then
  echo "tauri CLI not found. Run npm install from the repo root." >&2
  exit 1
fi
exec "$TAURI_BIN" dev
