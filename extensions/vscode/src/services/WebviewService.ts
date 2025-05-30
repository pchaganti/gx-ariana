import * as vscode from 'vscode';

/**
 * Service for handling webview-related functionality
 */
export class WebviewService {
  private _extensionUri: vscode.Uri;
  private _currentNonce: string;

  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
    this._currentNonce = this._generateUniqueNonce();
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
          <div id="root" data-vscode-context='${JSON.stringify({webviewType: "sidebar"})}' data-ariana-logo="${logoUri}" data-ariana-text-logo="${textLogoUri}"></div>
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
      webview.postMessage({ 
        type: 'renderNonce', 
        value: this._currentNonce
      });
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
}
