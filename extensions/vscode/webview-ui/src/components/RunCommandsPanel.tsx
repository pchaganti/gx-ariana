import React, { useState } from 'react';
import { postMessageToExtension } from '../utils/vscode';
import CodeBlockWithRunButton from './ui/CodeBlockWithRunButton';
import { cn } from '../lib/utils';

interface RunCommand {
  command: string;
  description?: string;
}

interface RunCommandsResponse {
  project: string[];
  file: string[];
}

interface RunCommandsPanelProps {
  isInstalled: boolean;
}

const RunCommandsPanel: React.FC<RunCommandsPanelProps> = ({ isInstalled }) => {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [runCommands, setRunCommands] = useState<RunCommandsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCacheCleared, setIsCacheCleared] = useState(false);

  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    
    // If expanding and we don't have commands yet, fetch them
    if (isCollapsed && !runCommands && !isLoading && isInstalled) {
      fetchRunCommands();
    }
  };

  const fetchRunCommands = (clearCache = false) => {
    setIsLoading(true);
    setError(null);
    setIsCacheCleared(false);
    
    if (clearCache) {
      postMessageToExtension({
        command: 'clearRunCommandsCache'
      });
    } else {
      postMessageToExtension({
        command: 'getRunCommands'
      });
    }
  };

  const handleRefresh = (e: React.MouseEvent) => {
    e.stopPropagation();
    fetchRunCommands(true);
  };
  
  const handleRetry = () => {
    fetchRunCommands(false);
  };

  const handleRunCommand = (command: string) => {
    postMessageToExtension({
      command: 'runArianaCommand',
      arianaCommand: command
    });
  };

  // Handle message from extension with run commands
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      
      if (message.type === 'runCommands') {
        console.log("Received run commands:", message.value);
        setRunCommands(message.value);
        setIsLoading(false);
      } else if (message.type === 'runCommandsError') {
        setError(message.error);
        setIsLoading(false);
      } else if (message.type === 'runCommandsCacheCleared') {
        setIsCacheCleared(true);
        // After cache is cleared, fetch new commands
        postMessageToExtension({
          command: 'getRunCommands'
        });
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // If not installed, don't show anything
  if (!isInstalled) {
    return null;
  }

  return (
    <div className="mb-4 rounded-sm bg-[var(--bg-0)] shadow-sm">
      <div
        className={cn(
          "group sticky top-0 z-20 flex items-center justify-between px-4 py-2 bg-[var(--bg-0)] cursor-pointer hover:bg-[var(--bg-2)] transition-colors rounded-sm",
          !isCollapsed && "border-solid border-b-2 border-[var(--bg-1)] rounded-b-none"
        )}
        onClick={handleToggleCollapse}
      >
        <div className="flex items-center gap-2">
          <h2 className="text-md font-medium text-[var(--fg-3)] group-hover:text-[var(--fg-0)]">
            Run with Ariana
          </h2>
        </div>
        <div className="flex items-center gap-2">
          {!isCollapsed && (
            <button
              className="text-xs px-2 py-1 rounded bg-[var(--bg-1)] hover:bg-[var(--bg-2)] transition-colors"
              onClick={handleRefresh}
              title="Refresh commands (clears cache)"
            >
              Refresh
            </button>
          )}
          <div className={cn(
            "h-3 w-3 group-hover:bg-[var(--bg-3)]",
            isCollapsed ? 'rounded-full bg-[var(--bg-1)]' : 'rounded-xs bg-[var(--bg-2)]'
          )}>
          </div>
        </div>
      </div>

      {!isCollapsed && (
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center p-4">
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-t-[var(--accent)] border-r-[var(--accent)] border-b-transparent border-l-transparent"></div>
              <span className="ml-2 text-[var(--fg-2)]">Loading commands...</span>
            </div>
          ) : error ? (
            <div className="p-3 bg-[var(--bg-1)] rounded-md">
              <p className="text-[var(--fg-2)]">Error: {error}</p>
              <button 
                className="mt-2 px-3 py-1 bg-[var(--accent)] text-[var(--fg-3)] rounded-md hover:bg-opacity-90 transition-colors"
                onClick={handleRetry}
              >
                Retry
              </button>
            </div>
          ) : runCommands ? (
            <div className="space-y-4">
              {runCommands.file && runCommands.file.length > 0 && (
                <div>
                  <h3 className="text-md font-medium mb-2 text-[var(--fg-1)]">Current File Commands</h3>
                  <div className="space-y-2">
                    {runCommands.file.map((command, index) => (
                      <CodeBlockWithRunButton
                        key={`file-${index}`}
                        code={command}
                        language="bash"
                        onRun={() => handleRunCommand(command)}
                        className="bg-[var(--bg-1)] rounded-md overflow-hidden"
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {runCommands.project && runCommands.project.length > 0 && (
                <div>
                  <h3 className="text-md font-medium mb-2 text-[var(--fg-1)]">Project Commands</h3>
                  <div className="space-y-2">
                    {runCommands.project.map((command, index) => (
                      <CodeBlockWithRunButton
                        key={`project-${index}`}
                        code={command}
                        language="bash"
                        onRun={() => handleRunCommand(command)}
                        className="bg-[var(--bg-1)] rounded-md overflow-hidden"
                      />
                    ))}
                  </div>
                </div>
              )}
              
              {(!runCommands.file || runCommands.file.length === 0) && 
               (!runCommands.project || runCommands.project.length === 0) && (
                <div className="p-3 bg-[var(--bg-1)] rounded-md">
                  <p className="text-[var(--fg-2)]">No commands found for this project.</p>
                </div>
              )}
              
              {isCacheCleared && (
                <div className="mt-2 p-2 bg-[var(--bg-1)] rounded-md text-xs text-[var(--fg-2)]">
                  Cache cleared. Showing fresh commands.
                </div>
              )}
            </div>
          ) : (
            <div className="p-3 bg-[var(--bg-1)] rounded-md">
              <p className="text-[var(--fg-2)]">No commands available.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RunCommandsPanel;
