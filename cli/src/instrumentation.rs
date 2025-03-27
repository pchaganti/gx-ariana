use anyhow::{anyhow, Result};
use ariana_server::traces::instrumentalization::ecma::EcmaImportStyle;
use ariana_server::web::traces::{CodeInstrumentationBatchRequest, CodeInstrumentationBatchResponse, CodeInstrumentationRequest, CodeInstrumentationResponse};
use ariana_server::web::vaults::VaultPublicData;
use reqwest::blocking::Client;
use std::fs;
use std::path::PathBuf;
use std::time::Duration;

use crate::utils::generate_machine_id;


pub fn instrument_files_batch(
    files_paths: &Vec<PathBuf>,
    files_contents: Vec<String>,
    api_url: String,
    vault_key: String,
    import_style: &EcmaImportStyle
) -> Result<Vec<Option<String>>> {
    let request = CodeInstrumentationBatchRequest {
        files_contents,
        files_paths: files_paths.iter().map(|file_path| file_path.to_string_lossy().to_string()).collect(),
        project_root: files_paths[0].parent().unwrap().to_string_lossy().to_string(),
        project_import_style: Some(import_style.clone()),
    };

    let client = Client::new();
    let response = client
        .post(&format!(
            "{}/vaults/traces/{}/instrumentalize-batched",
            api_url, vault_key
        ))
        .header("Content-Type", "application/json")
        .json(&request)
        .timeout(Duration::from_secs(10000))
        .send()?;

    if !response.status().is_success() {
        return Err(anyhow!(
            "Failed to instrument file: HTTP {}",
            response.status()
        ));
    }

    let data: CodeInstrumentationBatchResponse = response.json()?;
    Ok(data.instrumented_contents)
}

pub fn instrument_file(
    file_path: PathBuf,
    content: String,
    api_url: String,
    vault_key: String,
    import_style: &EcmaImportStyle,
) -> Result<String> {
    let request = CodeInstrumentationRequest {
        file_content: content,
        file_path: file_path.to_string_lossy().to_string(),
        project_root: file_path.parent().unwrap().to_string_lossy().to_string(),
        project_import_style: Some(import_style.clone()),
    };

    let client = Client::new();
    let response = client
        .post(&format!(
            "{}/vaults/traces/{}/instrumentalize",
            api_url, vault_key
        ))
        .header("Content-Type", "application/json")
        .json(&request)
        .timeout(Duration::from_secs(10))
        .send()?;

    if !response.status().is_success() {
        return Err(anyhow!(
            "Failed to instrument file: HTTP {}",
            response.status()
        ));
    }

    let data: CodeInstrumentationResponse = response.json()?;
    Ok(data.instrumented_content)
}


pub async fn create_vault(api_url: &str) -> Result<String> {
    // Generate a machine hash (just a random ID in this case)
    let machine_hash = generate_machine_id()?;
    
    // Call the server API to create a vault
    let client = reqwest::Client::new();
    let response = client
        .post(&format!("{}/unauthenticated/vaults/create", api_url))
        .header("X-Machine-Hash", machine_hash)
        .send().await?;

    if !response.status().is_success() {
        return Err(anyhow!("Failed to create vault: HTTP {}", response.status()));
    }
    
    // Parse the response to get the vault key
    let vault_data: VaultPublicData = response.json().await?;
    
    Ok(vault_data.secret_key)
}

pub fn detect_project_import_style(project_root: &PathBuf) -> Result<EcmaImportStyle> {
    let package_json_path = project_root.join("package.json");
    if package_json_path.exists() {
        let content = fs::read_to_string(&package_json_path)?;
        let json: serde_json::Value = serde_json::from_str(&content)?;
        if let Some(type_field) = json.get("type") {
            if type_field.as_str() == Some("module") {
                return Ok(EcmaImportStyle::ESM);
            }
        }
        if json.get("exports").is_some() || json.get("module").is_some() {
            return Ok(EcmaImportStyle::ESM);
        }
    }
    Ok(EcmaImportStyle::CJS)
}
