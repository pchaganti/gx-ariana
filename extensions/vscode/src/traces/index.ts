import { Trace } from "../bindings/Trace";
import { LightTrace } from "../bindings/LightTrace";

export function traceIsError(trace: Trace): boolean {
    return trace.trace_type !== 'Enter' && trace.trace_type !== 'Legacy' && 'Error' in trace.trace_type;
}

export function traceIsExit(trace: Trace): boolean {
    return trace.trace_type !== 'Enter' && trace.trace_type !== 'Legacy' && 'Exit' in trace.trace_type;
}

export function lightTraceIsError(trace: LightTrace): boolean {
    return trace.trace_type === 'Error';
}

export function lightTraceIsExit(trace: LightTrace): boolean {
    return trace.trace_type === 'Exit';
}