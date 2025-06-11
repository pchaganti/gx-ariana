import { LightTrace } from "../bindings/LightTrace";
import { Family, Span, SpanPattern, Timeline } from "./timelineTypes";

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

export function lightTracesToTimeline(lightTraces: LightTrace[]): Timeline {
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

                    const startTrace = enterTrace || errorTrace || exitTrace;
                    if (startTrace) {
                        const spanIndex = allSpans.length;
                        spanMapByTraceId[traceId] = spanIndex;
                        allSpans.push({
                            isError: !!errorTrace,
                            position: startTrace.start_pos,
                            endLine: startTrace.end_pos.line,
                            endColumn: startTrace.end_pos.column,
                            traceId: traceId,
                            location: `${startTrace.start_pos.filepath}:${startTrace.start_pos.line}`,
                            familyIndex: -1, // To be updated
                            isStartDefinite: !!enterTrace,
                            isEndDefinite: !!exitTrace,
                            startTimestamp: enterTrace?.timestamp || errorTrace?.timestamp || exitTrace!.timestamp,
                            endTimestamp: exitTrace?.timestamp || errorTrace?.timestamp || enterTrace!.timestamp,
                            childrenFamilyIndices: [],
                            indirectChildrenFamilyIndices: [],
                        });
                    }
                }
            });
        });
    });

    // 3. Create all Families
    const familyMapByParentId: Record<string, number> = {}; // parentId to index in allFamilies
    Object.values(tracesByFileAndParentAndTrace).forEach(tracesByParent => {
        Object.entries(tracesByParent).forEach(([parentId, tracesByTraceId]) => {
            if (familyMapByParentId[parentId] === undefined) {
                const familyIndex = allFamilies.length;
                familyMapByParentId[parentId] = familyIndex;

                const familySpansIndices = Object.keys(tracesByTraceId)
                    .map(traceId => spanMapByTraceId[traceId])
                    .filter(index => index !== undefined);

                const familySpans = familySpansIndices.map(i => allSpans[i]);
                familySpans.sort((a, b) => a.startTimestamp - b.startTimestamp);

                const firstSpan = familySpans[0];
                const lastSpan = familySpans[familySpans.length - 1];

                const family: Family = {
                    label: parentId,
                    parentId: parentId,
                    spansIndices: familySpans.map(s => allSpans.indexOf(s)),
                    startTimestamp: firstSpan ? firstSpan.startTimestamp : 0,
                    endTimestamp: lastSpan ? lastSpan.endTimestamp : 0,
                    isStartDefinite: firstSpan ? firstSpan.isStartDefinite : false,
                    isEndDefinite: lastSpan ? lastSpan.isEndDefinite : false,
                };

                const spanLocations = family.spansIndices.map(i => allSpans[i].location);
                family.patterns = findSpanPatterns(spanLocations);

                allFamilies.push(family);

                family.spansIndices.forEach(spanIndex => {
                    allSpans[spanIndex].familyIndex = familyIndex;
                });
            }
        });
    });

    // 4. Link direct children to spans
    allSpans.forEach(span => {
        const childFamilyIndex = familyMapByParentId[span.traceId];
        if (childFamilyIndex !== undefined) {
            span.childrenFamilyIndices.push(childFamilyIndex);
        }
    });

    // 5. Link indirect children to spans
    allSpans.forEach(span => {
        Object.entries(familyMapByParentId).forEach(([familyParentId, familyIndex]) => {
            if (familyParentId.startsWith('orphan-')) { return; } // Skip orphan families
            if (span.childrenFamilyIndices.includes(familyIndex)) { return; } // Already a direct child
            if (familyParentId === span.traceId) { return; } // The family is a direct child of this span

            const family = allFamilies[familyIndex];
            if (family.startTimestamp > span.startTimestamp && family.endTimestamp < span.endTimestamp) {
                span.indirectChildrenFamilyIndices.push(familyIndex);
            }
        });
    });

    // 6. Create clusters
    const rootFamilies = allFamilies.filter(f => f.parentId.startsWith('orphan-'));
    const rootFamilyIndices = rootFamilies.map(f => allFamilies.indexOf(f));
    rootFamilyIndices.sort((aIndex, bIndex) => {
        const scoreA = calculateFamilyEncompassingScore(aIndex, allFamilies, allSpans, new Set());
        const scoreB = calculateFamilyEncompassingScore(bIndex, allFamilies, allSpans, new Set());
        return scoreB - scoreA; // Sort descending by score
    });

    const clusters = [{
        label: 'All Traces',
        rootFamilyIndices: rootFamilyIndices,
    }];

    // 7. Final timestamp assembly
    const allTimestamps = allSpans.flatMap(s => [s.startTimestamp, s.endTimestamp]);
    const uniqueTimestamps = [...new Set(allTimestamps)].sort((a, b) => a - b);
    const interTimestamps = [];
    for (let i = 0; i < uniqueTimestamps.length - 1; i++) {
        interTimestamps.push((uniqueTimestamps[i] + uniqueTimestamps[i + 1]) / 2);
    }

    const timestampToPosition: Record<number, number> = {};
    uniqueTimestamps.forEach((ts, i) => timestampToPosition[ts] = i);

    return {
        clusters,
        spans: allSpans,
        families: allFamilies,
        uniqueTimestamps,
        interTimestamps,
        timestampToPosition,
    };
}
