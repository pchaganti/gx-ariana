import { Trace } from "../bindings/Trace";

export function traceIsError(trace: Trace): boolean {
    return trace.trace_type !== 'Enter' && trace.trace_type !== 'Awaited' && trace.trace_type !== 'Normal' && 'Error' in trace.trace_type;
}

export function traceIsExit(trace: Trace): boolean {
    return trace.trace_type !== 'Enter' && trace.trace_type !== 'Awaited' && trace.trace_type !== 'Normal' && 'Exit' in trace.trace_type;
}