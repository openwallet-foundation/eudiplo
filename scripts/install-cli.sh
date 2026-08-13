#!/usr/bin/env bash
set -euo pipefail

REPO="openwallet-foundation/eudiplo"
GITHUB_API="https://api.github.com/repos/${REPO}/releases/latest"
INSTALL_DIR="${EUDIPLO_INSTALL_DIR:-$HOME/.local/bin}"

fail() {
  echo "Error: $*" >&2
  exit 1
}

require_tool() {
  command -v curl >/dev/null 2>&1 || fail "curl is required but not installed"
}

ensure_npm_fallback() {
  command -v npm >/dev/null 2>&1 || fail "npm is required for the fallback install on this platform"
}

resolve_latest_tag() {
  curl -fsSL "$GITHUB_API" | grep -o '"tag_name": *"[^"]*"' | head -n 1 | cut -d'"' -f4
}

detect_asset() {
  local os arch tag
  os="$(uname -s)"
  arch="$(uname -m)"
  tag="$(resolve_latest_tag)"

  if [[ -z "$tag" ]]; then
    fail "Could not resolve the latest EUDIPLO release tag. Install the npm package instead: npm install -g @eudiplo/cli"
  fi

  case "$os" in
    Linux)
      case "$arch" in
        x86_64|amd64)
          echo "eudiplo-${tag}-linux-x64.tar.gz"
          ;;
        arm64|aarch64)
          echo "eudiplo-${tag}-linux-arm64.tar.gz"
          ;;
        *)
          fail "Standalone CLI builds are not published for this Linux architecture. Install the npm package instead: npm install -g @eudiplo/cli"
          ;;
      esac
      ;;
    Darwin)
      case "$arch" in
        arm64|aarch64)
          echo "eudiplo-${tag}-macos-arm64.tar.gz"
          ;;
        *)
          fail "Standalone CLI builds are not published for this macOS architecture. Install the npm package instead: npm install -g @eudiplo/cli"
          ;;
      esac
      ;;
    *)
      fail "Unsupported operating system: $os. Install the npm package instead: npm install -g @eudiplo/cli"
      ;;
  esac
}

fallback_to_npm_install() {
  echo "Standalone CLI binary is not available for this platform. Falling back to the npm package install."
  ensure_npm_fallback
  npm install -g @eudiplo/cli
  echo "Installed @eudiplo/cli via npm"
  exit 0
}

main() {
  require_tool

  local asset install_path download_url tmp_file archive_dir
  if [[ "$(uname -s)" == "Linux" && ( "$(uname -m)" == "x86_64" || "$(uname -m)" == "amd64" || "$(uname -m)" == "arm64" || "$(uname -m)" == "aarch64" ) ]] || [[ "$(uname -s)" == "Darwin" && ( "$(uname -m)" == "arm64" || "$(uname -m)" == "aarch64" ) ]]; then
    :
  else
    fallback_to_npm_install
  fi

  asset="$(detect_asset)"
  download_url="https://github.com/${REPO}/releases/download/$(resolve_latest_tag)/${asset}"
  install_path="${INSTALL_DIR}/eudiplo"

  mkdir -p "${INSTALL_DIR}"

  tmp_file="$(mktemp "${TMPDIR:-/tmp}/eudiplo-install.XXXXXX")"
  archive_dir="$(mktemp -d "${TMPDIR:-/tmp}/eudiplo-archive.XXXXXX")"
  trap 'rm -f "${tmp_file:-}"; rm -rf "${archive_dir:-}"' EXIT

  echo "Downloading ${asset} from ${download_url}"
  curl -fsSL "$download_url" -o "$tmp_file"

  tar -xzf "$tmp_file" -C "$archive_dir"
  install -m 755 "$archive_dir/eudiplo" "$install_path"
  echo "Installed EUDIPLO CLI to: ${install_path}"

  if ! printf '%s:' "$PATH" | grep -Fq ":${INSTALL_DIR}:"; then
    echo "Add this to your shell profile if needed:"
    echo "  export PATH=\"${INSTALL_DIR}:\$PATH\""
  fi

  echo "Run: eudiplo --help"
}

main "$@"
