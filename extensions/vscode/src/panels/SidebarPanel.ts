import * as vscode from 'vscode';
import { getNonce } from '../utilities/getNonce';
import { getUri } from '../utilities/getUri';
import { Trace } from '../bindings/Trace';
import * as path from 'path';

export class SidebarPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = "ariana.sidebarView";
  private _view?: vscode.WebviewView;
  private _lastSentTraces?: Trace[];

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = this._getWebviewContent(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(message => {
      switch (message.command) {
        case 'highlight':
          this._highlightCode(message.file, message.startLine, message.startCol, message.endLine, message.endCol);
          break;
        case 'getTheme':
          // Send the current theme to the webview
          this._sendThemeInfo(webviewView.webview);
          break;
      }
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
      if (webviewView.visible) {
        this._view?.webview.postMessage({ type: 'viewVisible' });
      }
    });
  }

  /**
   * Send trace data to the webview
   */
  public sendDataToWebView(traces: Trace[]) {
    if (this._view) {
      this._lastSentTraces = traces;
      this._view.webview.postMessage({ type: 'traces', value: traces });
    }
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
    webview.postMessage({ 
      type: 'theme', 
      value: themeKind === vscode.ColorThemeKind.Dark || themeKind === vscode.ColorThemeKind.HighContrast ? 'dark' : 'light',
      theme: themeKind
    });
  }

  /**
   * Register theme change listener
   */
  private _registerThemeChangeListener(webview: vscode.Webview) {
    // Listen for theme changes
    vscode.window.onDidChangeActiveColorTheme(() => {
      if (this._view) {
        webview.postMessage({ type: 'themeChange' });
        this._sendThemeInfo(webview);
      }
    });
  }

  /**
   * Get the webview HTML content
   */
  private _getWebviewContent(webview: vscode.Webview): string {
    const webviewUri = getUri(webview, this._extensionUri, ["webview-ui", "dist"]);
    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(webviewUri, "assets", "index.css")
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(webviewUri, "index.js")
    );

    // Get logo paths
    const logoPath = vscode.Uri.joinPath(this._extensionUri, "resources", "logo.png");
    const textLogoPath = vscode.Uri.joinPath(this._extensionUri, "resources", "logo_text_highres.png");
    const logoUri = webview.asWebviewUri(logoPath);
    const textLogoUri = webview.asWebviewUri(textLogoPath);

    // Use getNonce to create a nonce
    const nonce = getNonce();

    return `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} https:;">
        <link rel="stylesheet" type="text/css" href="${stylesUri}">
        <title>Ariana</title>
      </head>
      <body>
        <div id="root" data-vscode-context='{"webviewType":"sidebar"}' data-ariana-logo="${logoUri}" data-ariana-text-logo="${textLogoUri}"></div>
        <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
      </body>
    </html>`;
  }
}
