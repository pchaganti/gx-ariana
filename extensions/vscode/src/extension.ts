import * as vscode from 'vscode';
import { formatUriForDB } from './urilHelpers';
import { VaultsManager } from './vaults/VaultsManager';
import { highlightRegions, lightTracesToRegions } from './highlighting/regions';
import { clearDecorations } from './highlighting/decorations';
import { ArianaPanel } from './panels/ArianaPanel';
import { TimelinePanel } from './panels/TimelinePanel';
import { HighlightingToggle } from './highlighting/HighlightingToggle';
import { FocusedVaultManager } from './vaults/FocusedVaultManager';

class Extension {
    private context: vscode.ExtensionContext;
    private arianaPanel: ArianaPanel;
    private timelinePanel: TimelinePanel;
    private refreshTracesInTextEditorRequests: vscode.TextEditor[] = [];
    private highlightingToggle: HighlightingToggle;
    private tracesHoverDisposable: vscode.Disposable | undefined;
    private vaultsManager: VaultsManager;
    private focusVaultManager: FocusedVaultManager;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;

        this.vaultsManager = new VaultsManager(context.globalState);
        this.focusVaultManager = new FocusedVaultManager(this.vaultsManager);
        
        this.highlightingToggle = new HighlightingToggle();
        this.registerCommand('highlightTraces', this.highlightingToggle.toggleUntoggle);
        this.highlightingToggle.subscribe((toggled) => this.onHighlightingToggle(toggled));

        this.arianaPanel = new ArianaPanel(
            context.extensionUri, 
            context, 
            this.focusVaultManager, 
            this.vaultsManager,
            this.highlightingToggle
        );
        this.registerWebviewViewProvider(ArianaPanel.viewType, this.arianaPanel);

        this.timelinePanel = new TimelinePanel(
            context.extensionUri, 
            context, 
            this.focusVaultManager, 
            this.vaultsManager,
            this.highlightingToggle
        );
        this.registerWebviewViewProvider(TimelinePanel.viewType, this.timelinePanel);

        this.arianaPanel.setTimelinePanel(this.timelinePanel);
        
        this.registerCommand('openSidebar', () => {
            this.arianaPanel.focus();
        });

        // Logic to open panel on first-ever install, then respect user setting for subsequent launches.
        const hasBeenLaunchedBeforeKey = 'ariana.hasBeenLaunchedBefore';
        const openPanelUserPreferenceKey = 'ariana.openPanelAtLaunch';

        const hasBeenLaunchedBefore = this.context.globalState.get<boolean>(hasBeenLaunchedBeforeKey);

        if (!hasBeenLaunchedBefore) {
            // This is the very first launch (fresh install).
            vscode.commands.executeCommand('workbench.view.extension.ariana-sidebar').then(() => {
                console.log('Ariana panel opened on first-ever launch.');
            }, (err: any) => {
                console.error('Failed to open Ariana panel on first-ever launch:', err);
            });
            // Mark that the extension has been launched at least once.
            this.context.globalState.update(hasBeenLaunchedBeforeKey, true);
            // Default the user preference to open on launch to true.
            // The user can change this later via the extension settings.
            this.context.globalState.update(openPanelUserPreferenceKey, true);
        } else {
            // This is a subsequent launch (not the first-ever install).
            // Respect the user's preference for opening the panel on launch.
            const openPanelUserPreference = this.context.globalState.get<boolean>(openPanelUserPreferenceKey);
            // Default to true if the preference is somehow not set (should have been set on first launch).
            const shouldOpen = openPanelUserPreference === undefined ? true : openPanelUserPreference;
            if (shouldOpen) {
                vscode.commands.executeCommand('workbench.view.extension.ariana-sidebar').then(() => {
                    console.log('Ariana panel opened based on user preference.');
                }, (err: any) => {
                    console.error('Failed to open Ariana panel based on user preference:', err);
                });
            }
        }

        this.registerCommand('updateCLI', () => this.arianaPanel.updateArianaCli());

        vscode.window.onDidChangeActiveTextEditor(() => this.handleEditorChange());
        vscode.window.onDidChangeTextEditorSelection(() => this.handleEditorStateChange());
        vscode.window.onDidChangeTextEditorVisibleRanges(() => this.handleEditorStateChange());

        if (vscode.window.activeTextEditor) {
            this.requestRefreshTracesInTextEditor(vscode.window.activeTextEditor);
        }
        setInterval(() => this.handleRefreshTracesInTextEditorRequests(), 500);

        this.focusVaultManager.subscribeToFocusedVaultChange((vault) => {
            this.handleEditorChange();
        });
        this.focusVaultManager.subscribeToLightTracesBatch(() => this.handleReceivedTraces());

        context.subscriptions.push({
            dispose: () => {
                console.log('Disposing extension...');
                this.focusVaultManager.dispose();
                this.tracesHoverDisposable?.dispose();
                this.unhighlightTraces();
                this.clearHoverTraces();
            }
        });
    }

    private registerCommand(name: string, callback: (...args: any[]) => any) {
        this.context.subscriptions.push(
            vscode.commands.registerCommand(`ariana.${name}`, callback)
        );
    }

    private registerWebviewViewProvider(viewType: string, provider: vscode.WebviewViewProvider) {
        this.context.subscriptions.push(
            vscode.window.registerWebviewViewProvider(viewType, provider)
        );
    }

    private executeCommand(name: string) {
        vscode.commands.executeCommand(`ariana.${name}`);
    }

    private onHighlightingToggle(toggled: boolean) {
        if (toggled) {
            this.highlightTraces();
        }
        if (!toggled) {
            console.log('Unhighlighting traces');
            this.unhighlightTraces();
            this.clearHoverTraces();
        }
    }

    private handleEditorChange() {
        console.log('Editor changed');
        this.unhighlightTraces();
        this.clearHoverTraces();
        if (this.highlightingToggle.isToggled() && vscode.window.activeTextEditor) {
            this.requestRefreshTracesInTextEditor(vscode.window.activeTextEditor);
        }
        this.handleEditorStateChange();
    }

    private handleEditorStateChange() {
        this.arianaPanel.sendEditorState();
    }

    private requestRefreshTracesInTextEditor(editor: vscode.TextEditor) {
        this.refreshTracesInTextEditorRequests.push(editor);
    }

    private handleRefreshTracesInTextEditorRequests() {
        let requests = this.refreshTracesInTextEditorRequests ?? [];
        const currentEditor = vscode.window.activeTextEditor;
        if (requests.length > 0) {
            while (requests.length > 0 && requests[requests.length - 1] !== currentEditor) {
                requests.pop();
            }
            if (requests.length > 0 && requests[requests.length - 1] === currentEditor) {
                if (this.highlightingToggle.isToggled()) {
                    this.highlightTraces();
                }
                requests.pop();
            }
        }
    }

    private async highlightTraces() {
        if (!vscode.window.activeTextEditor) {
            return;
        }
        let editor = vscode.window.activeTextEditor;
        const fileTraces = this.focusVaultManager.getFocusedVaultLightTraces().filter(trace =>
            formatUriForDB(editor.document.uri) === trace.start_pos.filepath
        );
        const regions = lightTracesToRegions(fileTraces, (traceIds) => {
            return this.focusVaultManager.getFocusedVaultFullTraces(traceIds);
        });
        this.clearHoverTraces(editor);
        this.tracesHoverDisposable = highlightRegions(editor, regions);
    }

    private unhighlightTraces() {
        if (!vscode.window.activeTextEditor) {
            return;
        }
        clearDecorations(vscode.window.activeTextEditor);
    }

    private clearHoverTraces(editor: vscode.TextEditor | undefined = undefined) {
        editor = editor ?? vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        if (this.tracesHoverDisposable) {
            this.tracesHoverDisposable.dispose();
            this.tracesHoverDisposable = undefined;
        }
    }

    private handleReceivedTraces() {
        if (this.highlightingToggle.isToggled() && vscode.window.activeTextEditor) {
            this.requestRefreshTracesInTextEditor(vscode.window.activeTextEditor);
        }
    }
}

export async function activate(context: vscode.ExtensionContext) {
    new Extension(context);
}

export function deactivate() { }