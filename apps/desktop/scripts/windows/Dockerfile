# Image de compilation croisée Windows (installeur NSIS) depuis macOS/Linux.
# Voir scripts/windows/build.sh.
FROM rust:1-bookworm

RUN apt-get update \
 && apt-get install -y --no-install-recommends nsis lld llvm clang ca-certificates curl gnupg \
 && rm -rf /var/lib/apt/lists/*

# Node 24 + pnpm (version épinglée par packageManager du dépôt via corepack).
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/* \
 && corepack enable

# Debian ne fournit pas de binaire `clang-cl` : cargo-xwin s'appuie sur le mode cl de clang.
RUN ln -s /usr/bin/clang-14 /usr/bin/clang-cl

RUN rustup target add x86_64-pc-windows-msvc \
 && cargo install --locked cargo-xwin

WORKDIR /work
