import React, { useEffect, useRef, useState } from 'react';
import { useFocusedVault } from '../hooks/useFocusedVault';
import { useLightTraces } from '../hooks/useLightTraces';
import { LightTrace } from '../bindings/LightTrace';
import { Position } from '../bindings/Position';

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
  traceId: string;
  startTimestamp: number;
  endTimestamp: number;
}

function lightTracesToTimeline(lightTraces: LightTrace[]): Timeline {
  const tracesByFile = lightTraces.reduce((acc, trace) => {
    if (!acc[trace.start_pos.filepath]) {
      acc[trace.start_pos.filepath] = [];
    }
    acc[trace.start_pos.filepath].push(trace);
    return acc;
  }, {} as Record<string, LightTrace[]>);

  const tracesByFileByFamily = Object.entries(tracesByFile).reduce((acc, [filepath, traces]) => {
    const families = traces.reduce((acc, trace) => {
      if (!acc[trace.parent_id]) {
        acc[trace.parent_id] = [];
      }
      acc[trace.parent_id].push(trace);
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
      label: filepath,
      families: Object.entries(families).map(([familyId, spans]) => ({
        label: familyId,
        spans: Object.entries(spans).map(([traceId, traces]) => {
          traces.sort((a, b) => a.timestamp - b.timestamp);

          return {
            isError: traces.some(trace => trace.trace_type === 'Error'),
            position: traces[0].start_pos,
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
  clusters.flatMap(cluster => cluster.families.flatMap(family => family.spans.flatMap(span => span.startTimestamp))).forEach(timestamp => {
    if (!timestampToPosition[timestamp]) {
      uniqueTimestamps.push(timestamp);
      timestampToPosition[timestamp] = uniqueTimestamps.length - 1;
    }
  });
  uniqueTimestamps.sort((a, b) => a - b);

  // interTimestamps are all the time in between uniqueTimestamps
  const interTimestamps = uniqueTimestamps.slice(1).map((timestamp, index) => (timestamp + uniqueTimestamps[index]) / 2);

  return {
    clusters: clusters,
    uniqueTimestamps: uniqueTimestamps,
    interTimestamps: interTimestamps,
    timestampToPosition: timestampToPosition
  };
}

interface VaultTimelineProps { }

const VaultTimeline: React.FC<VaultTimelineProps> = ({ }) => {
  const lightTraces = useLightTraces();
  const [timeline, setTimeline] = useState<Timeline | null>(null);

  useEffect(() => {
    const timeline = lightTracesToTimeline(lightTraces);
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

  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);

  useEffect(() => {
    if (ref.current) {
      const { width, height } = ref.current.getBoundingClientRect();
      setWidth(width);
      setHeight(height);
    }
  }, [ref]);

  return (
    <div className="bg-[var(--bg-base)] flex flex-col w-full h-full max-w-full max-h-full text-[var(--fg-base)] overflow-hidden" ref={ref}>
      {`${Math.round(width)} x ${Math.round(height)}`}
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
