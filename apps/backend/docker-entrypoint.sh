#!/bin/sh
set -eu

if [ "${BOOTSTRAP_DEMO:-false}" = "true" ]; then
    target_config_folder="${CONFIG_FOLDER:-/app/config/config}"

    mkdir -p "$target_config_folder"

    if [ -z "$(find "$target_config_folder" -mindepth 1 -maxdepth 1 2>/dev/null)" ]; then
        echo "[demo-bootstrap] config folder is empty, seeding demo config"
        cp -R /app/demo-config/. "$target_config_folder"/
    else
        echo "[demo-bootstrap] config folder is not empty, skipping demo seed"
    fi

    export CONFIG_IMPORT="${CONFIG_IMPORT:-true}"
fi

exec "$@"
