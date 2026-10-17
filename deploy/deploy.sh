#!/usr/bin/env bash
set -Eeuo pipefail

die() { printf '%s\n' "$*" >&2; exit 1; }

revision=${1:-}
project_dir=${2:-/opt/web-druzstvo}
[[ "$revision" =~ ^[0-9a-f]{40}$ ]] || die 'Expected a full Git commit SHA.'
for tool in git docker python3 flock; do
  command -v "$tool" >/dev/null || die "Missing command: $tool"
done
cd "$project_dir"
[[ "$(git rev-parse --show-toplevel)" == "$(pwd -P)" ]] || die 'Deploy directory must be the repository root.'

# Also serialize manual invocations; the lock lives outside tracked files.
exec 9>"$(git rev-parse --git-path hkfree-deploy.lock)"
flock -n 9 || die 'Another deployment is running.'
[[ -z "$(git status --porcelain --untracked-files=normal)" ]] || die 'Repository has local changes; resolve them before deploying.'
[[ -f .env ]] || die 'Missing server .env; deployment never creates or overwrites it.'
docker info >/dev/null

# Require the existing installation, so a changed Compose project name cannot
# silently create an empty content volume. No down, volume removal or git reset.
container=$(docker compose ps --all --quiet web)
[[ -n "$container" && "$container" != *$'\n'* ]] || die 'Expected one existing web container. Check COMPOSE_PROJECT_NAME and the installation directory.'
content_volume=$(docker inspect --format '{{range .Mounts}}{{if eq .Destination "/app/data"}}{{.Name}}{{end}}{{end}}' "$container")
[[ -n "$content_volume" ]] || die 'Existing container has no named content volume at /app/data.'

git fetch --no-tags origin '+refs/heads/main:refs/remotes/origin/main'
git cat-file -e "${revision}^{commit}"
if [[ "$revision" != "$(git rev-parse refs/remotes/origin/main)" ]]; then
  printf 'Skipping %s: main has moved to another commit.\n' "$revision"
  exit 0
fi

previous_revision=$(git rev-parse HEAD)
previous_branch=$(git symbolic-ref --quiet --short HEAD || true)
checked_out=false
activated=false
# Invoked indirectly by the EXIT trap below.
# shellcheck disable=SC2329
cleanup() {
  status=$?
  if (( status != 0 )) && [[ "$checked_out" == true && "$activated" == false ]]; then
    printf 'Deployment stopped before activation; restoring checkout %s.\n' "$previous_revision" >&2
    git checkout --quiet "${previous_branch:-$previous_revision}" || true
  fi
}
trap 'cleanup' EXIT
git checkout --quiet --detach "$revision"
checked_out=true

# Compose resolves .env itself. Print only non-secret settings from its JSON.
settings=$(docker compose config --format json | python3 -c '
import json, re, sys
config = json.load(sys.stdin)
volume = config["volumes"]["content"]["name"]
prefix = config["services"]["web"]["build"].get("args", {}).get("BASE_PATH") or "/"
if prefix != "/" and not re.fullmatch(r"/(?:[a-zA-Z0-9_-]+/)*[a-zA-Z0-9_-]+/?", prefix):
    sys.exit("Invalid BASE_PATH in Compose configuration")
print(volume)
print(prefix.rstrip("/") + "/")
')
configured_volume=${settings%%$'\n'*}
health_path=${settings#*$'\n'}
[[ "$configured_volume" == "$content_volume" ]] || die 'Content volume would change; deployment refused.'

printf 'Building tested commit %s; current container stays running during build.\n' "$revision"
docker compose build web
# From this point a failure may leave the new container running. Keep the checkout
# on the deployed commit and report failure rather than claiming a rollback.
activated=true
docker compose up -d --no-build --no-deps web

for attempt in {1..12}; do
  if docker compose exec -T web node -e '
    fetch("http://127.0.0.1:4321" + process.argv[1], {
      redirect: "manual", signal: AbortSignal.timeout(5000),
    }).then(async response => {
      if (response.status !== 200 || !response.headers.get("content-type")?.includes("text/html")) process.exit(1);
      await response.text();
    }).catch(() => process.exit(1));
  ' "$health_path"; then
    printf 'Deployed %s; HTTP check passed at %s.\n' "$revision" "$health_path"
    exit 0
  fi
  if (( attempt < 12 )); then sleep 5; fi
done
die "HTTP check failed after deployment of $revision. Check docker compose logs web; no automatic rollback was performed."
