use anyhow::{anyhow, Result};
use rand::distributions::Alphanumeric;
use rand::thread_rng;
use rand::Rng;
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use std::process::Command;
use tokio::fs;

pub fn should_copy_or_link_directory(dir_name: &str) -> bool {
    let skip_list = [
        ".git",
        ".ariana",
        ".ariana_saved_traces",
        ".traces",
        ".ariana-saved-traces",
    ];
    !skip_list.contains(&dir_name)
}

pub fn should_explore_directory(dir_name: &str) -> bool {
    let skip_list = [
        "node_modules",
        ".git",
        ".ariana",
        "dist",
        "build",
        "target",
        ".ariana_saved_traces",
        ".traces",
        "venv",
        "site-packages",
        "__pycache__",
        ".ariana-saved-traces",
    ];

    !skip_list.contains(&dir_name) && !dir_name.contains(".") && !dir_name.starts_with("_")
}

pub async fn should_copy_not_link(path: &Path) -> bool {
    // if file is less than 1mb copy it
    let metadata = fs::metadata(path).await.unwrap();
    println!("{} {}", path.display(), metadata.len());
    if metadata.len() < 1024 * 1024 {
        return true;
    }

    let unsafe_extensions = ["html", "htm", "css", "sass", "scss", "vue", "svelte"];

    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        let ext_lower = ext.to_lowercase();
        if unsafe_extensions.contains(&ext_lower.as_str()) {
            return true;
        }
    }
    false
}

pub async fn create_link_or_copy(src: &Path, dest: &Path) -> Result<()> {
    if src.is_dir() {
        if should_copy_not_link(src).await {
            copy_dir_all(src, dest).await?;
            return Ok(());
        }

        #[cfg(unix)]
        {
            match tokio::fs::symlink(src, dest).await {
                Ok(_) => return Ok(()),
                Err(_) => {
                    copy_dir_all(src, dest).await?;
                    return Ok(());
                }
            }
        }

        #[cfg(windows)]
        {
            match tokio::fs::symlink_dir(src, dest).await {
                Ok(_) => return Ok(()),
                Err(_) => {
                    copy_dir_all(src, dest).await?;
                    return Ok(());
                }
            }
        }
    } else if src.is_file() {
        if should_copy_not_link(src).await {
            fs::copy(src, dest).await?;
            return Ok(());
        }

        #[cfg(unix)]
        {
            match tokio::fs::symlink(src, dest).await {
                Ok(_) => return Ok(()),
                Err(_) => {
                    fs::copy(src, dest).await?;
                    return Ok(());
                }
            }
        }

        #[cfg(windows)]
        {
            match tokio::fs::symlink_file(src, dest).await {
                Ok(_) => return Ok(()),
                Err(e) => {
                    eprintln!("cannot symlink: {:?}", e);
                    fs::copy(src, dest).await?;
                    return Ok(());
                }
            }
        }
    }

    #[cfg(not(any(unix, windows)))]
    {
        if src.is_dir() {
            copy_dir_all(src, dest).await?;
        } else if src.is_file() {
            fs::copy(src, dest).await?;
        }
    }

    Ok(())
}

#[async_recursion::async_recursion]
async fn copy_dir_all(src: &Path, dst: &Path) -> Result<()> {
    fs::create_dir_all(&dst).await?;
    let mut entries = fs::read_dir(src).await?;
    let mut tasks = Vec::new();

    while let Some(entry) = entries.next_entry().await? {
        let ty = entry.file_type().await?;
        let new_dst = dst.join(entry.file_name());
        let task = async move {
            if ty.is_dir() {
                copy_dir_all(&entry.path(), &new_dst).await
            } else {
                Ok(if ty.is_file() {
                    fs::copy(entry.path(), new_dst).await.map(|_| ())
                } else {
                    Ok(())
                }?)
            }
        };
        tasks.push(task);
    }

    futures_util::future::join_all(tasks)
        .await
        .into_iter()
        .collect::<Result<Vec<_>, _>>()?;

    Ok(())
}

pub async fn can_create_symlinks() -> bool {
    #[cfg(windows)]
    {
        let temp_dir = std::env::temp_dir();
        let src = temp_dir.join("ariana_test_src");
        let dest = temp_dir.join("ariana_test_dest");
        if fs::write(&src, "test").await.is_err() {
            return false;
        }
        let result = tokio::fs::symlink_file(&src, &dest).await;
        let _ = fs::remove_file(&src);
        if result.is_ok() {
            let _ = fs::remove_file(&dest);
            true
        } else {
            false
        }
    }
    #[cfg(not(windows))]
    {
        true
    }
}

pub async fn add_to_gitignore(project_root: &Path) -> Result<()> {
    let gitignore_path = project_root.join(".gitignore");
    let entries = vec![
        ".ariana/",
        ".traces/",
        ".ariana_saved_traces/",
        ".vault_secret_key",
    ];
    if !gitignore_path.exists() {
        fs::write(&gitignore_path, entries.join("\n") + "\n").await?;
        return Ok(());
    }
    let content = fs::read_to_string(&gitignore_path).await?;
    let mut lines: Vec<String> = content.lines().map(String::from).collect();
    let mut modified = false;
    for entry in entries {
        if !lines.contains(&entry.to_string()) {
            lines.push(entry.to_string());
            modified = true;
        }
    }
    if modified {
        fs::write(&gitignore_path, lines.join("\n") + "\n").await?;
    }
    Ok(())
}

pub fn compute_dest_path(src_path: &Path, project_root: &Path, ariana_dir: &Path) -> PathBuf {
    let relative_path = src_path.strip_prefix(project_root).unwrap();
    let result = ariana_dir.join(relative_path);
    result
}

pub async fn generate_machine_id() -> Result<String> {
    // Try to get a stable machine ID if possible, otherwise generate a random one
    let id = match get_stable_machine_id().await {
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

            tokio::fs::create_dir_all(&ariana_dir).await?;
            tokio::fs::write(ariana_dir.join("machine-id"), &random_id).await?;

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
async fn get_stable_machine_id() -> Option<String> {
    // First check if we've already created an ID
    if let Some(home_dir) = dirs::home_dir() {
        let ariana_id_path = home_dir.join(".ariana").join("machine-id");
        if let Ok(id) = fs::read_to_string(&ariana_id_path).await {
            return Some(id);
        }
    }

    // Try to get a system machine ID (Windows/Linux specific)
    #[cfg(windows)]
    {
        if let Ok(output) = Command::new("wmic")
            .args(["csproduct", "get", "UUID"])
            .output()
        {
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
