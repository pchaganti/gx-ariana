import * as vscode from 'vscode';
import { ArianaCliStatus, ArianaInstallMethod, getArianaCliStatus, installArianaCli, updateArianaCli } from '../installation/cliManager';
import { FocusedVaultManager } from '../vaults/FocusedVaultManager';
import { StoredVaultData, VaultsManager } from '../vaults/VaultsManager';
import { HighlightingToggle } from '../highlighting/HighlightingToggle';
import { LightTrace } from '../bindings/LightTrace';
import path = require('path');

export abstract class Panel implements vscode.WebviewViewProvider {
    protected _view?: vscode.WebviewView;
    protected _context: vscode.ExtensionContext;
    protected _focusedVaultManager: FocusedVaultManager;
    protected _vaultsManager: VaultsManager;
    protected _highlightToggle: HighlightingToggle;
    protected _currentNonce: string;
    protected _webviewPanel?: vscode.WebviewView;
    protected _isWatching: boolean;
    protected _disposables: vscode.Disposable[];

    constructor(
        protected readonly _extensionUri: vscode.Uri,
        context: vscode.ExtensionContext,
        focusedVaultManager: FocusedVaultManager,
        vaultsManager: VaultsManager,
        highlightToggle: HighlightingToggle
    ) {
        this._context = context;
        this._currentNonce = this._generateUniqueNonce();
        this._focusedVaultManager = focusedVaultManager;
        this._vaultsManager = vaultsManager;
        this._highlightToggle = highlightToggle;
        this._isWatching = false;
        this._disposables = [];

        this._focusedVaultManager.subscribeToFocusedVaultChange((focusedVaultInstance) => {
            const currentVaultData = focusedVaultInstance?.vaultData ?? null;
            console.log('Focused vault changed to: ' + currentVaultData?.secret_key);
            this.sendLightTracesToWebview(this._focusedVaultManager.getFocusedVaultLightTraces());
            this.sendFocusedVault(currentVaultData);
        });
        this._focusedVaultManager.subscribeToLightTracesBatch((_) => {
            this.sendLightTracesToWebview(this._focusedVaultManager.getFocusedVaultLightTraces());
        });
        this._highlightToggle.subscribe(() => this.sendHighlightingToggleState());

        this._vaultsManager.onDidUpdateVaultData(() => {
            const entries = this._vaultsManager.getVaultHistory();
            console.log('Vault history updated:', entries);
            this.sendFocusableVaults(entries);
        });

        console.log('Panel constructor called with extension URI:', _extensionUri.toString());
    }

    abstract viewId(): string;

    abstract onAfterResolveWebviewView(webviewView: vscode.WebviewView): void;

    focus() {
        if (this._view) {
            this._view.show();
        }
    }

    resolveWebviewView(webviewView: vscode.WebviewView, context: vscode.WebviewViewResolveContext, token: vscode.CancellationToken): Thenable<void> | void {
        console.log('resolveWebviewView called for view: ' + this.viewId());
        this._view = webviewView;

        // Set up hot reload service with current webview
        this.setWebviewPanel(webviewView);

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this.getWebviewContent(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(async message => {
            console.log('Received message from webview (' + this.viewId() + '):', message);
            this.handleMessageFromWebview(message);
        });

        // Send initial theme information
        this.sendThemeInfo(webviewView.webview);

        // Register theme change listener
        this.registerThemeChangeListener(webviewView.webview);

        // When the view becomes visible, notify the webview
        webviewView.onDidChangeVisibility(() => {
            console.log('View ' + this.viewId() + ' visibility changed:', webviewView.visible);
            if (webviewView.visible) {
                console.log('View ' + this.viewId() + ' became visible');
                // Webview will request viewId and nonce if needed
                this.onBecameVisible();
            } else {
                console.log('View ' + this.viewId() + ' became invisible');
            }
        });

        // Initial data send is now mostly driven by webview requests or other events
        setTimeout(() => {
            this.checkAndSendArianaCliStatus();
            this.sendFocusableVaults(this._vaultsManager.getVaultHistory());
            console.log('Sending focusable vaults (StoredVaultData[]): ', this._vaultsManager.getVaultHistory());

            const focusedVaultInstance = this._focusedVaultManager.getFocusedVault();
            const initialFocusedVaultData = focusedVaultInstance?.vaultData ?? null;

            if (initialFocusedVaultData) {
                console.log('Sending traces for focused vault: ', initialFocusedVaultData.secret_key);
                this.sendLightTracesToWebview(this._focusedVaultManager.getFocusedVaultLightTraces());
            }
            this.sendHighlightingToggleState();
        }, 500); // This timeout might still be useful for initial data that isn't viewId/nonce dependent

        this.onAfterResolveWebviewView(webviewView);
    }

    abstract onMessageFromWebview(message: any): void;

    abstract onBecameVisible(): void;

    /**
     * Check and send Ariana CLI status to the webview
     */
    private async checkAndSendArianaCliStatus() {
        try {
            const status = await getArianaCliStatus();
            this.sendArianaCliStatus(status);
        } catch (error) {
            console.error('Error checking Ariana CLI status:', error);
        }
    }

    /**
     * Send Ariana CLI status to the webview
     */
    private sendArianaCliStatus(status: ArianaCliStatus) {
        if (this._view) {
            try {
                this._view.webview.postMessage({ type: 'arianaCliStatus', value: status });
            } catch (error) {
                console.error('Error sending Ariana CLI status to webview:', error);
            }
        }
    }

    private sendViewId(webview: vscode.Webview) {
        try {
            webview.postMessage({ type: 'viewId', value: this.viewId() });
        } catch (error) {
            console.error('Error sending view ID to webview:', error);
        }
    }

    /**
     * Handle messages from the webview
     */
    private async handleMessageFromWebview(message: any) {
        this.onMessageFromWebview(message); // Call the abstract handler for view-specific messages

        switch (message.command) {
            case 'getViewId':
                if (this._view) {
                    console.log('Received getViewId from webview (' + this.viewId() + '), sending viewId and nonce.');
                    this.sendViewId(this._view.webview);
                    this.sendRenderNonce(this._view.webview); // Send nonce along with viewId
                }
                break;
            case 'getTheme':
                // Send the current theme to the webview
                if (this._view) {
                    this.sendThemeInfo(this._view.webview);
                }
                break;
            case 'focusVault':
                // Expecting message.vaultData to be StoredVaultData from the webview
                console.log('Asking to focus vault: ' + message.vaultData?.secret_key);
                this._focusedVaultManager.switchFocusedVault(message.vaultData as StoredVaultData | null);
                break;
            case 'getArianaCliStatus':
                await this.checkAndSendArianaCliStatus();
                break;
            case 'getLightTraces':
                {
                    const traces = this._focusedVaultManager.getFocusedVaultLightTraces();
                    this.sendLightTracesToWebview(traces);
                }
                break;
            case 'getFocusedVault':
                {
                    const focusedVaultInstance = this._focusedVaultManager.getFocusedVault();
                    const currentFocusedVaultData = focusedVaultInstance?.vaultData ?? null;
                    this.sendFocusedVault(currentFocusedVaultData);
                    // console.log('ArianaPanel: Responded to getFocusedVault request with vault: ', currentFocusedVaultData?.secret_key);
                }
                break;
            case 'refreshFocusableVaults':
                console.log('Refreshing focusable vaults');
                this.sendFocusableVaults(this._vaultsManager.getVaultHistory());
                break;
            case 'setOpenPanelAtLaunch':
                if (typeof message.value === 'boolean') {
                    this._context.globalState.update('ariana.openPanelAtLaunch', message.value);
                    vscode.window.setStatusBarMessage(`Ariana panel will ${message.value ? 'open' : 'not open'} at launch.`, 3000);
                } else {
                    console.warn('Invalid value received for setOpenPanelAtLaunch:', message.value);
                }
                break;
            case 'setHighlightingToggle':
                if (typeof message.value === 'boolean') {
                    this._highlightToggle.setState(message.value);
                } else {
                    console.warn('Invalid value received for setHighlightingToggle:', message.value);
                }
                break;
            case 'installArianaCli':
                await this.installArianaCli(message.method);
                break;
            case 'updateArianaCli':
                await this.updateArianaCli();
                break;
            case 'highlightCode':
                await this.highlightCode(
                    message.file,
                    message.startLine,
                    message.startCol,
                    message.endLine,
                    message.endCol
                );
                break;
            case 'openExternal':
                if (message.url) {
                    vscode.env.openExternal(vscode.Uri.parse(message.url));
                }
                break;
        }
    }

    private sendFocusableVaults(focusableVaults: StoredVaultData[]) {
        if (this._view) {
            try {
                this._view.webview.postMessage({ type: 'focusableVaults', value: focusableVaults });
            } catch (error) {
                console.error('Error sending focusable vaults to webview:', error);
            }
        }
    }

    private sendFocusedVault(vaultData: StoredVaultData | null) {
        if (this._view) {
            try {
                this._view.webview.postMessage({ type: 'focusedVault', value: vaultData });
            } catch (error) {
                console.error('Error sending focused vault to webview:', error);
            }
        }
    }

    private sendHighlightingToggleState() {
        if (this._view) {
            try {
                this._view.webview.postMessage({ type: 'setHighlightingToggle', value: this._highlightToggle.isToggled() });
            } catch (error) {
                console.error('Error sending highlighting toggle state to webview:', error);
            }
        }
    }


    /**
     * Install Ariana CLI
     */
    private async installArianaCli(method: ArianaInstallMethod) {
        try {
            // Show progress notification
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Installing Ariana CLI...',
                cancellable: false
            }, async () => {
                await installArianaCli(method, this._context);
            });

            // Check and send updated status
            await this.checkAndSendArianaCliStatus();

            // Show success message
            vscode.window.showInformationMessage('Ariana CLI installed successfully!');
        } catch (error) {
            console.error('Error installing Ariana CLI:', error);
            vscode.window.showErrorMessage(`Failed to install Ariana CLI: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    public async updateArianaCli(): Promise<void> {
        try {
            // Show progress notification
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'Updating Ariana CLI...',
                cancellable: false
            }, async () => {
                await updateArianaCli(this._context);
            });

            // Check and send updated status
            await this.checkAndSendArianaCliStatus();

            // Show success message
            vscode.window.showInformationMessage('Ariana CLI updated successfully!');
        } catch (error) {
            console.error('Error updating Ariana CLI:', error);
            vscode.window.showErrorMessage(`Failed to update Ariana CLI: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    private sendLightTracesToWebview(traces: LightTrace[]): void {
        try {
            this._view?.webview.postMessage({ type: 'lightTraces', value: traces });
        } catch (error) {
            console.error('Error sending traces to webview:', error);
        }
    }

    public async highlightCode(file: string, startLine: number, startCol: number, endLine: number, endCol: number): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(file);
            const editor = await vscode.window.showTextDocument(document);

            // Convert to zero-based positions
            const startPosition = new vscode.Position(startLine - 1, startCol - 1);
            const endPosition = new vscode.Position(endLine - 1, endCol - 1);
            const range = new vscode.Range(startPosition, endPosition);

            // Highlight the range
            editor.selection = new vscode.Selection(startPosition, endPosition);
            editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
        } catch (error) {
            console.error('Failed to highlight code:', error);
            vscode.window.showErrorMessage(`Failed to highlight code: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Get the HTML content for the webview
     */
    public getWebviewContent(webview: vscode.Webview): string {
        // Generate new render nonce for timer cancellation
        this._currentNonce = this._generateUniqueNonce();

        // Get paths to the webview resources
        const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist', 'assets', 'index.css'));
        const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist', 'index.js'));

        // Get paths to logo resources
        const logoUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'logo.png'));
        const textLogoUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'resources', 'logo_text_highres.png'));

        // Create a nonce for script security
        const nonce = this._getNonce();

        // Generate the HTML content
        const html = `<!DOCTYPE html>
          <html lang="en">
            <head>
              <meta charset="UTF-8" />
              <meta name="viewport" content="width=device-width, initial-scale=1.0" />
              <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https: data:; connect-src ${webview.cspSource} https:; frame-src 'self';">
              <link rel="stylesheet" type="text/css" href="${stylesUri}">
              <title>Ariana</title>
            </head>
            <body>
              <div id="root" data-vscode-context='${JSON.stringify({ webviewType: "sidebar" })}' data-ariana-logo="${logoUri}" data-ariana-text-logo="${textLogoUri}"></div>
              <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
            </body>
          </html>`;
        return html;
    }

    /**
     * Get the current render nonce
     */
    public getCurrentNonce(): string {
        return this._currentNonce;
    }

    /**
     * Send the current render nonce to the webview
     */
    public sendRenderNonce(webview: vscode.Webview): void {
        try {
            setTimeout(() => {
                webview.postMessage({
                    type: 'renderNonce',
                    value: this._currentNonce
                });
            }, 100);
        } catch (error) {
            console.error('Error sending render nonce to webview:', error);
        }
    }

    /**
     * Send theme information to the webview
     */
    public sendThemeInfo(webview: vscode.Webview): void {
        const themeKind = vscode.window.activeColorTheme.kind;
        const isDark = themeKind === vscode.ColorThemeKind.Dark || themeKind === vscode.ColorThemeKind.HighContrast;
        try {
            webview.postMessage({
                type: 'theme',
                value: isDark ? 'dark' : 'light',
                isDark,
                theme: themeKind
            });
        } catch (error) {
            console.error('Error sending theme info to webview:', error);
        }
    }

    /**
     * Register theme change listener
     */
    public registerThemeChangeListener(webview: vscode.Webview): vscode.Disposable {
        // Listen for theme changes
        return vscode.window.onDidChangeActiveColorTheme(() => {
            try {
                webview.postMessage({ type: 'themeChange' });
                this.sendThemeInfo(webview);
            } catch (error) {
                console.error('Error sending theme change to webview:', error);
            }
        });
    }

    /**
     * Generate a nonce string for script security
     */
    private _getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    /**
     * Generate a unique nonce for timer cancellation
     */
    private _generateUniqueNonce(): string {
        return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
    }


    /**
     * Set the webview panel to refresh when changes are detected
     */
    public setWebviewPanel(webviewPanel: vscode.WebviewView): void {
        this._webviewPanel = webviewPanel;
        if (!this._isWatching) {
            this.startWatching();
        }
    }

    /**
     * Start watching for changes in the webview-ui folder
     */
    public startWatching(): void {
        if (this._isWatching) {
            return;
        }

        console.log('Starting hot reload watcher for webview UI');
        this._isWatching = true;

        // Watch the dist directory for changes
        const distPath = path.join(this._extensionUri.fsPath, 'webview-ui', 'dist');
        console.log(`Watching for changes in: ${distPath}`);

        // Create watcher for the dist directory
        const watcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(vscode.Uri.file(distPath), '**/*')
        );

        // When files are created or changed, refresh the webview
        watcher.onDidCreate(this.refreshWebview.bind(this));
        watcher.onDidChange(this.refreshWebview.bind(this));

        // Store disposable for cleanup
        this._disposables.push(watcher);
    }

    /**
     * Refresh the webview when changes are detected
     */
    private refreshWebview(uri: vscode.Uri): void {
        console.log(`File changed: ${uri.fsPath}, refreshing webview...`);

        // Wait a short time to ensure file writes are complete
        setTimeout(() => {
            if (this._webviewPanel && this._webviewPanel.visible) {
                // Refresh the HTML content
                this._webviewPanel.webview.html = this.getWebviewContent(this._webviewPanel.webview);

                // Notify the webview that it was hot-reloaded
                this._webviewPanel.webview.postMessage({ type: 'hotReload' });
                this.sendRenderNonce(this._webviewPanel.webview);
                this.sendViewId(this._webviewPanel.webview);
                this.onBecameVisible();

                console.log('Webview refreshed successfully');
            }
        }, 100);
    }

    /**
     * Dispose of the watchers
     */
    public dispose(): void {
        this._isWatching = false;
        this._disposables.forEach(d => d.dispose());
        this._disposables = [];
    }
}