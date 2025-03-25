use anyhow::Result;
use ariana_server::traces::Trace;
use clap::Parser;
use processor::restore_backup;
use tokio::spawn;
use tokio::sync::mpsc;
use std::env;
use std::fs;
use std::process::exit;
use std::sync::atomic::AtomicBool;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use tokio::io::AsyncBufReadExt;

mod collector;
mod instrumentation;
mod processor;
mod trace_watcher;
mod utils;

use collector::collect_items;
use instrumentation::{create_vault, detect_project_import_style};
use processor::process_items;
use trace_watcher::watch_traces;
use utils::{add_to_gitignore, can_create_symlinks};

#[derive(Parser)]
#[command(
    version,
    about = "Ariana CLI"
)]
struct Cli {
    /// API URL for Ariana server
    #[arg(long, default_value_t = if cfg!(debug_assertions) { "http://localhost:8080/".to_string() } else { "https://api.ariana.dev/".to_string() })]
    api_url: String,

    /// Get an AI recap of last run instead of running instrumentation
    #[arg(long)]
    recap: bool,

    /// Instrumentize the original code files instead of a copy of them under .ariana
    #[arg(long)]
    inplace: bool,

    /// The command to execute in the instrumented code directory (not required if --recap is used)
    #[arg(trailing_var_arg = true)]
    command: Vec<String>,
}

const ARIANA_DIR: &str = ".ariana";

#[tokio::main]
async fn main() -> Result<()> {
    env::set_var("RUST_BACKTRACE", "1");
    let cli = Cli::parse();

    if cli.recap {
        // Recap mode (to be implemented as per original logic if needed)
        println!("[Ariana] Recap mode not implemented in this rewrite yet.");
        Ok(())
    } else {
        if cli.command.is_empty() {
            eprintln!("Error: A command is required when not using --recap");
            eprintln!("Usage: ariana [args...] <command>");
            eprintln!("       ariana --recap");
            exit(1);
        }

        let current_dir = env::current_dir()?;
        let ariana_dir = current_dir.join(ARIANA_DIR);

        // Check symlink capability on Windows
        if cfg!(windows) && !can_create_symlinks() {
            println!("[Ariana] Warning: Unable to create symlinks. Ariana will fall back to copying files, which may be slow for large directories like node_modules.");
            println!("To enable symlinks on Windows:");
            println!("1. Enable Developer Mode in Windows Settings (Settings > Update & Security > For developers).");
            println!("2. Or run this CLI as Administrator.");
            println!("For more info: https://docs.microsoft.com/en-us/windows/win32/fileio/creating-symbolic-links");
        }

        // Create or clean .ariana directory
        if !cli.inplace {
            if ariana_dir.exists() {
                println!("[Ariana] Removing previous .ariana directory");
                fs_extra::dir::remove(&ariana_dir)?;
            }
            fs::create_dir_all(&ariana_dir)?;
        }

        // Add .ariana to .gitignore
        add_to_gitignore(&current_dir)?;

        // Create vault
        println!("[Ariana] Creating a new vault for your traces");
        let vault_key = create_vault(&cli.api_url)?;
        let import_style = detect_project_import_style(&current_dir)?;

        // Process files
        let working_dir = if cli.inplace {
            current_dir.clone()
        } else {
            ariana_dir.clone()
        };

        println!("[Ariana] Listing code files to instrument");
        let collected_items = collect_items(&current_dir, &ariana_dir)?;
        println!("[Ariana] Instrumenting code files");
        process_items(&collected_items, &cli.api_url, &vault_key, &import_style, cli.inplace)?;

        // Write vault secret key
        let vault_secret_key_path = ariana_dir.join(".vault_secret_key");
        fs::write(
            &vault_secret_key_path,
            format!("{}\nDO NOT SHARE THE ABOVE KEY WITH ANYONE", vault_key),
        )?;

        let (trace_tx, mut trace_rx) = mpsc::channel::<Trace>(1);
        let (stop_tx, mut stop_rx) = mpsc::channel::<()>(1);
        let api_url = cli.api_url.clone();
        let trace_watcher= spawn(async move {
            let _ = watch_traces(&mut trace_rx, &api_url, &vault_key, &mut stop_rx).await;
        });
        // Prepare the command to run
        let mut command_args = cli.command.clone();
        let command = command_args.remove(0);
        
        println!("[Ariana] Running `{} {}` in {}/", command, command_args.join(" "), working_dir.file_name().unwrap().to_str().unwrap());

        println!("\n\n\n");

        // Execute the command in the working directory with streaming output
        let mut child = if cfg!(windows) {
            tokio::process::Command::new("cmd")
                .args(&["/C", &command])
                .args(&command_args)
                .current_dir(&working_dir)
                .stdout(std::process::Stdio::piped())
                .spawn()?
        } else {
            tokio::process::Command::new(&command)
                .args(&command_args)
                .current_dir(&working_dir)
                .stdout(std::process::Stdio::piped())
                .spawn()?
        };

        let running = Arc::new(AtomicBool::new(true));
        let r = running.clone();
        // Set up a Ctrl+C handler
        let _ = ctrlc::set_handler(move || {
            println!("[Ariana] Received Ctrl+C, stopping your command...");
            r.store(false, Ordering::SeqCst);
        });

        // Process stdout as it's produced
        let stdout = child.stdout.take().expect("Failed to capture stdout");
        let mut reader = tokio::io::BufReader::new(stdout).lines();

        let perf_now = std::time::Instant::now();
        
        // let mut sent_traces_futures = Vec::new();
        while let Some(line) = reader.next_line().await.unwrap_or_else(|_| Some(String::new())) {
            let mut processed_line = String::new();
            let mut current_pos = 0;
            
            // Find all trace tags in the line
            while let Some(start_idx) = line[current_pos..].find("<trace id=") {
                let absolute_start = current_pos + start_idx;
                
                // Add text before the trace tag to the processed line
                processed_line.push_str(&line[current_pos..absolute_start]);
                
                // Find the end of this trace tag
                if let Some(end_idx) = line[absolute_start..].find("</trace>") {
                    let absolute_end = absolute_start + end_idx + 8; // 8 is the length of "</trace>"
                    
                    // Extract trace id and content for logging
                    if let Some(id_start) = line[absolute_start..absolute_start+20].find('\"') {
                        if let Some(_) = line[absolute_start+id_start+1..absolute_start+50].find('\"') {
                            // Extract just the content between the tags
                            let id_end = line[absolute_start+id_start+1..absolute_start+50].find('\"').unwrap();
                            let content_start = absolute_start + id_start + id_end + 3; // +3 for the closing " and the >
                            let content_end = absolute_start + end_idx;
                            let trace_content = &line[content_start..content_end];
                            let trace: Trace = serde_json::from_str(trace_content).unwrap();

                            trace_tx.send(trace).await?;
                        }
                    }
                    
                    // Update position to after this trace tag
                    current_pos = absolute_end;
                } else {
                    // If no closing tag found, add the rest and break
                    processed_line.push_str(&line[absolute_start..]);
                    current_pos = line.len();
                    break;
                }
            }
            
            // Add any remaining text after the last trace tag
            if current_pos < line.len() {
                processed_line.push_str(&line[current_pos..]);
            }
            
            // Only print if the line contains non-whitespace characters
            if !processed_line.trim_matches(|c| c == ' ' || c == '\n' || c == '\t' || c == '\r' || c == '\x08').is_empty() {
                println!("{}", processed_line);
            }
        }

        let perf_end = std::time::Instant::now();

        println!("[Ariana] Command finished, took {} ms. Waiting to finish sending collected traces...", perf_end.duration_since(perf_now).as_millis());

        // let _ = futures::future::join_all(sent_traces_futures).await;

        // Wait for the process to finish
        let status = child.wait().await?;

        // Stop the trace watcher
        let _ = stop_tx.send(()).await;

        // Wait for the trace watcher to complete
        let _ = trace_watcher.await;

        // If running in-place, restore original files
        if cli.inplace {
            if let Err(e) = restore_backup(&collected_items) {
                eprintln!("[Ariana] Could not restore backup from {}/__ariana_backup.zip: {}", ariana_dir.display(), e);
            } else {
                println!("[Ariana] Your instrumented code files just got restored from backup. In case something went wrong, please find the backup preserved in {}/__ariana_backup.zip", ariana_dir.display());
            }
        } else {
            println!("[Ariana] Removing .ariana/ ...");
            fs_extra::dir::remove(ariana_dir)?;
        }

        // Exit with the same status code as the command
        if !status.success() {
            exit(status.code().unwrap_or(1));
        }

        Ok(())
    }
}
