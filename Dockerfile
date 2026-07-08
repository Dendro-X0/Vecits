FROM rust:1-bookworm AS builder

WORKDIR /app
COPY Cargo.toml Cargo.lock ./
COPY apps ./apps
COPY crates ./crates

RUN cargo build --release --bin vectis-node

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/target/release/vectis-node /usr/local/bin/vectis-node
COPY docker/entrypoint.sh /usr/local/bin/vectis-entrypoint.sh

RUN chmod +x /usr/local/bin/vectis-entrypoint.sh

ENV VECTIS_DATA_DIR=/data

VOLUME ["/data"]
EXPOSE 7878

ENTRYPOINT ["/usr/local/bin/vectis-entrypoint.sh"]
CMD ["node", "serve", "--data-dir", "/data", "--bind", "0.0.0.0:7878"]
