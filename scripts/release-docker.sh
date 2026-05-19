#!/usr/bin/env bash
set -euo pipefail

# Inputs expected from semantic-release exec
: "${DOCKER_REGISTRY_USER:?DOCKER_REGISTRY_USER is required}"
: "${DOCKER_REGISTRY_PASSWORD:?DOCKER_REGISTRY_PASSWORD is required}"
: "${DOCKER_RELEASE_VERSION:?DOCKER_RELEASE_VERSION is required}"

REGISTRY="ghcr.io/openwallet-foundation"
BACKEND_IMAGE="eudiplo"
CLIENT_IMAGE="eudiplo-client"
DOCKERFILE="Dockerfile"

# Parse version parts (X.Y.Z)
IFS='.' read -r MAJOR MINOR PATCH <<< "${DOCKER_RELEASE_VERSION}"

log() { printf "[release] %s\n" "$*"; }

login() {
  log "Logging in to GHCR..."
  echo "${DOCKER_REGISTRY_PASSWORD}" | docker login ghcr.io -u "${DOCKER_REGISTRY_USER}" --password-stdin
}

# Build an image for a given target and push tags
# Args: <target> <image-name>
build_and_push() {
  local target="$1" image="$2"
  local full_image_base="${REGISTRY}/${image}"

  log "Building and pushing ${image} from target ${target} (version ${DOCKER_RELEASE_VERSION}) for linux/amd64,linux/arm64"

  docker buildx build \
    -f "${DOCKERFILE}" \
    --target "${target}" \
    --platform linux/amd64,linux/arm64 \
    --build-arg VERSION="${DOCKER_RELEASE_VERSION}" \
    -t "${full_image_base}:latest" \
    -t "${full_image_base}:${DOCKER_RELEASE_VERSION}" \
    -t "${full_image_base}:${MAJOR}" \
    -t "${full_image_base}:${MAJOR}.${MINOR}" \
    --push \
    .
}

main() {
  login
  build_and_push "eudiplo" "${BACKEND_IMAGE}"
  build_and_push "client" "${CLIENT_IMAGE}"
  log "Done."
}

main "$@"
