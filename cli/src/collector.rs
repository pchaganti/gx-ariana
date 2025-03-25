use crate::utils::{
    compute_dest_path, should_explore_directory, should_copy_or_link_directory,
};
use anyhow::Result;
use ignore::WalkBuilder;
use std::fs;
use std::path::{Path, PathBuf};

pub struct CollectedItems {
    pub directories_to_link_or_copy: Vec<(PathBuf, PathBuf)>,
    pub files_to_instrument: Vec<(PathBuf, PathBuf)>,
    pub files_to_link_or_copy: Vec<(PathBuf, PathBuf)>,
}

pub fn collect_items(project_root: &Path, ariana_dir: &Path) -> Result<CollectedItems> {
    let mut directories_to_link_or_copy = Vec::new();
    let mut files_to_instrument = Vec::new();
    let mut files_to_link_or_copy = Vec::new();

    let mut builder = WalkBuilder::new(project_root);
    builder.add_ignore(".arianaignore");
    builder.filter_entry(|entry| {
        if entry.file_type().map_or(false, |ft| ft.is_dir()) {
            let dir_name = entry.file_name().to_str().unwrap_or("");
            should_explore_directory(dir_name)
        } else {
            true
        }
    });

    for entry in builder.build() {
        let entry = entry?;
        let path = entry.path();
        if path == project_root {
            continue;
        }
        let file_type = entry.file_type().unwrap();

        if file_type.is_dir() {
            let dir_name = path.file_name().unwrap().to_str().unwrap_or("");
            if should_copy_or_link_directory(dir_name) {
                let dest_path = compute_dest_path(path, project_root, ariana_dir);
                directories_to_link_or_copy.push((path.to_owned(), dest_path));
            }
        } else if file_type.is_file() {
            let dest_path = compute_dest_path(path, project_root, ariana_dir);
            if should_instrument_file(path) {
                files_to_instrument.push((path.to_owned(), dest_path));
            } else {
                files_to_link_or_copy.push((path.to_owned(), dest_path));
            }
        }
    }

    Ok(CollectedItems {
        directories_to_link_or_copy,
        files_to_instrument,
        files_to_link_or_copy,
    })
}

fn should_instrument_file(path: &Path) -> bool {
    let valid_extensions = ["js", "ts", "tsx", "jsx", "py"];
    if let Ok(metadata) = fs::metadata(path) {
        if metadata.len() >= 4 * 1024 * 1024 {
            // 4MB
            return false;
        }
    } else {
        return false; // If metadata fails, skip instrumentation
    }
    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
        let ext_lower = ext.to_lowercase();
        if !valid_extensions.contains(&ext_lower.as_str()) {
            return false;
        }
        let filename = path.file_name().unwrap().to_str().unwrap_or("");
        if filename.ends_with(".config.js") || filename.ends_with(".config.ts") {
            return false;
        }
        true
    } else {
        false // No extension or extension reading fails
    }
}
