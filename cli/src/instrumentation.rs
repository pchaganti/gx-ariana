use anyhow::{anyhow, Result};
use ariana_server::traces::instrumentation::ecma::EcmaImportStyle;
use ariana_server::web::traces::instrument::{
    CodeInstrumentationBatchRequest, CodeInstrumentationBatchResponse,
};
use ariana_server::web::vaults::{VaultPublicData, CreateVaultRequestPayload};
use reqwest::blocking::Client;
use std::path::PathBuf;
use std::time::Duration;
use tokio::task;

use crate::utils::generate_machine_id;

pub async fn instrument_files_batch(
    files_paths: &Vec<PathBuf>,
    files_contents: Vec<String>,
    api_url: String,
    vault_key: String,
    import_style: &EcmaImportStyle,
) -> Result<Vec<Option<String>>> {
    if files_paths.is_empty() {
        // If files_paths is empty, there's nothing to instrument.
        // The original code would panic on files_paths[0] if it were empty.
        return Ok(vec![]); 
    }

    let project_root_str = files_paths
        .get(0)
        .ok_or_else(|| anyhow!("Cannot determine project root: files_paths list is empty."))?
        .parent()
        .ok_or_else(|| {
            anyhow!(
                "Cannot determine project root: path {} has no parent.",
                files_paths[0].display()
            )
        })?
        .to_string_lossy()
        .into_owned();

    let files_paths_str: Vec<String> = files_paths
        .iter()
        .map(|p| p.to_string_lossy().into_owned())
        .collect();

    let import_style_owned = import_style.clone();

    let request_payload = CodeInstrumentationBatchRequest {
        files_contents, // Consumes files_contents
        files_paths: files_paths_str,
        project_root: project_root_str,
        project_import_style: Some(import_style_owned),
    };

    // api_url and vault_key are owned Strings, they will be moved into the closure.
    // request_payload is also moved.
    task::spawn_blocking(move || {
        let client = Client::new(); 
        let response_result = client
            .post(&format!(
                "{}/vaults/traces/{}/instrument-batched",
                api_url, vault_key
            ))
            .header("Content-Type", "application/json")
            .json(&request_payload)
            .timeout(Duration::from_secs(10000))
            .send();

        match response_result {
            Ok(resp) => {
                let status = resp.status();
                if !status.is_success() {
                    let body = resp.text().unwrap_or_else(|_| "Failed to read response body".to_string());
                    Err(anyhow!(
                        "Failed to instrument file batch (HTTP {}): {}",
                        status, body
                    ))
                } else {
                    resp.json::<CodeInstrumentationBatchResponse>()
                        .map_err(|e| {
                            anyhow!("Failed to parse instrument batch response JSON: {}", e)
                        })
                        .map(|data| data.instrumented_contents)
                }
            }
            Err(e) => Err(anyhow!("Instrument batch HTTP request failed: {}", e)),
        }
    })
    .await
    .map_err(|e| anyhow!("Task for instrumenting batch panicked or was cancelled: {}", e))? // Handles JoinError from spawn_blocking (e.g. if the spawned task panics)
    // The final '?' propagates the Result from the closure (inner Result)
}

pub async fn create_vault(api_url: &str, command_str: Option<&str>, cwd_str: Option<&str>) -> Result<String> {
    // Generate a machine hash (just a random ID in this case)
    let machine_hash = generate_machine_id().await?;

    // Call the server API to create a vault
    let client = reqwest::Client::new();
    let payload = CreateVaultRequestPayload {
        command: command_str.map(|s| s.to_string()),
        cwd: cwd_str.map(|s| s.to_string()),
    };

    let response = client
        .post(&format!("{}/unauthenticated/vaults/create", api_url))
        .header("X-Machine-Hash", machine_hash)
        .json(&payload)
        .send()
        .await?;

    if !response.status().is_success() {
        return Err(anyhow!(
            "Failed to create vault: HTTP {}",
            response.status()
        ));
    }

    // Parse the response to get the vault key
    let vault_data: VaultPublicData = response.json().await?;

    Ok(vault_data.secret_key)
}

pub fn detect_project_import_style(project_root: &PathBuf) -> Result<EcmaImportStyle> {
    let package_json_path = project_root.join("package.json");
    if package_json_path.exists() {
        let content = std::fs::read_to_string(&package_json_path)?;
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
