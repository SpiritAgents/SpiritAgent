# Ubuntu base image required for Cloud Agent Computer Use support.
# See https://cursor.com/docs/cloud-agent/setup.md#computer-use-support-for-dockerfile-repos
FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    git \
    build-essential \
    python3 \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Node.js 24 + pnpm 10.33.0 (matches packageManager in root package.json)
RUN curl -fsSL https://deb.nodesource.com/setup_24.x | bash - \
    && apt-get install -y nodejs \
    && corepack enable \
    && corepack prepare pnpm@10.33.0 --activate

# Rust stable (CLI requires edition 2024 / rust-version 1.85)
ENV CARGO_HOME=/usr/local/cargo
ENV RUSTUP_HOME=/usr/local/rustup
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs \
    | sh -s -- -y --no-modify-path --default-toolchain stable \
    && rustup component add clippy

ENV PATH="/usr/local/cargo/bin:/usr/bin:/usr/local/bin:${PATH}"
