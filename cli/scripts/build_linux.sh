SQLX_OFFLINE=true cross build --release --target x86_64-unknown-linux-gnu
cp target/x86_64-unknown-linux-gnu/release/ariana binaries/ariana-linux-x64
chmod +x binaries/ariana-linux-x64

SQLX_OFFLINE=true cross build --release --target aarch64-unknown-linux-gnu
cp target/aarch64-unknown-linux-gnu/release/ariana binaries/ariana-linux-arm64
chmod +x binaries/ariana-linux-arm64