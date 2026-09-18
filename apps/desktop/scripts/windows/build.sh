#!/bin/zsh
# Génère l'installeur Windows (NSIS, x64) depuis un Mac ou un Linux, dans Docker.
#
#   apps/desktop/scripts/windows/build.sh            # build
#   apps/desktop/scripts/windows/build.sh --shell    # ouvre un shell dans l'environnement (dépannage)
#   apps/desktop/scripts/windows/build.sh --purger   # supprime les caches (volumes Docker)
#
# Le dépôt est exporté tel que commité (git archive) dans un volume Docker :
# tout se passe sur un système de fichiers Linux natif (pas de montage macOS,
# lent et incompatible avec les liens physiques de pnpm). Les caches cargo,
# xwin (SDK Windows) et pnpm sont conservés entre deux builds.
# Résultat : apps/desktop/dist-windows/QuincaPro_<version>_x64-setup.exe
set -euo pipefail

RACINE="$(cd "$(dirname "$0")/../../../.." && pwd)"
IMAGE="quinca-pro/windows-builder:1"
SORTIE="$RACINE/apps/desktop/dist-windows"
VOLUMES=(
  -v quinca-work:/work
  -v quinca-cargo-registry:/usr/local/cargo/registry
  -v quinca-cargo-git:/usr/local/cargo/git
  -v quinca-xwin-cache:/root/.cache/cargo-xwin
  -v quinca-pnpm-store:/root/.local/share/pnpm/store
  -v quinca-target-windows:/work/apps/desktop/src-tauri/target
)

if [[ "${1:-}" == "--purger" ]]; then
  docker volume rm -f quinca-work quinca-cargo-registry quinca-cargo-git quinca-xwin-cache quinca-pnpm-store quinca-target-windows
  exit 0
fi

docker build -t "$IMAGE" "$RACINE/apps/desktop/scripts/windows"

# Export du dépôt (HEAD) + fichier .env non versionné, dans le volume de travail.
docker run --rm -v quinca-work:/work "$IMAGE" bash -c 'find /work -mindepth 1 -maxdepth 1 ! -name apps -exec rm -rf {} + ; find /work/apps -mindepth 1 -maxdepth 1 ! -name desktop -exec rm -rf {} + 2>/dev/null; find /work/apps/desktop -mindepth 1 -maxdepth 1 ! -name src-tauri -exec rm -rf {} + 2>/dev/null; find /work/apps/desktop/src-tauri -mindepth 1 -maxdepth 1 ! -name target -exec rm -rf {} + 2>/dev/null; true'
git -C "$RACINE" archive HEAD | docker run --rm -i -v quinca-work:/work "$IMAGE" tar -x -C /work
docker run --rm -i -v quinca-work:/work "$IMAGE" bash -c 'cat > /work/apps/desktop/.env' < "$RACINE/apps/desktop/.env"

if [[ "${1:-}" == "--shell" ]]; then
  exec docker run --rm -it "${VOLUMES[@]}" -w /work "$IMAGE" bash --noprofile
fi

docker run --rm "${VOLUMES[@]}" -w /work "$IMAGE" bash -c '
  set -euo pipefail
  pnpm config set store-dir /root/.local/share/pnpm/store
  pnpm install --frozen-lockfile
  pnpm --filter @quinca/desktop exec tauri build --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis
'

mkdir -p "$SORTIE"
CID=$(docker create "${VOLUMES[@]}" "$IMAGE" true)
docker cp "$CID:/work/apps/desktop/src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/." "$SORTIE/"
docker rm "$CID" > /dev/null
echo "Installeur Windows : $(ls "$SORTIE"/*.exe)"
