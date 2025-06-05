# Ariana CLI Development Guide

## Build/Test Commands
- **Build**: `cargo build` (debug), `cargo build --release` (optimized)
- **Test**: `cargo test`
- **Run**: `cargo run` or `cargo run --release`
- **Cross-compile**: `cross build --release --target x86_64-unknown-linux-gnu`
- **Check**: `cargo check` (fast compilation check)
- **Format**: `cargo fmt`
- **Lint**: `cargo clippy`

## Code Style & Conventions
- **Error handling**: Use `anyhow::Result<T>` for functions, `?` operator for propagating errors
- **Imports**: Group std library, external crates, then local modules with `mod` declarations
- **Naming**: snake_case for functions/variables, PascalCase for types/structs
- **Async**: Use tokio runtime, `async fn` with proper error handling
- **CLI**: Use clap derive macros for argument parsing
- **Modules**: Separate concerns into modules (auth, config, collector, processor, etc.)

## Project Structure
- `/src`: Main CLI source code (Rust)
- `main.rs`: Entry point with CLI argument parsing
- Individual modules for auth, config, collector, processor, instrumentation
- Uses ariana-server as workspace dependency
