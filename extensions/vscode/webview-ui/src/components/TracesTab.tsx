import React, { useState, useEffect, useRef } from 'react';
import JsonView from 'react-json-view';
import type { Trace } from '../bindings/Trace';
import stateManager from '../utils/stateManager';

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

type HighlightRequest = (file: string, startLine: number, startCol: number, endLine: number, endCol: number) => void;

const TraceGroup = ({ key, traces, requestHighlight }: { key: number, traces: Trace[], requestHighlight: HighlightRequest }) => {
    let enterTrace = findEnterTrace(traces, traces[0].trace_id);
    let exitTrace = findExitTrace(traces, traces[0].trace_id);
    let errorTrace = findErrorTrace(traces, traces[0].trace_id);

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
            <div
                onClick={() => {
                    requestHighlight(enterTrace.start_pos.filepath, enterTrace.start_pos.line, enterTrace.start_pos.column, enterTrace.end_pos.line, enterTrace.end_pos.column);
                }}
                className={`w-full text-sm flex gap-3 items-start`}
            >
                <button
                onClick={() => {
                    requestHighlight(enterTrace.start_pos.filepath, enterTrace.start_pos.line, enterTrace.start_pos.column, enterTrace.end_pos.line, enterTrace.end_pos.column);
                }} className="font-mono opacity-60 w-[14ch] text-left hover:bg-accent cursor-pointer">
                    {enterTrace.start_pos.line === enterTrace.end_pos.line 
                        ? `L${enterTrace.start_pos.line}:${enterTrace.start_pos.column} to :${enterTrace.end_pos.column}`
                        : `L${enterTrace.start_pos.line}:${enterTrace.start_pos.column} to L${enterTrace.end_pos.line}:${enterTrace.end_pos.column}`
                    }
                </button>
                <div className="flex flex-col gap-1 text-xs items-start">
                    <div className="font-mono opacity-30">
                        Tracing started at: {formatTimestamp(enterTrace.timestamp)}
                    </div>
                    {(exitOrErrorTrace && (
                        <div className={`font-mono opacity-30 ${traceIsError(exitOrErrorTrace) ? 'text-destructive' : ''}`}>
                            ... and {(traceIsError(exitOrErrorTrace) ? "threw Error" : "finished")} at: {formatTimestamp(exitOrErrorTrace.timestamp)}
                        </div>
                    ))}
                    <div className="font-mono opacity-50">
                        Execution took: {duration_ns * 10e-11} ms
                    </div>
                </div>
            </div>
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
            <div className="w-full flex flex-col gap-1 p-3 border-b border-border">
                <Header enterTrace={enterTrace} exitOrErrorTrace={exitTrace ? exitTrace : errorTrace} />
                <div className="overflow-x-auto">
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
  requestHighlight: HighlightRequest;
}

const TracesTab: React.FC<TracesTabProps> = ({ traces, requestHighlight }) => {
  const [renderKey, setRenderKey] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Force rerender when theme changes
  useEffect(() => {
    const handleThemeChange = () => {
      setRenderKey(prev => prev + 1);
    };
    
    window.addEventListener('message', (event) => {
      const message = event.data;
      if (message.type === 'themeChange') {
        handleThemeChange();
      }
    });
    
    return () => {
      window.removeEventListener('message', handleThemeChange);
    };
  }, []);

  // Restore scroll position when tab is shown
  useEffect(() => {
    if (containerRef.current) {
      const savedScrollPosition = stateManager.get('tracesScrollPosition');
      if (typeof savedScrollPosition === 'number') {
        containerRef.current.scrollTop = savedScrollPosition;
      }
    }
  }, []);

  // Save scroll position when scrolling
  const handleScroll = () => {
    if (containerRef.current) {
      stateManager.set('tracesScrollPosition', containerRef.current.scrollTop);
    }
  };
  
  let tracesById: Record<string, Trace[]> = {};
  traces.forEach(trace => {
      if (!(trace.trace_id in tracesById)) {
          tracesById[trace.trace_id] = [];
      }
      tracesById[trace.trace_id].push(trace);
  });

  traces.sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div key={renderKey} className="p-4" style={{ height: '100%', width: '100%' }}>
      <div 
        ref={containerRef}
        className="flex flex-col gap-3 w-full max-w-full h-full overflow-y-auto"
        onScroll={handleScroll}
      >
        {traces.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--vscode-descriptionForeground)] p-4 text-center">
            <p className="mb-2">No traces available</p>
            <p className="text-sm">Run your code with the Ariana CLI to generate traces</p>
          </div>
        ) : (
          traces.filter(t => t.trace_type === 'Enter').map((trace, i) => (
            <TraceGroup key={i} traces={tracesById[trace.trace_id] ?? []} requestHighlight={requestHighlight} />
          ))
        )}
      </div>
    </div>
  );
};

function traceIsError(trace: Trace): boolean {
  return trace.trace_type !== 'Enter' && trace.trace_type !== 'Awaited' && trace.trace_type !== 'Normal' && 'Error' in trace.trace_type;
}

function traceIsExit(trace: Trace): boolean {
  return trace.trace_type !== 'Enter' && trace.trace_type !== 'Awaited' && trace.trace_type !== 'Normal' && 'Exit' in trace.trace_type;
}

function findErrorTrace(traces: Trace[], traceId: string): Trace | undefined {
  return traces.find(t => t.trace_id === traceId && traceIsError(t));
}

function findExitTrace(traces: Trace[], traceId: string): Trace | undefined {
  return traces.find(t => t.trace_id === traceId && t.trace_type !== 'Enter' && t.trace_type !== 'Awaited' && t.trace_type !== 'Normal' && 'Exit' in t.trace_type);
}

function findEnterTrace(traces: Trace[], traceId: string): Trace | undefined {
  return traces.find(t => t.trace_id === traceId && t.trace_type === 'Enter');
}

export default TracesTab;
