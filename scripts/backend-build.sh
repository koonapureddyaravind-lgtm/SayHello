#!/usr/bin/env bash
# Build the Spring Boot backend inside Docker (no host JDK required).
# The repository root is mounted so app/worker can package ../database/migrations.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
M2_DIR="${HOME}/.m2"
mkdir -p "$M2_DIR"

ARGS=("$@")
if [ ${#ARGS[@]} -eq 0 ]; then
  ARGS=("-DskipTests" "package")
fi

docker run --rm \
  -v "${REPO_ROOT}:/workspace" \
  -v "${M2_DIR}:/root/.m2" \
  -w /workspace \
  maven:3.9-eclipse-temurin-21 \
  mvn -B -ntp -f backend/pom.xml "${ARGS[@]}"
