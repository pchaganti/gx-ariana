use std::time::Duration;

use anyhow::{anyhow, Result};
use ariana_server::{traces::Trace, web::traces::PushTracesRequest};
use tokio::{sync::mpsc, time::interval};

pub async fn watch_traces(
    trace_rx: &mut mpsc::Receiver<Trace>,
    api_url: &str,
    vault_key: &str,
    stop_rx: &mut mpsc::Receiver<()>
) -> Result<()> {
    let mut traces = Vec::new();
    let batch_size = 50_000;
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
