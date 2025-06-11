import React, { useEffect, useRef, useState } from 'react';
import { useFocusedVault } from '../hooks/useFocusedVault';
import { useLightTraces } from '../hooks/useLightTraces';
import { LightTrace } from '../bindings/LightTrace';
import { Position } from '../bindings/Position';
import { useWorkspaceRoots } from '../hooks/useWorkspaceRoots';
import { getRelativePath } from '../utils/pathUtils';
import { requestHighlight } from '../lib/highlight';
import { cn } from '../lib/utils';

type Timeline = {
  clusters: Cluster[];
  spans: Span[]; // all spans across the entire timeline
  families: Family[]; // all families across the entire timeline
  uniqueTimestamps: number[];
  interTimestamps: number[];
  timestampToPosition: Record<number, number>;
}

type Cluster = {
  label: string;
  rootFamilyIndices: number[]; // indices into Timeline.families
}

type Family = {
  label: string; // Corresponds to the parent_id of its traces
  parentId: string; // parent_id of its traces, can be "orphan-..." or a traceId
  spansIndices: number[]; // indices into Timeline.spans
  startTimestamp: number;
  endTimestamp: number;
  patterns?: SpanPattern[];
}

type Span = {
  isError: boolean;
  position: Position; // start position of the first trace segment
  endLine: number;    // end line of the first trace segment (or last if consolidated) - check usage
  endColumn: number;  // end column of the first trace segment (or last if consolidated) - check usage
  traceId: string;
  location: string; // e.g., filepath:line
  familyIndex: number;
  startTimestamp: number;
  endTimestamp: number;
  childrenFamilyIndices: number[]; // Families directly parented by this span
  indirectChildrenFamilyIndices: number[]; // Families temporally contained within this span
}

type SpanPattern = {
  startSpanIndex: number;
  patternLength: number;
  repeats: number;
  sequence: string[];
}

function sequencesEqual(seq1: string[], seq2: string[]): boolean {
  if (seq1.length !== seq2.length) { return false; }
  for (let i = 0; i < seq1.length; i++) {
    if (seq1[i] !== seq2[i]) { return false; }
  }
  return true;
}

function findSpanPatterns(spanLocations: string[]): SpanPattern[] {
  const foundPatterns: SpanPattern[] = [];
  const n = spanLocations.length;
  let currentIndex = 0;

  while (currentIndex < n) {
    let bestPatternForCurrentIndex: SpanPattern | null = null;

    for (let len = Math.min(100, Math.floor((n - currentIndex) / 2)); len >= 1; len--) {
      if (currentIndex + 2 * len > n) { continue; } // Not enough elements for at least two occurrences

      const currentSequence = spanLocations.slice(currentIndex, currentIndex + len);
      let repeats = 1;
      for (let k = 1; currentIndex + (k + 1) * len <= n; k++) {
        const nextSequenceSlice = spanLocations.slice(currentIndex + k * len, currentIndex + (k + 1) * len);
        if (sequencesEqual(currentSequence, nextSequenceSlice)) {
          repeats++;
        } else {
          break;
        }
      }

      if (repeats > 1) {
        bestPatternForCurrentIndex = {
          startSpanIndex: currentIndex,
          patternLength: len,
          repeats: repeats,
          sequence: currentSequence,
        };
        break; // Found the longest pattern for this currentIndex
      }
    }

    if (bestPatternForCurrentIndex) {
      foundPatterns.push(bestPatternForCurrentIndex);
      currentIndex += bestPatternForCurrentIndex.patternLength * bestPatternForCurrentIndex.repeats;
    } else {
      currentIndex++;
    }
  }
  return foundPatterns;
}

function calculateFamilyEncompassingScore(
  familyIndex: number,
  allFamilies: readonly Family[],
  allSpans: readonly Span[],
  visitedFamilies: Set<number> // To avoid cycles and redundant counting WITHIN A SINGLE ROOT'S SCORE CALCULATION
): number {
  if (visitedFamilies.has(familyIndex)) {
    return 0; // Already counted in this path or cycle detected
  }
  visitedFamilies.add(familyIndex);

  const family = allFamilies[familyIndex];
  if (!family) { return 0; } // Should not happen if indices are correct

  let score = 1; // Count the family itself

  for (const spanIndex of family.spansIndices) {
    const span = allSpans[spanIndex];
    if (!span) { continue; }

    // Direct children
    for (const childFamilyIndex of span.childrenFamilyIndices) {
      score += calculateFamilyEncompassingScore(childFamilyIndex, allFamilies, allSpans, visitedFamilies);
    }
    // Indirect children
    for (const indirectChildFamilyIndex of span.indirectChildrenFamilyIndices) {
      score += calculateFamilyEncompassingScore(indirectChildFamilyIndex, allFamilies, allSpans, visitedFamilies);
    }
  }
  return score;
}

function lightTracesToTimeline(lightTraces: LightTrace[], workspaceRoots: string[]): Timeline {
  const allSpans: Span[] = [];
  const allFamilies: Family[] = [];
  const spanMapByTraceId: Record<string, number> = {}; // traceId to index in allSpans

  // 1. Group traces by filepath -> parent_id -> trace_id
  const tracesByFileAndParentAndTrace = lightTraces.reduce((acc, trace) => {
    const { filepath } = trace.start_pos;
    const { parent_id, trace_id } = trace;
    if (!acc[filepath]) acc[filepath] = {};
    if (!acc[filepath][parent_id]) acc[filepath][parent_id] = {};
    if (!acc[filepath][parent_id][trace_id]) acc[filepath][parent_id][trace_id] = [];
    acc[filepath][parent_id][trace_id].push(trace);
    return acc;
  }, {} as Record<string, Record<string, Record<string, LightTrace[]>>>);

  // 2. Create all Spans first
  Object.values(tracesByFileAndParentAndTrace).forEach(tracesByParent => {
    Object.values(tracesByParent).forEach(tracesByTraceId => {
      Object.entries(tracesByTraceId).forEach(([traceId, traceSegments]) => {
        if (spanMapByTraceId[traceId] === undefined) { // Ensure each span is created once
          traceSegments.sort((a, b) => a.timestamp - b.timestamp);
          const firstSegment = traceSegments[0];
          const lastSegment = traceSegments[traceSegments.length - 1];
          const representativeTraceForLocation = traceSegments.sort((a,b) => a.timestamp - b.timestamp)[0];
          const spanLocation = `${representativeTraceForLocation.start_pos.filepath}:${representativeTraceForLocation.start_pos.line}`;

          const span: Span = {
            location: spanLocation,
            traceId: traceId,
            position: firstSegment.start_pos,
            endLine: firstSegment.end_pos.line, // Or lastSegment.end_pos.line if preferred
            endColumn: firstSegment.end_pos.column, // Or lastSegment.end_pos.column
            isError: traceSegments.some(t => t.trace_type === 'Error'),
            startTimestamp: firstSegment.timestamp,
            endTimestamp: lastSegment.timestamp,
            childrenFamilyIndices: [],
            indirectChildrenFamilyIndices: [],
            familyIndex: -1, // Will be set later
          };
          spanMapByTraceId[traceId] = allSpans.push(span) - 1;
        }
      });
    });
  });

  // 3. Create all Families
  const familyMapByParentId: Record<string, number> = {}; // parent_id to index in allFamilies
  Object.entries(tracesByFileAndParentAndTrace).forEach(([filepath, tracesByParent]) => {
    Object.entries(tracesByParent).forEach(([parentId, tracesByTraceId]) => {
      if (familyMapByParentId[parentId] === undefined) { // Ensure each family is created once
        const familySpanIndices: number[] = [];
        let minStart = Infinity;
        let maxEnd = -Infinity;

        Object.keys(tracesByTraceId).forEach(traceId => {
          const spanIndex = spanMapByTraceId[traceId];
          if (spanIndex !== undefined) {
            familySpanIndices.push(spanIndex);
            const span = allSpans[spanIndex];
            minStart = Math.min(minStart, span.startTimestamp);
            maxEnd = Math.max(maxEnd, span.endTimestamp);
            span.familyIndex = allFamilies.length; // Set family index for the span
          }
        });

        if (familySpanIndices.length > 0) {
          const family: Family = {
            label: parentId, // Or a more descriptive label if needed
            parentId: parentId,
            spansIndices: familySpanIndices,
            startTimestamp: minStart,
            endTimestamp: maxEnd,
          };
          familyMapByParentId[parentId] = allFamilies.push(family) - 1;
        }
      }
    });
  });

  // Find span patterns for each family
  allFamilies.forEach(family => {
    const familySpanLocations = family.spansIndices.map(idx => allSpans[idx].location);
    family.patterns = findSpanPatterns(familySpanLocations);
  });

  // 4. Link Spans to Children Families
  allSpans.forEach((span) => { // Removed spanIndex as it's not used here
    allFamilies.forEach((family, familyIndex) => {
      if (family.parentId === span.traceId) {
        span.childrenFamilyIndices.push(familyIndex);
      }
    });
  });

  // 5. Link Spans to Indirect Children Families
  allSpans.forEach((span) => { // Removed spanIndex as it's not used here
    const potentialIndirects: { familyIndex: number, gap: number }[] = [];
    allFamilies.forEach((family, familyIndex) => {
      if (family.startTimestamp > span.startTimestamp && family.endTimestamp < span.endTimestamp) {
        const gap = ((family.startTimestamp - span.startTimestamp) + (span.endTimestamp - family.endTimestamp)) / 2;
        potentialIndirects.push({ familyIndex, gap });
      }
    });
    potentialIndirects.sort((a, b) => a.gap - b.gap);
    span.indirectChildrenFamilyIndices = potentialIndirects.map(p => p.familyIndex);
  });

  // 6. Create Clusters
  const timelineClusters: Cluster[] = Object.entries(tracesByFileAndParentAndTrace).map(([filepath, tracesByParent]) => {
    const currentClusterRootIndices: number[] = [];
    Object.keys(tracesByParent).forEach(parentId => {
      if (parentId.startsWith("orphan-")) {
        const familyIndex = familyMapByParentId[parentId];
        if (familyIndex !== undefined) {
          // Check if this family truly belongs to this filepath (first span's filepath)
          const family = allFamilies[familyIndex];
          if (family.spansIndices.length > 0) {
            const firstSpanOfFamily = allSpans[family.spansIndices[0]];
            if (firstSpanOfFamily.position.filepath === filepath) {
              if (!currentClusterRootIndices.includes(familyIndex)) { // Avoid duplicates if a parentId could somehow be processed twice for roots
                currentClusterRootIndices.push(familyIndex);
              }
            }
          }
        }
      }
    });
    return {
      label: getRelativePath(filepath, workspaceRoots),
      rootFamilyIndices: currentClusterRootIndices, // Will be sorted later
    };
  });

  // Sort root families in each cluster by encompassing score
  timelineClusters.forEach(cluster => {
    const scoredRootFamilies = cluster.rootFamilyIndices.map(rootFamilyIndex => {
      const visitedForThisRoot = new Set<number>(); // Fresh set for each root's score calculation
      const score = calculateFamilyEncompassingScore(rootFamilyIndex, allFamilies, allSpans, visitedForThisRoot);
      return { index: rootFamilyIndex, score };
    });

    scoredRootFamilies.sort((a, b) => b.score - a.score); // Sort descending by score
    cluster.rootFamilyIndices = scoredRootFamilies.map(item => item.index);
  });

  // 7. Final Timeline Assembly (Timestamps)
  const uniqueTimestamps: number[] = [];
  const timestampToPosition: Record<number, number> = {};
  allSpans.forEach(span => {
    [span.startTimestamp, span.endTimestamp].forEach(ts => {
      if (!uniqueTimestamps.includes(ts)) {
        uniqueTimestamps.push(ts);
      }
    });
  });
  uniqueTimestamps.sort((a, b) => a - b);
  uniqueTimestamps.forEach((timestamp, index) => {
    timestampToPosition[timestamp] = index;
  });
  const interTimestamps = uniqueTimestamps.slice(1).map((timestamp, index) => (timestamp + uniqueTimestamps[index]) / 2);

  return {
    clusters: timelineClusters,
    spans: allSpans,
    families: allFamilies,
    uniqueTimestamps,
    interTimestamps,
    timestampToPosition,
  };
}

const TimelineCluster: React.FC<{ timeline: Timeline, cluster: Cluster }> = ({ timeline, cluster }) => {
  const [clusterExpanded, setClusterExpanded] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(0);

  useEffect(() => {
    if (ref.current) {
      const { width: newWidth } = ref.current.getBoundingClientRect();
      setWidth(newWidth);
    }
    // Add a resize listener if responsive width is needed
    const handleResize = () => {
      if (ref.current) {
        setWidth(ref.current.getBoundingClientRect().width);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []); // Removed ref.current from dependency array as it might cause loop, effect runs once

  return (
    <div className="flex flex-col w-full max-w-full">
      <button onClick={() => setClusterExpanded(!clusterExpanded)} className="flex px-1.5 py-0.5 bg-[var(--bg-550)] sticky top-0 z-10">
        {cluster.label}
      </button>
      {clusterExpanded && (
        <div className="flex flex-col w-full px-3">
          <div className="w-full h-1" ref={ref}></div> {/* Element to measure width, ensure it's part of layout flow */}
          {cluster.rootFamilyIndices.map((familyIndex) => {
            const family = timeline.families[familyIndex];
            if (!family) return null; // Should not happen
            
            const spansInFamily = family.spansIndices.map(idx => timeline.spans[idx]).sort((a, b) => a.startTimestamp - b.startTimestamp);
            if (spansInFamily.length === 0) return null;

            return (
              <div key={`family-${family.label}-${familyIndex}`} className='relative h-14 w-full my-1'>
                {spansInFamily.map((span) => { // Removed spanLocalIndex as it's not used
                  const spanLeft = timeline.timestampToPosition[span.startTimestamp] / timeline.uniqueTimestamps.length * width;
                  const spanWidth = Math.max(2, (timeline.timestampToPosition[span.endTimestamp] - timeline.timestampToPosition[span.startTimestamp] +1) / timeline.uniqueTimestamps.length * width); // Ensure min width for visibility

                  return (
                    <div
                      key={span.traceId}
                      className={cn(
                        'absolute top-1/2 -translate-y-1/2 h-6 bg-[var(--info-muted)] cursor-pointer hover:bg-[var(--info-base)] hover:border-2 hover:border-[var(--bg-base)] hover:outline-2 hover:outline-[var(--info-muted)] rounded-md',
                      )}
                      style={{
                        left: `${spanLeft}px`,
                        width: `${spanWidth}px`,
                      }}
                      title={`Trace ID: ${span.traceId}\nStart: ${span.startTimestamp}\nEnd: ${span.endTimestamp}`}
                      onMouseEnter={() => {
                        requestHighlight(span.position.filepath, span.position.line, span.position.column, span.endLine, span.endColumn);
                      }}
                    >
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};


interface VaultTimelineProps { }

const VaultTimeline: React.FC<VaultTimelineProps> = ({ }) => {
  const lightTraces = useLightTraces();
  const [timeline, setTimeline] = useState<Timeline | null>(null);
  const workspaceRoots = useWorkspaceRoots();

  useEffect(() => {
    if (lightTraces && lightTraces.length > 0 && workspaceRoots && workspaceRoots.length > 0) {
      const newTimeline = lightTracesToTimeline(lightTraces, workspaceRoots);
      setTimeline(newTimeline);
    } else if (lightTraces.length === 0) {
        setTimeline(null); // Clear timeline if no traces
    }
  }, [lightTraces, workspaceRoots]);

  if (lightTraces.length === 0) {
    return (
      <div className="bg-[var(--bg-base)] flex items-center justify-center w-full h-full text-[var(--fg-base)]">
        No traces recorded for the selected run.
      </div>
    );
  }

  if (!timeline) {
    return (
      <div className="bg-[var(--bg-base)] flex items-center justify-center w-full h-full text-[var(--fg-base)]">
        <div className="animate-pulse">Loading timeline...</div>
      </div>
    );
  }
  
  if (timeline.clusters.every(c => c.rootFamilyIndices.length === 0)) {
     return (
      <div className="bg-[var(--bg-base)] flex items-center justify-center w-full h-full text-[var(--fg-base)]">
        No top-level (orphan) traces found to display in the timeline.
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-base)] flex flex-col w-full h-full max-w-full max-h-full text-[var(--fg-base)] overflow-auto">
      {timeline.clusters.map((cluster, index) => (
        cluster.rootFamilyIndices.length > 0 && // Only render cluster if it has root families
        <TimelineCluster key={`${cluster.label}-${index}`} timeline={timeline} cluster={cluster} />
      ))}
    </div>
  );
};

interface VaultTimelineViewProps { }

const VaultTimelineView: React.FC<VaultTimelineViewProps> = ({ }) => {
  const { focusedVault } = useFocusedVault();

  if (!focusedVault) {
    return (
      <div className="bg-[var(--bg-base)] flex items-center justify-center w-full h-full text-[var(--fg-base)]">
        Select a Run in the sidebar to view its timeline.
      </div>
    );
  }

  return (
    <VaultTimeline />
  );
};

export default VaultTimelineView;
