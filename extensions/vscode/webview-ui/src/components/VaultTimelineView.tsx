import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../lib/utils';
import { useFocusedVault } from '../hooks/useFocusedVault';
import { requestHighlight } from '../lib/highlight';
import { Timeline, Cluster, Family, Span } from '../lib/Timeline';
import { useSharedState } from '../hooks/shared/useSharedState';

const SpanComponent: React.FC<{ 
  timeline: Timeline;
  span: Span;
  containerWidth: number;
}> = ({ timeline, span, containerWidth }) => {
  const startPos = timeline.timestampToPosition[span.startTimestamp] ?? 0;
  const endPos = timeline.timestampToPosition[span.endTimestamp] ?? 0;
  
  const spanLeft = (startPos / timeline.uniqueTimestamps.length) * containerWidth;
  const spanWidth = Math.max(
    2,
    ((endPos - startPos + 1) / timeline.uniqueTimestamps.length) * containerWidth
  );

  return (
    <div
      key={span.traceId}
      className={cn(
        'absolute top-1/2 -translate-y-1/2 h-6 bg-[var(--info-muted)] cursor-pointer hover:bg-[var(--info-base)] hover:border-2 hover:border-[var(--bg-base)] hover:outline-2 hover:outline-[var(--info-muted)] rounded-md'
      )}
      style={{
        left: `${spanLeft}px`,
        width: `${spanWidth}px`,
      }}
      title={`Trace ID: ${span.traceId}\nStart: ${span.startTimestamp}\nEnd: ${span.endTimestamp}`}
      onMouseEnter={() => {
        if (span.position) {
          requestHighlight(span.position.filepath, span.position.line, span.position.column, span.endLine, span.endColumn);
        }
      }}
    />
  );
};

const FamilyComponent: React.FC<{ 
  timeline: Timeline;
  family: Family;
  containerWidth: number;
}> = ({ timeline, family, containerWidth }) => {
  const spansInFamily = family.spansIndices
    .map((idx) => timeline.spans[idx])
    .sort((a, b) => a.startTimestamp - b.startTimestamp);

  if (spansInFamily.length === 0) {
    return null;
  }

  return (
    <div className='relative h-14 w-full my-1'>
      {spansInFamily.map((span) => (
        <SpanComponent 
          key={span.traceId} 
          timeline={timeline} 
          span={span} 
          containerWidth={containerWidth} 
        />
      ))}
    </div>
  );
};

const TimelineCluster: React.FC<{ timeline: Timeline; cluster: Cluster }> = ({ timeline, cluster }) => {
  const [clusterExpanded, setClusterExpanded] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState<number>(0);

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
        {cluster.label}
      </button>
      {clusterExpanded && (
        <div className="flex flex-col w-full px-3">
          <div className="w-full h-1" ref={ref}></div>
          {cluster.rootFamilyIndices.map((familyIndex) => {
            const family = timeline.families[familyIndex];
            if (!family) {
              return null;
            }
            return (
              <FamilyComponent
                key={`family-${family.label}-${familyIndex}`}
                timeline={timeline}
                family={family}
                containerWidth={width}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

interface VaultTimelineViewProps {}

const VaultTimelineView: React.FC<VaultTimelineViewProps> = ({}) => {
  const focusedVault = useFocusedVault();
  const timelineData = useSharedState<Timeline | null>('timeline', null, 'timeline-update', 'request-timeline-update');

  if (!focusedVault) {
    return (
      <div className="bg-[var(--bg-base)] flex items-center justify-center w-full h-full text-[var(--fg-base)]">
        Select a Run in the sidebar to view its timeline.
      </div>
    );
  }

  if (!timelineData) {
    return (
      <div className="bg-[var(--bg-base)] flex items-center justify-center w-full h-full text-[var(--fg-base)]">
        <div className="animate-pulse">Computing timeline... or No traces recorded...</div>
      </div>
    );
  }

  if (timelineData.clusters.length === 0) {
    return (
      <div className="bg-[var(--bg-base)] flex items-center justify-center w-full h-full text-[var(--fg-base)]">
        No traces found to display in the timeline.
      </div>
    );
  }

  return (
    <div className="bg-[var(--bg-base)] flex flex-col w-full h-full max-w-full max-h-full text-[var(--fg-base)] overflow-auto">
      {timelineData.clusters.map((cluster, index) =>
        cluster.rootFamilyIndices.length > 0 ? (
          <TimelineCluster key={`${cluster.label}-${index}`} timeline={timelineData} cluster={cluster} />
        ) : null
      )}
    </div>
  );
};

export default VaultTimelineView;
