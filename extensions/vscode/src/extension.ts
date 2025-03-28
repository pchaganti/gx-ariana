import * as vscode from 'vscode';
import { TracesPanel, TracesPanelMode } from "./panels/TracesPanel";
import { formatUriForDB } from './urilHelpers';
import type { Trace } from './bindings/Trace';
import path = require('path');
import { VaultManager } from './vaults/manager';
import { getConfig } from './config';
import { TracesUnderPathRequest } from './bindings/TracesUnderPathRequest';
import { HighlightedRegion, highlightRegions } from './highlighting';
import { clearDecorations } from './highlighting/decorations';
import { handleArianaInstallation, updateArianaCLI } from './installation';

let tracesData: Trace[] = [];
let wsConnection: WebSocket | null = null;
let vaultKeyPollingInterval: NodeJS.Timeout | null = null;
let currentVaultSecretKey: string | null = null;
let tracesHoverDisposable: vscode.Disposable | undefined;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Extension is now active');
    const { apiUrl } = getConfig();

    VaultManager.initialize(context);

    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return;
    }
    
    let showTraces = false;

    context.subscriptions.push(
        vscode.commands.registerCommand('ariana.updateCLI', () => {
            updateArianaCLI(context);
        })
    );

    // Create a command to show the traceback panel
    context.subscriptions.push(
        vscode.commands.registerCommand('ariana.openWebview', (traceIds: string[], mode: TracesPanelMode) => {
            const panel = TracesPanel.render(context.extensionUri, tracesData.filter((trace) => traceIds.find((v) => v === trace.trace_id)), mode, async (file, startLine, startCol, endLine, endCol) => {
                console.log('Highlighting:', file, startLine, startCol, endLine, endCol);
                // Try to use existing editor if it's showing the right file
                // Check all visible editors first
                let editor = vscode.window.visibleTextEditors.find(e => formatUriForDB(e.document.uri) === file);
                if (!editor) {
                    // Open the file if no matching editor is found
                    console.log('Opening file:', file);
                    const doc = await vscode.workspace.openTextDocument(file);
                    editor = await vscode.window.showTextDocument(doc);
                }

                // Reveal and highlight the range
                const range = new vscode.Range(startLine, startCol, endLine, endCol);
                editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                editor.selection = new vscode.Selection(range.start, range.end);
            });
        })
    );

    // Function to manage WebSocket connection
    async function connectToTraceWebSocket(vaultSecretKey: string) {
        // Close existing connection if any
        closeWebSocketConnection();

        const wsUrl = apiUrl.replace(/^http/, 'ws');
        const fullWsUrl = `${wsUrl}/vaults/traces/${vaultSecretKey}/stream`;
        console.log(`Connecting to WebSocket at ${fullWsUrl}`);

        wsConnection = new WebSocket(fullWsUrl);

        wsConnection.onopen = () => {
            console.log('WebSocket connection established');
        };

        wsConnection.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                if (Array.isArray(data)) {
                    // Initial batch of traces
                    console.log(`Received ${data.length} traces from WebSocket`);
                    tracesData = data;
                    if (showTraces && vscode.window.activeTextEditor) {
                        highlightTraces(vscode.window.activeTextEditor);
                    }
                } else {
                    // Single new trace
                    console.log('Received new trace from WebSocket');
                    tracesData.push(data);
                    
                    // If the file this trace belongs to is currently focused, update highlights
                    if (showTraces && vscode.window.activeTextEditor) {
                        const filepath = formatUriForDB(vscode.window.activeTextEditor.document.uri);
                        if (data.start_pos.filepath === filepath) {
                            highlightTraces(vscode.window.activeTextEditor);
                        }
                    }
                }
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
            }
        };

        wsConnection.onerror = (error) => {
            console.error('WebSocket error:', error);
        };

        wsConnection.onclose = (event) => {
            console.log(`WebSocket connection closed: ${event.code} ${event.reason}`);
            wsConnection = null;
            
            // Try to reconnect after a delay if we should still be connected
            if (showTraces && currentVaultSecretKey) {
                setTimeout(() => {
                    if (showTraces && currentVaultSecretKey) {
                        connectToTraceWebSocket(currentVaultSecretKey);
                    }
                }, 5000);
            }
        };
    }

    function closeWebSocketConnection() {
        if (wsConnection) {
            wsConnection.close();
            wsConnection = null;
        }
    }

    // Function to start monitoring vault key changes
    function startVaultKeyMonitoring() {
        // Stop existing monitoring if any
        stopVaultKeyMonitoring();

        // Check immediately and then at regular intervals
        checkVaultKeyAndUpdateConnection();
        
        vaultKeyPollingInterval = setInterval(checkVaultKeyAndUpdateConnection, 5000); // Check every 5 seconds
    }

    // Function to stop monitoring vault key changes
    function stopVaultKeyMonitoring() {
        if (vaultKeyPollingInterval) {
            clearInterval(vaultKeyPollingInterval);
            vaultKeyPollingInterval = null;
        }
    }

    // Function to check vault key and update connection if necessary
    async function checkVaultKeyAndUpdateConnection() {
        if (!vscode.window.activeTextEditor) {
            return;
        }

        try {
            const vaultManager = VaultManager.getInstance();
            const vaultSecretKey = await vaultManager.getVaultKey(vscode.window.activeTextEditor.document.uri.fsPath);

            if (!vaultSecretKey) {
                closeWebSocketConnection();
                currentVaultSecretKey = null;
                return;
            }

            // If vault key changed or we need to connect and don't have a connection
            if (currentVaultSecretKey !== vaultSecretKey || (showTraces && !wsConnection)) {
                currentVaultSecretKey = vaultSecretKey;
                
                if (showTraces) {
                    connectToTraceWebSocket(vaultSecretKey);
                }
            }
        } catch (error) {
            console.error('Error checking vault key:', error);
        }
    }

    // Function to fetch traces for an editor (fallback to REST if WebSocket fails)
    async function fetchTracesForEditor(editor: vscode.TextEditor) {
        const document = editor.document;
        console.log('Active document:', document.uri.fsPath);
        tracesHoverDisposable = undefined;
        try {
            const vaultManager = VaultManager.getInstance();
            const vaultSecretKey = await vaultManager.getVaultKey(document.uri.fsPath);

            if (!vaultSecretKey) {
                return;
            }

            // If we have an active WebSocket connection, we don't need to fetch via HTTP
            if (wsConnection && wsConnection.readyState === WebSocket.OPEN) {
                // WebSocket is already providing traces
                return;
            }

            const body: TracesUnderPathRequest = {
                filepath: formatUriForDB(document.uri)
            };
            const response = await fetch(`${apiUrl}/vaults/traces/${vaultSecretKey}/under-path`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                console.error('Failed to fetch traces:', response.statusText);
                return;
            }

            const data: Trace[] = await response.json();
            console.log('Traces data:', data.length);
            if (vscode.window.activeTextEditor?.document.uri.toString() === document.uri.toString()) {
                tracesData = data;
            }
        } catch (error) {
            console.error('Error fetching traces:', error);
        }
    }

    let disposable = vscode.commands.registerCommand('ariana.highlightTraces', () => {
        showTraces = !showTraces;
        
        if (showTraces) {
            startVaultKeyMonitoring();
            highlightTraces();
        } else {
            stopVaultKeyMonitoring();
            closeWebSocketConnection();
            unhighlightTraces();
        }

        vscode.window.showInformationMessage(`Ariana traces: ${showTraces ? 'Enabled' : 'Disabled'}`);
    });

    // Fetch traces for initial active editor
    if (vscode.window.activeTextEditor) {
        handleArianaInstallation(context);
        if (showTraces) {
            startVaultKeyMonitoring();
            highlightTraces();
        }
    }

    // Listen for editor changes
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        if (editor) {
            unhighlightTraces(editor);
            handleArianaInstallation(context);
            if (showTraces) {
                highlightTraces(editor);
            }
        }
    });

    async function highlightTraces(editor: vscode.TextEditor | undefined = undefined) {
        editor = editor ?? vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Loading traces...",
            cancellable: false
        }, async (progress) => {
            try {
                await fetchTracesForEditor(editor);
                const regions = processTraces(tracesData.filter(trace => 
                    formatUriForDB(editor.document.uri) === trace.start_pos.filepath
                ));
                if (tracesHoverDisposable) {
                    tracesHoverDisposable.dispose();
                }
                clearDecorations(editor);
                tracesHoverDisposable = highlightRegions(editor, regions);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to load traces: ${error}`);
            }
        });
    }

    function unhighlightTraces(editor: vscode.TextEditor | undefined = undefined) {
        editor = editor ?? vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        if (tracesHoverDisposable) {
            clearDecorations(editor);
            tracesHoverDisposable.dispose();
            tracesHoverDisposable = undefined;
        }
    }

    function processTraces(tracesData: Trace[]): Array<HighlightedRegion> {
        const uniqueRegions = new Set(tracesData.map(trace => 
            `${trace.start_pos.line},${trace.start_pos.column},${trace.end_pos.line},${trace.end_pos.column}`
        ));

        return Array.from(uniqueRegions).map(regionKey => {
            const [startLine, startCol, endLine, endCol] = regionKey.split(',').map(Number);
            const tracesInRegion = tracesData.filter(trace =>
                trace.start_pos.line >= startLine &&
                trace.start_pos.column >= startCol &&
                trace.end_pos.line <= endLine &&
                trace.end_pos.column <= endCol
            );

            return {
                traces: tracesInRegion,
                startLine,
                startCol,
                endLine,
                endCol: endCol + 1
            };
        }).filter(region => region.traces.length > 0);
    }

    context.subscriptions.push(disposable);

    // Make sure to clean up resources when deactivated
    context.subscriptions.push({
        dispose: () => {
            stopVaultKeyMonitoring();
            closeWebSocketConnection();
        }
    });
}

export function deactivate() {
    // DropdownWebview.hide();
    if (vscode.window.activeTextEditor) {
        clearDecorations(vscode.window.activeTextEditor);
        if (tracesHoverDisposable) {
            tracesHoverDisposable.dispose();
            tracesHoverDisposable = undefined;
        }
    }
}