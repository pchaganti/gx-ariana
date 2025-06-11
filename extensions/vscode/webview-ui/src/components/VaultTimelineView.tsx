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
  isStartDefinite: boolean;
  isEndDefinite: boolean;
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
  isStartDefinite: boolean;
  isEndDefinite: boolean;
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
  // TEMPORARY BENCHMARKING CODE - START
  const benchmarkTimings = {
    totalFunctionTime: 0,
    step1_groupTracesByFileParentTrace: 0,
    step2_createAllSpans: 0,
    step3_createAllFamiliesMain: 0,
    step3_totalPatternFindingTime: 0,
    step4_linkDirectChildrenToSpans: 0,
    step5_linkIndirectChildrenToSpans: 0,
    step6_createClustersInitial: 0,
    step6_totalRootFamilySortingTime: 0,
    step7_finalTimestampAssembly: 0,
  };
  const overallStartTime = performance.now();
  // TEMPORARY BENCHMARKING CODE - END

  let startTime = performance.now();
  const allSpans: Span[] = [];
  const allFamilies: Family[] = [];
  const spanMapByTraceId: Record<string, number> = {}; // traceId to index in allSpans

  // 1. Group traces by filepath -> parent_id -> trace_id
  const tracesByFileAndParentAndTrace = lightTraces.reduce((acc, trace) => {
    const { filepath } = trace.start_pos;
    const { parent_id, trace_id } = trace;
    if (!acc[filepath]) { acc[filepath] = {}; }
    if (!acc[filepath][parent_id]) { acc[filepath][parent_id] = {}; }
    if (!acc[filepath][parent_id][trace_id]) { acc[filepath][parent_id][trace_id] = []; }
    acc[filepath][parent_id][trace_id].push(trace);
    return acc;
  }, {} as Record<string, Record<string, Record<string, LightTrace[]>>>);
  benchmarkTimings.step1_groupTracesByFileParentTrace = performance.now() - startTime;
  startTime = performance.now();

  // 2. Create all Spans first
  Object.values(tracesByFileAndParentAndTrace).forEach(tracesByParent => {
    Object.values(tracesByParent).forEach(tracesByTraceId => {
      Object.entries(tracesByTraceId).forEach(([traceId, traceSegments]) => {
        if (spanMapByTraceId[traceId] === undefined) { // Ensure each span is created once
          traceSegments.sort((a, b) => a.timestamp - b.timestamp);
          let enterTrace: LightTrace | null = null;
          let exitTrace: LightTrace | null = null;
          let errorTrace: LightTrace | null = null;

          for (const segment of traceSegments) {
            if (segment.trace_type === 'Enter') {
              if (!enterTrace || segment.timestamp < enterTrace.timestamp) {
                enterTrace = segment;
              }
            }
            if (segment.trace_type === 'Exit') {
              if (!exitTrace || segment.timestamp > exitTrace.timestamp) {
                exitTrace = segment;
              }
            }
            if (segment.trace_type === 'Error') {
              if (!errorTrace || segment.timestamp > errorTrace.timestamp) {
                errorTrace = segment;
              }
            }
          }

          const completionTrace = errorTrace ? (exitTrace && errorTrace.timestamp < exitTrace.timestamp ? exitTrace : errorTrace) : exitTrace;
          const isError = !!errorTrace;

          const isStartDefinite = !!enterTrace;
          const isEndDefinite = !!completionTrace;

          let startTimestamp = 0;
          let endTimestamp = 0;
          let position = enterTrace?.start_pos ?? completionTrace?.start_pos ?? traceSegments[0].start_pos; // Fallback if somehow no enter/completion
          let endLine = position.line; // Placeholder
          let endColumn = position.column; // Placeholder

          if (enterTrace) {
            startTimestamp = enterTrace.timestamp;
            position = enterTrace.start_pos;
          } else if (completionTrace) {
            startTimestamp = completionTrace.timestamp; // Undefined start, use completion time as placeholder
            position = completionTrace.start_pos;
          }

          if (completionTrace) {
            endTimestamp = completionTrace.timestamp;
            endLine = completionTrace.end_pos.line;
            endColumn = completionTrace.end_pos.column;
          } else if (enterTrace) {
            endTimestamp = enterTrace.timestamp; // Undefined end, use enter time as placeholder
            endLine = enterTrace.start_pos.line; // Use start pos for end if no completion
            endColumn = enterTrace.start_pos.column;
          }
          
          // Fallback for location if somehow traceSegments[0] was used for position
          const representativeTraceForLocation = enterTrace ?? completionTrace ?? traceSegments[0];
          const spanLocation = `${representativeTraceForLocation.start_pos.filepath}:${representativeTraceForLocation.start_pos.line}`;

          const newSpan: Span = {
            location: spanLocation,
            traceId: traceId,
            position: position,
            endLine: endLine,
            endColumn: endColumn,
            isError: isError,
            startTimestamp: startTimestamp,
            endTimestamp: endTimestamp,
            isStartDefinite: isStartDefinite,
            isEndDefinite: isEndDefinite,
            childrenFamilyIndices: [],
            indirectChildrenFamilyIndices: [],
            familyIndex: -1, // Will be set later
          };
          spanMapByTraceId[traceId] = allSpans.push(newSpan) - 1;
        }
      });
    });
  });
  benchmarkTimings.step2_createAllSpans = performance.now() - startTime;
  startTime = performance.now();

  // 3. Create all Families
  const familyMapByParentId: Record<string, number> = {}; // parentId to index in allFamilies (for unique family creation)
  const familiesGroupedByParentId: Record<string, number[]> = {}; // parentId to list of familyIndices (for linking children)
  let totalPatternFindingTimeForStep3 = 0;
  Object.entries(tracesByFileAndParentAndTrace).forEach(([filepath, tracesByParent]) => {
    Object.entries(tracesByParent).forEach(([parentId, tracesByTraceId]) => {
      if (familyMapByParentId[parentId] === undefined) { // Ensure each family is created once
        const familySpansIndices: number[] = [];
        let familyStart = Infinity;
        let familyEnd = -Infinity;
        let isFamilyStartDefinite = true;
        let isFamilyEndDefinite = true;

        Object.keys(tracesByTraceId).forEach(traceId => {
          const spanIndex = spanMapByTraceId[traceId];
          if (spanIndex !== undefined) {
            familySpansIndices.push(spanIndex);
            const span = allSpans[spanIndex];
            if (span.startTimestamp < familyStart) { familyStart = span.startTimestamp; }
            if (span.endTimestamp > familyEnd) { familyEnd = span.endTimestamp; }
            if (!span.isStartDefinite) { isFamilyStartDefinite = false; }
            if (!span.isEndDefinite) { isFamilyEndDefinite = false; }
            span.familyIndex = allFamilies.length; // Set family index for the span
          }
        });

        if (familySpansIndices.length > 0) {
          const family: Family = {
            label: `${getRelativePath(filepath, workspaceRoots)} - ${parentId}`,
            parentId: parentId,
            spansIndices: familySpansIndices,
            startTimestamp: familyStart,
            endTimestamp: familyEnd,
            isStartDefinite: isFamilyStartDefinite,
            isEndDefinite: isFamilyEndDefinite,
          };
          const familyIndex = allFamilies.push(family) - 1;

          // Group family by its parentId for quick child lookup later
          if (!familiesGroupedByParentId[parentId]) {
            familiesGroupedByParentId[parentId] = [];
          }
          familiesGroupedByParentId[parentId].push(familyIndex);
          familiesGroupedByParentId[parentId].push(allFamilies.length - 1);
        }
      }
    });
  });

  // Find span patterns for each family
  allFamilies.forEach(family => {
    const familySpanLocations = family.spansIndices.map(idx => allSpans[idx].location);
    const patternStartTime = performance.now();
    family.patterns = findSpanPatterns(familySpanLocations);
    totalPatternFindingTimeForStep3 += (performance.now() - patternStartTime);
  });
  benchmarkTimings.step3_createAllFamiliesMain = (performance.now() - startTime) - totalPatternFindingTimeForStep3;
  benchmarkTimings.step3_totalPatternFindingTime = totalPatternFindingTimeForStep3;
  startTime = performance.now();

  // NEW STEP: Determine overall definite time range for resolving indefinite timestamps
  let overallDefiniteMinTimestamp = Infinity;
  let overallDefiniteMaxTimestamp = -Infinity;

  for (const span of allSpans) {
    if (span.isStartDefinite && span.startTimestamp < overallDefiniteMinTimestamp) {
      overallDefiniteMinTimestamp = span.startTimestamp;
    }
    if (span.isEndDefinite && span.endTimestamp > overallDefiniteMaxTimestamp) {
      overallDefiniteMaxTimestamp = span.endTimestamp;
    }
  }

  // Handle case where there are no definite timestamps at all
  if (overallDefiniteMinTimestamp === Infinity) {
    // Fallback: use any timestamp available
    for (const span of allSpans) {
        if (span.startTimestamp < overallDefiniteMinTimestamp) { overallDefiniteMinTimestamp = span.startTimestamp; }
        if (span.endTimestamp > overallDefiniteMaxTimestamp) { overallDefiniteMaxTimestamp = span.endTimestamp; }
    }
    // If still nothing, set a default range
    if (overallDefiniteMinTimestamp === Infinity) {
        overallDefiniteMinTimestamp = 0;
        overallDefiniteMaxTimestamp = 1;
    }
  }

  // Helper to resolve timestamps to their visual position on the timeline
  function resolveTimestamp(timestamp: number, isDefinite: boolean, isStart: boolean): number {
      if (isDefinite) {
          return timestamp;
      }
      // For indefinite timestamps, push them to the very start or end of the timeline's definite range
      return isStart ? overallDefiniteMinTimestamp - 1 : overallDefiniteMaxTimestamp + 1;
  }

  // 4. Link direct children families to their parent spans
  allSpans.forEach((span) => {
    const directChildrenIndices = familiesGroupedByParentId[span.traceId];
    if (directChildrenIndices) {
      // Assign directly. Assuming childrenFamilyIndices should only contain direct children from this logic.
      // If spans could have children from other sources or if duplicates are an issue from upstream,
      // then a Set or .includes check might be needed, but that would reduce optimization benefits.
      span.childrenFamilyIndices = [...directChildrenIndices];
    }
  });
  benchmarkTimings.step4_linkDirectChildrenToSpans = performance.now() - startTime;
  startTime = performance.now();

  // 5. Link Spans to Indirect Children Families (Simplified based on 'orphan-' parentId rule)
  allSpans.forEach((currentSpan) => {
    const potentialIndirects: { familyIndex: number; gap: number }[] = [];
    allFamilies.forEach((candidateFamily, candidateFamilyIndex) => {
      if (candidateFamily.parentId.startsWith("orphan-") &&
          resolveTimestamp(candidateFamily.startTimestamp, candidateFamily.isStartDefinite, true) >= resolveTimestamp(currentSpan.startTimestamp, currentSpan.isStartDefinite, true) &&
          resolveTimestamp(candidateFamily.endTimestamp, candidateFamily.isEndDefinite, false) <= resolveTimestamp(currentSpan.endTimestamp, currentSpan.isEndDefinite, false) &&
          candidateFamily.spansIndices.length > 0
      ) {
        // This family is an orphan and is temporally contained within the currentSpan.
        // It cannot be a direct child of currentSpan by definition (orphan parentId vs span.traceId).
        const firstSpanOfFamily = allSpans[candidateFamily.spansIndices[0]]; // Assuming spansIndices[0] is valid
        if (firstSpanOfFamily) { // Ensure the span exists
          const gap = Math.min(
            Math.abs(resolveTimestamp(candidateFamily.startTimestamp, candidateFamily.isStartDefinite, true) - resolveTimestamp(currentSpan.startTimestamp, currentSpan.isStartDefinite, true)),
            Math.abs(resolveTimestamp(candidateFamily.endTimestamp, candidateFamily.isEndDefinite, false) - resolveTimestamp(currentSpan.endTimestamp, currentSpan.isEndDefinite, false)),
            Math.abs(resolveTimestamp(firstSpanOfFamily.startTimestamp, firstSpanOfFamily.isStartDefinite, true) - resolveTimestamp(currentSpan.startTimestamp, currentSpan.isStartDefinite, true)) // Gap to the first span of the orphan family
          );
          potentialIndirects.push({ familyIndex: candidateFamilyIndex, gap });
        }
      }
    });
    potentialIndirects.sort((a, b) => a.gap - b.gap);
    currentSpan.indirectChildrenFamilyIndices = potentialIndirects.map(p => p.familyIndex);
  });
  benchmarkTimings.step5_linkIndirectChildrenToSpans = performance.now() - startTime;
  startTime = performance.now();

  // 6. Create Clusters by finding root families (those whose parent span doesn't exist)
  const rootFamilyIndices: number[] = [];
  allFamilies.forEach((family, index) => {
    // A family is a root if its parent span does not exist in the set of all spans.
    if (spanMapByTraceId[family.parentId] === undefined) {
      rootFamilyIndices.push(index);
    }
  });

  const clustersByFilepath: Record<string, Cluster> = {};
  rootFamilyIndices.forEach(rootFamilyIndex => {
    const rootFamily = allFamilies[rootFamilyIndex];
    if (rootFamily.spansIndices.length > 0) {
      const firstSpan = allSpans[rootFamily.spansIndices[0]];
      const filepath = firstSpan.position.filepath;

      if (!clustersByFilepath[filepath]) {
        clustersByFilepath[filepath] = {
          label: getRelativePath(filepath, workspaceRoots),
          rootFamilyIndices: [],
        };
      }
      clustersByFilepath[filepath].rootFamilyIndices.push(rootFamilyIndex);
    }
  });

  const timelineClusters = Object.values(clustersByFilepath);
  benchmarkTimings.step6_createClustersInitial = performance.now() - startTime;
  startTime = performance.now(); // Reset for sorting part

  // Sort root families in each cluster by encompassing score
  let totalRootFamilySortingTimeForStep6 = 0;
  timelineClusters.forEach(cluster => {
    const scoreCalcStartTime = performance.now();
    const scoredRootFamilies = cluster.rootFamilyIndices.map(rootFamilyIndex => {
      const visitedForThisRoot = new Set<number>(); // Fresh set for each root's score calculation
      const score = calculateFamilyEncompassingScore(rootFamilyIndex, allFamilies, allSpans, visitedForThisRoot);
      return { index: rootFamilyIndex, score };
    });
    totalRootFamilySortingTimeForStep6 += (performance.now() - scoreCalcStartTime);

    scoredRootFamilies.sort((a, b) => b.score - a.score); // Sort descending by score
    cluster.rootFamilyIndices = scoredRootFamilies.map(item => item.index);
  });
  benchmarkTimings.step6_totalRootFamilySortingTime = totalRootFamilySortingTimeForStep6;
  startTime = performance.now();

  // 7. Final Timeline Assembly (Timestamps)
  const uniqueTimestamps: number[] = [];
  const allTimestamps = new Set<number>();
  allSpans.forEach(span => {
    allTimestamps.add(resolveTimestamp(span.startTimestamp, span.isStartDefinite, true));
    allTimestamps.add(resolveTimestamp(span.endTimestamp, span.isEndDefinite, false));
  });
  allTimestamps.forEach(ts => {
      if (!uniqueTimestamps.includes(ts)) {
        uniqueTimestamps.push(ts);
      }
    });
  uniqueTimestamps.sort((a, b) => a - b);
  const timestampToPosition: Record<number, number> = {};
  uniqueTimestamps.forEach((timestamp, index) => {
    timestampToPosition[timestamp] = index;
  });
  const interTimestamps = uniqueTimestamps.slice(1).map((timestamp, index) => (timestamp + uniqueTimestamps[index]) / 2);
  benchmarkTimings.step7_finalTimestampAssembly = performance.now() - startTime;
  benchmarkTimings.totalFunctionTime = performance.now() - overallStartTime;

  // TEMPORARY BENCHMARKING CODE - START
  console.log('VaultTimelineView.tsx lightTracesToTimeline BENCHMARKS (ms):');
  Object.entries(benchmarkTimings).forEach(([key, value]) => {
    console.log(`  ${key}: ${value.toFixed(2)}`);
  });
  // TEMPORARY BENCHMARKING CODE - END

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
            if (!family) { return null; } // Should not happen
            
            const spansInFamily = family.spansIndices.map(idx => timeline.spans[idx]).sort((a, b) => a.startTimestamp - b.startTimestamp);
            if (spansInFamily.length === 0) { return null; }

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
