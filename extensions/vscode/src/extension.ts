import * as vscode from 'vscode';
import { formatUriForDB } from './urilHelpers';
import type { Trace } from './bindings/Trace';
import { VaultsManager } from './vaults/manager';
import { getConfig } from './config';
import { TracesUnderPathRequest } from './bindings/TracesUnderPathRequest';
import { HighlightedRegion, highlightRegions } from './highlighting';
import { clearDecorations } from './highlighting/decorations';
import { WebSocket } from 'ws';
import { SidebarPanel } from './panels/SidebarPanel';

let tracesData: Trace[] = [];
let wsConnection: WebSocket | null = null;
let vaultKeyPollingInterval: NodeJS.Timeout | null = null;
let currentVaultSecretKey: string | null = null;
let tracesHoverDisposable: vscode.Disposable | undefined;
let sidebarProvider: SidebarPanel | undefined;
let decoratedRanges: Map<vscode.Range, vscode.TextEditorDecorationType> = new Map();


let refreshTracesInTextEditorRequests: vscode.TextEditor[] = [];
let showTraces = false;

let apiUrl: string;

export async function activate(context: vscode.ExtensionContext) {
    console.log('Extension is now active');
    apiUrl = getConfig().apiUrl;

    console.log('Initializing VaultsManager...');
    VaultsManager.initialize(context);
    console.log('VaultsManager initialized successfully');

    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return;
    }

    console.log('Creating sidebar panel provider...');
    sidebarProvider = new SidebarPanel(context.extensionUri, context);
    console.log('Sidebar panel provider created successfully');

    console.log('Registering sidebar view provider...');
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(SidebarPanel.viewType, sidebarProvider)
    );
    console.log('Sidebar view provider registered successfully');

    console.log('Automatically opening the sidebar...');
    vscode.commands.executeCommand('workbench.view.extension.ariana-sidebar');

    console.log('Registering command to open the sidebar...');
    context.subscriptions.push(
        vscode.commands.registerCommand('ariana.openSidebar', () => {
            console.log('Opening sidebar...');
            vscode.commands.executeCommand('workbench.view.extension.ariana-sidebar');
            console.log('Sidebar opened successfully');
        })
    );

    console.log('Registering command to generate run commands...');
    context.subscriptions.push(
        vscode.commands.registerCommand('ariana.generateRunCommands', async (context) => {
            console.log('Generating run commands...');
            try {
                // Call the API endpoint to generate run commands
                const response = await fetch(`${apiUrl}/unauthenticated/codebase-intel/run-commands`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ context })
                });
                
                if (!response.ok) {
                    throw new Error(`Server responded with status: ${response.status}`);
                }
                
                return await response.json();
            } catch (error) {
                console.error('Error generating run commands:', error);
                throw error;
            }
        })
    );

    console.log('Updating the updateCLI command to use the SidebarPanel...');
    context.subscriptions.push(
        vscode.commands.registerCommand('ariana.updateCLI', () => {
            console.log('Updating CLI...');
            if (sidebarProvider) {
                sidebarProvider.updateArianaCli();
            }
        })
    );

    context.subscriptions.push(vscode.commands.registerCommand('ariana.highlightTraces', () => {
        console.log('Toggling showTraces...');
        showTraces = !showTraces;
        
        if (showTraces) {
            console.log("showing traces now");
            startVaultKeyMonitoring();
        } else {
            console.log("hiding traces now");
            stopVaultKeyMonitoring();
            wsConnection?.close();
            wsConnection = null;
            tracesData = [];
            unhighlightTraces();
            clearHoverTraces();
        }

        vscode.window.showInformationMessage(`Ariana traces: ${showTraces ? 'Enabled' : 'Disabled'}`);
    }));

    console.log('Fetching traces for initial active editor...');
    if (vscode.window.activeTextEditor) {
        if (showTraces) {
            startVaultKeyMonitoring();
            requestRefreshTracesInTextEditor(vscode.window.activeTextEditor);
        }
    }

    console.log('Listening for editor changes...');
    vscode.window.onDidChangeActiveTextEditor(handleEditorChange);

    setInterval(handleRefreshTracesInTextEditorRequests, 500);

    context.subscriptions.push({
        dispose: () => {
            console.log('Disposing...');
            stopVaultKeyMonitoring();
            wsConnection?.close();
        }
    });
}

export function deactivate() {
    console.log('Deactivating Ariana extension...');
    // DropdownWebview.hide();
    if (vscode.window.activeTextEditor) {
        clearDecorations(vscode.window.activeTextEditor, new Map());
        if (tracesHoverDisposable) {
            tracesHoverDisposable.dispose();
            tracesHoverDisposable = undefined;
        }
    }
}

async function handleEditorChange(editor: vscode.TextEditor | undefined) {
    console.log('Editor changed...');
    if (editor) {
        unhighlightTraces(editor);
        clearHoverTraces(editor);
        if (showTraces) {
            requestRefreshTracesInTextEditor(editor);
        }
    }
}

function requestRefreshTracesInTextEditor(editor: vscode.TextEditor) {
    refreshTracesInTextEditorRequests.push(editor);
}

function handleRefreshTracesInTextEditorRequests() {
    let requests = refreshTracesInTextEditorRequests;
    const currentEditor = vscode.window.activeTextEditor;
    if (requests.length > 0) {
        while (requests.length > 0 && requests[requests.length - 1] !== currentEditor) {
            requests.pop();
        }
        if (requests.length > 0 && requests[requests.length - 1] === currentEditor) {
            if (showTraces) {
                highlightTraces(currentEditor);
            }
            requests.pop();
        }
    }
}

async function highlightTraces(editor: vscode.TextEditor | undefined = undefined) {
    console.log('Highlighting traces...');
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
    
    // Send traces to sidebar if it exists
    if (sidebarProvider) {
        sidebarProvider.sendDataToWebView(tracesData);
    }
}

function unhighlightTraces(editor: vscode.TextEditor | undefined = undefined) {
    console.log('Unhighlighting traces...');
    editor = editor ?? vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }
    console.log("unhighlighting traces now");
    clearDecorations(editor, decoratedRanges);
}

function clearHoverTraces(editor: vscode.TextEditor | undefined = undefined) {
    console.log('Clearing hover traces...');
    editor = editor ?? vscode.window.activeTextEditor;
    if (!editor) {
        return;
    }
    if (tracesHoverDisposable) {
        console.log("clearing hovers");
        tracesHoverDisposable.dispose();
        tracesHoverDisposable = undefined;
    }
}

function tracesToRegions(tracesData: Trace[]): Array<HighlightedRegion> {
    console.log('Converting traces to regions...');
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

async function connectToTraceWebSocket(vaultSecretKey: string) {
    console.log('Connecting to WebSocket...');
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
        console.log('Received WebSocket message...');
        try {
            const parsedData = JSON.parse(data.toString());
            if (Array.isArray(parsedData)) {
                // Initial batch of traces
                if (isFirst) {
                    console.log(`Received ${parsedData.length} initial traces from WebSocket`);
                    tracesData = parsedData;
                } else {
                    console.log(`Received ${parsedData.length} new traces from WebSocket`);
                    parsedData.forEach(pd => tracesData.push(pd));
                }
                if (showTraces && vscode.window.activeTextEditor) {
                    requestRefreshTracesInTextEditor(vscode.window.activeTextEditor);
                }
                // Send traces to sidebar if it exists
                if (sidebarProvider) {
                    sidebarProvider.sendDataToWebView(tracesData);
                }
            } else {
                // Single new trace
                console.log('Received exactly one new trace from WebSocket');
                tracesData.push(parsedData);
                
                // If the file this trace belongs to is currently focused, update highlights
                if (showTraces && vscode.window.activeTextEditor) {
                    const filepath = formatUriForDB(vscode.window.activeTextEditor.document.uri);
                    if (parsedData.start_pos.filepath === filepath) {
                        requestRefreshTracesInTextEditor(vscode.window.activeTextEditor);
                    }
                }
                // Send updated traces to sidebar if it exists
                if (sidebarProvider) {
                    sidebarProvider.sendDataToWebView(tracesData);
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

function startVaultKeyMonitoring() {
    console.log('Starting vault key monitoring...');
    // Stop existing monitoring if any
    stopVaultKeyMonitoring();

    // Check immediately and then at regular intervals
    checkVaultKeyAndUpdateConnection();
    
    vaultKeyPollingInterval = setInterval(checkVaultKeyAndUpdateConnection, 5000); // Check every 5 seconds
}

function stopVaultKeyMonitoring() {
    console.log('Stopping vault key monitoring...');
    if (vaultKeyPollingInterval) {
        clearInterval(vaultKeyPollingInterval);
        vaultKeyPollingInterval = null;
    }
}

async function checkVaultKeyAndUpdateConnection() {
    console.log('Checking vault key...');
    if (!vscode.window.activeTextEditor) {
        return;
    }

    try {
        const vaultManager = VaultsManager.getInstance();
        const vault = await vaultManager.getCurrentLocalVaultKey(vscode.window.activeTextEditor.document.uri.fsPath);

        if (!vault) {
            return;
        }

        // If vault key changed or we need to connect and don't have a connection
        if (currentVaultSecretKey !== vault.key || (showTraces && !wsConnection)) {
            currentVaultSecretKey = vault.key;
            
            if (showTraces) {
                connectToTraceWebSocket(vault.key);
            }
        }
    } catch (error) {
        console.error('Error checking vault key:', error);
    }
}
