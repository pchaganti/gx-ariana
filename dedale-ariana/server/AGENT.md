# Ariana Server Development Guide

## Build/Test Commands
- **Build**: `cargo build --release`
- **Test**: `cargo test`
- **Run HTTP server**: `cargo run --bin http`
- **Generate TS bindings**: `cargo test export_bindings`
- **Check**: `cargo check`
- **Format**: `cargo fmt`
- **Lint**: `cargo clippy`

## Database Commands
- **PostgreSQL migrations**: Place in `/migrations/` with timestamp naming
- **ClickHouse migrations**: `cargo run --bin ch_run_migrations`
- **New ClickHouse migration**: `cargo run --bin ch_new_migration <name>`

## Code Style & Conventions
- **Error handling**: Use `anyhow::Result<T>`, `thiserror` for custom errors
- **Async**: Actix-web runtime, async/await patterns
- **Database**: SQLx with PostgreSQL, UUID primary keys, macros for queries
- **Modules**: Organized by domain (web/, vaults/, traces/, parsing/, etc.)
- **Auth**: JWT with Clerk integration, middleware for protected routes
- **Tests**: Use `#[test]` with `mod tests` blocks per module

## Project Structure
- `/src/bin/`: Binary executables (http, migrations, etc.)
- `/src/web/`: HTTP API endpoints and middleware
- `/src/vaults/`, `/src/traces/`: Core domain logic
- `/migrations/`: PostgreSQL schema migrations
- `/clickhouse_migrations/`: ClickHouse schema migrations
- Tree-sitter parsers for multiple programming languages
