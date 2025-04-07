import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { RunCommands } from '../bindings/RunCommands';
import { CommandWithPath } from '../bindings/CommandWithPath';
import { ProjectContext } from '../bindings/ProjectContext';
import { generateProjectContext } from '../projectAnalyzer';
import { getConfig } from '../config';

// Cache interface for storing run commands
interface RunCommandsCache {
  commands: RunCommands;
  timestamp: number;
}

// Persistent cache structure
interface PersistentCache {
  workspaces: { [workspacePath: string]: string }; // Maps workspace paths to their cache IDs
  projectCommands: { [cacheId: string]: RunCommandsCache };
  fileCommands: { [cacheId: string]: RunCommandsCache };
}

// Extended RunCommands interface with client-side timestamp
interface RunCommandsWithTimestamp {
  project: CommandWithPath[];
  file: CommandWithPath[];
  generated_at?: number;
}

/**
 * Service for handling Ariana run commands functionality
 */
export class RunCommandsService {
  private _context: vscode.ExtensionContext;
  private _projectCommandsCache: Map<string, RunCommandsCache> = new Map();
  private _fileCommandsCache: Map<string, RunCommandsCache> = new Map();
  private _cacheTTL: number = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds
  private _globalStoragePath: string;
  private _cacheFilePath: string;
  private _workspaceToIdMap: Map<string, string> = new Map();

  constructor(context: vscode.ExtensionContext) {
    this._context = context;
    this._globalStoragePath = context.globalStoragePath;
    this._cacheFilePath = path.join(this._globalStoragePath, 'run_commands_cache.json');
    this._loadCacheFromDisk();
  }

  /**
   * Generate a hash key for the project context to use as cache key
   * @param context The project context
   * @param type The type of context hash to generate ('project' or 'file')
   * @returns A hash string representing the context
   */
  private generateContextHash(context: ProjectContext, type: 'project' | 'file'): string {
    // Create a simplified context object with only the properties we want to consider for caching
    const cacheableContext: any = {
      workspace_path: context.workspace_path,
      os: context.os,
    };

    if (type === 'project') {
      // For project commands, include workspace files and content
      cacheableContext.important_workspace_files = context.important_workspace_files;
      cacheableContext.important_workspace_file_content = context.important_workspace_file_content;
    } else {
      // For file commands, include only the current file information
      cacheableContext.current_focused_file_path = context.current_focused_file_path;
      cacheableContext.current_focused_file_content = context.current_focused_file_content;
    }

    // Create a hash of the stringified context
    return crypto
      .createHash('md5')
      .update(JSON.stringify(cacheableContext))
      .digest('hex');
  }

  /**
   * Generate a unique ID for a workspace path
   * @param workspacePath The workspace path
   * @returns A unique ID for the workspace
   */
  private generateWorkspaceId(workspacePath: string): string {
    return crypto
      .createHash('md5')
      .update(workspacePath)
      .digest('hex');
  }

  /**
   * Ensure the global storage directory exists
   */
  private ensureGlobalStorageExists(): void {
    if (!fs.existsSync(this._globalStoragePath)) {
      fs.mkdirSync(this._globalStoragePath, { recursive: true });
    }
  }

  /**
   * Load the cache from disk
   */
  private _loadCacheFromDisk(): void {
    try {
      this.ensureGlobalStorageExists();

      if (!fs.existsSync(this._cacheFilePath)) {
        return;
      }

      const cacheData = fs.readFileSync(this._cacheFilePath, 'utf8');
      const cache: PersistentCache = JSON.parse(cacheData);

      // Load workspace to ID mapping
      if (cache.workspaces) {
        for (const [workspacePath, cacheId] of Object.entries(cache.workspaces)) {
          this._workspaceToIdMap.set(workspacePath, cacheId);
        }
      }

      // Load project commands cache
      if (cache.projectCommands) {
        for (const [key, value] of Object.entries(cache.projectCommands)) {
          this._projectCommandsCache.set(key, value);
        }
      }

      // Load file commands cache
      if (cache.fileCommands) {
        for (const [key, value] of Object.entries(cache.fileCommands)) {
          this._fileCommandsCache.set(key, value);
        }
      }

      console.log('Loaded run commands cache from disk');
    } catch (error) {
      console.error('Failed to load run commands cache from disk:', error);
    }
  }

  /**
   * Save the cache to disk
   */
  private _saveCacheToDisk(): void {
    try {
      this.ensureGlobalStorageExists();

      const cache: PersistentCache = {
        workspaces: {},
        projectCommands: {},
        fileCommands: {}
      };

      // Save workspace to ID mapping
      for (const [workspacePath, cacheId] of this._workspaceToIdMap.entries()) {
        cache.workspaces[workspacePath] = cacheId;
      }

      // Save project commands cache
      for (const [key, value] of this._projectCommandsCache.entries()) {
        cache.projectCommands[key] = value;
      }

      // Save file commands cache
      for (const [key, value] of this._fileCommandsCache.entries()) {
        cache.fileCommands[key] = value;
      }

      fs.writeFileSync(this._cacheFilePath, JSON.stringify(cache, null, 2), 'utf8');
      console.log('Saved run commands cache to disk');
    } catch (error) {
      console.error('Failed to save run commands cache to disk:', error);
    }
  }

  /**
   * Get the workspace ID for the given workspace path
   * @param workspacePath The workspace path
   * @returns The workspace ID
   */
  private getWorkspaceId(workspacePath: string): string {
    let workspaceId = this._workspaceToIdMap.get(workspacePath);

    if (!workspaceId) {
      workspaceId = this.generateWorkspaceId(workspacePath);
      this._workspaceToIdMap.set(workspacePath, workspaceId);
      this._saveCacheToDisk();
    }

    return workspaceId;
  }

  /**
   * Clear the run commands cache
   */
  public clearCache(): void {
    this._projectCommandsCache.clear();
    this._fileCommandsCache.clear();
    this._saveCacheToDisk();
  }

  /**
   * Get run commands for the current project context
   * @param webview The webview to post messages to
   */
  public async getRunCommands(webview: vscode.Webview): Promise<void> {
    try {
      // Get the active workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders || workspaceFolders.length === 0) {
        webview.postMessage({
          type: 'runCommandsError',
          error: 'No workspace folder is open.'
        });
        return;
      }

      // Get the active editor for current file path
      const activeEditor = vscode.window.activeTextEditor;
      const currentFilePath = activeEditor?.document.uri.fsPath;
      const workspacePath = workspaceFolders[0].uri.fsPath;

      // Get the project context
      const context = await generateProjectContext(workspacePath, currentFilePath);

      if (!context) {
        webview.postMessage({
          type: 'runCommandsError',
          error: 'Failed to generate project context'
        });
        return;
      }

      // Generate hash keys for caching
      const workspaceId = this.getWorkspaceId(context.workspace_path);
      const projectContextHash = `${workspaceId}_project_${this.generateContextHash(context, 'project')}`;
      const fileContextHash = `${workspaceId}_file_${this.generateContextHash(context, 'file')}`;

      // Check if we have valid cached results
      const now = Date.now();
      const cachedProjectResult = this._projectCommandsCache.get(projectContextHash);
      const cachedFileResult = this._fileCommandsCache.get(fileContextHash);

      // Determine if we need to fetch new commands
      const projectCacheValid = cachedProjectResult && (now - cachedProjectResult.timestamp) < this._cacheTTL;
      const fileCacheValid = cachedFileResult && (now - cachedFileResult.timestamp) < this._cacheTTL;

      let runCommands: RunCommandsWithTimestamp = {
        project: [],
        file: []
      };

      // If both caches are valid, use them
      if (projectCacheValid && fileCacheValid) {
        console.log('Using cached run commands for both project and file');
        runCommands = {
          project: cachedProjectResult.commands.project,
          file: cachedFileResult.commands.file,
          generated_at: Math.min(cachedProjectResult.timestamp, cachedFileResult.timestamp)
        };

        webview.postMessage({
          type: 'runCommands',
          value: runCommands,
          cacheStatus: {
            project: true,
            file: true
          }
        });
        return;
      }

      // If we need to fetch new commands, show loading state
      webview.postMessage({
        type: 'runCommandsLoading'
      });

      try {
        console.log('Fetching new run commands');
        // Call the Ariana CLI to generate run commands
        const newRunCommands = await this._generateRunCommands(context);

        // Cache the results with the current timestamp
        const now = Date.now();

        // If we have valid project cache but need to fetch file commands
        if (projectCacheValid) {
          runCommands.project = cachedProjectResult.commands.project;
        } else {
          runCommands.project = newRunCommands.project;
          // Cache the project commands
          this._projectCommandsCache.set(projectContextHash, {
            commands: newRunCommands,
            timestamp: now
          });
        }

        // If we have valid file cache but need to fetch project commands
        if (fileCacheValid) {
          runCommands.file = cachedFileResult.commands.file;
        } else {
          runCommands.file = newRunCommands.file;
          // Cache the file commands
          this._fileCommandsCache.set(fileContextHash, {
            commands: newRunCommands,
            timestamp: now
          });
        }

        // Add the timestamp
        runCommands.generated_at = now;

        // Save the updated cache to disk
        this._saveCacheToDisk();

        // Send the run commands to the webview
        webview.postMessage({
          type: 'runCommands',
          value: runCommands,
          cacheStatus: {
            project: !projectCacheValid,
            file: !fileCacheValid
          }
        });
      } catch (error) {
        console.error('Failed to generate run commands:', error);
        webview.postMessage({
          type: 'runCommandsError',
          error: `Failed to generate run commands: ${error}`
        });
      }
    } catch (error) {
      console.error('Failed to get run commands:', error);
      webview.postMessage({
        type: 'runCommandsError',
        error: `Failed to get run commands: ${error}`
      });
    }
  }

  /**
   * Generate run commands for the given project context
   * @param context The project context
   * @returns The generated run commands
   */
  private async _generateRunCommands(context: ProjectContext): Promise<RunCommands> {
    console.log('Generating run commands...');
    try {
      // Call the API endpoint to generate run commands
      const response = await fetch(`${getConfig().apiUrl}/unauthenticated/codebase-intel/run-commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ context })
      });

      if (!response.ok) {
        throw new Error(`Server responded with status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error generating run commands:', error);
      throw error;
    }
  }

  /**
   * Execute a run command in the terminal
   * @param command The command to execute
   */
  public executeRunCommand(command: CommandWithPath): void {
    if (!command || !command.command) {
      console.error('Invalid command');
      return;
    }

    try {
      // Create a terminal for running the command
      const terminal = vscode.window.createTerminal('Ariana Run Command');

      // If we have a relative path, cd to it first
      if (command.working_directory && command.working_directory.length > 0) {
        const relativePath = command.working_directory.join(path.sep);
        // Use proper CD command based on OS
        const isWindows = process.platform === 'win32';
        if (isWindows) {
          terminal.sendText(`cd "${relativePath}"`);
        } else {
          terminal.sendText(`cd "${relativePath}"`);
        }
      }

      // Execute the command
      terminal.sendText(`ariana ${command.command}`);
      terminal.show();
    } catch (error) {
      console.error('Failed to execute run command:', error);
      vscode.window.showErrorMessage(`Failed to execute run command: ${error}`);
    }
  }
}
