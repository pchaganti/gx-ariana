use anyhow::{anyhow, Result};
use ariana_server::traces::Trace;
use clap::Parser;
use processor::restore_backup;
use utils::generate_machine_id;
use std::env;
use std::fs;
use std::process::exit;
use tokio::io::AsyncBufReadExt;
use tokio::spawn;
use tokio::signal;
use tokio::sync::mpsc;

mod auth;
mod config;

mod collector;
mod instrumentation;
mod processor;
mod subprocess_stdout_watcher;
mod trace_watcher;
mod utils;

use collector::collect_items;
use instrumentation::{create_vault, detect_project_import_style};
use processor::process_items;
use subprocess_stdout_watcher::{watch_subprocess_output, OutputSource};
use trace_watcher::watch_traces;
use utils::{add_to_gitignore, can_create_symlinks};

#[derive(Parser)]
#[command(version, about = "Ariana CLI")]
struct Cli {
    /// Ignores normal behavior and just gets an AI recap of the last run
    #[arg(long)]
    recap: bool,

    /// Ignores normal behavior and just restores original files from backup. Can be useful if you just ran --inplace and the backup was not restored
    #[arg(long)]
    restore: bool,

    /// Ignores normal behavior and just logs in to your Ariana account
    #[arg(long)]
    login: bool,

    /// API URL for Ariana server
    #[arg(long, default_value_t = if cfg!(debug_assertions) { "http://localhost:8080/".to_string() } else { "https://api.ariana.dev/".to_string() })]
    api_url: String,

    /// Toggles instrumenting the original code files instead of a copy of them under .ariana
    #[arg(long)]
    inplace: bool,

    /// The command to execute in the instrumented code directory (not required if --recap, --restore, or --login is used)
    #[arg(trailing_var_arg = true)]
    command: Vec<String>,
}

const ARIANA_DIR: &str = ".ariana";

#[tokio::main]
async fn main() -> Result<()> {
    env::set_var("RUST_BACKTRACE", "1");
    let cli = Cli::parse();

    if cli.login {
        auth::ensure_authenticated(&cli.api_url).await
    } else if cli.recap {
        run_recap(&cli.api_url).await
    } else if cli.restore {
        restore_backup()
    } else {
        // // Ensure authenticated before running any command
        // auth::ensure_authenticated(&cli.api_url).await?;
        main_command(cli).await
    }
}

async fn main_command(cli: Cli) -> Result<()> {
    if cli.command.is_empty() && !cli.login {
        eprintln!("Error: A command is required when not using --recap");
        eprintln!("Usage: ariana [args...] <command>");
        eprintln!("       ariana --recap");
        exit(1);
    }

    let current_dir = env::current_dir()?;
    let ariana_dir = current_dir.join(ARIANA_DIR);

    // Check symlink capability on Windows
    if cfg!(windows) && !can_create_symlinks().await {
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
    add_to_gitignore(&current_dir).await?;

    // Create vault
    println!("[Ariana] Creating a new vault for your traces");
    let current_cwd_str = env::current_dir()?.to_string_lossy().into_owned();
    let vault_command_str = if cli.command.is_empty() { None } else { Some(cli.command.join(" ")) };
    let vault_key = create_vault(&cli.api_url, vault_command_str.as_deref(), Some(&current_cwd_str)).await?;
    let import_style = detect_project_import_style(&current_dir)?;

    // Process files
    let working_dir = if cli.inplace {
        current_dir.clone()
    } else {
        ariana_dir.clone()
    };

    let collected_items = collect_items(&current_dir, &ariana_dir)?;
    println!("[Ariana] Instrumenting code files");
    process_items(
        &collected_items,
        &cli.api_url,
        &vault_key,
        &import_style,
        cli.inplace,
    )
    .await
    .map_err(|s| anyhow!(s))?;

    // Write vault secret key
    let vault_secret_key_path = ariana_dir.join(".vault_secret_key");
    fs::write(
        &vault_secret_key_path,
        format!("{}\nDO NOT SHARE THE ABOVE KEY WITH ANYONE", vault_key),
    )?;

    let (trace_tx, mut trace_rx) = mpsc::channel::<Trace>(1);
    let (output_tx, output_rx) = mpsc::channel::<(String, OutputSource)>(100);
    let (stop_tx, mut stop_rx) = mpsc::channel::<()>(1);
    let (subprocess_stop_tx, subprocess_stop_rx) = mpsc::channel::<()>(1);

    let api_url = cli.api_url.clone();
    let trace_watcher_vault_key = vault_key.clone();
    let trace_watcher = spawn(async move {
        let _ = watch_traces(&mut trace_rx, &api_url, &trace_watcher_vault_key, &mut stop_rx).await;
    });
    
    // Start the subprocess output watcher
    let subprocess_api_url = cli.api_url.clone();
    let subprocess_vault_key = vault_key.clone();
    let subprocess_watcher = spawn(async move {
        watch_subprocess_output(output_rx, &subprocess_api_url, &subprocess_vault_key, subprocess_stop_rx).await
    });
    // Prepare the command to run
    let command_to_run = cli.command[0].clone(); // Assuming cli.command is not empty, checked earlier
    let command_args = cli.command[1..].to_vec();

    println!(
        "[Ariana] Running `{} {}` in {}/",
        command_to_run,
        command_args.join(" "),
        working_dir.file_name().unwrap_or_default().to_str().unwrap_or_default()
    );
    println!("\n\n\n");

    let mut child = if cfg!(windows) {
        tokio::process::Command::new("cmd")
            .args(&["/C", &command_to_run])
            .args(&command_args)
            .current_dir(&working_dir)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()?
    } else {
        tokio::process::Command::new(&command_to_run)
            .args(&command_args)
            .current_dir(&working_dir)
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::piped())
            .spawn()?
    };

    let child_stdout = child.stdout.take().expect("Failed to capture stdout");
    let mut stdout_reader = tokio::io::BufReader::new(child_stdout).lines();

    let child_stderr = child.stderr.take().expect("Failed to capture stderr");
    let mut stderr_reader = tokio::io::BufReader::new(child_stderr).lines();

    let stdout_output_tx = output_tx.clone();
    let stderr_output_tx_clone = output_tx.clone(); 
    let trace_tx_for_stdout = trace_tx.clone();
    
    let perf_now = std::time::Instant::now();

    let stdout_processing_task = tokio::spawn(async move {
        loop {
            match stdout_reader.next_line().await {
                Ok(Some(line)) => {
                    let mut processed_line = String::new();
                    let mut current_pos = 0;
                    while let Some(start_idx) = line[current_pos..].find("<trace id=") {
                        let absolute_start = current_pos + start_idx;
                        processed_line.push_str(&line[current_pos..absolute_start]);
                        if let Some(end_idx) = line[absolute_start..].find("</trace>") {
                            let absolute_end = absolute_start + end_idx + 8; 
                            if let Some(id_start_offset) = line[absolute_start..absolute_end].find('"') {
                                let id_start_abs = absolute_start + id_start_offset + 1;
                                if let Some(id_end_offset) = line[id_start_abs..absolute_end].find('"') {
                                    let content_start = id_start_abs + id_end_offset + 2;
                                    let content_end = absolute_start + end_idx;
                                    if content_start <= content_end && content_end <= line.len() {
                                        let trace_content = &line[content_start..content_end];
                                        match serde_json::from_str::<Trace>(trace_content) {
                                            Ok(trace) => {
                                                if trace_tx_for_stdout.send(trace).await.is_err() {
                                                    eprintln!("[Ariana] Trace channel closed. Cannot send more traces.");
                                                }
                                            }
                                            Err(e) => {
                                                eprintln!("[Ariana] Failed to deserialize trace content: {}, content: '{}'", e, trace_content);
                                            }
                                        }
                                    }
                                }
                            }
                            current_pos = absolute_end;
                        } else {
                            processed_line.push_str(&line[absolute_start..]);
                            current_pos = line.len();
                            break;
                        }
                    }
                    if current_pos < line.len() {
                        processed_line.push_str(&line[current_pos..]);
                    }
                    if !processed_line.trim_matches(|c| c == ' ' || c == '\n' || c == '\t' || c == '\r' || c == '\x08').is_empty() {
                        println!("{}", processed_line);
                        if stdout_output_tx.send((processed_line.clone(), OutputSource::Stdout)).await.is_err() {
                            eprintln!("[Ariana] Stdout channel closed. Stopping stdout processing.");
                            break;
                        }
                    }
                }
                Ok(None) => break, 
                Err(e) => {
                    eprintln!("[Ariana] Error reading stdout from subprocess: {}", e);
                    break;
                }
            }
        }
    });

    let stderr_processing_task = tokio::spawn(async move {
        loop {
            match stderr_reader.next_line().await {
                Ok(Some(line)) => {
                    eprintln!("{}", line);
                    if stderr_output_tx_clone.send((line, OutputSource::Stderr)).await.is_err() {
                        eprintln!("[Ariana] Stderr channel closed. Stopping stderr processing.");
                        break;
                    }
                }
                Ok(None) => break, 
                Err(e) => {
                    eprintln!("[Ariana] Error reading stderr from subprocess: {}", e);
                    break;
                }
            }
        }
    });
    
    tokio::select! {
        biased; 
        _ = signal::ctrl_c() => {
            println!("[Ariana] Received Ctrl+C, stopping your command...");
            if cli.inplace {
                if let Err(e) = processor::restore_backup() {
                    eprintln!("[Ariana] Error restoring backup during Ctrl+C: {}", e);
                } else {
                    println!("[Ariana] Backup restored due to Ctrl+C (if applicable).");
                }
            }
            if let Err(e) = child.kill().await {
                eprintln!("[Ariana] Failed to kill subprocess: {}. It might have already exited.", e);
            } else {
                println!("[Ariana] Subprocess signalled to terminate.");
            }
            // Child will be waited for outside the select block if killed.
        }
        result = child.wait() => {
            match result {
                Ok(status) => {
                    if !status.success() {
                        eprintln!("[Ariana] Subprocess exited with status: {}", status);
                    }
                }
                Err(e) => {
                    eprintln!("[Ariana] Error waiting for subprocess: {}", e);
                }
            }
        }
    }

    if let Err(e) = stdout_processing_task.await {
        eprintln!("[Ariana] Error joining stdout processing task: {:?}", e);
    }
    if let Err(e) = stderr_processing_task.await {
        eprintln!("[Ariana] Error joining stderr processing task: {:?}", e);
    }

    let perf_end = std::time::Instant::now();
    println!(
        "[Ariana] Command finished, took {} ms. Waiting to finish sending collected traces and output...",
        perf_end.duration_since(perf_now).as_millis()
    );

    drop(stop_tx); 
    drop(subprocess_stop_tx);
    drop(output_tx);

    if let Err(e) = trace_watcher.await {
         eprintln!("[Ariana CLI Main] Failed to join trace_watcher task: {:?}", e);
    }
    match subprocess_watcher.await {
        Ok(Ok(_)) => {}
        Ok(Err(e)) => eprintln!("[Ariana CLI Main] Subprocess_watcher completed with error: {}", e),
        Err(e) => eprintln!("[Ariana CLI Main] Failed to join subprocess_watcher task: {:?}", e),
    }

    if cli.inplace {
        if let Err(e) = processor::restore_backup() {
            eprintln!("[Ariana] Error restoring backup at end of command: {}", e);
        } else {
            println!("[Ariana] Backup restored at end of command (if applicable).");
        }
    }

    println!("[Ariana] ❓ Use the Ariana IDE extension to view the traces.");
    println!("[Ariana] 🙏 Thanks for using Ariana! We are looking for your feedback, suggestions & bugs so we can make Ariana super awesome for you!");
    println!("[Ariana] ➡️  Join the Discord: https://discord.gg/Y3TFTmE89g");

    Ok(())
}

async fn run_recap(api_url: &str) -> Result<()> {
    println!("[Ariana] Reading vault secret key...");
    let vault_key = read_vault_secret_key().await?;
    
    println!("[Ariana] Fetching recap from server...");
    
    // Generate a machine hash for the request
    let machine_hash = generate_machine_id().await?;
    
    // Call the server API to get the trace tree
    let client = reqwest::Client::new();
    let response = client
        .post(&format!("{}/vaults/{}/get-trace-tree", api_url, vault_key))
        .header("X-Machine-Hash", machine_hash)
        .send()
        .await?;
    
    if !response.status().is_success() {
        return Err(anyhow!("Failed to get trace tree: HTTP {}", response.status()));
    }
    
    // Parse and print the response
    let trace_tree_response: ariana_server::web::vaults::GetTraceTreeLLMResponse = response.json().await?;
    
    println!("\n[Ariana] Trace Recap:\n");
    println!("{}", trace_tree_response.answer);
    
    Ok(())
}

/// Read the first line of the .ariana/.vault_secret_key file to get the vault secret key
async fn read_vault_secret_key() -> Result<String> {
    let current_dir = env::current_dir()?;
    let vault_key_path = current_dir.join(ARIANA_DIR).join(".vault_secret_key");
    
    if !vault_key_path.exists() {
        return Err(anyhow!("Vault secret key file not found at {}. Have you run 'ariana run' first?", vault_key_path.display()));
    }
    
    let content = tokio::fs::read_to_string(&vault_key_path).await?;
    let vault_key = content.lines().next().ok_or_else(|| anyhow!("Vault secret key file is empty"))?;
    
    Ok(vault_key.to_string())
}