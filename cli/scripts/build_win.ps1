$env:SQLX_OFFLINE = "true"
cargo build --release --target x86_64-pc-windows-msvc
cp target/x86_64-pc-windows-msvc/release/ariana.exe binaries/ariana-windows-x64.exe