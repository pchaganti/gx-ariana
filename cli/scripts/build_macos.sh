export SQLX_OFFLINE=true
# build for macos
cargo build --release --target x86_64-apple-darwin
# build for macos arm64
cargo build --release --target aarch64-apple-darwin

cp target/x86_64-apple-darwin/release/ariana binaries/ariana-macos-x64
cp target/aarch64-apple-darwin/release/ariana binaries/ariana-macos-arm64
chmod +x binaries/ariana-macos-x64
chmod +x binaries/ariana-macos-arm64