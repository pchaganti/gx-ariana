import React, { useEffect, useState } from 'react';
import { postMessageToExtension } from '../utils/vscode';
import CodeBlockWithRunButton from './ui/CodeBlockWithRunButton';
import { cn } from '../lib/utils';
import stateManager from '../utils/stateManager';
import { setTimeoutCancelIfDifferentNonce } from '../utils/timerManagement';

interface CommandWithPath {
  command: string;
  relative_path: string[];
}

interface RunCommandsResponse {
  project: CommandWithPath[];
  file: CommandWithPath[];
  generated_at?: number; // Optional client-side timestamp when commands were generated
}

interface RunCommandsPanelProps {
  isInstalled: boolean;
}

// Group commands by their relative path
interface GroupedCommands {
  [path: string]: CommandWithPath[];
}

const RunCommandsPanel: React.FC<RunCommandsPanelProps> = ({ isInstalled }) => {
  const [isCollapsed, setIsCollapsed] = stateManager.usePersistedState<boolean>('runCommandsIsCollapsed', true);
  const [isLoading, setIsLoading] = useState(false);
  const [runCommands, setRunCommands] = stateManager.usePersistedState<RunCommandsResponse | null>('runCommands', null);
  const [error, setError] = useState<string | null>(null);

  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const fetchRunCommands = (clearCache = false) => {
    setIsLoading(true);
    setError(null);

    postMessageToExtension({
      command: 'getRunCommands',
      clearCache
    });
  };

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLoading) {
      return;
    }
    fetchRunCommands(true);
  };

  const handleRunCommand = (command: CommandWithPath) => {
    postMessageToExtension({
      command: 'runArianaCommand',
      commandData: command
    });
  };

  // Format the cache timestamp
  const formatCacheTime = (timestamp?: number): string => {
    if (!timestamp) {
      return '';
    }
    
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Group commands by their relative path
  const groupCommandsByPath = (commands: CommandWithPath[]): GroupedCommands => {
    const grouped: GroupedCommands = {};
    
    // Special group for commands without a path
    const rootKey = '.';
    
    commands.forEach(cmd => {
      if (!cmd.relative_path || cmd.relative_path.length === 0) {
        // Commands without a path go to the root group
        if (!grouped[rootKey]) {
          grouped[rootKey] = [];
        }
        grouped[rootKey].push(cmd);
      } else {
        // Use the relative path as the group key
        const pathKey = cmd.relative_path.join('/');
        if (!grouped[pathKey]) {
          grouped[pathKey] = [];
        }
        grouped[pathKey].push(cmd);
      }
    });
    
    return grouped;
  };

  // Handle message from extension with run commands
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      if (message.type === 'runCommandsLoading') {
        setIsLoading(true);
      } else if (message.type === 'runCommands') {
        setRunCommands(message.value);
        setIsLoading(false);
        setTimeoutCancelIfDifferentNonce(() => {
          fetchRunCommands(false);
        }, 2000, 'fetchRunCommands');
      } else if (message.type === 'runCommandsError') {
        setError(message.error);
        setIsLoading(false);
      }
    };

    fetchRunCommands(false);

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // If not installed, don't show anything
  if (!isInstalled) {
    return null;
  }

  return (
    <div className="mb-4 rounded-sm bg-[var(--bg-0)]">
      <div
        className={cn(
          "group sticky top-0 z-20 flex items-center justify-between px-4 py-4 bg-[var(--bg-0)] cursor-pointer hover:bg-[var(--bg-2)] transition-colors rounded-sm",
          !isCollapsed && "border-solid border-b-2 border-[var(--bg-1)] rounded-b-none"
        )}
        onClick={handleToggleCollapse}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium text-[var(--fg-3)] group-hover:text-[var(--fg-0)]">
            🧵 Run your code with Ariana
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <div className={cn(
            "h-3 w-3 group-hover:bg-[var(--bg-3)]",
            isCollapsed ? 'rounded-full bg-[var(--bg-1)]' : 'rounded-xs bg-[var(--bg-2)]'
          )}>
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-4 flex flex-col gap-5">
          {isLoading && !runCommands && (
            <div className="flex items-center justify-center p-4">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-t-[var(--accent)] border-r-[var(--accent)] border-b-transparent border-l-transparent"></div>
              <span className="ml-2 text-[var(--fg-2)]">Loading commands...</span>
            </div>
          )}
          { runCommands && (
            <div className="flex flex-col gap-3">
              {/* File Commands Section */}
              {runCommands.file && runCommands.file.length > 0 && (
                <div>
                  <h3 className="text-md font-medium mb-2 text-[var(--fg-1)]">
                    Current File Commands <span className="opacity-50">({runCommands.file.length})</span>
                  </h3>
                  
                  {/* Group file commands by path */}
                  {Object.entries(groupCommandsByPath(runCommands.file)).map(([path, commands]) => (
                    <div key={`file-group-${path}`} className="mb-3">
                      {/* Only show path heading if it's not the root path */}
                      {path !== '.' && (
                        <h4 className="text-sm font-medium mb-1 text-[var(--fg-2)] pl-2">
                          {path}
                        </h4>
                      )}
                      <div className="space-y-2">
                        {commands.map((command, index) => (
                          <CodeBlockWithRunButton
                            key={`file-${path}-${index}`}
                            code={command.command}
                            language="bash"
                            onRun={() => handleRunCommand(command)}
                            buttonText='Run with Ariana'
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Project Commands Section */}
              {runCommands.project && runCommands.project.length > 0 && (
                <div>
                  <h3 className="text-md font-medium mb-2 text-[var(--fg-1)]">
                    Project Commands <span className="opacity-50">({runCommands.project.length})</span>
                  </h3>
                  
                  {/* Group project commands by path */}
                  {Object.entries(groupCommandsByPath(runCommands.project)).map(([path, commands]) => (
                    <div key={`project-group-${path}`} className="mb-3">
                      {/* Only show path heading if it's not the root path */}
                      {path !== '.' && (
                        <h4 className="text-sm font-medium mb-1 text-[var(--fg-2)] pl-2">
                          {path}
                        </h4>
                      )}
                      <div className="space-y-2">
                        {commands.map((command, index) => (
                          <CodeBlockWithRunButton
                            key={`project-${path}-${index}`}
                            code={command.command}
                            language="bash"
                            onRun={() => handleRunCommand(command)}
                            buttonText="Run with Ariana"
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex justify-between items-center mt-2">
                {runCommands.generated_at && (
                  <><div className="text-xs text-[var(--fg-2)]">
                    Infered by Ariana AI at {formatCacheTime(runCommands.generated_at)}
                  </div>
                  <button
                    className="group text-xs px-1 py-0.5 rounded bg-[var(--bg-0)] hover:bg-[var(--accent)] text-[var(--fg-2)] hover:text-[var(--fg-3)] transition-colors cursor-pointer"
                    onClick={handleRefresh}
                    title="Refresh commands (clears cache)"
                  >
                    <div className="group-hover:opacity-100 opacity-70 group-disabled:opacity-50">refresh</div>
                  </button></>
                )}
              </div>
            </div>
          )}
          {error && (
            <div className="p-3 bg-[var(--bg-1)] rounded-md opacity-70">
              <p className="text-[var(--fg-2)]">Error refreshing commands: {error}</p>
              <button 
                className="mt-2 px-3 py-1 bg-[var(--accent)] text-[var(--fg-3)] rounded-md hover:bg-opacity-90 transition-colors"
                onClick={handleRefresh}
              >
                Retry
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RunCommandsPanel;
