import React, { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import JsonView from '@microlink/react-json-view';
import type { Trace } from '../bindings/Trace';
import { requestHighlight } from '../lib/highlight';

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

const TraceGroup = ({ traces }: { traces: Trace[] }) => {
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
                            <div className={`font-mono opacity-30`}>
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
        return null;
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
            <div className={"w-full flex flex-col gap-1.5 rounded-md " + (errorTrace ? 'bg-red-700/20' : ' bg-[var(--bg-0)]')}>
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

interface VirtualizedTracesListProps {
  traces: Trace[];
  tracesById: Record<string, Trace[]>;
}

const VirtualizedTracesList: React.FC<VirtualizedTracesListProps> = ({ traces, tracesById }) => {
  const parentRef = useRef<HTMLDivElement>(null);
  
  // Only use the Enter traces for virtualization (one per trace group)
  const enterTraces = traces.filter(t => t.trace_type === 'Enter');
  
  const virtualizer = useVirtualizer({
    count: enterTraces.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // Estimated height for each trace group
    overscan: 5, // Number of items to render outside of the visible area
  });

  if (traces.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-center">
        <p className="mb-2">No traces available</p>
        <p className="text-sm">Run your code with the Ariana CLI to generate traces, or select a previous run from the dropdown above.</p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="flex flex-col gap-3 w-full h-full overflow-y-auto max-h-full pr-4 text-[var(--fg-0)]"
      style={{ overflowY: 'auto' }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
          maxHeight: '100%',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const trace = enterTraces[virtualRow.index];
          const traceGroup = tracesById[trace.trace_id] || [];
          
          return (
            <div
              key={virtualRow.key}
              ref={virtualizer.measureElement}
              data-index={virtualRow.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                padding: '0px 0',
                maxHeight: '100%',
              }}
            >
              <TraceGroup traces={traceGroup} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default VirtualizedTracesList;