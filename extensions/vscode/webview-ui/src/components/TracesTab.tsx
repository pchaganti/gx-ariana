import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { Trace } from '../bindings/Trace';
import stateManager from '../utils/stateManager';
import VaultSelector, { VaultHistoryEntry } from './VaultSelector';
import { postMessageToExtension } from '../utils/vscode';
import VirtualizedTracesList from './VirtualizedTracesList';
import SortDropdown from './SortDropdown';
import OnlyErrorsToggle from './OnlyErrorsToggle';

interface TracesTabProps {
  traces: Trace[];
  focusableVaults: VaultHistoryEntry[];
  focusedVault: string | null;
  highlightingToggled: boolean;
  isRefreshingVaults?: boolean;
}

// Helper functions
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

const TracesTab: React.FC<TracesTabProps> = ({ traces, focusableVaults, focusedVault, highlightingToggled, isRefreshingVaults = false }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollPosition, setScrollPosition] = stateManager.usePersistedState<number>('tracesScrollPosition', 0);
  const [copied, setCopied] = useState(false);
  const [sortOrder, setSortOrder] = stateManager.usePersistedState<'asc' | 'desc'>('tracesSortOrder', 'desc');
  const [onlyErrors, setOnlyErrors] = stateManager.usePersistedState<boolean>('tracesOnlyErrors', false);

  // Initialize tracesById
  let tracesById: Record<string, Trace[]> = {};
  traces.forEach(trace => {
    if (!(trace.trace_id in tracesById)) {
      tracesById[trace.trace_id] = [];
    }
    tracesById[trace.trace_id].push(trace);
  });

  // Apply filtering and sorting
  let filteredTraces = traces;
  if (onlyErrors) {
    // Filter to only include traces from groups that have an error
    const traceIdsWithErrors = new Set(
      traces
        .filter(traceIsError)
        .map(trace => trace.trace_id)
    );
    filteredTraces = traces.filter(trace => traceIdsWithErrors.has(trace.trace_id));
  }
  filteredTraces = [...filteredTraces].sort((a, b) => sortOrder === 'asc' ? a.timestamp - b.timestamp : b.timestamp - a.timestamp);

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

  return (
    <div className="flex flex-col h-full max-h-full max-w-full w-full p-4 pr-0 gap-3">
      <div className="flex justify-between gap-3 pr-4 items-end mb-2">
        <div className="flex-grow">
          <VaultSelector
            focusableVaults={focusableVaults}
            focusedVault={focusedVault}
            isRefreshing={isRefreshingVaults}
            onRefresh={() => postMessageToExtension({ command: 'refreshFocusableVaults' })}
          />
        </div>
      </div>
      <div className="flex flex-row flex-wrap gap-2 pr-4 items-center">
        <button
          onClick={() => {
            postMessageToExtension({ command: 'toggleHighlighting' });
          }}
          className={"text-[var(--text-default)] px-3 rounded-md h-8 w-[20ch] cursor-pointer text-sm font-semibold flex-shrink-0 " + (highlightingToggled ? 'bg-[var(--interactive-default)]' : 'bg-[var(--surface-code)]')}
        >
          Traces Overlay: {highlightingToggled ? 'On' : 'Off'}
        </button>
        <OnlyErrorsToggle enabled={onlyErrors} onToggle={() => setOnlyErrors(v => !v)} />
        <SortDropdown value={sortOrder} onChange={setSortOrder} />
        {traces.length > 0 && (
          <button
            onClick={handleCopyAllTraces}
            className={`text-[var(--text-default)] px-3 rounded-md h-8 w-[15ch] cursor-pointer text-sm font-semibold flex-shrink-0 ${copied ? 'bg-[var(--warning-base)]' : ' bg-[var(--surface-code)]'}`}
          >
            {copied ? 'Copied' : '📋 Copy All'}
          </button>
        )}
      </div>
      <div
        ref={containerRef}
        className="w-full max-w-full flex-1 overflow-y-auto scrollbar-w-2"
        onScroll={handleScroll}
      >
        <VirtualizedTracesList
          traces={filteredTraces}
          tracesById={tracesById}
        />
      </div>
    </div>
  );
};

export default TracesTab;