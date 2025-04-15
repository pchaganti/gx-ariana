import * as vscode from 'vscode';
import { Trace } from '../bindings/Trace';
import { ArianaCliStatus, ArianaInstallMethod, getArianaCliStatus, installArianaCli, updateArianaCli } from '../installation/cliManager';
import { WebviewService } from '../services/WebviewService';
import { HotReloadService } from '../services/HotReloadService';
import { FocusedVaultManager } from '../vaults/FocusedVaultManager';
import { VaultHistoryEntry, VaultsManager } from '../vaults/VaultsManager';
import { HighlightingToggle } from '../highlighting/HighlightingToggle';

export class ArianaPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = "ariana.sidebarView";
  private _view?: vscode.WebviewView;
  private _context: vscode.ExtensionContext;
  private _webviewService: WebviewService;
  private _hotReloadService: HotReloadService;
  private _focusedVaultManager: FocusedVaultManager;
  private _vaultsManager: VaultsManager;
  private _highlightToggle: HighlightingToggle;

  constructor(
    private readonly _extensionUri: vscode.Uri, 
    context: vscode.ExtensionContext, 
    focusedVaultManager: FocusedVaultManager, 
    vaultsManager: VaultsManager,
    highlightToggle: HighlightingToggle
  ) {
    this._context = context;
    this._webviewService = new WebviewService(_extensionUri);
    this._hotReloadService = new HotReloadService(_extensionUri, this._webviewService);
    this._focusedVaultManager = focusedVaultManager;
    this._vaultsManager = vaultsManager;
    this._highlightToggle = highlightToggle;

    this._focusedVaultManager.subscribeToFocusedVaultChange((vault) => {
      this.sendTracesToWebview(this._focusedVaultManager.getFocusedVaultTraces());
      this.sendFocusedVault(vault?.key ?? null);
    });
    this._focusedVaultManager.subscribeToBatchTrace((_) => {
      this.sendTracesToWebview(this._focusedVaultManager.getFocusedVaultTraces());
    });
    this._highlightToggle.subscribe(() => this.sendHighlightingToggleState());

    this._vaultsManager.onDidAddVault((_) => {
      console.log('Vault added');
      const entries = this._vaultsManager.getVaultHistory();
      this.sendFocusableVaults(entries);
    });

    console.log('ArianaPanel constructor called with extension URI:', _extensionUri.toString());
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    console.log('resolveWebviewView called');
    this._view = webviewView;

    // Set up hot reload service with current webview
    this._hotReloadService.setWebviewPanel(webviewView);

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._webviewService.getWebviewContent(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async message => {
      console.log('Received message from webview:', message);
      this.handleMessageFromWebview(message);
    });

    // Send initial theme information
    this._webviewService.sendThemeInfo(webviewView.webview);
    
    // Send initial render nonce for timer management
    this._webviewService.sendRenderNonce(webviewView.webview);

    // Register theme change listener
    this._webviewService.registerThemeChangeListener(webviewView.webview);

    // When the view becomes visible, notify the webview
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        this._view?.webview.postMessage({ type: 'viewVisible' });
        // Send a fresh render nonce when view becomes visible again
        this._webviewService.sendRenderNonce(webviewView.webview);
      }
    });

    setTimeout(() => {
      this.checkAndSendArianaCliStatus();

      this.sendFocusableVaults(this._vaultsManager.getVaultHistory());
      console.log('Sending focusable vaults: ', this._vaultsManager.getVaultHistory());
      
      const focusedVault = this._focusedVaultManager.getFocusedVault()?.key ?? null;
      this.sendFocusedVault(focusedVault);
      console.log('Sending focused vault: ', focusedVault);
      
      if (focusedVault) {
        console.log('Sending traces for focused vault: ', focusedVault);
        this.sendTracesToWebview(this._focusedVaultManager.getFocusedVaultTraces());
      }

      this.sendHighlightingToggleState();
    }, 500);
  }

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

  /**
   * Handle messages from the webview
   */
  private async handleMessageFromWebview(message: any) {
    switch (message.command) {
      case 'getTheme':
        // Send the current theme to the webview
        if (this._view) {
          this._webviewService.sendThemeInfo(this._view.webview);
        }
        break;
      case 'focusVault':
        console.log('Asking to focus vault: ' + message.vaultSecretKey);
        this._focusedVaultManager.switchFocusedVault(message.vaultSecretKey);
        break;
      case 'getArianaCliStatus':
        await this.checkAndSendArianaCliStatus();
        break;
      case 'toggleHighlighting':
        this._highlightToggle.toggleUntoggle();
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
      default:
        console.log(`Unknown command: ${message.command}`);
    }
  }

  private sendFocusableVaults(focusableVaults: VaultHistoryEntry[]) {
    if (this._view) {
      try {
        this._view.webview.postMessage({ type: 'focusableVaults', value: focusableVaults });
      } catch (error) {
        console.error('Error sending focusable vaults to webview:', error);
      }
    }
  }

  private sendFocusedVault(vaultSecretKey: string | null) {
    if (this._view) {
      try {
        this._view.webview.postMessage({ type: 'focusedVault', value: vaultSecretKey });
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

  private sendTracesToWebview(traces: Trace[]): void {
    try {
      this._view?.webview.postMessage({ type: 'traces', value: traces });
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
}
