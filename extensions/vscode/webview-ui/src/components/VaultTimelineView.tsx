import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../lib/utils';
import { useFocusedVault } from '../hooks/useFocusedVault';
import { requestHighlight } from '../lib/highlight';
import { useConstructionTree } from '../hooks/useConstructionTree';
import { ConstructionTraceTree } from '../bindings/ConstructionTraceTree';
import { getRelativePath } from '../utils/pathUtils';
import { useWorkspaceRoots } from '../hooks/useWorkspaceRoots';
import { Timestamp } from '../bindings/Timestamp';

function resolveTimestamp(timeline: { min_ts: number; max_ts: number; }, timestamp: Timestamp, isStart: boolean): number {
  if (timestamp === 'Unknown') {
    return isStart ? timeline.min_ts : timeline.max_ts;
  }
  return timestamp.Known;
}

const SpanComponent: React.FC<{ 
  timeline: Timeline;
  spanId: string;
  containerWidth: number;
}> = ({ timeline, spanId, containerWidth }) => {
  const span = timeline.spans[spanId];
  if (!span) {
    return null;
  }

  const startTimestamp = resolveTimestamp(timeline, span.start, true);
  const endTimestamp = resolveTimestamp(timeline, span.end, false);

  const timelineStartPos = timeline.timestampsToTimelinePosition.get(startTimestamp) ?? -1;
  const timelineEndPos = timeline.timestampsToTimelinePosition.get(endTimestamp) ?? -1;
  
  if (timelineStartPos === -1 || timelineEndPos === -1) {
    return null;
  }
  
  const spanLeft = (timelineStartPos / timeline.timestampsToTimelinePosition.size) * containerWidth;
  const spanWidth = Math.max(
    2,
    ((timelineEndPos - timelineStartPos + 1) / timeline.timestampsToTimelinePosition.size) * containerWidth
  );

  const traces = timeline.spansToTraces.get(spanId);
  if (!traces) {
    return null;
  }

  const enterTrace = timeline.traces.items[traces.enter];

  const startPosition = enterTrace.start_pos;
  const endPosition = enterTrace.end_pos;

  return (
    <div
      key={spanId}
      className={cn(
        'absolute top-1/2 -translate-y-1/2 h-6 bg-[var(--info-muted)] cursor-pointer hover:bg-[var(--info-base)] hover:border-2 hover:border-[var(--bg-base)] hover:outline-2 hover:outline-[var(--info-muted)] rounded-md'
      )}
      style={{
        left: `${spanLeft}px`,
        width: `${spanWidth}px`,
      }}
      title={`${startPosition.filepath}:${startPosition.line}:${startPosition.column} - ${endPosition.filepath}:${endPosition.line}:${endPosition.column}. ${timelineStartPos} - ${timelineEndPos} ${startTimestamp} - ${endTimestamp}`}
      onMouseEnter={() => {
        requestHighlight(startPosition.filepath, startPosition.line, startPosition.column, endPosition.line, endPosition.column);
      }}
    />
  );
};

const FamilyComponent: React.FC<{ 
  timeline: Timeline;
  familyId: string;
  containerWidth: number;
}> = ({ timeline, familyId, containerWidth }) => {
  const spans = timeline.familiesToSpans.get(familyId);
  if (!spans || spans.size === 0) {
    return null;
  }

  return (
    <div className='relative h-14 w-full my-1'>
      {spans.values().map((spanId, index) => (
        <SpanComponent 
          key={index} 
          timeline={timeline} 
          spanId={spanId} 
          containerWidth={containerWidth} 
        />
      ))}
    </div>
  );
};

const TimelineCluster: React.FC<{ timeline: Timeline; filepath: string }> = ({ timeline, filepath }) => {
  const [clusterExpanded, setClusterExpanded] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(0);
  const workspaceRoots = useWorkspaceRoots();

  useEffect(() => {
    const updateWidth = () => {
      if (ref.current) {
        setWidth(ref.current.getBoundingClientRect().width);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  return (
    <div className="flex flex-col w-full max-w-full">
      <button
        onClick={() => setClusterExpanded(!clusterExpanded)}
        className="flex px-1.5 py-0.5 bg-[var(--bg-550)] sticky top-0 z-10"
      >
        {getRelativePath(filepath, workspaceRoots)}
      </button>
      {clusterExpanded && (
        <div className="flex flex-col w-full px-3">
          <div className="w-full h-1" ref={ref}></div>
          {timeline.filesToFamilies.get(filepath)?.values().map((familyId, index) => {
            const orphan = timeline.orphan_families_with_no_indirect_parent.includes(familyId);
            if (!orphan) {
              return null;
            }
            return (
              <FamilyComponent
                key={index}
                timeline={timeline}
                familyId={familyId}
                containerWidth={width}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

type Timeline = ConstructionTraceTree & {
  spansToTraces: Map<string, {
    enter: number,
    exitOrError: number
  }>;
  filesToFamilies: Map<string, Set<string>>;
  familiesToSpans: Map<string, Set<string>>;
  timestampsToTimelinePosition: Map<number, number>;
};

interface VaultTimelineViewProps {}

const VaultTimelineView: React.FC<VaultTimelineViewProps> = ({}) => {
  const focusedVault = useFocusedVault();
  const tree = useConstructionTree();

  if (!focusedVault) {
    return (
      <div className="bg-[var(--bg-base)] flex items-center justify-center w-full h-full text-[var(--fg-base)]">
        Select a Run in the sidebar to view its timeline.
      </div>
    );
  }

  if (!tree) {
    return (
      <div className="bg-[var(--bg-base)] flex items-center justify-center w-full h-full text-[var(--fg-base)]">
        <div className="animate-pulse">Computing timeline... or No traces recorded...</div>
      </div>
    );
  }

  if (Object.keys(tree.orphan_families).length === 0) {
    return (
      <div className="bg-[var(--bg-base)] flex items-center justify-center w-full h-full text-[var(--fg-base)]">
        No traces found to display in the timeline.
      </div>
    );
  }

  let spansToTraces: Map<string, {
    enter: number,
    exitOrError: number
  }> = new Map();

  tree.traces.items.forEach((trace, index) => {
    const existing = spansToTraces.get(trace.trace_id);
    spansToTraces.set(trace.trace_id, {
      enter: trace.trace_type === "Enter" ? index : existing?.enter ?? -1,
      exitOrError: trace.trace_type === "Exit" || trace.trace_type === "Error" ? index : existing?.exitOrError ?? -1
    });
  });

  let familiesToSpans: Map<string, Set<string>> = new Map();
  let filesToFamilies: Map<string, Set<string>> = new Map();
  let uniqueTimestamps: Set<number> = new Set();
  uniqueTimestamps.add(tree.min_ts);
  uniqueTimestamps.add(tree.max_ts);

  spansToTraces.entries().forEach(([traceId, { enter, exitOrError }]) => {
    const trace = tree.traces.items[enter];
    const span = tree.spans[traceId];
    const exitOrErrorTrace = tree.traces.items[exitOrError];
    if (trace && span) {
      const familyId = trace.parent_id;
      if (!familiesToSpans.has(familyId)) {
        familiesToSpans.set(familyId, new Set());
      }
      familiesToSpans.get(familyId)!.add(traceId);

      if (!filesToFamilies.has(trace.start_pos.filepath)) {
        filesToFamilies.set(trace.start_pos.filepath, new Set());
      }
      filesToFamilies.get(trace.start_pos.filepath)!.add(familyId);

      const startTimestamp = resolveTimestamp(tree, span.start, true);
      const endTimestamp = resolveTimestamp(tree, span.end, false);

      uniqueTimestamps.add(startTimestamp);
      uniqueTimestamps.add(endTimestamp);
    }
  });

  const sortedTimestamps = Array.from(uniqueTimestamps).sort((a, b) => a - b);
  const timestampsToTimelinePosition: Map<number, number> = new Map();
  sortedTimestamps.forEach((timestamp, index) => {
    timestampsToTimelinePosition.set(timestamp, index);
  });

  let timeline: Timeline = {
    ...tree,
    spansToTraces,
    filesToFamilies,
    familiesToSpans,
    timestampsToTimelinePosition,
  };

  console.log('timeline', timeline);

  return (
    <div className="bg-[var(--bg-base)] flex flex-col w-full h-full max-w-full max-h-full text-[var(--fg-base)] overflow-auto">
      {timeline.filesToFamilies.keys().map((filepath, index) =>
        <TimelineCluster key={index} timeline={timeline} filepath={filepath} />
      )}
    </div>
  );
};

export default VaultTimelineView;