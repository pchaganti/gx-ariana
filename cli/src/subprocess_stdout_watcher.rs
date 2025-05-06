use anyhow::Result;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::protocol::Message;
use std::time::{SystemTime, UNIX_EPOCH};
use futures_util::SinkExt;
use tokio_tungstenite::connect_async;

#[derive(Debug, Serialize, Deserialize, Clone, Copy, PartialEq, Eq)]
pub enum OutputSource {
    Stdout,
    Stderr,
}

#[derive(Debug, Serialize, Deserialize)]
struct SubprocessOutput {
    pub line: String,
    pub timestamp: u64,
    pub source: OutputSource,
}

pub async fn watch_subprocess_output(
    mut output_rx: mpsc::Receiver<(String, OutputSource)>,
    api_url: &str,
    vault_key: &str,
    mut stop_rx: mpsc::Receiver<()>,
) -> Result<()> {
    let url = format!(
        "{}vaults/{}/subprocess-stdout/stream",
        api_url.replace("http", "ws").replace("https", "wss"),
        vault_key
    );

    let (mut ws_stream, _) = connect_async(&url).await?;
    // println!("[Ariana] Connected to subprocess stdout stream");

    let (internal_tx, mut internal_rx) = mpsc::channel::<(String, OutputSource)>(10_000);
    let (task_stop_tx, mut task_stop_rx) = mpsc::channel::<()>(1);

    tokio::spawn(async move {
        loop {
            tokio::select! {
                biased; // Prioritize stop signal
                _ = task_stop_rx.recv() => {
                    // println!("[Ariana CLI Watcher] Forwarder task: Received stop signal. Breaking loop.");
                    break;
                }
                output_opt = output_rx.recv() => {
                    if let Some(output) = output_opt {
                        // println!("[Ariana CLI Watcher] Forwarder task: Received from output_rx: {:?}", output);
                        if internal_tx.send(output.clone()).await.is_err() { // Cloned for logging if send fails
                            // println!("[Ariana CLI Watcher] Forwarder task: Failed to send to internal_tx (receiver dropped). Breaking loop.");
                            break; // internal_rx dropped
                        }
                        // println!("[Ariana CLI Watcher] Forwarder task: Sent to internal_tx: {:?}", output);
                    } else {
                        // println!("[Ariana CLI Watcher] Forwarder task: output_rx channel closed. Breaking loop.");
                        break; // output_rx closed
                    }
                }
            }
        }
        // println!("[Ariana CLI Watcher] Forwarder task: Exited loop.");
    });

    let mut shutting_down = false;

    'main_loop: loop {
        tokio::select! {
            biased;
            _ = stop_rx.recv(), if !shutting_down => {
                // println!("[Ariana CLI Watcher] Main loop: Received global stop signal.");
                shutting_down = true;
                let _ = task_stop_tx.send(()).await; // Signal forwarder task to stop
                // println!("[Ariana CLI Watcher] Main loop: Signaled forwarder task to stop. Will continue to drain internal_rx.");
                // Continue to drain internal_rx
            },
            internal_output_opt = internal_rx.recv() => {
                if let Some((line, source)) = internal_output_opt {
                    // println!("[Ariana CLI Watcher] Main loop: Received from internal_rx: line='{}', source={:?}", line, source);
                    let output_payload = SubprocessOutput {
                        line: line.clone(), // Clone for potential retry
                        timestamp: SystemTime::now()
                            .duration_since(UNIX_EPOCH)
                            .unwrap_or_else(|_| SystemTime::UNIX_EPOCH.duration_since(UNIX_EPOCH).unwrap())
                            .as_millis() as u64,
                        source,
                    };

                    if let Ok(json) = serde_json::to_string(&output_payload) {
                        // println!("[Ariana CLI Watcher] Main loop: Sending JSON to WebSocket: {}", json);
                        if ws_stream.send(Message::Text(json.clone().into())).await.is_err() {
                            // eprintln!("[Ariana CLI Watcher] Main loop: Error sending subprocess output, attempting reconnect...");
                            match connect_async(&url).await {
                                Ok((new_stream, _)) => {
                                    ws_stream = new_stream;
                                    // println!("[Ariana CLI Watcher] Main loop: Reconnected to subprocess stdout stream");
                                    if ws_stream.send(Message::Text(json.into())).await.is_err() {
                                        // eprintln!("[Ariana CLI Watcher] Main loop: Error resending after reconnect. Message lost: {:?}", output_payload);
                                    }
                                }
                                Err(_e_connect) => {
                                    // eprintln!("[Ariana CLI Watcher] Main loop: Failed to reconnect: {}. Exiting watcher.", e_connect);
                                    break 'main_loop; // Cannot send, so exit
                                }
                            }
                        }
                    } else {
                        // eprintln!("[Ariana CLI Watcher] Main loop: Failed to serialize SubprocessOutput to JSON: line='{}', source={:?}", output_payload.line, output_payload.source);
                    }
                } else {
                    // internal_rx is closed. This means internal_tx (from forwarder task) was dropped.
                    // This happens when the forwarder task finishes (either subprocess ended or was stopped).
                    // println!("[Ariana CLI Watcher] Main loop: internal_rx channel closed. All messages processed or forwarder stopped. Breaking loop.");
                    break 'main_loop;
                }
            }
        }
    }

    // println!("[Ariana CLI Watcher] Main loop: Draining complete or loop exited. Closing WebSocket.");
    if let Err(_e) = ws_stream.close(None).await {
        // eprintln!("[Ariana CLI Watcher] Error closing WebSocket connection: {}", e);
    }
    // println!("[Ariana CLI Watcher] Subprocess stdout watcher finished.");
    Ok(())
}
