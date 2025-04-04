import * as vscode from 'vscode';
import { Trace } from '../bindings/Trace';

/**
 * Service for handling trace-related functionality
 */
export class TraceService {
  /**
   * Highlight code in the editor based on trace information
   */
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
   * Send trace data to the webview
   */
  public sendTracesToWebview(webview: vscode.Webview, traces: Trace[]): void {
    try {
      webview.postMessage({ type: 'traces', value: traces });
    } catch (error) {
      console.error('Error sending traces to webview:', error);
    }
  }
}
