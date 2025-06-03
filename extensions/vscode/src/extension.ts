import * as vscode from 'vscode';
import { formatUriForDB } from './urilHelpers';
import { VaultsManager } from './vaults/VaultsManager';
import { highlightRegions, tracesToRegions } from './highlighting/regions';
import { clearDecorations } from './highlighting/decorations';
import { ArianaPanel } from './panels/ArianaPanel';
import { HighlightingToggle } from './highlighting/HighlightingToggle';
import { FocusedVaultManager } from './vaults/FocusedVaultManager';

class Extension {
    private context: vscode.ExtensionContext;
    private arianaPanel: ArianaPanel;
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

        const openPanelAtLaunch = this.context.globalState.get<boolean>('ariana.openPanelAtLaunch', true);

        this.registerCommand('openSidebar', () => {
            vscode.commands.executeCommand('workbench.view.extension.ariana-sidebar');
        });
        if (openPanelAtLaunch) {
            this.executeCommand('openSidebar');
        }

        this.registerCommand('updateCLI', () => this.arianaPanel.updateArianaCli());

        vscode.window.onDidChangeActiveTextEditor(() => this.handleEditorChange());

        if (vscode.window.activeTextEditor) {
            this.requestRefreshTracesInTextEditor(vscode.window.activeTextEditor);
        }
        setInterval(() => this.handleRefreshTracesInTextEditorRequests(), 500);

        this.focusVaultManager.subscribeToFocusedVaultChange((vault) => {
            this.handleEditorChange();
        });
        this.focusVaultManager.subscribeToBatchTrace(() => this.handleReceivedTraces());

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
        const regions = tracesToRegions(this.focusVaultManager.getFocusedVaultTraces().filter(trace =>
            formatUriForDB(editor.document.uri) === trace.start_pos.filepath
        ));
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