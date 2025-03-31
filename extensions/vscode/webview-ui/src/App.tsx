import { PropsWithChildren, useEffect, useRef, useState } from 'react';
import { ChevronRight, ChevronDown, X } from 'lucide-react';
import JsonView from 'react-json-view';
import type { Trace } from './bindings/Trace';

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

// type PinedVariable = { name: string, anonymous: boolean, traceId: string, valueJson: string };
type HighlightRequest = (file: string, startLine: number, startCol: number, endLine: number, endCol: number) => void;
// type PinVariable = (variable: PinedVariable) => void;

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
                }} className="font-mono opacity-60 w-[14ch] text-left hover:bg-gray-600/50 cursor-pointer">
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
                        <div className={`font-mono opacity-30 ${traceIsError(exitOrErrorTrace) ? 'text-red-500' : ''}`}>
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

    if (!enterTrace) return(<></>);

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

        console.log(parsedValue);
        
        return (
            <div className="w-full flex flex-col gap-1 p-3 border-b border-gray-600/50">
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
                                    return <span className="font-mono text-gray-500">undefined</span>;
                                case 'function':
                                    return <span className="font-mono text-blue-400">[Function]</span>;
                                case 'symbol':
                                    return <span className="font-mono text-green-400">{parsedValue.toString()}</span>;
                                case 'object':
                                    if (parsedValue === null) {
                                        return (
                                            <span className="font-mono text-red-500">
                                                null/None
                                            </span>
                                        );
                                    }
                                    if (JSON.stringify(parsedValue) === '{}') {
                                        return <span className="font-mono text-gray-500">{String(parsedValue)}</span>;
                                    }
                                    return (
                                        <JsonView
                                            src={parsedValue}
                                            theme="twilight"
                                        />
                                    );
                                default:
                                    return <span className="font-mono text-red-400">[Unknown Type]</span>;
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
}

const App = () => {
    const [traces, setTraces] = useState<Trace[]>([]);
    const [requestHighlight, setRequestHighlight] = useState<HighlightRequest>(() => { });

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const { traces } = event.data;
            setTraces(traces);
        };

        const vscode = acquireVsCodeApi();

        const requestHighlight: HighlightRequest = (file, startLine, startCol, endLine, endCol) => {
            console.log('Requesting highlight', file, startLine, startCol, endLine, endCol);
            vscode.postMessage({
                command: 'highlight',
                file,
                startLine,
                startCol,
                endLine,
                endCol
            });
        };
        setRequestHighlight(() => requestHighlight);

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    let tracesById: Record<string, Trace[]> = {};
    traces.forEach(trace => {
        if (!(trace.trace_id in tracesById)) {
            tracesById[trace.trace_id] = [];
        }
        tracesById[trace.trace_id].push(trace);
    });

    traces.sort((a, b) => b.timestamp - a.timestamp);

    return (
        <div className="flex flex-col py-1" style={{ height: '98vh', width: '100%' }}>
            <div className={"flex flex-col gap-2 w-full max-w-full h-full overflow-y-auto"}>
                {traces.filter(t => t.trace_type === 'Enter').map((trace, i) => (
                    <TraceGroup key={i} traces={tracesById[trace.trace_id] ?? []} requestHighlight={requestHighlight} />
                ))}
            </div>
        </div>
    );
};

export default App;

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
    return traces.find(t => t.trace_id === traceId && traceIsExit(t));
}

function findEnterTrace(traces: Trace[], traceId: string): Trace | undefined {
    return traces.find(t => t.trace_id === traceId && t.trace_type === 'Enter');
}