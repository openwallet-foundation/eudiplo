#!/usr/bin/env bash
set -euo pipefail

REPO="openwallet-foundation/eudiplo"
RELEASE_BASE="https://github.com/${REPO}/releases/latest/download"
INSTALL_DIR="${EUDIPLO_INSTALL_DIR:-$HOME/.local/bin}"

fail() {
  echo "Error: $*" >&2
  exit 1
}

detect_asset() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Linux)
      case "$arch" in
        x86_64|amd64)
          echo "eudiplo-sea-linux-x64"
          ;;
        *)
          fail "Standalone CLI builds are currently published only for Linux x64. Install the npm package instead: npm install -g @eudiplo/cli"
          ;;
      esac
      ;;
    Darwin)
      fail "Standalone CLI builds are currently published only for Linux x64. Install the npm package instead: npm install -g @eudiplo/cli"
      ;;
    *)
      fail "Unsupported operating system: $os. Standalone CLI builds are currently published only for Linux x64. Install the npm package instead: npm install -g @eudiplo/cli"
      ;;
  esac
}

ensure_tool() {
  command -v curl >/dev/null 2>&1 || fail "curl is required but not installed"
}

ensure_npm_fallback() {
  command -v npm >/dev/null 2>&1 || fail "npm is required for the fallback install on this platform"
}

fallback_to_npm_install() {
  echo "Standalone CLI binary is currently published only for Linux x64. Falling back to the npm package install for this machine."
  ensure_npm_fallback
  npm install -g @eudiplo/cli
  echo "Installed @eudiplo/cli via npm"
  exit 0
}

main() {
  ensure_tool

  local asset install_path download_url tmp_file
  if [[ "$(uname -s)" != "Linux" || "$(uname -m)" != "x86_64" && "$(uname -m)" != "amd64" ]]; then
    fallback_to_npm_install
  fi

  asset="$(detect_asset)"
  download_url="${RELEASE_BASE}/${asset}"
  install_path="${INSTALL_DIR}/eudiplo"

  mkdir -p "${INSTALL_DIR}"

  tmp_file="$(mktemp "${TMPDIR:-/tmp}/eudiplo-install.XXXXXX")"
  trap 'rm -f "$tmp_file"' EXIT

  echo "Downloading ${asset} from ${download_url}"
  curl -fsSL "$download_url" -o "$tmp_file"

  install -m 755 "$tmp_file" "$install_path"
  echo "Installed EUDIPLO CLI to: ${install_path}"

  if ! printf '%s:' "$PATH" | grep -Fq ":${INSTALL_DIR}:"; then
    echo "Add this to your shell profile if needed:"
    echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
  fi

  echo "Run: eudiplo --help"
}

main "$@"
