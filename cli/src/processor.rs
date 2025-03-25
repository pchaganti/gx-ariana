use crate::collector::CollectedItems;
use crate::instrumentation::instrument_file;
use crate::utils::create_link_or_copy;
use anyhow::{Result, anyhow};
use ariana_server::traces::instrumentalization::ecma::EcmaImportStyle;
use indicatif::{ProgressBar, ProgressStyle};
use zip::write::FileOptions;
use zip::{ZipArchive, ZipWriter};
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

pub fn process_items(
    items: &CollectedItems,
    api_url: &str,
    vault_key: &str,
    import_style: &EcmaImportStyle,
    is_inplace: bool
) -> Result<()> {
    let total = if is_inplace {
        items.files_to_instrument.len() as u64
    } else {
        (items.directories_to_link_or_copy.len()
        + items.files_to_instrument.len()
        + items.files_to_link_or_copy.len()) as u64
    };

    let pb = ProgressBar::new(total);
    pb.set_style(
        ProgressStyle::default_bar()
            .template("[{elapsed_precise}] {bar:40.cyan/blue} {pos}/{len} {msg}")
            .unwrap()
            .progress_chars("##-"),
    );

    let processing_done = Arc::new(AtomicBool::new(false));
    let pd_clone = processing_done.clone();
    let message_thread = thread::spawn(move || {
        thread::sleep(Duration::from_secs(5));
        if !pd_clone.load(Ordering::SeqCst) {
            println!("[Ariana] Instrumentation is taking a while. For large projects, consider using the --inplace flag to instrument files in place, which may be faster.");
        }
    });
   
    let zip_file = if is_inplace {
        std::fs::create_dir_all(".ariana")?;
        Some(File::create(".ariana/__ariana_backups.zip")?)
    } else {
        None
    };
    let zip_writer = zip_file.map(|f| Arc::new(Mutex::new(ZipWriter::new(f))));

    rayon::scope(|s| {
        if !is_inplace {
            for (src, dest) in &items.directories_to_link_or_copy {
                let pb = pb.clone();
                let src = src.clone();
                let dest = dest.clone();
                s.spawn(move |_| {
                    // println!("Copying or linking {:?}", src);
                    if let Err(_) = create_link_or_copy(&src, &dest) {
                        // eprintln!("Could not copy or link {:?}: {}", src, e);
                    }
                    pb.inc(1);
                });
            }
        }
        for (src, dest) in &items.files_to_instrument {
            let pb = pb.clone();
            let src = src.clone();
            let dest = dest.clone();
            let api_url = api_url.to_string();
            let vault_key = vault_key.to_string();
            let import_style = import_style.clone();
            let zip_writer = zip_writer.clone();
            s.spawn(move |_| {
                let content = std::fs::read_to_string(&src).unwrap();
                // println!("Instrumenting {:?}", src);
                let instrumented =
                    instrument_file(src.clone(), content.clone(), api_url, vault_key, &import_style)
                        .unwrap();
                
                if is_inplace {
                    if let Some(zw) = zip_writer {
                        let mut zw = zw.lock().unwrap();
                        // Store original content in ZIP with path as name
                        let path_str = src.to_string_lossy().to_string();
                        zw.start_file(&path_str, FileOptions::<()>::default()).unwrap();
                        zw.write_all(content.as_bytes()).unwrap();
                        // Write instrumented content to original file
                        std::fs::write(&src, instrumented).unwrap();
                    }
                } else {
                    std::fs::create_dir_all(dest.parent().unwrap()).unwrap();
                    std::fs::write(&dest, instrumented).unwrap();
                }
                pb.inc(1);
            });
        }
        if !is_inplace {
            for (src, dest) in &items.files_to_link_or_copy {
                let pb = pb.clone();
                let src = src.clone();
                let dest = dest.clone();
                s.spawn(move |_| {
                    // println!("Copying or linking {:?}", src);
                    if let Err(e) = create_link_or_copy(&src, &dest) {
                        // eprintln!("Could not copy or link {:?}: {}", src, e);
                    }
                    pb.inc(1);
                });
            }
        }
    });

    pb.finish();
    processing_done.store(true, Ordering::SeqCst);
    message_thread.join().unwrap();

    Ok(())
}

pub fn restore_backup(items: &CollectedItems) -> Result<()> {
    let zip_path = Path::new(".ariana/__ariana_backups.zip");
    if !zip_path.exists() {
        return Err(anyhow!("Backup not found, could not restore."));
    }

    let zip_file = File::open(zip_path)?;
    let mut archive = ZipArchive::new(zip_file)?;

    let total = items.files_to_instrument.len() as u64;
    let pb = ProgressBar::new(total);
    pb.set_style(
        ProgressStyle::default_bar()
            .template("[{elapsed_precise}] {bar:40.cyan/blue} {pos}/{len} Restoring backups")
            .unwrap()
            .progress_chars("##-"),
    );

    for (src, _) in &items.files_to_instrument {
        let path_str = src.to_string_lossy().to_string();
        if let Ok(mut file) = archive.by_name(&path_str) {
            let mut content = Vec::new();
            file.read_to_end(&mut content)?;
            std::fs::write(src, content)?;
            pb.inc(1);
        }
    }

    drop(archive); // Close the archive
    let _ = std::fs::remove_dir_all(".ariana"); // Clean up if empty

    pb.finish_with_message("Backup restoration complete");
    Ok(())
}