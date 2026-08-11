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
          echo "eudiplo-seal-linux-x64"
          ;;
        arm64|aarch64)
          echo "eudiplo-seal-linux-arm64"
          ;;
        *)
          fail "Unsupported Linux architecture: $arch"
          ;;
      esac
      ;;
    Darwin)
      case "$arch" in
        x86_64|amd64)
          echo "eudiplo-seal-macos-x64"
          ;;
        arm64|aarch64)
          echo "eudiplo-seal-macos-arm64"
          ;;
        *)
          fail "Unsupported macOS architecture: $arch"
          ;;
      esac
      ;;
    *)
      fail "Unsupported operating system: $os"
      ;;
  esac
}

ensure_tool() {
  command -v curl >/dev/null 2>&1 || fail "curl is required but not installed"
}

main() {
  ensure_tool

  local asset install_path download_url tmp_file
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
