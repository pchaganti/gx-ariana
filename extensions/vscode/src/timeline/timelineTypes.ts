import { LightTrace } from '../bindings/LightTrace';
import { Position } from '../bindings/Position';

export type Timeline = {
  clusters: Cluster[];
  spans: Span[]; // all spans across the entire timeline
  families: Family[]; // all families across the entire timeline
  uniqueTimestamps: number[];
  interTimestamps: number[];
  timestampToPosition: Record<number, number>;
}

export type Cluster = {
  label: string;
  rootFamilyIndices: number[]; // indices into Timeline.families
}

export type Family = {
  label: string; // Corresponds to the parent_id of its traces
  parentId: string; // parent_id of its traces, can be "orphan-..." or a traceId
  spansIndices: number[]; // indices into Timeline.spans
  startTimestamp: number;
  endTimestamp: number;
  isStartDefinite: boolean;
  isEndDefinite: boolean;
  patterns?: SpanPattern[];
}

export type Span = {
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

export type SpanPattern = {
  startSpanIndex: number;
  patternLength: number;
  repeats: number;
  sequence: string[];
}
