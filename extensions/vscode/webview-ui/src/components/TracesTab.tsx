import React, { useState, useEffect, useRef, useCallback } from 'react';
import JsonView from 'react-json-view';
import type { Trace } from '../bindings/Trace';
import stateManager from '../utils/stateManager';
import { requestHighlight } from '../lib/highlight';
import VaultSelector, { VaultHistoryEntry } from './VaultSelector';
import { postMessageToExtension } from '../utils/vscode';

const formatTimestamp = (timestamp: number) => {
    const date = new Date(Math.trunc(timestamp * 10e-4 * 10e-3));
    const ms = Math.trunc((timestamp * 10e-4) % 1000);
    return date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }) + ` + ${ms.toString().padStart(3, '0')}ms`;
};

const formatDuration = (nanoseconds: number) => {
    if (nanoseconds === 0) {
        return "0 ms";
    }
    
    if (nanoseconds < 1000) {
        return `${nanoseconds.toFixed(3)} ns`;
    } else if (nanoseconds < 1000000) {
        return `${(nanoseconds / 1000).toFixed(3)} µs`;
    } else if (nanoseconds < 1000000000) {
        return `${(nanoseconds / 1000000).toFixed(3)} ms`;
    } else {
        return `${(nanoseconds / 1000000000).toFixed(3)} s`;
    }
};

const TraceGroup = ({ key, traces }: { key: number, traces: Trace[] }) => {
    let enterTrace = findEnterTrace(traces, traces[0].trace_id);
    let exitTrace = findExitTrace(traces, traces[0].trace_id);
    let errorTrace = findErrorTrace(traces, traces[0].trace_id);

    let parts = (enterTrace ?? exitTrace ?? errorTrace)?.start_pos.filepath.split('\\') ?? [];
    let fileName = parts.slice(-2).join('\\');
    parts = fileName.split('/');
    fileName = parts.slice(-2).join('/');

    function Header({ enterTrace, exitOrErrorTrace }: { enterTrace: Trace, exitOrErrorTrace: Trace | undefined }) {
        let duration_ns = 0;
        if (exitOrErrorTrace) {
            if (traceIsExit(exitOrErrorTrace)) {
                duration_ns = (exitOrErrorTrace.trace_type as any)['Exit'].duration_ns;
            } else if (traceIsError(exitOrErrorTrace)) {
                duration_ns = (exitOrErrorTrace.trace_type as any)['Error'].duration_ns;
            }
        }
        
        return (
            <button
                onClick={() => {
                    requestHighlight(enterTrace.start_pos.filepath, enterTrace.start_pos.line, enterTrace.start_pos.column, enterTrace.end_pos.line, enterTrace.end_pos.column);
                }} 
                className={`w-full text-left text-sm flex-col hover:bg-[var(--bg-2)] rounded-md p-3 pb-1.5 cursor-pointer`}
            >
                <div className="font-mono opacity-30 mb-0.5">
                    in {fileName}
                </div>
                <div className={`w-full text-sm flex gap-3 items-start`}>
                    <div
                    className="font-mono opacity-60 w-[14ch] text-left">
                        {enterTrace.start_pos.line === enterTrace.end_pos.line 
                            ? `L${enterTrace.start_pos.line}:${enterTrace.start_pos.column} to :${enterTrace.end_pos.column}`
                            : `L${enterTrace.start_pos.line}:${enterTrace.start_pos.column} to L${enterTrace.end_pos.line}:${enterTrace.end_pos.column}`
                        }
                    </div>
                    <div className="flex flex-col text-xs items-start mt-1">
                        <div className="font-mono opacity-30">
                            Tracing started at: {formatTimestamp(enterTrace.timestamp)}
                        </div>
                        {(exitOrErrorTrace && (
                            <div className={`font-mono opacity-30 ${traceIsError(exitOrErrorTrace) ? 'text-red-500' : ''}`}>
                                ... and {(traceIsError(exitOrErrorTrace) ? "threw Error" : "finished")} at: {formatTimestamp(exitOrErrorTrace.timestamp)}
                            </div>
                        ))}
                        <div className="font-mono opacity-50">
                            Execution took: {formatDuration(duration_ns)}
                        </div>
                    </div>
                </div>
            </button>
        );
    }

    if (!enterTrace) {
        return(<></>);
    };

    if (exitTrace || errorTrace) {
        let parsedValue;
        if (exitTrace) {
            parsedValue = (exitTrace.trace_type as any)['Exit'].return_value;
        } else if (errorTrace) {
            parsedValue = (errorTrace.trace_type as any)['Error'].error_message;
        }
        try {
            parsedValue = JSON.parse(parsedValue);
        } catch {
            // do nothing
        }
        
        return (
            <div className="w-full flex flex-col gap-1.5 rounded-md bg-[var(--bg-0)]">
                <Header enterTrace={enterTrace} exitOrErrorTrace={exitTrace ? exitTrace : errorTrace} />
                <div className="overflow-x-auto p-3 pt-0">
                    <div className="flex gap-2 items-start">
                        <div>
                            =
                        </div>
                        {(() => {
                            switch (typeof parsedValue) {
                                case 'string':
                                    return (
                                        <div className="font-mono">
                                            {parsedValue.split('\n').map((line, index) => (
                                                <div key={index}>{line}</div>
                                            ))}
                                        </div>
                                    );
                                case 'number':
                                case 'boolean':
                                    return <span className="font-mono">{String(parsedValue)}</span>;
                                case 'undefined':
                                    return <span className="font-mono text-muted-foreground">undefined</span>;
                                case 'function':
                                    return <span className="font-mono text-blue-400">[Function]</span>;
                                case 'symbol':
                                    return <span className="font-mono text-green-400">{parsedValue.toString()}</span>;
                                case 'object':
                                    if (parsedValue === null) {
                                        return (
                                            <span className="font-mono text-destructive">
                                                null/None
                                            </span>
                                        );
                                    }
                                    if (JSON.stringify(parsedValue) === '{}') {
                                        return <span className="font-mono text-muted-foreground">{String(parsedValue)}</span>;
                                    }
                                    return (
                                        <JsonView
                                            src={parsedValue}
                                            theme="twilight"
                                            collapsed={true}
                                            shouldCollapse={(_) => true}
                                        />
                                    );
                                default:
                                    return <span className="font-mono text-destructive">[Unknown Type]</span>;
                            }
                        })()}
                    </div>
                 </div>
            </div>
        );
    } else {
        return (
            <div className="w-full flex flex-col gap-1">
                <Header enterTrace={enterTrace} exitOrErrorTrace={undefined} />
            </div>
        );
    }
};

interface TracesTabProps {
  traces: Trace[];
  focusableVaults: VaultHistoryEntry[];
  focusedVault: string | null;
  highlightingToggled: boolean;
}

const TracesTab: React.FC<TracesTabProps> = ({ traces, focusableVaults, focusedVault, highlightingToggled }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = stateManager.usePersistedState<number>('tracesScrollPosition', 0);
  const [copied, setCopied] = useState(false);
  
  // Initialize tracesById
  let tracesById: Record<string, Trace[]> = {};
  traces.forEach(trace => {
      if (!(trace.trace_id in tracesById)) {
          tracesById[trace.trace_id] = [];
      }
      tracesById[trace.trace_id].push(trace);
  });

  // Restore scroll position when tab is shown
  useEffect(() => {
    if (containerRef.current) {
        containerRef.current.scrollTop = scrollPosition;
    }
  }, []);

  // Save scroll position when scrolling
  const handleScroll = () => {
    if (containerRef.current) {
      setScrollPosition(containerRef.current.scrollTop);
    }
  };

  // Function to format a trace for text output
  const traceToText = (trace: Trace, traces: Trace[], prevTrace?: Trace): string => {
    const enterTrace = findEnterTrace(traces, trace.trace_id);
    if (!enterTrace) {
      return '';
    }
    
    const exitTrace = findExitTrace(traces, trace.trace_id);
    const errorTrace = findErrorTrace(traces, trace.trace_id);
    const exitOrErrorTrace = exitTrace || errorTrace;
    
    const lines: string[] = [];
    
    // Add filepath if different from previous trace
    if (prevTrace) {
        if (enterTrace.start_pos.filepath !== findEnterTrace(traces, prevTrace.trace_id)?.start_pos.filepath) {
            lines.push(`in ${enterTrace.start_pos.filepath}`);
        }
    } else {
        lines.push(`in ${enterTrace.start_pos.filepath}`);
    }
    
    // Add line and column info
    const posInfo = `from L${enterTrace.start_pos.line}:${enterTrace.start_pos.column} to L${enterTrace.end_pos.line}:${enterTrace.end_pos.column}`;
    lines.push(posInfo);
    
    // Add timestamp info
    let timeInfo = `from ${formatTimestamp(enterTrace.timestamp)}`;
    if (exitOrErrorTrace) {
      timeInfo += ` to ${formatTimestamp(exitOrErrorTrace.timestamp)}`;
    }
    lines.push(timeInfo);
    
    // Add duration if available
    let duration_ns = 0;
    if (exitOrErrorTrace) {
      if (traceIsExit(exitOrErrorTrace) && typeof exitOrErrorTrace.trace_type === 'object' && 'Exit' in exitOrErrorTrace.trace_type) {
        duration_ns = exitOrErrorTrace.trace_type.Exit.duration_ns;
      } else if (traceIsError(exitOrErrorTrace) && typeof exitOrErrorTrace.trace_type === 'object' && 'Error' in exitOrErrorTrace.trace_type) {
        duration_ns = exitOrErrorTrace.trace_type.Error.duration_ns;
      }
      lines.push(`took ${formatDuration(duration_ns)}`);
    }
    
    // Add error/return value info
    if (errorTrace && typeof errorTrace.trace_type === 'object' && 'Error' in errorTrace.trace_type) {
      lines.push(`error: ${errorTrace.trace_type.Error.error_message}`);
    } else if (exitTrace && typeof exitTrace.trace_type === 'object' && 'Exit' in exitTrace.trace_type) {
      lines.push(`value: ${exitTrace.trace_type.Exit.return_value || 'null'}`);
    } else {
      lines.push('did not finish');
    }
    
    return lines.join('\n');
  };
  
  const handleCopyAllTraces = useCallback(() => {
    // First, group traces by ID and filter to only include those with enter traces
    let validTraceGroups: Trace[][] = [];
    Object.entries(tracesById).forEach(([traceId, traceGroup]) => {
      const enterTrace = findEnterTrace(traceGroup, traceId);
      if (enterTrace) {
        validTraceGroups.push(traceGroup);
      }
    });
    
    // Sort groups by enter trace timestamp
    validTraceGroups.sort((a, b) => {
      const aEnter = findEnterTrace(a, a[0].trace_id);
      const bEnter = findEnterTrace(b, b[0].trace_id);
      if (!aEnter || !bEnter) {
        return 0;
      }
      return aEnter.timestamp - bEnter.timestamp;
    });
    
    // Format each group and join with newlines
    let textOutput = '';
    let prevTrace: Trace | undefined;
    
    validTraceGroups.forEach((traceGroup) => {
      const trace = traceGroup[0];
      textOutput += traceToText(trace, traceGroup, prevTrace) + '\n';
      prevTrace = trace;
    });
    
    // Copy to clipboard
    navigator.clipboard.writeText(textOutput)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      })
      .catch((err) => {
        console.error('Failed to copy traces:', err);
      });
  }, [traces, tracesById]);
  
  traces.sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="flex flex-col gap-3 p-4 pr-0" style={{ height: '100%', width: '100%' }}>
      <div className="flex justify-between gap-3 pr-4 items-end">
        <div className="flex-grow">
          <VaultSelector 
            focusableVaults={focusableVaults} 
            focusedVault={focusedVault} 
          />
        </div>
        <div className="flex flex-col gap-1 shrink-0 h-16 justify-end">
            <button
            onClick={() => {
                postMessageToExtension({
                command: 'toggleHighlighting'
                });
            }}
            className={"text-[var(--fg-0)] px-3 rounded-md max-h-1/2 grow cursor-pointer text-sm font-semibold " + (highlightingToggled ? 'bg-[var(--accent)]' : '')}
            >
                Traces Overlay: {highlightingToggled ? 'On' : 'Off'}
            </button>
            {traces.length > 0 && (
                <button
                    onClick={handleCopyAllTraces}
                    className={`text-[var(--fg-0)] px-3 rounded-md grow cursor-pointer text-sm font-semibold ${copied ? 'bg-green-600' : ' bg-[var(--bg-0)]'}`}
                >
                    {copied ? 'Copied' : '📋 Copy All'}
                </button>
            )}
        </div>
      </div>
      <div 
        ref={containerRef}
        className="flex flex-col gap-3 w-full max-w-full h-full overflow-y-auto pr-4 text-[var(--fg-0)]"
        onScroll={handleScroll}
      >
        {traces.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-4 text-center">
            <p className="mb-2">No traces available</p>
            {focusedVault ? (
                <p className="text-sm">Waiting for traces...</p>
            ) : (
                <p className="text-sm">Run your code with the Ariana CLI to generate traces. Or select a previous run from the dropdown above.</p>
            )}
          </div>
        ) : (
          traces.filter(t => t.trace_type === 'Enter').map((trace, i) => (
            <TraceGroup key={i} traces={tracesById[trace.trace_id] ?? []} />
          ))
        )}
      </div>
    </div>
  );
};

function traceIsError(trace: Trace): boolean {
  return typeof trace.trace_type === 'object' && trace.trace_type !== null && 'Error' in trace.trace_type;
}

function traceIsExit(trace: Trace): boolean {
  return typeof trace.trace_type === 'object' && trace.trace_type !== null && 'Exit' in trace.trace_type;
}

function findErrorTrace(traces: Trace[], traceId: string): Trace | undefined {
  return traces.find(t => t.trace_id === traceId && traceIsError(t));
}

function findExitTrace(traces: Trace[], traceId: string): Trace | undefined {
  return traces.find(t => t.trace_id === traceId && traceIsExit(t));
}

function findEnterTrace(traces: Trace[], traceId: string): Trace | undefined {
  return traces.find(t => t.trace_id === traceId && t.trace_type === 'Enter');
}

export default TracesTab;
