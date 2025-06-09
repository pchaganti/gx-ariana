import * as vscode from 'vscode';
import { WebviewService } from '../services/WebviewService';
import { HotReloadService } from '../services/HotReloadService';
import { BottomPanelController } from './ArianaPanel'; // Import the interface

export class VaultDetailPanelProvider implements vscode.WebviewViewProvider, BottomPanelController {
  public static readonly viewType = 'ariana.vaultDetailView';
  private _view?: vscode.WebviewView;
  private _webviewService: WebviewService;
  private _hotReloadService: HotReloadService;
  private _extensionUri: vscode.Uri;
  private _pendingVaultId?: string; 

  // Helper to centralize message posting
  private sendMessageToWebview(type: string, payload: any) {
    if (this._view) { 
        console.log(`VaultDetailPanelProvider: Posting message to webview: type=${type}, payload=`, payload);
        this._view.webview.postMessage({ type, ...payload });
    } else {
        console.warn(`VaultDetailPanelProvider: sendMessageToWebview called but view is not available. Type: ${type}`);
    }
  }

  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
    this._webviewService = new WebviewService(extensionUri);
    this._hotReloadService = new HotReloadService(extensionUri, this._webviewService);
    console.log('VaultDetailPanelProvider constructor called');
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    console.log('VaultDetailPanelProvider: resolveWebviewView called');
    this._view = webviewView;
    this._hotReloadService.setWebviewPanel(webviewView); // Enable hot reload

    // Correctly set webview options (as seen in ArianaPanel.ts)
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    // Correctly set HTML content (as seen in ArianaPanel.ts)
    webviewView.webview.html = this._webviewService.getWebviewContent(webviewView.webview);

    // Handle messages from this webview
    webviewView.webview.onDidReceiveMessage(async (message) => {
      console.log('VaultDetailPanelProvider: Received message from detail webview:', message);
      switch (message.command) {
        case 'getTheme':
          // Correctly send theme info (as seen in ArianaPanel.ts)
          if (this._view) { // Ensure view is available
            this._webviewService.sendThemeInfo(this._view.webview);
          }
          break;
        // Add other cases as needed
      }
    });

    // Send initial theme information (as seen in ArianaPanel.ts)
    this._webviewService.sendThemeInfo(webviewView.webview);
    
    // Send initial render nonce for timer management (as seen in ArianaPanel.ts)
    this._webviewService.sendRenderNonce(webviewView.webview);

    // Register theme change listener (as seen in ArianaPanel.ts)
    this._webviewService.registerThemeChangeListener(webviewView.webview);

    // When the view becomes visible, notify the webview (as seen in ArianaPanel.ts)
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible && this._view) { // Ensure view is available
        this._webviewService.sendRenderNonce(this._view.webview);
      }
    });
    
    // If updateVault was called before this view was resolved, process the pending vaultId now.
    if (this._pendingVaultId) {
      console.log(`VaultDetailPanelProvider: Processing pending vault ID ${this._pendingVaultId} in resolveWebviewView`);
      this.sendMessageToWebview('navigateToPage', { route: `/vault-details/${this._pendingVaultId}` });
      this._pendingVaultId = undefined; 
    }
  }

  // Implementation of BottomPanelController methods
  public async updateVault(vaultId: string): Promise<void> {
    console.log(`VaultDetailPanelProvider: updateVault called for vaultId: ${vaultId}`);
    if (this._view) {
      this._view.show(true); 
      this.sendMessageToWebview('navigateToPage', { route: `/vault-details/${vaultId}` });
    } else {
      console.warn(`VaultDetailPanelProvider: View not available when updateVault called. Storing ${vaultId} as pending.`);
      this._pendingVaultId = vaultId;
    }
  }

  public async focus(): Promise<void> {
    const viewFocusCommand = `${VaultDetailPanelProvider.viewType}.focus`;
    console.log(`VaultDetailPanelProvider: Attempting to focus view using command '${viewFocusCommand}'`);
    try {
      await vscode.commands.executeCommand(viewFocusCommand);
      // If this command succeeds, VS Code should handle bringing the panel and view 
      // into focus, which should then trigger resolveWebviewView.
    } catch (err) {
      console.error(`VaultDetailPanelProvider: Failed to focus view using command '${viewFocusCommand}'. Error: ${err}`);
      // Fallback: try to focus the general panel area.
      console.log("VaultDetailPanelProvider: Falling back to focus 'workbench.action.focusPanel'");
      try {
        await vscode.commands.executeCommand('workbench.action.focusPanel');
        // After focusing the panel, the user might still need to click the "Ariana" tab.
        vscode.window.showInformationMessage('Ariana bottom panel activated. Please select the "Ariana" tab if it is not already visible.');
      } catch (panelErr) {
        console.error(`VaultDetailPanelProvider: Failed to focus panel using 'workbench.action.focusPanel'. Error: ${panelErr}`);
        vscode.window.showErrorMessage('Could not automatically show the Ariana detail panel. Please try opening it manually from the bottom panel view.');
      }
    }
  }
}
