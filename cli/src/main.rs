use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, exit};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use anyhow::{Result, anyhow};
use ignore::gitignore::{Gitignore, GitignoreBuilder};

use ariana_server::traces::Trace;
use ariana_server::web::traces::{CodeInstrumentationRequest, CodeInstrumentationResponse, PushTracesRequest};
use ariana_server::web::vaults::VaultPublicData;
use clap::Parser;
use tokio::fs::create_dir_all;
use tokio::io::AsyncBufReadExt;
use tokio::spawn;
use tokio::sync::mpsc;
use tokio::time::Duration;
use tokio::time::interval;
use ariana_server::traces::instrumentalization::ecma::EcmaImportStyle;
use rand::{thread_rng, distributions::Alphanumeric, Rng};
use sha2::{Sha256, Digest};
use async_recursion::async_recursion;
use dirs;
use ctrlc;

#[derive(Parser)]
#[command(
    version, 
    about = "Ariana CLI - Instrumentalize your code to collect Ariana traces while it runs."
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

struct RunCli {
    api_url: String,
    inplace: bool,
    command: Vec<String>,
}

const TRACE_DIR: &str = ".traces";
const ARIANA_DIR: &str = ".ariana";
const SAVED_TRACES_DIR: &str = ".ariana_saved_traces";

#[tokio::main]
async fn main() -> Result<()> {
    // Enable backtraces
    env::set_var("RUST_BACKTRACE", "1");
    
    let cli = Cli::parse();
    
    if cli.recap {
        // Run recap command
        match run_recap(&cli.api_url).await {
            Ok(_) => Ok(()),
            Err(e) => {
                eprintln!("Error reading trace recap: {:#}", e);
                Err(e)
            }
        }
    } else {
        // Validate that a command was provided when not in recap mode
        if cli.command.is_empty() {
            eprintln!("Error: A command is required when not using --recap");
            eprintln!("Usage: ariana <command> [args...]");
            eprintln!("       ariana --recap");
            exit(1);
        }
        
        // Run main command (default)
        let run_cli = RunCli {
            api_url: cli.api_url,
            inplace: cli.inplace,
            command: cli.command,
        };
        
        match run_main(run_cli).await {
            Ok(_) => Ok(()),
            Err(e) => {
                eprintln!("Error occurred: {:#}", e);
                
                let backtrace = e.backtrace();
                eprintln!("\nBacktrace:\n{}", backtrace);

                Err(e)
            }
        }
    }
}

async fn run_main(cli: RunCli) -> Result<()> {
    // Get the current directory to process
    let current_dir = env::current_dir()?;

    // Create a new vault
    println!("[Ariana] Creating a new vault...");
    let vault_key = create_vault(&cli.api_url).await?;

    // Create the .ariana directory for backups/instrumented code
    let ariana_dir = current_dir.join(ARIANA_DIR);
    if ariana_dir.exists() {
        println!("[Ariana] Removing existing .ariana directory");
        fs::remove_dir_all(&ariana_dir)?;
    }
    create_dir_all(&ariana_dir).await?;

    // Set up the trace directory - either in original directory or .ariana based on inplace flag
    let trace_dir = if cli.inplace {
        current_dir.join(TRACE_DIR)
    } else {
        ariana_dir.join(TRACE_DIR)
    };
    create_dir_all(&trace_dir).await?;

    // Add .ariana to .gitignore
    add_to_gitignore(&current_dir).await?;

    // Backup or copy files based on inplace flag
    let working_dir = if cli.inplace {
        // Backup files to .ariana without instrumentation
        process_directory_backup(&current_dir, &ariana_dir, &current_dir)?;
        current_dir.clone()
    } else {
        // Copy and instrument files to .ariana
        println!("[Ariana] Instrumenting your code...");
        instrumentalize_project(&cli.api_url, &current_dir, &vault_key, false).await?;
        ariana_dir.clone()
    };

    // If running in-place, instrument the files in the original location
    if cli.inplace {
        println!("[Ariana] Instrumenting your code in-place...");
        instrumentalize_project(&cli.api_url, &current_dir, &vault_key, true).await?;
    }

    // Start trace watcher in a separate task
    let (trace_tx, mut trace_rx) = mpsc::channel::<Trace>(1);
    let (stop_tx, mut stop_rx) = mpsc::channel::<()>(1);
    let api_url = cli.api_url.clone();
    let trace_watcher= spawn(async move {
        let _ = watch_traces(&mut trace_rx, &api_url, &vault_key, &mut stop_rx).await;
    });

    // Prepare the command to run
    let mut command_args = cli.command.clone();
    let command = command_args.remove(0);
    
    println!("[Ariana] Running command in {}/ : {} {}", working_dir.file_name().unwrap().to_str().unwrap(), command, command_args.join(" "));
    if !cli.inplace {
        println!("[Ariana] tip: To run the command in the original directory, use the --inplace flag (in that case original files will be temporarily edited and then restored).");
        println!("➡️    For more info: Run 'ariana --help' or for a trace recap use 'ariana --recap'");
        println!("➡️    Join us on Discord for tips and features previews: https://discord.gg/Y3TFTmE89g");
    }

    println!("\n\n\n");

    // Execute the command in the working directory with streaming output
    let mut child = if cfg!(windows) {
        tokio::process::Command::new("cmd")
            .args(&["/C", &command])
            .args(&command_args)
            .current_dir(&working_dir)
            .env("TRACE_DIR", TRACE_DIR)
            .stdout(std::process::Stdio::piped())
            .spawn()?
    } else {
        tokio::process::Command::new(&command)
            .args(&command_args)
            .current_dir(&working_dir)
            .env("TRACE_DIR", TRACE_DIR)
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

    println!("[Ariana] All traces observed. Took {} ms. Now waiting to finish sending them.", perf_end.duration_since(perf_now).as_millis());

    // let _ = futures::future::join_all(sent_traces_futures).await;

    // Wait for the process to finish
    let status = child.wait().await?;

    // Stop the trace watcher
    let _ = stop_tx.send(()).await;

    // Wait for the trace watcher to complete
    let _ = trace_watcher.await;

    // If running in-place, restore original files
    if cli.inplace {
        restore_from_backup(&working_dir, &ariana_dir)?;
        // Don't delete the backup directory, just in case
        println!("[Ariana] Your instrumented code files just got restored from backup. In case something went wrong, please find the backup preserved in {}", ariana_dir.display());
    }

    // Exit with the same status code as the command
    if !status.success() {
        exit(status.code().unwrap_or(1));
    }

    Ok(())
}

async fn watch_traces(
    trace_rx: &mut mpsc::Receiver<Trace>,
    api_url: &str,
    vault_key: &str,
    stop_rx: &mut mpsc::Receiver<()>
) -> Result<()> {
    let mut traces = Vec::new();
    let batch_size = 50_000;
    let saved_traces_dir = Path::new(".").join(SAVED_TRACES_DIR).join(vault_key);
    create_dir_all(&saved_traces_dir).await?;
    let mut clear_start = std::time::Instant::now();
    let mut interval = interval(Duration::from_secs(3));

    loop {
        tokio::select! {
            _ = interval.tick() => {
                if !traces.is_empty() {
                    process_traces(&traces, api_url, vault_key).await?;
                    traces.clear();
                    clear_start = std::time::Instant::now();
                }
            }
            trace = trace_rx.recv() => {
                if let Some(trace) = trace {
                    traces.push(trace);

                    if traces.len() >= batch_size || clear_start.elapsed() > Duration::from_secs(3) {
                        process_traces(&traces, api_url, vault_key).await?;
                        traces.clear();
                        clear_start = std::time::Instant::now();
                    }
                }
            }
            _ = stop_rx.recv() => {
                if !traces.is_empty() {
                    // split in chunks of batch_size
                    println!("[Ariana] Sending remaining {} traces", traces.len());
                    let mut chunks = Vec::new();
                    for i in 0..(traces.len() / batch_size) + 1 {
                        let start = i * batch_size;
                        let end = ((i + 1) * batch_size).min(traces.len());
                        chunks.push(&traces[start..end]);
                    }
                    for chunk in chunks {
                        process_traces(chunk, api_url, vault_key).await?;
                    }
                }

                println!("[Ariana] Trace channel closed");
                println!("[Ariana] ==================================");
                println!("❓    You can now open your IDE, use the Ariana extension and view the traces.\nSee how to do it: https://github.com/dedale-dev/ariana?tab=readme-ov-file#3--in-your-ide-get-instant-debugging-information-in-your-code-files");
                println!("🙏    Thanks for using Ariana! We are looking for your feedback, suggestions & bugs so we can make Ariana super awesome for you!");
                println!("➡️    Join the Discord: https://discord.gg/Y3TFTmE89g");
                break;
            }
        }
    }

    Ok(())
}

async fn process_traces(
    traces: &[Trace],
    api_url: &str,
    vault_key: &str
) -> Result<()> {
    // Create a properly typed request
    let request = PushTracesRequest {
        traces: traces.to_vec(),
    };
    
    // Send the trace to the server
    let client = reqwest::Client::new();
    let response = client
        .post(&format!("{}/vaults/traces/{}/push", api_url, vault_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(anyhow!("Failed to process trace: {}", response.status()));
    }
    
    Ok(())
}

async fn instrumentalize_project(
    api_url: &str,
    project_root: &Path,
    vault_key: &str,
    inplace: bool
) -> Result<()> {
    // Create the .ariana directory
    let ariana_dir = project_root.join(ARIANA_DIR);
    create_dir_all(&ariana_dir).await?;

    // Detect project import style
    let import_style = detect_project_import_style(project_root).await?;
    
    // Process the directory
    process_directory(
        project_root.to_path_buf(),
        if inplace { project_root.to_path_buf() } else { ariana_dir.to_path_buf() },
        project_root,
        api_url,
        vault_key,
        &import_style,
        inplace
    ).await?;
    
    println!("[Ariana] Instrumentation complete!");

    let vault_secret_key_path = ariana_dir.join(".vault_secret_key");
    let vault_secret_key_content = format!("{}\nDO NOT SHARE THE ABOVE KEY WITH ANYONE, DO NOT COMMIT IT TO VERSION CONTROL", vault_key);
    tokio::fs::write(&vault_secret_key_path, vault_secret_key_content).await?;
    
    Ok(())
}

async fn detect_project_import_style(project_root: &Path) -> Result<EcmaImportStyle> {
    let package_json_path = project_root.join("package.json");
    
    if package_json_path.exists() {
        let package_json = fs::read_to_string(package_json_path)?;
        let package_data: serde_json::Value = serde_json::from_str(&package_json)?;
        
        // Check package.json "type" field first
        if let Some(type_field) = package_data.get("type") {
            if type_field.as_str() == Some("module") {
                return Ok(EcmaImportStyle::ESM);
            }
        }
        
        // Check for specific indicators in package.json
        let has_esm_indicators = 
            package_data.get("exports").is_some() || 
            package_data.get("module").is_some() || 
            package_data.get("mjs").is_some();
        
        if has_esm_indicators {
            return Ok(EcmaImportStyle::ESM);
        }
    }
    
    // Default to CJS if no strong ESM indicators
    Ok(EcmaImportStyle::CJS)
}

#[async_recursion]
async fn process_directory(
    src: PathBuf,
    dest: PathBuf,
    project_root: &Path,
    api_url: &str,
    vault_key: &str,
    import_style: &EcmaImportStyle,
    inplace: bool
) -> Result<()> {
    // Create the destination directory if not in-place mode
    if !inplace {
        create_dir_all(dest.clone()).await?;
    }

    let mut subdirs_processing_futures = vec![];
    let mut files_processing_futures = vec![];

    // Load .gitignore and .arianaignore patterns
    let mut builder = GitignoreBuilder::new(&src);
    if let Ok(Some(gitignore)) = find_nearest_gitignore(&src) {
        builder.add(gitignore);
    }
    let ariana_ignore = src.join(".arianaignore");
    if ariana_ignore.exists() {
        builder.add(ariana_ignore);
    }
    let ignore_matcher = builder.build().unwrap_or_else(|_| Gitignore::empty());

    // Get all entries in the source directory
    for entry in fs::read_dir(src.clone())? {
        let entry = entry?;
        let entry_path = entry.path();
        
        // Compute the equivalent destination path
        let rel_path = entry_path.strip_prefix(Path::new(&src))?;
        let dest_path = dest.join(Path::new(&rel_path));
        
        // Process based on entry type
        if entry_path.is_dir() {
            let dir_name = entry_path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("");
                
            if should_skip_directory(dir_name) {
                // For node_modules and other special dirs, create a symlink or copy if not in-place
                if !inplace {
                    create_link_or_copy(&entry_path, &dest_path).await?;
                }
                continue;
            }
            
            // Clone paths to owned PathBufs to ensure they live long enough
            let entry_path_owned = entry_path.to_path_buf();
            let dest_path_owned = dest_path.to_path_buf();
            
            subdirs_processing_futures.push(process_directory(
                entry_path_owned,
                dest_path_owned,
                project_root,
                api_url,
                vault_key,
                import_style,
                inplace
            ));
        } else if entry_path.is_file() {
            let filename = entry_path.file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("");
                
            if filename.ends_with(".config.js") || filename.ends_with(".config.ts") {
                if !inplace {
                    fs::copy(&entry_path, &dest_path)?;
                }
                continue;
            }

            // Process the file
            if let Some(ext) = entry_path.extension() {
                let ext_str = ext.to_string_lossy().to_lowercase();
                if ["js", "jsx", "ts", "tsx", "py"].contains(&ext_str.as_str()) {
                    let content = fs::read_to_string(&entry_path)?;
                    let entry_path_owned = entry_path.to_path_buf();
                    let project_root_owned = project_root.to_path_buf();
                    let dest_path_owned = if inplace { entry_path.to_path_buf() } else { dest_path.to_path_buf() };
                    
                    // Check if file should be ignored for instrumentation
                    let should_instrument = !ignore_matcher.matched(&entry_path, false).is_ignore();
                    
                    if should_instrument {
                        files_processing_futures.push(async move {
                            let file_path_str = entry_path_owned.to_string_lossy().to_string();
                            match instrument_file(
                                entry_path_owned,
                                content,
                                project_root_owned,
                                api_url.to_string(),
                                vault_key.to_string(),
                                import_style.clone()
                            ).await {
                                Ok(instrumented_content) => {
                                    if let Err(_) = fs::write(dest_path_owned, instrumented_content) {
                                        return Err(file_path_str);
                                    }
                                    Ok(())
                                },
                                Err(_) => Err(file_path_str)
                            }
                        });
                    } else if !inplace {
                        // For ignored files, just copy them without instrumentation
                        fs::copy(&entry_path, &dest_path)?;
                    }
                } else if !inplace {
                    // Just copy non-JS/TS files when not in-place
                    create_link_or_copy(&entry_path, &dest_path).await?;
                }
            } else {
                create_link_or_copy(&entry_path, &dest_path).await?;
            }
        }
    }

    // Wait for all subdirectories to be processed
    let subdir_results = futures::future::join_all(subdirs_processing_futures).await;
    for result in subdir_results {
        result?;
    }

    // Wait for all files to be processed
    let file_results = futures::future::join_all(files_processing_futures).await;
    let failed_files: Vec<String> = file_results.into_iter()
        .filter_map(|r| r.err())
        .collect();
    
    if !failed_files.is_empty() {
        eprintln!("[Ariana] Failed to process the following files:");
        for file in failed_files {
            eprintln!("  {}", file);
        }
        return Err(anyhow!("Failed to process some files"));
    }

    Ok(())
}

fn should_skip_directory(dir_name: &str) -> bool {
    let skip_list = ["node_modules", ".git", ".ariana", "dist", "build", "target", ".ariana_saved_traces", ".traces", "venv", "site-packages", "__pycache__", ".ariana-saved-traces"];
    skip_list.contains(&dir_name)
}

async fn create_link_or_copy(src: &Path, dest: &Path) -> Result<()> {
    if src.is_dir() {
        #[cfg(unix)]
        {
            match std::os::unix::fs::symlink(src, dest) {
                Ok(_) => return Ok(()),
                Err(_) => {
                    // If symlink fails, use fs_extra to copy
                    let options = fs_extra::dir::CopyOptions::new();
                    fs_extra::dir::copy(src, dest.parent().unwrap(), &options)?;
                    return Ok(());
                }
            }
        }

        #[cfg(windows)]
        {
            match std::os::windows::fs::symlink_dir(src, dest) {
                Ok(_) => return Ok(()),
                Err(_) => {
                    // If symlink fails, use fs_extra to copy
                    let options = fs_extra::dir::CopyOptions::new();
                    fs_extra::dir::copy(src, dest.parent().unwrap(), &options)?;
                    return Ok(());
                }
            }
        }
    } else if src.is_file() {
        #[cfg(unix)]
        {
            match std::os::unix::fs::symlink(src, dest) {
                Ok(_) => return Ok(()),
                Err(_) => {
                    // If symlink fails, copy the file
                    fs::copy(src, dest)?;
                    return Ok(());
                }
            }
        }

        #[cfg(windows)]
        {
            match std::os::windows::fs::symlink_file(src, dest) {
                Ok(_) => return Ok(()),
                Err(_) => {
                    // If symlink fails, copy the file
                    fs::copy(src, dest)?;
                    return Ok(());
                }
            }
        }
    };

    #[cfg(not(any(unix, windows)))]
    {
        // For other platforms, just copy
        if src.is_dir() {
            let options = fs_extra::dir::CopyOptions::new();
            fs_extra::dir::copy(src, dest.parent().unwrap(), &options)?;
        } else if src.is_file() {
            fs::copy(src, dest)?;
        }
    }

    Ok(())
}

async fn instrument_file(
    file_path: PathBuf,
    content: String,
    project_root: PathBuf,
    api_url: String,
    vault_key: String,
    project_import_style: EcmaImportStyle
) -> Result<String> {
    // Create a properly typed request
    let request = CodeInstrumentationRequest {
        file_content: content.to_string(),
        file_path: file_path.to_string_lossy().to_string(),
        project_root: project_root.to_string_lossy().to_string(),
        project_import_style: Some(project_import_style.clone()),
    };
    
    // Call the server API to instrumentalize the code
    let client = reqwest::Client::new();
    let response = client
        .post(&format!("{}/vaults/traces/{}/instrumentalize", api_url, vault_key))
        .header("Content-Type", "application/json")
        .json(&request)
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(anyhow!("Failed to instrumentalize code: HTTP {}", response.status()));
    }
    
    // Parse the response to get the instrumented content
    let response_data: CodeInstrumentationResponse = response.json().await?;
    
    Ok(response_data.instrumented_content)
}

async fn add_to_gitignore(project_root: &Path) -> Result<()> {
    println!("[Ariana] Adding ariana temporary files & secrets to .gitignore...");
    
    // Find the nearest .gitignore file
    let gitignore_path = find_nearest_gitignore(project_root)?;
    let entries_to_add = vec![".ariana/", ".ariana.json", ".vault_secret_key", ".traces/", ".ariana_saved_traces/"];
    
    // Create a new .gitignore if none exists
    if gitignore_path.is_none() {
        println!("[Ariana] No .gitignore found, creating new one...");
        let content = entries_to_add.join("\n") + "\n";
        fs::write(project_root.join(".gitignore"), content)?;
        return Ok(());
    }
    
    // Read existing .gitignore
    let gitignore_path = gitignore_path.unwrap();
    let content = fs::read_to_string(&gitignore_path)?;
    let mut lines: Vec<String> = content
        .lines()
        .map(|line| line.trim().to_string())
        .collect();
    
    // Add new entries if they don't exist
    let mut modified = false;
    for entry in entries_to_add {
        if !lines.contains(&entry.to_string()) {
            lines.push(entry.to_string());
            modified = true;
        }
    }
    
    // Save if changes were made
    if modified {
        let new_content = lines.join("\n") + "\n";
        fs::write(gitignore_path, new_content)?;
        println!("[Ariana] Updated .gitignore");
    }
    
    Ok(())
}

fn find_nearest_gitignore(start_path: &Path) -> Result<Option<PathBuf>> {
    let mut current_path = start_path.to_path_buf();
    
    loop {
        let gitignore_path = current_path.join(".gitignore");
        if gitignore_path.exists() {
            return Ok(Some(gitignore_path));
        }
        
        // Move up to parent directory
        if !current_path.pop() {
            // We've reached the root and found no .gitignore
            return Ok(None);
        }
    }
}

/// Create a new vault and return the vault secret key
async fn create_vault(api_url: &str) -> Result<String> {
    // Generate a machine hash (just a random ID in this case)
    let machine_hash = generate_machine_id()?;
    
    // Call the server API to create a vault
    let client = reqwest::Client::new();
    let response = client
        .post(&format!("{}/unauthenticated/vaults/create", api_url))
        .header("X-Machine-Hash", machine_hash)
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(anyhow!("Failed to create vault: HTTP {}", response.status()));
    }
    
    // Parse the response to get the vault key
    let vault_data: VaultPublicData = response.json().await?;
    
    Ok(vault_data.secret_key)
}

/// Generate a unique machine ID (for X-Machine-Hash header)
fn generate_machine_id() -> Result<String> {
    // Try to get a stable machine ID if possible, otherwise generate a random one
    let id = match get_stable_machine_id() {
        Some(id) => id,
        None => {
            // Generate a random ID and save it for future use
            let rng = thread_rng();
            let random_id: String = rng
                .sample_iter(&Alphanumeric)
                .take(32)
                .map(char::from)
                .collect();
            
            // Save this ID for future use
            let ariana_dir = dirs::home_dir()
                .ok_or_else(|| anyhow!("Could not determine home directory"))?
                .join(".ariana");
            
            fs::create_dir_all(&ariana_dir)?;
            fs::write(ariana_dir.join("machine-id"), &random_id)?;
            
            random_id
        }
    };
    
    // Hash the ID for privacy
    let mut hasher = Sha256::new();
    hasher.update(id.as_bytes());
    let result = hasher.finalize();
    
    Ok(format!("{:x}", result))
}

/// Try to get a stable machine ID from the filesystem
fn get_stable_machine_id() -> Option<String> {
    // First check if we've already created an ID
    if let Some(home_dir) = dirs::home_dir() {
        let ariana_id_path = home_dir.join(".ariana").join("machine-id");
        if let Ok(id) = fs::read_to_string(&ariana_id_path) {
            return Some(id);
        }
    }
    
    // Try to get a system machine ID (Windows/Linux specific)
    #[cfg(windows)]
    {
        if let Ok(output) = Command::new("wmic").args(["csproduct", "get", "UUID"]).output() {
            let output = String::from_utf8_lossy(&output.stdout);
            let uuid = output.lines().nth(1).unwrap_or("").trim();
            if !uuid.is_empty() {
                return Some(uuid.to_string());
            }
        }
    }
    
    #[cfg(unix)]
    {
        if let Ok(id) = fs::read_to_string("/etc/machine-id") {
            return Some(id.trim().to_string());
        }
        
        if let Ok(id) = fs::read_to_string("/var/lib/dbus/machine-id") {
            return Some(id.trim().to_string());
        }
    }
    
    None
}

/// Process directory by copying files without instrumentation (for backup)
fn process_directory_backup(src: &Path, dest: &Path, project_root: &Path) -> Result<()> {
    if should_skip_directory(src.file_name().unwrap_or_default().to_str().unwrap_or_default()) {
        return Ok(());
    }

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let path = entry.path();
        let relative_path = path.strip_prefix(project_root)?;
        let target_path = dest.join(relative_path);

        if path.is_dir() {
            fs::create_dir_all(&target_path)?;
            process_directory_backup(&path, dest, project_root)?;
        } else if path.is_file() {
            fs::create_dir_all(target_path.parent().unwrap())?;
            fs::copy(&path, &target_path)?;
        }
    }
    Ok(())
}

/// Restore files from backup
fn restore_from_backup(working_dir: &Path, backup_dir: &Path) -> Result<()> {
    println!("[Ariana] Restoring files from backup...");
    
    // First, collect all files that need to be restored
    let mut files_to_restore = Vec::new();
    collect_files_to_restore(backup_dir, backup_dir, &mut files_to_restore)?;

    // Then restore each file
    for (backup_path, relative_path) in files_to_restore {
        let target_path = working_dir.join(&relative_path);
        
        // Create parent directory if it doesn't exist
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent)?;
        }

        // Copy the file, overwriting the instrumented version
        if backup_path.is_file() {
            fs::copy(&backup_path, &target_path)?;
        }
    }

    Ok(())
}

/// Helper function to collect all files that need to be restored
fn collect_files_to_restore(
    current_path: &Path,
    backup_root: &Path,
    files: &mut Vec<(PathBuf, PathBuf)>
) -> Result<()> {
    if current_path.is_dir() {
        for entry in fs::read_dir(current_path)? {
            let entry = entry?;
            let path = entry.path();
            
            // Skip .git directory
            if path.is_dir() && path.file_name().unwrap_or_default() == ".git" {
                continue;
            }

            // Skip .ariana directory
            if path.is_dir() && path.file_name().unwrap_or_default() == ARIANA_DIR {
                continue;
            }

            // Get the relative path from the backup root
            let binding = path.clone();
            let relative_path = binding.strip_prefix(backup_root)?;

            if path.is_dir() {
                collect_files_to_restore(&path, backup_root, files)?;
            } else if path.is_file() {
                files.push((path, relative_path.to_path_buf()));
            }
        }
    }
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

/// Run the recap command to get a summary of traces from the server
async fn run_recap(api_url: &str) -> Result<()> {
    println!("[Ariana] Reading vault secret key...");
    let vault_key = read_vault_secret_key().await?;
    
    println!("[Ariana] Fetching recap from server...");
    
    // Generate a machine hash for the request
    let machine_hash = generate_machine_id()?;
    
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