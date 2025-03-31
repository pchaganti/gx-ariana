import * as vscode from 'vscode';
import type { Trace } from '../bindings/Trace';
import path = require('path');
import { traceIsError, traceIsExit } from '../traces';
import { errorDecorationType, errorInBetweenDecorationType, errorLeftDecorationType, errorRightDecorationType, highlightDecorationType, highlightInBetweenDecorationType, highlightLeftDecorationType, highlightRightDecorationType, hoverDecorationType, hoverErrorDecorationType, hoverErrorInBetweenDecorationType, hoverErrorLeftDecorationType, hoverErrorRightDecorationType, hoverInBetweenDecorationType, hoverLeftDecorationType, hoverRightDecorationType } from './decorations';

export type HighlightedRegion = {
    traces: Trace[];
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

export function highlightRegions(
    editor: vscode.TextEditor,
    regions: Array<HighlightedRegion>,
    decoratedRanges: Map<vscode.Range, vscode.TextEditorDecorationType>
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

    let decorationsStarts: { pos: vscode.Position, region: HighlightedRegion, decType: vscode.TextEditorDecorationType }[] = [];
    let decorationsEnds: { pos: vscode.Position }[] = [];

    // Keep track of which regions and decoration types each range belongs to
    const rangeToRegionMap = new Map<string, { region: HighlightedRegion, decorationType: vscode.TextEditorDecorationType, isError: boolean }>();

    function highlightRegion(regionIndex: number, tree: HighlightedRegionsTree, depth: number = 0): number {
        let region = tree.regions[regionIndex];

        let isError = region.traces.some(trace => {
            return (
                trace.start_pos.line === region.startLine &&
                trace.start_pos.column === region.startCol &&
                trace.end_pos.line === region.endLine &&
                trace.end_pos.column === region.endCol - 1 &&
                traceIsError(trace)
            )
        });

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
                    subDecorationsCount += highlightRegion(nested, tree, depth + 1);
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
            highlightRegion(i, tree);
        }
    });

    decorationsStarts.forEach((dec, i) => {
        let range = new vscode.Range(dec.pos, decorationsEnds[i].pos);
        finalDecorations.get(dec.decType)!.push(range);

        rangeToRegionMap.set(JSON.stringify(rangeToJson(range)), {
            region: dec.region,
            decorationType: dec.decType,
            isError: dec.decType === errorLeftDecorationType || dec.decType === errorRightDecorationType || dec.decType === errorInBetweenDecorationType
        });
    });

    // Apply all decorations
    for (const [decorationType, ranges] of finalDecorations) {
        editor.setDecorations(decorationType, ranges);
    }

    let onHoverAnotherPosition = () => { };

    // Setup hover provider
    let tracesHoverDisposable = vscode.languages.registerHoverProvider('*', {
        provideHover(document, position, token) {
            if (document != editor.document) return
            onHoverAnotherPosition();

            // Check all decorations to find the one containing the hover position
            const containingDecorations = Array.from(rangeToRegionMap.keys())
                .map(rangeStr => jsonToRange(JSON.parse(rangeStr)))
                .filter(range => range.contains(position));

            // Find the region that this decoration is from
            const containingRegions = containingDecorations
                .map(range => rangeToRegionMap.get(JSON.stringify(rangeToJson(range)))!.region)
                .sort((a, b) => {
                    const sizeA = (a.endLine - a.startLine) * 1000 + (a.endCol - a.startCol);
                    const sizeB = (b.endLine - b.startLine) * 1000 + (b.endCol - b.startCol);
                    return sizeB - sizeA;
                });

            if (containingRegions.length > 0) {
                const smallestRegion = containingRegions[containingRegions.length - 1];
                const hasError = smallestRegion.traces.some(trace =>
                    trace.start_pos.line === smallestRegion.startLine + 1 &&
                    trace.start_pos.column === smallestRegion.startCol + 1 &&
                    trace.end_pos.line === smallestRegion.endLine + 1 &&
                    trace.end_pos.column === smallestRegion.endCol &&
                    traceIsError(trace)
                );

                const hoverTypes = hasError ? {
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
                for (const rangeStr of rangeToRegionMap.keys()) {
                    const { region, decorationType, isError } = rangeToRegionMap.get(rangeStr)!;
                    if (isWithinRegion(jsonToRange(JSON.parse(rangeStr)), smallestRegion)) {
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

                let tracesById: { [id: string]: Trace[] } = {};
                for (const trace of smallestRegion.traces) {
                    if (trace.start_pos.line === smallestRegion.startLine &&
                        trace.start_pos.column === smallestRegion.startCol &&
                        trace.end_pos.line === smallestRegion.endLine &&
                        trace.end_pos.column === smallestRegion.endCol - 1) {
                        if (!(trace.trace_id in tracesById)) {
                            tracesById[trace.trace_id] = [];
                        }
                        tracesById[trace.trace_id].push(trace);
                    }
                }

                const sortedTracesById = Object.entries(tracesById).sort((a, b) => {
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
                    const date = new Date(Math.trunc(timestamp * 10e-4 * 10e-3));
                    const ms = Math.trunc((timestamp * 10e-4) % 1000);
                    return date.toLocaleTimeString('en-US', {
                        hour12: false,
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                    }) + ` + ${ms.toString().padStart(3, '0')}ms`;
                };

                const top3Recent = sortedTracesById.slice(-5).map(([traceId, traces]) => {
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

                const howManyAfter = sortedTracesById.length - 3;

                const showDropdownCommandUri = vscode.Uri.parse(`command:ariana.openWebview?${encodeURIComponent(JSON.stringify([
                    sortedTracesById.map(([traceId, _]) => traceId),
                    'trace'
                ]))}`);


                let markdownSring = new vscode.MarkdownString("### 🕵️ Ariana traces\n\n" + `#### [Explore in side panel](${showDropdownCommandUri})\n\n` + top3Recent.join('\n\n') + (howManyAfter > 0 ? `\n\n...and [${howManyAfter} more traces](${showDropdownCommandUri})` : ''));
                markdownSring.isTrusted = true;
                return new vscode.Hover(
                    markdownSring
                );
            }
            return null;
        }
    });

    // Helper function to check if a range is within a region
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

    return tracesHoverDisposable;
}