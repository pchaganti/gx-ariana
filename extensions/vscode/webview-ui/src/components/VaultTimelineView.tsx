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
  uniqueTimestamps: number[];
  interTimestamps: number[];
  timestampToPosition: Record<number, number>;
}

type Cluster = {
  label: string;
  families: Family[]
  subclusters: Cluster[];
}

type Family = {
  label: string;
  spans: Span[]
}

type Span = {
  isError: boolean;
  position: Position;
  endLine: number;
  endColumn: number;
  traceId: string;
  startTimestamp: number;
  endTimestamp: number;
}

function lightTracesToTimeline(lightTraces: LightTrace[], workspaceRoots: string[]): Timeline {
  const tracesByFile = lightTraces.reduce((acc, trace) => {
    if (!acc[trace.start_pos.filepath]) {
      acc[trace.start_pos.filepath] = [];
    }
    acc[trace.start_pos.filepath].push(trace);
    return acc;
  }, {} as Record<string, LightTrace[]>);

  const tracesByFileByFamily = Object.entries(tracesByFile).reduce((acc, [filepath, traces]) => {
    const families = traces.reduce((acc, trace) => {
      let parent_id = trace.parent_id;
      if (!acc[parent_id]) {
        acc[parent_id] = [];
      }
      acc[parent_id].push(trace);
      return acc;
    }, {} as Record<string, LightTrace[]>);
    acc[filepath] = families;
    return acc;
  }, {} as Record<string, Record<string, LightTrace[]>>);

  const tracesByFileByFamilyByTraceId = Object.entries(tracesByFileByFamily).reduce((acc, [filepath, families]) => {
    const familyEntries = Object.entries(families).reduce((acc, [familyId, traces]) => {
      const spans = traces.reduce((acc, trace) => {
        if (!acc[trace.trace_id]) {
          acc[trace.trace_id] = [];
        }
        acc[trace.trace_id].push(trace);
        return acc;
      }, {} as Record<string, LightTrace[]>);
      acc[familyId] = spans;
      return acc;
    }, {} as Record<string, Record<string, LightTrace[]>>);
    acc[filepath] = familyEntries;
    return acc;


  }, {} as Record<string, Record<string, Record<string, LightTrace[]>>>);

  const clusters = Object.entries(tracesByFileByFamilyByTraceId).reduce((acc, [filepath, families]) => {
    const cluster: Cluster = {
      label: getRelativePath(filepath, workspaceRoots),
      families: Object.entries(families).map(([familyId, spans]) => ({
        label: familyId,
        spans: Object.entries(spans).map(([traceId, traces]) => {
          traces.sort((a, b) => a.timestamp - b.timestamp);

          return {
            isError: traces.some(trace => trace.trace_type === 'Error'),
            position: traces[0].start_pos,
            endLine: traces[0].end_pos.line,
            endColumn: traces[0].end_pos.column,
            traceId: traceId,
            startTimestamp: traces[0].timestamp,
            endTimestamp: traces[traces.length - 1].timestamp
          };
        })
      })),
      subclusters: []
    };
    acc.push(cluster);
    return acc;
  }, [] as Cluster[]);

  const uniqueTimestamps: number[] = [];
  const timestampToPosition: Record<number, number> = {};
  clusters.flatMap(cluster => cluster.families.flatMap(family => family.spans.flatMap(span => [span.startTimestamp, span.endTimestamp]))).forEach(timestamp => {
    if (!uniqueTimestamps.includes(timestamp)) {
      uniqueTimestamps.push(timestamp);
    }
  });
  uniqueTimestamps.sort((a, b) => a - b);
  uniqueTimestamps.forEach((timestamp, index) => {
    timestampToPosition[timestamp] = index;
  });

  // interTimestamps are all the time in between uniqueTimestamps
  const interTimestamps = uniqueTimestamps.slice(1).map((timestamp, index) => (timestamp + uniqueTimestamps[index]) / 2);

  console.log("clusters: ", clusters);

  return {
    clusters: clusters,
    uniqueTimestamps: uniqueTimestamps,
    interTimestamps: interTimestamps,
    timestampToPosition: timestampToPosition
  };
}

const TimelineCluster: React.FC<{ timeline: Timeline, cluster: Cluster }> = ({ timeline, cluster }) => {
  const [clusterExpanded, setClusterExpanded] = useState(true);

  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(0);

  useEffect(() => {
    if (ref.current) {
      const { width } = ref.current.getBoundingClientRect();
      console.log('Width:', width);
      setWidth(width);
    }
  }, [ref.current]);

  return (
    <div className="flex flex-col w-full max-w-full">
      <button onClick={() => setClusterExpanded(!clusterExpanded)} className="flex px-1.5 py-0.5 bg-[var(--bg-550)]">
        {cluster.label}
      </button>
      {clusterExpanded && (
        <div className="flex flex-col w-full px-3">
          <div className="w-full" ref={ref}></div>
          {cluster.families.map((family, index) => (
            <div key={index} className='relative h-14 w-full'>
              <div 
                className='absolute top-1/2 -translate-y-1/2 h-6 rounded-2xl bg-[var(--info-subtle)] w-fit'
                style={{
                  left: `${timeline.timestampToPosition[family.spans[0].startTimestamp] / timeline.uniqueTimestamps.length * width}px`,
                  width: `${(timeline.timestampToPosition[family.spans[family.spans.length - 1].endTimestamp] - timeline.timestampToPosition[family.spans[0].startTimestamp] + 1) / timeline.uniqueTimestamps.length * width}px`
                }}
              >
                {family.spans.sort((a, b) => a.startTimestamp - b.startTimestamp).map((span, index, array) => (
                  <div 
                    className={cn(
                      'absolute bg-[var(--info-muted)] h-full cursor-pointer hover:bg-[var(--info-base)] hover:border-2 hover:border-[var(--bg-base)] hover:outline-2 hover:outline-[var(--info-muted)] hover:rounded-2xl',
                      index === 0 && 'rounded-l-2xl',
                      index === array.length - 1 && 'rounded-r-2xl'
                    )}
                    style={{
                      left: `${(timeline.timestampToPosition[span.startTimestamp] / timeline.uniqueTimestamps.length * width) - (timeline.timestampToPosition[family.spans[0].startTimestamp] / timeline.uniqueTimestamps.length * width)}px`,
                      width: `${(timeline.timestampToPosition[span.endTimestamp] - timeline.timestampToPosition[span.startTimestamp] + 1) / timeline.uniqueTimestamps.length * width}px`
                    }}
                    key={index}
                    onMouseEnter={() => {
                      requestHighlight(span.position.filepath, span.position.line, span.position.column, span.endLine, span.endColumn);
                    }}
                    // style={{
                    //   left: `${timeline.timestampToPosition[span.startTimestamp] / timeline.uniqueTimestamps.length * width}px`,
                    //   width: `${(timeline.timestampToPosition[span.endTimestamp] - timeline.timestampToPosition[span.startTimestamp] + 1) / timeline.uniqueTimestamps.length * width}px`
                    // }}
                  >
                    {}
                  </div>
                ))}
              </div>
            </div>
          ))}
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
    const timeline = lightTracesToTimeline(lightTraces, workspaceRoots);
    setTimeline(timeline);
  }, [lightTraces]);

  if (lightTraces.length === 0) {
    return (
      <div className="bg-[var(--bg-base)] flex items-center justify-center w-full h-full text-[var(--fg-base)]">
        No traces recorded yet
      </div>
    );
  }

  if (!timeline) {
    return (
      <div className="bg-[var(--bg-base)] flex items-center justify-center w-full h-full text-[var(--fg-base)]">
        <div className="animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-base)] flex flex-col w-full h-full max-w-full max-h-full text-[var(--fg-base)] overflow-auto">
      {timeline.clusters.map((cluster, index) => (
        <TimelineCluster key={index} timeline={timeline} cluster={cluster} />
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
        Select a Run in the sidebar
      </div>
    );
  }

  return (
    <VaultTimeline />
  );
};

export default VaultTimelineView;
