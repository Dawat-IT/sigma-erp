#!/usr/bin/env bash
set -Eeuo pipefail
root=/opt/sigma-erp
sha=${1:?Usage: deploy.sh COMMIT_SHA}
[[ "$sha" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid commit SHA'; exit 1; }
[[ -s "$root/.env" ]] || { echo 'Missing /opt/sigma-erp/.env'; exit 1; }
command -v pm2 >/dev/null
command -v flock >/dev/null
exec 9>"$root/deploy.lock"
flock -w 300 9
release="$root/releases/$sha"
mkdir -p "$release"
tar -xzf "$root/incoming-$sha.tar.gz" -C "$release" --no-same-owner
previous=$(readlink -f "$root/current" 2>/dev/null || true)
start_release() {
  local directory=$1
  if pm2 describe sigma-erp >/dev/null 2>&1; then pm2 delete sigma-erp; fi
  pm2 start "$directory/ecosystem.config.cjs" --only sigma-erp
}
healthy() {
  local attempt
  for attempt in {1..45}; do
    if curl --fail --silent --max-time 3 http://127.0.0.1:3100/api/health >/dev/null; then return 0; fi
    sleep 2
  done
  return 1
}
if ! start_release "$release" || ! healthy; then
  echo 'Deployment failed; restoring previous release when available'
  if [[ -n "$previous" && -d "$previous" ]]; then
    start_release "$previous"
    healthy || { echo 'Previous release health check failed'; exit 1; }
  fi
  exit 1
fi
ln -sfn "$release" "$root/current.next"
mv -Tf "$root/current.next" "$root/current"
pm2 save
rm -f "$root/incoming-$sha.tar.gz"
echo "Deployed $sha"
