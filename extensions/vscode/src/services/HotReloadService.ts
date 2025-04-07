import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { WebviewService } from './WebviewService';

/**
 * Service for handling hot reload functionality of the webview UI
 */
export class HotReloadService {
  private _extensionUri: vscode.Uri;
  private _webviewPanel: vscode.WebviewView | undefined;
  private _webviewService: WebviewService;
  private _disposables: vscode.Disposable[] = [];
  private _isWatching: boolean = false;

  constructor(extensionUri: vscode.Uri, webviewService: WebviewService) {
    this._extensionUri = extensionUri;
    this._webviewService = webviewService;
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
        this._webviewPanel.webview.html = this._webviewService.getWebviewContent(this._webviewPanel.webview);
        
        // Notify the webview that it was hot-reloaded
        this._webviewPanel.webview.postMessage({ type: 'hotReload' });
        
        // Send a fresh render nonce for timer management
        this._webviewService.sendRenderNonce(this._webviewPanel.webview);
        
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
