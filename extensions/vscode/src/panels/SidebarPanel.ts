import * as vscode from 'vscode';
import { Trace } from '../bindings/Trace';
import { ArianaCliStatus, ArianaInstallMethod, getArianaCliStatus, installArianaCli, updateArianaCli } from '../installation/cliManager';

export class SidebarPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = "ariana.sidebarView";
  private _view?: vscode.WebviewView;
  private _lastSentTraces?: Trace[];
  private _context: vscode.ExtensionContext;

  constructor(private readonly _extensionUri: vscode.Uri, context: vscode.ExtensionContext) {
    this._context = context;
    console.log('SidebarPanel constructor called with extension URI:', _extensionUri.toString());
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    console.log('resolveWebviewView called');
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    try {
      console.log('Setting webview HTML');
      webviewView.webview.html = this._getWebviewContent(webviewView.webview);
      console.log('Webview HTML set successfully');
    } catch (error) {
      console.error('Error setting webview HTML:', error);
    }

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async message => {
      console.log('Received message from webview:', message);
      this._handleMessage(message);
    });

    // Send initial theme information
    this._sendThemeInfo(webviewView.webview);

    // Register theme change listener
    this._registerThemeChangeListener(webviewView.webview);

    // If we have traces already, send them to the webview
    if (this._lastSentTraces) {
      this.sendDataToWebView(this._lastSentTraces);
    }

    // When the view becomes visible, notify the webview
    webviewView.onDidChangeVisibility(() => {
      console.log('Webview visibility changed, visible:', webviewView.visible);
      if (webviewView.visible) {
        try {
          this._view?.webview.postMessage({ type: 'viewVisible' });
        } catch (error) {
          console.error('Error sending viewVisible message:', error);
        }
      }
    });

    // Send initial CLI status
    this._checkAndSendArianaCliStatus();
  }

  /**
   * Send trace data to the webview
   */
  public sendDataToWebView(traces: Trace[]) {
    if (this._view) {
      this._lastSentTraces = traces;
      try {
        this._view.webview.postMessage({ type: 'traces', value: traces });
      } catch (error) {
        console.error('Error sending traces to webview:', error);
      }
    } else {
      console.log('Cannot send traces - webview not initialized');
    }
  }

  /**
   * Check and send Ariana CLI status to the webview
   */
  private async _checkAndSendArianaCliStatus() {
    try {
      const status = await getArianaCliStatus();
      this._sendArianaCliStatus(status);
    } catch (error) {
      console.error('Error checking Ariana CLI status:', error);
    }
  }

  /**
   * Send Ariana CLI status to the webview
   */
  private _sendArianaCliStatus(status: ArianaCliStatus) {
    if (this._view) {
      try {
        this._view.webview.postMessage({ 
          type: 'arianaCliStatus', 
          value: status 
        });
      } catch (error) {
        console.error('Error sending CLI status to webview:', error);
      }
    } else {
      console.error('Cannot send CLI status - webview not initialized');
    }
  }

  /**
   * Install Ariana CLI
   */
  private async _installArianaCli(method: ArianaInstallMethod) {
    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Installing Ariana CLI...',
        cancellable: false
      }, async () => {
        const success = await installArianaCli(method, this._context);
        if (success) {
          vscode.window.showInformationMessage('Ariana CLI installed successfully!');
          await this._checkAndSendArianaCliStatus();
        } else {
          vscode.window.showErrorMessage('Failed to install Ariana CLI');
        }
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Error installing Ariana CLI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Update Ariana CLI
   */
  public async updateArianaCli() {
    try {
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Updating Ariana CLI...',
        cancellable: false
      }, async () => {
        const success = await updateArianaCli(this._context);
        if (success) {
          vscode.window.showInformationMessage('Ariana CLI updated successfully!');
          // Update the CLI status
          await this._checkAndSendArianaCliStatus();
        } else {
          vscode.window.showErrorMessage('Failed to update Ariana CLI');
        }
      });
    } catch (error) {
      vscode.window.showErrorMessage(`Error updating Ariana CLI: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async _updateArianaCli() {
    await this.updateArianaCli();
  }

  /**
   * Highlight code in the editor
   */
  private async _highlightCode(file: string, startLine: number, startCol: number, endLine: number, endCol: number) {
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
      vscode.window.showErrorMessage(`Failed to highlight code: ${error}`);
    }
  }

  /**
   * Send theme information to the webview
   */
  private _sendThemeInfo(webview: vscode.Webview) {
    const themeKind = vscode.window.activeColorTheme.kind;
    try {
      console.log('Sending theme info to webview');
      webview.postMessage({ 
        type: 'theme', 
        value: themeKind === vscode.ColorThemeKind.Dark || themeKind === vscode.ColorThemeKind.HighContrast ? 'dark' : 'light',
        theme: themeKind
      });
    } catch (error) {
      console.error('Error sending theme info to webview:', error);
    }
  }

  /**
   * Register theme change listener
   */
  private _registerThemeChangeListener(webview: vscode.Webview) {
    // Listen for theme changes
    vscode.window.onDidChangeActiveColorTheme(() => {
      if (this._view) {
        try {
          webview.postMessage({ type: 'themeChange' });
          this._sendThemeInfo(webview);
        } catch (error) {
          console.error('Error sending theme change to webview:', error);
        }
      }
    });
  }

  /**
   * Get the HTML content for the webview
   */
  private _getWebviewContent(webview: vscode.Webview): string {
    console.log('Getting webview content');
    
    // Get paths to the webview resources
    const webviewUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist'));
    console.log('Webview URI:', webviewUri.toString());
    
    const stylesUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist', 'assets', 'index.css'));
    console.log('Styles URI:', stylesUri.toString());
    
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'webview-ui', 'dist', 'index.js'));
    console.log('Script URI:', scriptUri.toString());

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
          <div id="root" data-vscode-context='${JSON.stringify({webviewType: "sidebar"})}' data-ariana-logo="${logoUri}" data-ariana-text-logo="${textLogoUri}"></div>
          <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
        </body>
      </html>`;

    console.log('Generated HTML:', html);
    return html;
  }

  /**
   * Generate a nonce for CSP
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
   * Handle messages from the webview
   * @param message 
   */
  private _handleMessage(message: any) {
    console.log('Received message from webview:', message);
    
    switch (message.command) {
      case 'getTheme':
        // Send the current theme to the webview
        this._sendThemeInfo(this._view!.webview);
        break;
      case 'getArianaCliStatus':
        // Get and send the Ariana CLI status
        this._sendCliStatus();
        break;
      case 'installArianaCli':
        this._installArianaCli(message.method);
        break;
      case 'updateArianaCli':
        this._updateArianaCli();
        break;
      case 'retryWebview':
        this._refreshWebview();
        break;
      case 'highlight':
        this._highlightCode(message.file, message.startLine, message.startCol, message.endLine, message.endCol);
        break;
      default:
        console.log('Unhandled message:', message);
    }
  }
  
  /**
   * Send the current CLI status to the webview
   */
  private async _sendCliStatus() {
    console.log('Getting Ariana CLI status');
    try {
      const status = await getArianaCliStatus();
      console.log('Got CLI status:', status);
      this._sendArianaCliStatus(status);
    } catch (error) {
      console.error('Error getting CLI status:', error);
    }
  }
  
  /**
   * Refresh the webview
   */
  private _refreshWebview() {
    console.log('Refreshing webview');
    if (this._view) {
      // Update the webview content
      this._view.webview.html = this._getWebviewContent(this._view.webview);
      console.log('Webview content reloaded');
    }
  }
}
