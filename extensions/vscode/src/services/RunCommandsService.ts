import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { generateProjectContext } from '../projectAnalyzer';
import { getArianaCliStatus } from '../installation/cliManager';
import { ProjectContext } from '../bindings/ProjectContext';
import { RunCommands } from '../bindings/RunCommands';
import { GenerateRunCommandsRequest } from '../bindings/GenerateRunCommandsRequest';
import { getConfig } from '../config';

// Cache interface for storing run commands
interface RunCommandsCache {
  commands: RunCommands;
  timestamp: number;
}

/**
 * Service for handling Ariana run commands functionality
 */
export class RunCommandsService {
  private _context: vscode.ExtensionContext;
  private _commandsCache: Map<string, RunCommandsCache> = new Map();
  private _cacheTTL: number = 5 * 60 * 1000; // 5 minutes in milliseconds

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
  }

  /**
   * Generate a hash key for the project context to use as cache key
   * @param context The project context
   * @returns A hash string representing the context
   */
  private generateContextHash(context: ProjectContext): string {
    // Create a simplified context object with only the properties we want to consider for caching
    const cacheableContext = {
      workspace_path: context.workspace_path,
      os: context.os,
      important_workspace_files: context.important_workspace_files,
      important_workspace_file_content: context.important_workspace_file_content,
      current_focused_file_path: context.current_focused_file_path
    };
    
    // Create a hash of the stringified context
    return crypto
      .createHash('md5')
      .update(JSON.stringify(cacheableContext))
      .digest('hex');
  }

  /**
   * Get run commands for the current workspace and return them
   * @param webview The webview to send messages to
   */
  public async getRunCommands(webview: vscode.Webview): Promise<void> {
    try {
      // Check if Ariana CLI is installed
      const cliStatus = await getArianaCliStatus();
      if (!cliStatus.isInstalled) {
        webview.postMessage({
          type: 'runCommandsError',
          error: 'Ariana CLI is not installed. Please install it first.'
        });
        return;
      }

      // Get the active workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        webview.postMessage({
          type: 'runCommandsError',
          error: 'No workspace folder is open.'
        });
        return;
      }

      // Get the active editor
      const activeEditor = vscode.window.activeTextEditor;
      const currentFilePath = activeEditor?.document.uri.fsPath;

      // Show progress notification
      await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Analyzing project for run commands...',
        cancellable: false
      }, async () => {
        // Generate the project context
        const workspacePath = workspaceFolders[0].uri.fsPath;
        const context = await generateProjectContext(workspacePath, currentFilePath);
        
        // Generate a hash key for the context
        const contextHash = this.generateContextHash(context);
        
        // Check if we have a valid cached result
        const cachedResult = this._commandsCache.get(contextHash);
        const now = Date.now();
        
        if (cachedResult && (now - cachedResult.timestamp) < this._cacheTTL) {
          console.log('Using cached run commands');
          // Use cached commands
          webview.postMessage({
            type: 'runCommands',
            value: cachedResult.commands
          });
          return;
        }

        try {
          const { apiUrl } = getConfig();
          // Call the API endpoint to generate run commands
          const response = await fetch(`${apiUrl}/unauthenticated/run-commands/generate`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ context } as GenerateRunCommandsRequest)
          });
          
          if (!response.ok) {
            throw new Error(`Server responded with status: ${response.status}`);
          }
          
          const runCommands: RunCommands = await response.json();
          
          // Cache the result
          this._commandsCache.set(contextHash, {
            commands: runCommands,
            timestamp: now
          });

          // Send the run commands to the webview
          webview.postMessage({
            type: 'runCommands',
            value: runCommands
          });
        } catch (error) {
          console.error('Error generating run commands:', error);
          webview.postMessage({
            type: 'runCommandsError',
            error: `Failed to generate run commands: ${error instanceof Error ? error.message : 'Unknown error'}`
          });
        }
      });
    } catch (error) {
      console.error('Error in getRunCommands:', error);
      webview.postMessage({
        type: 'runCommandsError',
        error: `An error occurred: ${error instanceof Error ? error.message : 'Unknown error'}`
      });
    }
  }

  /**
   * Run an Ariana command in the terminal
   * @param command The Ariana command to run
   */
  public runArianaCommand(command: string): void {
    try {
      // Get the active workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        vscode.window.showErrorMessage('No workspace folder is open.');
        return;
      }

      const workspacePath = workspaceFolders[0].uri.fsPath;

      // Create a terminal if it doesn't exist
      const terminal = vscode.window.createTerminal('Ariana');
      
      // Activate the terminal
      terminal.show();

      // Run the command in the terminal
      // Note: VS Code terminal API handles the OS-specific command execution
      // We don't need to modify the command syntax based on OS as VS Code handles this
      terminal.sendText(`cd "${workspacePath}" && ${command}`);

      // Show a notification
      vscode.window.showInformationMessage(`Running: ${command}`);
    } catch (error) {
      console.error('Error running Ariana command:', error);
      vscode.window.showErrorMessage(`Failed to run command: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear the commands cache
   */
  public clearCache(): void {
    this._commandsCache.clear();
    console.log('Run commands cache cleared');
  }
}
