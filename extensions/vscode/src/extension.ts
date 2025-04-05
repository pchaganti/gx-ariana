import * as vscode from 'vscode';
import { formatUriForDB } from './urilHelpers';
import type { Trace } from './bindings/Trace';
import { VaultManager } from './vaults/manager';
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

export async function activate(context: vscode.ExtensionContext) {
    console.log('Extension is now active');
    const { apiUrl } = getConfig();

    console.log('Initializing VaultManager...');
    VaultManager.initialize(context);
    console.log('VaultManager initialized successfully');

    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return;
    }
    
    let showTraces = false;

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
                const { apiUrl } = getConfig();
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

    console.log('Defining function to manage WebSocket connection...');
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
                        declareTracesUpdate(vscode.window.activeTextEditor);
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
                            declareTracesUpdate(vscode.window.activeTextEditor);
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

    console.log('Defining function to start monitoring vault key changes...');
    function startVaultKeyMonitoring() {
        console.log('Starting vault key monitoring...');
        // Stop existing monitoring if any
        stopVaultKeyMonitoring();

        // Check immediately and then at regular intervals
        checkVaultKeyAndUpdateConnection();
        
        vaultKeyPollingInterval = setInterval(checkVaultKeyAndUpdateConnection, 5000); // Check every 5 seconds
    }

    console.log('Defining function to stop monitoring vault key changes...');
    function stopVaultKeyMonitoring() {
        console.log('Stopping vault key monitoring...');
        if (vaultKeyPollingInterval) {
            clearInterval(vaultKeyPollingInterval);
            vaultKeyPollingInterval = null;
        }
    }

    console.log('Defining function to check vault key and update connection if necessary...');
    async function checkVaultKeyAndUpdateConnection() {
        console.log('Checking vault key...');
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

    console.log('Defining function to fetch traces for an editor (fallback to REST if WebSocket fails)...');
    async function fetchTracesForEditor(editor: vscode.TextEditor) {
        console.log('Fetching traces for editor...');
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
                // Send traces to sidebar if it exists
                if (sidebarProvider) {
                    sidebarProvider.sendDataToWebView(tracesData);
                }
            }
        } catch (error) {
            console.error('Error fetching traces:', error);
        }
    }

    let disposable = vscode.commands.registerCommand('ariana.highlightTraces', () => {
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
    });

    console.log('Fetching traces for initial active editor...');
    if (vscode.window.activeTextEditor) {
        if (showTraces) {
            startVaultKeyMonitoring();
            declareTracesUpdate(vscode.window.activeTextEditor);
        }
    }

    console.log('Listening for editor changes...');
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        console.log('Editor changed...');
        if (editor) {
            unhighlightTraces(editor);
            clearHoverTraces(editor);
            if (showTraces) {
                declareTracesUpdate(editor);
            }
        }
    });

    let tracesUpdates: vscode.TextEditor[] = [];

    console.log('Defining function to declare traces update...');
    function declareTracesUpdate(editor: vscode.TextEditor) {
        console.log('Declaring traces update...');
        tracesUpdates.push(editor);
    }

    console.log('Defining function to highlight traces...');
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

    console.log('Setting interval to check for traces updates...');
    setInterval(() => {
        console.log('Checking for traces updates...');
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

    console.log('Defining function to unhighlight traces...');
    function unhighlightTraces(editor: vscode.TextEditor | undefined = undefined) {
        console.log('Unhighlighting traces...');
        editor = editor ?? vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        console.log("unhighlighting traces now");
        clearDecorations(editor, decoratedRanges);
    }

    console.log('Defining function to clear hover traces...');
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

    console.log('Defining function to convert traces to regions...');
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

    console.log('Adding disposable to context subscriptions...');
    context.subscriptions.push(disposable);

    console.log('Adding dispose function to context subscriptions...');
    context.subscriptions.push({
        dispose: () => {
            console.log('Disposing...');
            stopVaultKeyMonitoring();
            wsConnection?.close();
        }
    });
}

console.log('Defining deactivate function...');
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