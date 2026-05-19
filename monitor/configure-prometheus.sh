#!/bin/bash

# Script to switch between different Prometheus configurations

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROMETHEUS_DIR="$SCRIPT_DIR/prometheus"

show_help() {
    echo "Usage: $0 [option]"
    echo ""
    echo "Options:"
    echo "  local-only     Monitor only local Node.js application"
    echo "  docker-only    Monitor only Docker container"
    echo "  both           Monitor both local and Docker (default)"
    echo "  flexible       Use flexible config with deployment labels"
    echo "  status         Show current configuration"
    echo "  help           Show this help message"
}

create_local_only_config() {
    cat > "$PROMETHEUS_DIR/prometheus.yml" << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

scrape_configs:
  # EUDIPLO service metrics - Local Node.js only
  - job_name: 'eudiplo'
    static_configs:
      - targets: ['host.docker.internal:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s
    scrape_timeout: 10s

  # Prometheus self-monitoring
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
EOF
}

create_docker_only_config() {
    cat > "$PROMETHEUS_DIR/prometheus.yml" << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

scrape_configs:
  # EUDIPLO service metrics - Docker container only
  - job_name: 'eudiplo'
    static_configs:
      - targets: ['eudiplo:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s
    scrape_timeout: 10s

  # Prometheus self-monitoring
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
EOF
}

create_both_config() {
    cat > "$PROMETHEUS_DIR/prometheus.yml" << 'EOF'
global:
  scrape_interval: 15s
  evaluation_interval: 15s

rule_files:
  - "rules/*.yml"

scrape_configs:
  # EUDIPLO service metrics (containerized)
  - job_name: 'eudiplo-docker'
    static_configs:
      - targets: ['eudiplo:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s
    scrape_timeout: 10s

  # EUDIPLO service metrics (local development)
  - job_name: 'eudiplo-local'
    static_configs:
      - targets: ['host.docker.internal:3000']
    metrics_path: '/metrics'
    scrape_interval: 30s
    scrape_timeout: 10s

  # Prometheus self-monitoring
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']
EOF
}

use_flexible_config() {
    if [[ -f "$PROMETHEUS_DIR/prometheus-flexible.yml" ]]; then
        cp "$PROMETHEUS_DIR/prometheus-flexible.yml" "$PROMETHEUS_DIR/prometheus.yml"
    else
        echo "Error: prometheus-flexible.yml not found"
        exit 1
    fi
}

restart_prometheus() {
    echo "Restarting Prometheus to apply new configuration..."
    if docker-compose ps prometheus | grep -q "Up"; then
        docker-compose restart prometheus
        echo "Prometheus restarted successfully"
    else
        echo "Prometheus is not running. Start it with: docker-compose up -d"
    fi
}

show_status() {
    echo "Current Prometheus configuration:"
    echo "================================="
    if [[ -f "$PROMETHEUS_DIR/prometheus.yml" ]]; then
        grep -A 10 "scrape_configs:" "$PROMETHEUS_DIR/prometheus.yml" | grep -E "(job_name|targets)"
    else
        echo "No prometheus.yml found"
    fi
    echo ""
    echo "Prometheus container status:"
    docker-compose ps prometheus 2>/dev/null || echo "Docker Compose not available or not in monitor directory"
}

case "${1:-both}" in
    "local-only")
        echo "Configuring Prometheus to monitor local Node.js application only..."
        create_local_only_config
        restart_prometheus
        ;;
    "docker-only")
        echo "Configuring Prometheus to monitor Docker container only..."
        create_docker_only_config
        restart_prometheus
        ;;
    "both")
        echo "Configuring Prometheus to monitor both local and Docker..."
        create_both_config
        restart_prometheus
        ;;
    "flexible")
        echo "Using flexible configuration with deployment labels..."
        use_flexible_config
        restart_prometheus
        ;;
    "status")
        show_status
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        echo "Unknown option: $1"
        show_help
        exit 1
        ;;
esac
