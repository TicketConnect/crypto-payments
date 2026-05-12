# syntax=docker/dockerfile:1.7

FROM rust:1.91-bookworm AS builder
WORKDIR /app
COPY . .
RUN --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/target \
    cargo build --release --bin depositoor && \
    cp /app/target/release/depositoor /usr/local/bin/depositoor

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        libssl3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /usr/local/bin/depositoor /usr/local/bin/depositoor

ENV RUST_LOG=info

# Railway injects $PORT. Map it to LISTEN_ADDR unless the user already set one.
# Default subcommand is `api`; override CMD (or Railway's Start Command) to run
# `indexer --chain-id <id> --rpc-url <url>` or `sweeper ...` in additional services.
ENTRYPOINT ["/bin/sh", "-c", "if [ -z \"$LISTEN_ADDR\" ]; then export LISTEN_ADDR=\"0.0.0.0:${PORT:-3001}\"; fi; exec depositoor \"$@\"", "--"]
CMD ["api"]
