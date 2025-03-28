use crate::utils::{compute_dest_path, should_copy_or_link_directory, should_explore_directory};
use anyhow::Result;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use ignore::gitignore::GitignoreBuilder;

pub struct CollectedItems {
    pub directories_to_link_or_copy: Vec<(PathBuf, PathBuf)>,
    pub files_to_instrument: Vec<(PathBuf, PathBuf)>,
    pub files_to_link_or_copy: Vec<(PathBuf, PathBuf)>,
}

pub fn collect_items(project_root: &Path, ariana_dir: &Path) -> Result<CollectedItems> {
    let mut directories_to_link_or_copy = HashSet::new();
    let mut parents_of_files = HashSet::new();
    let mut files_to_instrument = HashSet::new();
    let mut files_to_link_or_copy = HashSet::new();

    let mut ignore_builder = GitignoreBuilder::new(project_root);
    // Add local .gitignore if it exists
    ignore_builder.add(project_root.join(".gitignore"));
    // Add .arianaignore if it exists
    ignore_builder.add(project_root.join(".arianaignore"));

    let mut entries = fs::read_dir(project_root)?.collect::<Vec<_>>();
    while let Some(entry) = entries.pop() {
        let entry = entry?;
        let path = entry.path();

        ignore_builder.add(path.join(".gitignore"));
        ignore_builder.add(path.join(".arianaignore"));
        let ignore = ignore_builder.build()?;

        let file_type = entry.file_type().unwrap();

        if file_type.is_dir() {
            let dir_name = path.file_name().unwrap().to_str().unwrap_or("");
            if ignore.matched(&path, path.is_dir()).is_none() && should_explore_directory(&dir_name) {
                entries.extend(fs::read_dir(&path)?);
            }

            if should_copy_or_link_directory(dir_name) {
                directories_to_link_or_copy.insert(path.to_owned());
            }
        } else if file_type.is_file() {
            let mut tmp = path.clone();
            while let Some(parent) = tmp.parent() {
                if parents_of_files.contains(parent) {
                    break;
                }
                parents_of_files.insert(parent.to_owned());
                tmp = parent.to_owned();
            }
            if should_instrument_file(&path) {
                files_to_instrument.insert(path.to_owned());
            } else {
                files_to_link_or_copy.insert(path.to_owned());
            }
        }
    }

    let directories_to_link_or_copy = directories_to_link_or_copy
        .difference(&parents_of_files)
        .collect::<HashSet<_>>();

    let files_to_link_or_copy = files_to_link_or_copy
        .difference(&files_to_instrument)
        .collect::<HashSet<_>>(); // redundant but for my sanity

    Ok(CollectedItems {
        directories_to_link_or_copy: directories_to_link_or_copy
            .iter()
            .map(|src| {
                (
                    src.to_owned().to_owned(),
                    compute_dest_path(src, project_root, ariana_dir),
                )
            })
            .collect(),
        files_to_instrument: files_to_instrument
            .iter()
            .map(|src| {
                (
                    src.to_owned(),
                    compute_dest_path(src, project_root, ariana_dir),
                )
            })
            .collect(),
        files_to_link_or_copy: files_to_link_or_copy
            .iter()
            .map(|src| {
                (
                    src.to_owned().to_owned(),
                    compute_dest_path(src, project_root, ariana_dir),
                )
            })
            .collect(),
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
