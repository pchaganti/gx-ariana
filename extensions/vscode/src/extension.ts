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
import { WebSocket } from 'ws';

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
        if (wsConnection) {
            wsConnection.close();
            wsConnection = null;
        }

        const wsUrl = apiUrl.replace(/^http/, 'ws');
        const fullWsUrl = `${wsUrl}/vaults/traces/${vaultSecretKey}/stream`;
        console.log(`Connecting to WebSocket at ${fullWsUrl}`);

        wsConnection = new WebSocket(fullWsUrl);

        wsConnection.on('open', () => {
            console.log('WebSocket connection established');
        });

        let isFirst = true;

        wsConnection.on('message', (data: Buffer) => {
            try {
                const parsedData = JSON.parse(data.toString());
                if (Array.isArray(parsedData)) {
                    // Initial batch of traces
                    if (isFirst) {
                        console.log(`Received ${parsedData.length} initial traces from WebSocket`);
                        tracesData = parsedData;
                    } else {
                        console.log(`Received ${parsedData.length} new traces from WebSocket`);
                        parsedData.forEach(pd => tracesData.push(pd))
                    }
                    if (showTraces && vscode.window.activeTextEditor) {
                        declareTracesUpdate(vscode.window.activeTextEditor);
                    }
                } else {
                    // Single new trace
                    console.log('Received exactly one new trace from WebSocket');
                    tracesData.push(parsedData);
                    
                    // If the file this trace belongs to is currently focused, update highlights
                    if (showTraces && vscode.window.activeTextEditor) {
                        const filepath = formatUriForDB(vscode.window.activeTextEditor.document.uri);
                        if (parsedData.start_pos.filepath === filepath) {
                            declareTracesUpdate(vscode.window.activeTextEditor);
                        }
                    }
                }
                isFirst = false;
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
            }
        });

        wsConnection.on('error', (error: Error) => {
            console.error('WebSocket error:', error);
        });

        wsConnection.on('close', (code: number, reason: string) => {
            console.log(`WebSocket connection closed: ${code} ${reason}`);
            wsConnection = null;
            
            // Try to reconnect after a delay if we should still be connected
            if (showTraces && currentVaultSecretKey) {
                setTimeout(() => {
                    if (showTraces && currentVaultSecretKey) {
                        connectToTraceWebSocket(currentVaultSecretKey);
                    }
                }, 5000);
            }
        });
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
            console.log("showing traces now");
            startVaultKeyMonitoring();
        } else {
            console.log("hiding traces now");
            stopVaultKeyMonitoring();
            wsConnection?.close();
            wsConnection = null;
            tracesData = []
            unhighlightTraces();
            clearHoverTraces();
        }

        vscode.window.showInformationMessage(`Ariana traces: ${showTraces ? 'Enabled' : 'Disabled'}`);
    });

    // Fetch traces for initial active editor
    if (vscode.window.activeTextEditor) {
        handleArianaInstallation(context);
        if (showTraces) {
            startVaultKeyMonitoring();
            declareTracesUpdate(vscode.window.activeTextEditor);
        }
    }

    // Listen for editor changes
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        if (editor) {
            unhighlightTraces(editor);
            clearHoverTraces(editor);
            handleArianaInstallation(context);
            if (showTraces) {
                declareTracesUpdate(editor);
            }
        }
    });

    let tracesUpdates: vscode.TextEditor[] = [];

    function declareTracesUpdate(editor: vscode.TextEditor) {
        tracesUpdates.push(editor);
    }

    async function highlightTraces(editor: vscode.TextEditor | undefined = undefined) {
        editor = editor ?? vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        console.log("highlight requested of " + tracesData.length + " traces");
        const regions = tracesToRegions(tracesData.filter(trace => 
            formatUriForDB(editor.document.uri) === trace.start_pos.filepath
        ));
        clearHoverTraces(editor);
        tracesHoverDisposable = highlightRegions(editor, regions, decoratedRanges);
    }

    setInterval(() => {
        const currentEditor = vscode.window.activeTextEditor;
        if (tracesUpdates.length > 0) {
            while (tracesUpdates.length > 0 && tracesUpdates[tracesUpdates.length - 1] !== currentEditor) {
                tracesUpdates.pop();
            }
            if (tracesUpdates.length > 0 && tracesUpdates[tracesUpdates.length - 1] === currentEditor) {
                console.log(tracesUpdates.length + " relevant trace update received now");
                if (showTraces) {
                    console.log("update triggers highlight because we show traces");
                    highlightTraces(currentEditor);
                }
                tracesUpdates.pop();
            }
        }
    }, 500);

    let decoratedRanges: Map<vscode.Range, vscode.TextEditorDecorationType> = new Map();

    function unhighlightTraces(editor: vscode.TextEditor | undefined = undefined) {
        editor = editor ?? vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        console.log("unhighlighting traces now");
        clearDecorations(editor, decoratedRanges);
    }

    function clearHoverTraces(editor: vscode.TextEditor | undefined = undefined) {
        editor = editor ?? vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        if (tracesHoverDisposable) {
            console.log("clearing hovers")
            tracesHoverDisposable.dispose();
            tracesHoverDisposable = undefined;
        }
    }

    function tracesToRegions(tracesData: Trace[]): Array<HighlightedRegion> {
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

    context.subscriptions.push({
        dispose: () => {
            stopVaultKeyMonitoring();
            wsConnection?.close()
        }
    });
}

export function deactivate() {
    // DropdownWebview.hide();
    if (vscode.window.activeTextEditor) {
        clearDecorations(vscode.window.activeTextEditor, new Map());
        if (tracesHoverDisposable) {
            tracesHoverDisposable.dispose();
            tracesHoverDisposable = undefined;
        }
    }
}