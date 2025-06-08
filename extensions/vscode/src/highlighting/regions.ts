import * as vscode from 'vscode';
import type { LightTrace } from '../bindings/LightTrace';
import { lightTraceIsError, lightTraceIsExit, traceIsError, traceIsExit } from '../traces';
import { errorDecorationType, errorInBetweenDecorationType, errorLeftDecorationType, errorRightDecorationType, highlightDecorationType, highlightInBetweenDecorationType, highlightLeftDecorationType, highlightRightDecorationType, hoverDecorationType, hoverErrorDecorationType, hoverErrorInBetweenDecorationType, hoverErrorLeftDecorationType, hoverErrorRightDecorationType, hoverInBetweenDecorationType, hoverLeftDecorationType, hoverRightDecorationType } from './decorations';
import { Trace } from '../bindings/Trace';

export type HighlightedRegion = {
    tracesFittingExactly: LightTrace[];
    ofAllFittingTracesOneIsError: boolean;
    ofAllTracesInsideOneIsError: boolean;
    hoverString: string | null;
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
}

export type HighlightedRegionsTree = {
    regions: HighlightedRegion[];
    children: number[][];
    parents: (number | null)[];
}

type DecorationsStart = {
    pos: vscode.Position,
    region: HighlightedRegion,
    decType: vscode.TextEditorDecorationType
}

type DecorationsEnd = {
    pos: vscode.Position
}

type RegionBlueprint = {
    region: HighlightedRegion,
    decorationType: vscode.TextEditorDecorationType,
    isError: boolean
}

export function highlightRegions(
    editor: vscode.TextEditor,
    regions: Array<HighlightedRegion>
): vscode.Disposable {
    // Sort regions by size (largest first) for proper nesting
    regions.sort((a, b) => {
        const sizeA = (a.endLine - a.startLine) * 1000 + (a.endCol - a.startCol);
        const sizeB = (b.endLine - b.startLine) * 1000 + (b.endCol - b.startCol);
        return sizeB - sizeA;
    });

    // Create final decorations list with both normal and error variants
    const finalDecorations = new Map<vscode.TextEditorDecorationType, vscode.Range[]>([
        [highlightDecorationType, []],
        [highlightLeftDecorationType, []],
        [highlightInBetweenDecorationType, []],
        [highlightRightDecorationType, []],
        [errorDecorationType, []],
        [errorLeftDecorationType, []],
        [errorInBetweenDecorationType, []],
        [errorRightDecorationType, []]
    ]);

    let decorationsStarts: DecorationsStart[] = [];
    let decorationsEnds: DecorationsEnd[] = [];

    // Keep track of which regions and decoration types each range belongs to
    const rangeToRegionBlueprint = new Map<string, RegionBlueprint>();

    let tree: HighlightedRegionsTree = {
        regions: regions,
        children: [],
        parents: regions.map(() => null)
    };

    regions.forEach((region, i) => {
        let children = [];
        for (let j = i + 1; j < regions.length; j++) {
            if (
                region.startLine < regions[j].startLine ||
                (region.startLine === regions[j].startLine && region.startCol <= regions[j].startCol)
            ) {
                if (
                    region.endLine > regions[j].endLine ||
                    (region.endLine === regions[j].endLine && region.endCol >= regions[j].endCol)
                ) {
                    children.push(j);
                    tree.parents[j] = i;
                }
            }
        }
        tree.children.push(children);
    });

    tree.regions.forEach((region, i) => {
        if (tree.parents[i] === null) {
            highlightRegion(editor, i, tree, decorationsStarts, decorationsEnds, 0);
        }
    });

    decorationsStarts.forEach((dec, i) => {
        let range = new vscode.Range(dec.pos, decorationsEnds[i].pos);
        finalDecorations.get(dec.decType)!.push(range);

        rangeToRegionBlueprint.set(JSON.stringify(rangeToJson(range)), {
            region: dec.region,
            decorationType: dec.decType,
            isError: dec.decType === errorLeftDecorationType || dec.decType === errorRightDecorationType || dec.decType === errorInBetweenDecorationType
        });
    });

    // Apply all decorations
    for (const [decorationType, ranges] of finalDecorations) {
        console.log("setting " + ranges.length + " highlighted ranges of type " + decorationType.key);
        editor.setDecorations(decorationType, ranges);
    }

    let onHoverAnotherPosition = () => { };

    // Setup hover provider
    let tracesHoverDisposable = vscode.languages.registerHoverProvider('*', {
        provideHover: (document, position, token) => {
            if (document !== editor.document) {
                return;
            }
            onHoverAnotherPosition();

            const smallestRegionBlueprint = positionToSmallestRegion(position, rangeToRegionBlueprint);
            if (smallestRegionBlueprint) {
                const hoverTypes = smallestRegionBlueprint.isError ? {
                    full: hoverErrorDecorationType,
                    left: hoverErrorLeftDecorationType,
                    between: hoverErrorInBetweenDecorationType,
                    right: hoverErrorRightDecorationType
                } : {
                    full: hoverDecorationType,
                    left: hoverLeftDecorationType,
                    between: hoverInBetweenDecorationType,
                    right: hoverRightDecorationType
                };

                onHoverAnotherPosition = () => {
                    editor.setDecorations(hoverTypes.full, []);
                    editor.setDecorations(hoverTypes.left, []);
                    editor.setDecorations(hoverTypes.between, []);
                    editor.setDecorations(hoverTypes.right, []);
                };

                // Group ranges by decoration type
                const hoverDecorations = new Map<vscode.TextEditorDecorationType, vscode.Range[]>();
                for (const rangeStr of rangeToRegionBlueprint.keys()) {
                    const { region, decorationType, isError } = rangeToRegionBlueprint.get(rangeStr)!;
                    if (isWithinRegion(jsonToRange(JSON.parse(rangeStr)), smallestRegionBlueprint.region)) {
                        let hoverType: vscode.TextEditorDecorationType;
                        if (decorationType === (isError ? errorDecorationType : highlightDecorationType)) {
                            hoverType = hoverTypes.full;
                        } else if (decorationType === (isError ? errorLeftDecorationType : highlightLeftDecorationType)) {
                            hoverType = hoverTypes.left;
                        } else if (decorationType === (isError ? errorInBetweenDecorationType : highlightInBetweenDecorationType)) {
                            hoverType = hoverTypes.between;
                        } else {
                            hoverType = hoverTypes.right;
                        }

                        if (!hoverDecorations.has(hoverType)) {
                            hoverDecorations.set(hoverType, []);
                        }
                        hoverDecorations.get(hoverType)!.push(jsonToRange(JSON.parse(rangeStr)));
                    }
                }

                // Apply hover decorations
                for (const [hoverType, ranges] of hoverDecorations) {
                    editor.setDecorations(hoverType, ranges);
                }

                let markdownSring = new vscode.MarkdownString(smallestRegionBlueprint.region.hoverString ?? 'loading...');
                markdownSring.isTrusted = true;
                return new vscode.Hover(
                    markdownSring
                );
            }
            return null;
        }
    });

    return tracesHoverDisposable;
}

function positionToSmallestRegion(position: vscode.Position, rangeToRegionBlueprint: Map<string, RegionBlueprint>): RegionBlueprint | null {
    const containingDecorationsRanges = Array.from(rangeToRegionBlueprint.keys())
        .map(rangeStr => jsonToRange(JSON.parse(rangeStr)))
        .filter(range => range.contains(position));

    const containingRegionsBlueprints = containingDecorationsRanges
        .map(range => rangeToRegionBlueprint.get(JSON.stringify(rangeToJson(range)))!)
        .sort(({ region: a }, { region: b }) => {
            const sizeA = (a.endLine - a.startLine) * 1000 + (a.endCol - a.startCol);
            const sizeB = (b.endLine - b.startLine) * 1000 + (b.endCol - b.startCol);
            return sizeB - sizeA;
        });

    return containingRegionsBlueprints.length > 0 ? containingRegionsBlueprints[containingRegionsBlueprints.length - 1] : null;
}

function highlightRegion(
    editor: vscode.TextEditor,
    regionIndex: number,
    tree: HighlightedRegionsTree,
    decorationsStarts: Array<{ pos: vscode.Position, region: HighlightedRegion, decType: vscode.TextEditorDecorationType }>,
    decorationsEnds: Array<{ pos: vscode.Position }>,
    depth: number = 0
): number {
    let region = tree.regions[regionIndex];

    let isError = region.tracesFittingExactly.some(lightTraceIsError);

    let line = region.startLine;
    let col = region.startCol;
    let subDecorationsCount = 0;
    while (line <= region.endLine) {
        let lineLength = editor.document.lineAt(line).text.length;
        let nestedCount = 0;
        while (col < (line === region.endLine ? region.endCol : lineLength)) {
            let nested = null;
            for (let childIndex of tree.children[regionIndex]) {
                let child = tree.regions[childIndex];
                if (child.startLine === line && child.startCol === col) {
                    nested = childIndex;
                    nestedCount++;
                    break;
                }
            }
            if (nested) { // if a child starts here, skip till the end of the child
                if (decorationsStarts.length === decorationsEnds.length + 1) { // make sure to close if there was a wip decoration
                    if (line !== region.endLine && line !== region.startLine) {
                        decorationsEnds.push({ pos: new vscode.Position(line, 2) });
                    } else {
                        decorationsEnds.push({ pos: new vscode.Position(line, col) });
                    }
                }
                // let the child handle its own decorations
                subDecorationsCount += highlightRegion(
                    editor,
                    nested,
                    tree,
                    decorationsStarts,
                    decorationsEnds,
                    depth + 1,
                );
                // then skip
                col = tree.regions[nested].endCol;
                line = tree.regions[nested].endLine;
            } else { // if no child on sight
                if (
                    // and if there is no wip decoration
                    decorationsStarts.length === decorationsEnds.length
                    // start one asap, but if you're in between start & end make sure we haven't skipped a nested already
                    // and are aligned with depth
                    && ((line === region.endLine || line === region.startLine) || col === 0)
                ) {
                    // if this is the first decoration, start with a left one
                    // (ps: this cannot happen if we're in between start & end it seems)
                    if (subDecorationsCount === 0) {
                        decorationsStarts.push({ pos: new vscode.Position(line, col), region, decType: isError ? errorLeftDecorationType : highlightLeftDecorationType });
                    } else { // otherwise start with an in-between one
                        decorationsStarts.push({ pos: new vscode.Position(line, col), region, decType: isError ? errorInBetweenDecorationType : highlightInBetweenDecorationType });
                    }
                    subDecorationsCount++;
                }
                col++;
            }
        }
        // if we started something
        if (decorationsStarts.length === decorationsEnds.length + 1) {
            // if it was for lines in between start & end, close it at length 2
            if (line !== region.endLine && line !== region.startLine) {
                decorationsEnds.push({ pos: new vscode.Position(line, 2) });
            } else { // otherwise close it at the end of the line
                decorationsEnds.push({ pos: new vscode.Position(line, col) });
                // if it was the final line, change the latest start to a right one
                if (line === region.endLine && subDecorationsCount > 0) {
                    decorationsStarts[decorationsStarts.length - 1].decType = isError ? errorRightDecorationType : highlightRightDecorationType;
                }
            }
        }
        line++;
        col = 0;
    }
    if (subDecorationsCount === 1) {
        // find the last start and change it to a full one
        decorationsStarts[decorationsStarts.length - 1].decType = isError ? errorDecorationType : highlightDecorationType;
    }

    return subDecorationsCount;
}


export function lightTracesToRegions(
    lightTraces: LightTrace[],
    traceIdsToFullTraces: (traceIds: string[]) => Promise<Trace[] | null>
): Array<HighlightedRegion> {
    const uniqueRegions = new Set(lightTraces.map(trace =>
        `${trace.start_pos.line},${trace.start_pos.column},${trace.end_pos.line},${trace.end_pos.column}`
    ));

    const hoverTracesIds: string[] = [];
    const traceIdToRegionKey: { [traceId: string]: string } = {};
    const regionsByKey: { [regionKey: string]: HighlightedRegion } = {};

    Array.from(uniqueRegions).forEach(regionKey => {
        const [startLine, startCol, endLine, endCol] = regionKey.split(',').map(Number);
        const tracesWithinRegion = lightTraces.filter(trace =>
            trace.start_pos.line >= startLine &&
            trace.start_pos.column >= startCol &&
            trace.end_pos.line <= endLine &&
            trace.end_pos.column <= endCol
        );
        if (tracesWithinRegion.length === 0) {
            return;
        }
        const tracesExactlyInRegion = tracesWithinRegion.filter(trace =>
            trace.start_pos.line === startLine &&
            trace.start_pos.column === startCol &&
            trace.end_pos.line === endLine &&
            trace.end_pos.column === endCol
        );

        const region: HighlightedRegion = {
            tracesFittingExactly: tracesExactlyInRegion,
            ofAllFittingTracesOneIsError: tracesExactlyInRegion.some(lightTraceIsError),
            ofAllTracesInsideOneIsError: tracesWithinRegion.some(lightTraceIsError),
            hoverString: null,
            startLine,
            startCol,
            endLine,
            endCol: endCol + 1
        };

        hoverTracesIds.push(...regionToHoverTraceIds(region));
        tracesExactlyInRegion.forEach(trace => {
            if (!(trace.trace_id in traceIdToRegionKey)) {
                traceIdToRegionKey[trace.trace_id] = regionKey;
            }
        });

        regionsByKey[regionKey] = region;
    });

    console.log("Calling traceIdsToFullTraces with: ", hoverTracesIds);
    traceIdsToFullTraces(hoverTracesIds).then((fullTraces) => {
        console.log("traceIdsToFullTraces returned: ", fullTraces);
        if (!fullTraces) {
            return;
        }
        const topFullTracesPerRegionKey: { [regionKey: string]: Trace[] } = {};
        fullTraces.forEach(trace => {
            const regionKey = traceIdToRegionKey[trace.trace_id];
            if (!(regionKey in topFullTracesPerRegionKey)) {
                topFullTracesPerRegionKey[regionKey] = [];
            }
            topFullTracesPerRegionKey[regionKey].push(trace);
        });

        Object.entries(topFullTracesPerRegionKey).forEach(([regionKey, topFullTraces]) => {
            regionsByKey[regionKey].hoverString = regionAndTopTracesToHoverString(
                regionsByKey[regionKey],
                topFullTraces
            );
        });
    });

    return Object.values(regionsByKey);
}

function regionAndTopTracesToHoverString(region: HighlightedRegion, topTraces: Trace[]): string {
    let spansInRegion: string[] = [];
    for (const trace of region.tracesFittingExactly) {
        if (!spansInRegion.includes(trace.trace_id)) {
            spansInRegion.push(trace.trace_id);
        }
    }

    let topSpans: { [id: string]: Trace[] } = {};
    for (const trace of topTraces) {
        if (!(trace.trace_id in topSpans)) {
            topSpans[trace.trace_id] = [];
        }
        topSpans[trace.trace_id].push(trace);
    }

    const topSpansSortedByRecency = Object.entries(topSpans).sort((a, b) => {
        a[1].sort((aa, ab) => ab.timestamp - aa.timestamp);
        b[1].sort((aa, ab) => ab.timestamp - aa.timestamp);
        const aTrace = a[1][0];
        const bTrace = b[1][0];
        return aTrace.timestamp - bTrace.timestamp;
    });
    
    function eclipseText(text: string, maxLength: number): string {
        if (text.length > maxLength) {
            return text.slice(0, Math.floor(maxLength) - 2) + '\n\`\`\`\n\n**...**';
        } else {
            return text + '\n\`\`\`';
        }
    }

    const formatTimestamp = (timestamp: number) => {
        const timestampSecsTrunc = Math.trunc(timestamp * 10e-9);
        const timestampSubSec = ((timestamp * 10e-9) % 1);
        const date = new Date(timestampSecsTrunc * 1000); // JS expects ms
        const ms = Math.trunc(timestampSubSec * 1000);
        return `${date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        })}.${ms.toString().padStart(3, '0')}`;
    };

    const lines = topSpansSortedByRecency.slice(-5).map(([traceId, traces]) => {
        traces.sort((aa, ab) => aa.timestamp - ab.timestamp);
        const trace = traces.find(traceIsExit) || traces.find(traceIsError) || traces[0];
        if (traceIsExit(trace)) {
            return `*[${formatTimestamp(traces[0].timestamp)}] traced as:* \n\n\`\`\`\n${eclipseText((trace.trace_type as any).Exit.return_value, 300)}`;
        } else if (traceIsError(trace)) {
            return `*[${formatTimestamp(traces[0].timestamp)}] produced error:* \n\n\`\`\`\n${eclipseText((trace.trace_type as any).Error.error_message, 300)}`;
        } else {
            return `*[${formatTimestamp(traces[0].timestamp)}] started evaluating, didn't finish*`;
        }
    }).reverse();

    const howManyAfter = spansInRegion.length - 3;

    return "### 🕵️ Ariana traces\n\n" 
        + lines.join('\n\n') + (howManyAfter > 0 ? `\n\n...and ${howManyAfter} more traces` : '');
}

function regionToHoverTraceIds(region: HighlightedRegion): string[] {
    let spansInRegion: { [id: string]: LightTrace[] } = {};
    for (const trace of region.tracesFittingExactly) {
        if (!(trace.trace_id in spansInRegion)) {
            spansInRegion[trace.trace_id] = [];
        }
        spansInRegion[trace.trace_id].push(trace);
    }

    const spansInRegionSortedByRecency = Object.entries(spansInRegion).sort((a, b) => {
        a[1].sort((aa, ab) => ab.timestamp - aa.timestamp);
        b[1].sort((aa, ab) => ab.timestamp - aa.timestamp);
        const aLightTrace = a[1][0];
        const bLightTrace = b[1][0];
        return aLightTrace.timestamp - bLightTrace.timestamp;
    });

    const topRecent = spansInRegionSortedByRecency.slice(-3).map(([traceId, _]) => traceId).reverse();

    return topRecent;
}

function isWithinRegion(range: vscode.Range, region: HighlightedRegion): boolean {
    return range.start.line >= region.startLine &&
        range.end.line <= region.endLine &&
        (range.start.line > region.startLine || range.start.character >= region.startCol) &&
        (range.end.line < region.endLine || range.end.character <= region.endCol);
}

function rangeToJson(range: vscode.Range): any {
    return {
        start: {
            line: range.start.line,
            character: range.start.character
        },
        end: {
            line: range.end.line,
            character: range.end.character
        }
    };
}

function jsonToRange(json: any): vscode.Range {
    return new vscode.Range(
        json.start.line,
        json.start.character,
        json.end.line,
        json.end.character
    );
}