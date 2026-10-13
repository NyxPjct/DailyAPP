#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

docker_local() {
  env -u DOCKER_HOST -u DOCKER_CONTEXT -u DOCKER_TLS -u DOCKER_TLS_VERIFY -u DOCKER_CERT_PATH \
    docker --host=unix:///var/run/docker.sock "$@"
}
docker_local info --format '{{.ServerVersion}}' >/dev/null
task_db_password=$(mktemp /tmp/dailyapp-db.XXXXXX)
task_db_container="dailyapp-security-test-$$"
task_db_started=false
cleanup() {
  if [ "$task_db_started" = true ]; then docker_local stop "$task_db_container" >/dev/null; fi
  rm -f "$task_db_password"
}
trap cleanup EXIT
python3 - "$task_db_password" <<'PY'
import os,sys
with open(sys.argv[1], 'w') as file:
    file.write(os.urandom(32).hex())
PY
docker_local run --detach --rm --name "$task_db_container" \
  --label org.dailyapp.test=security \
  --mount "type=bind,src=$task_db_password,dst=/run/test-db-password,readonly" \
  -e POSTGRES_PASSWORD_FILE=/run/test-db-password postgres:17-bookworm >/dev/null
task_db_started=true
task_db_ready=false
for attempt in {1..30}; do
  if docker_local exec "$task_db_container" pg_isready -U postgres >/dev/null 2>&1; then task_db_ready=true; break; fi
  sleep 1
done
if [ "$task_db_ready" != true ]; then echo 'PostgreSQL não iniciou a tempo.' >&2; exit 1; fi
docker_local exec -i "$task_db_container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/bootstrap.sql
docker_local exec -i "$task_db_container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610130001_workspaces.sql
# Check that applying the migration again preserves a valid schema.
docker_local exec -i "$task_db_container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/migrations/202610130001_workspaces.sql
docker_local exec -i "$task_db_container" psql -U postgres -v ON_ERROR_STOP=1 < supabase/tests/security.sql
