import * as vscode from 'vscode';
import { TracesPanel, TracesPanelMode } from "./panels/TracesPanel";
import { formatUriForDB } from './urilHelpers';
import type { Trace } from './bindings/Trace';
import path = require('path');
import { VaultManager } from './vaults/manager';
import { getConfig } from './config';
import { TracesUnderPathRequest } from './bindings/TracesUnderPathRequest';
import * as fs from 'fs/promises';

let tracesData: Trace[] = [];

function traceIsError(trace: Trace): boolean {
    return trace.trace_type !== 'Enter' && trace.trace_type !== 'Awaited' && trace.trace_type !== 'Normal' && 'Error' in trace.trace_type;
}

function traceIsExit(trace: Trace): boolean {
    return trace.trace_type !== 'Enter' && trace.trace_type !== 'Awaited' && trace.trace_type !== 'Normal' && 'Exit' in trace.trace_type;
}

const baseHighlightDecoration = {
    backgroundColor: 'rgba(40, 120, 40, 0.2)',
    borderWidth: '1.5px',
    borderStyle: 'solid',
    borderColor: 'rgba(40, 120, 40, 0.1)',
};

const baseErrorDecoration = {
    backgroundColor: 'rgba(120, 40, 40, 0.2)',
    borderWidth: '1.5px',
    borderStyle: 'solid',
    borderColor: 'rgba(120, 40, 40, 0.1)',
};

// Normal decorations
const highlightDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseHighlightDecoration,
    borderRadius: '10px',
});

const highlightInBetweenDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseHighlightDecoration,
    borderRadius: '0px',
});

const highlightLeftDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseHighlightDecoration,
    borderRadius: '10px 0 0 10px',
});

const highlightRightDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseHighlightDecoration,
    borderRadius: '0 10px 10px 0',
});

// Error decorations
const errorDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseErrorDecoration,
    borderRadius: '10px',
});

const errorInBetweenDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseErrorDecoration,
    borderRadius: '0px',
});

const errorLeftDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseErrorDecoration,
    borderRadius: '10px 0 0 10px',
});

const errorRightDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseErrorDecoration,
    borderRadius: '0 10px 10px 0',
});

// Hover decorations
const baseHoverDecoration = {
    backgroundColor: 'rgba(60, 160, 60, 0.3)',
};

const baseHoverErrorDecoration = {
    backgroundColor: 'rgba(160, 60, 60, 0.3)',
};

const hoverDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseHoverDecoration,
    borderRadius: '10px'
});

const hoverInBetweenDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseHoverDecoration,
    borderRadius: '0px',
});

const hoverLeftDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseHoverDecoration,
    borderRadius: '10px 0 0 10px',
});

const hoverRightDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseHoverDecoration,
    borderRadius: '0 10px 10px 0',
});

// Hover error decorations
const hoverErrorDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseHoverErrorDecoration,
    borderRadius: '10px'
});

const hoverErrorInBetweenDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseHoverErrorDecoration,
    borderRadius: '0px',
});

const hoverErrorLeftDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseHoverErrorDecoration,
    borderRadius: '10px 0 0 10px',
});

const hoverErrorRightDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseHoverErrorDecoration,
    borderRadius: '0 10px 10px 0',
});

export async function activate(context: vscode.ExtensionContext) {
    console.log('Extension is now active 2222');
    const { apiUrl } = getConfig();

    VaultManager.initialize(context);

    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return;
    }
    
    let showTraces = false;

    // Create a command to show the traceback panel
    context.subscriptions.push(
        vscode.commands.registerCommand('ariana.openWebview', (traceIds: string[], mode: TracesPanelMode) => {
            const panel = TracesPanel.render(context.extensionUri, tracesData.filter((trace) => traceIds.find((v) => v === trace.trace_id)), mode, async (file, startLine, startCol, endLine, endCol) => {
                console.log('Highlighting:', file, startLine, startCol, endLine, endCol);
                // Try to use existing editor if it's showing the right file
                // Check all visible editors first
                let editor = vscode.window.visibleTextEditors.find(e => formatUriForDB(e.document.uri) === file);
                if (!editor) {
                    // Open the file if no matching editor is found
                    console.log('Opening file:', file);
                    const doc = await vscode.workspace.openTextDocument(file);
                    editor = await vscode.window.showTextDocument(doc);
                }

                // Reveal and highlight the range
                const range = new vscode.Range(startLine, startCol, endLine, endCol);
                editor.revealRange(range, vscode.TextEditorRevealType.InCenter);
                editor.selection = new vscode.Selection(range.start, range.end);
            });
        })
    );

    let tracesHoverDisposable: vscode.Disposable | undefined;

    // Function to fetch traces for an editor
    async function fetchTracesForEditor(editor: vscode.TextEditor) {
        const document = editor.document;
        console.log('Active document:', document.uri.fsPath);
        tracesHoverDisposable = undefined;
        try {
            const vaultManager = VaultManager.getInstance();
            const vaultSecretKey = await vaultManager.getVaultKey(document.uri.fsPath);

            if (!vaultSecretKey) {
                return;
            }

            const body: TracesUnderPathRequest = {
                filepath: formatUriForDB(document.uri)
            };
            const response = await fetch(`${apiUrl}/vaults/traces/${vaultSecretKey}/under-path`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                console.error('Failed to fetch traces:', response.statusText);
                return;
            }

            const data: Trace[] = await response.json();
            console.log('Traces data:', data.length);
            if (vscode.window.activeTextEditor?.document.uri.toString() === document.uri.toString()) {
                tracesData = data;
            }
        } catch (error) {
            console.error('Error fetching traces:', error);
        }
    }

    let disposable = vscode.commands.registerCommand('ariana.highlightTraces', () => {
        if (!showTraces || !tracesData || tracesData.length === 0) {
            showTraces = true;
            highlightTraces();
        } else {
            showTraces = false;
            unhighlightTraces();
        }
    });

    // Fetch traces for initial active editor
    if (vscode.window.activeTextEditor) {
        if (showTraces) {
            highlightTraces();
        }
    }

    // Listen for editor changes
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
        if (editor) {
            if (showTraces) {
                highlightTraces(editor);
            }
        }
    });

    async function highlightTraces(editor: vscode.TextEditor | undefined = undefined) {
        editor = editor ?? vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Loading traces...",
            cancellable: false
        }, async (progress) => {
            try {
                await fetchTracesForEditor(editor);
                const regions = processTraces(tracesData);
                if (tracesHoverDisposable) {
                    unhighlightTraces(editor);
                }
                tracesHoverDisposable = highlightRegions(editor, regions);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to load traces: ${error}`);
            }
        });
    }

    function unhighlightTraces(editor: vscode.TextEditor | undefined = undefined) {
        editor = editor ?? vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }
        if (tracesHoverDisposable) {
            clearDecorations(editor);
            tracesHoverDisposable.dispose();
            tracesHoverDisposable = undefined;
        }
    }

    function processTraces(tracesData: Trace[]): Array<HighlightedRegion> {
        const uniqueRegions = new Set(tracesData.map(trace => 
            `${trace.start_pos.line},${trace.start_pos.column},${trace.end_pos.line},${trace.end_pos.column}`
        ));

        return Array.from(uniqueRegions).map(regionKey => {
            const [startLine, startCol, endLine, endCol] = regionKey.split(',').map(Number);
            const tracesInRegion = tracesData.filter(trace =>
                trace.start_pos.line >= startLine &&
                trace.start_pos.column >= startCol &&
                trace.end_pos.line <= endLine &&
                trace.end_pos.column <= endCol
            );

            return {
                traces: tracesInRegion,
                startLine,
                startCol,
                endLine,
                endCol: endCol + 1
            };
        }).filter(region => region.traces.length > 0);
    }

    function clearDecorations(editor: vscode.TextEditor) {
        const decorationTypes = [
            highlightDecorationType, highlightInBetweenDecorationType,
            highlightLeftDecorationType, highlightRightDecorationType,
            hoverDecorationType, hoverInBetweenDecorationType,
            hoverLeftDecorationType, hoverRightDecorationType
        ];
        decorationTypes.forEach(type => editor.setDecorations(type, []));
    }

    context.subscriptions.push(disposable);
}

type HighlightedRegion = {
    traces: Trace[];
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
}

type HighlightedRegionsTree = {
    regions: HighlightedRegion[];
    children: number[][];
    parents: (number | null)[];
}

function highlightRegions(editor: vscode.TextEditor, regions: Array<HighlightedRegion>): vscode.Disposable {
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

        let isError = region.traces.some(trace =>
            trace.start_pos.line === region.startLine + 1 &&
            trace.start_pos.column === region.startCol + 1 &&
            trace.end_pos.line === region.endLine + 1 &&
            trace.end_pos.column === region.endCol &&
            traceIsError(trace)
        );

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
        // if no parent
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

    let onHoverSomeoneElse = () => { };

    // Setup hover provider
    let tracesHoverDisposable = vscode.languages.registerHoverProvider('*', {
        provideHover(document, position, token) {
            onHoverSomeoneElse();
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

                onHoverSomeoneElse = () => {
                    editor.setDecorations(hoverTypes.full, []);
                    editor.setDecorations(hoverTypes.left, []);
                    editor.setDecorations(hoverTypes.between, []);
                    editor.setDecorations(hoverTypes.right, []);
                };

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
                    const aTrace = a[1].find(traceIsExit) || a[1].find(traceIsError) || a[1][0];
                    const bTrace = b[1].find(traceIsExit) || b[1].find(traceIsError) || b[1][0];
                    return bTrace.timestamp - aTrace.timestamp;
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

                const top3Recent = sortedTracesById.slice(-3).map(([traceId, traces]) => {
                    const trace = traces.find(traceIsExit) || traces.find(traceIsError) || traces[0];
                    if (traceIsExit(trace)) {
                        return `*[${formatTimestamp(trace.timestamp)}] traced as:* \n\n\`\`\`\n${eclipseText((trace.trace_type as any).Exit.return_value, 300)}`;
                    } else if (traceIsError(trace)) {
                        return `*[${formatTimestamp(trace.timestamp)}] produced error:* \n\n\`\`\`\n${eclipseText((trace.trace_type as any).Error.error_message, 300)}`;
                    } else {
                        return `*[${formatTimestamp(trace.timestamp)}] started evaluating, didn't finish*`;
                    }
                });

                const howManyAfter = sortedTracesById.length - 3;

                const showDropdownCommandUri = vscode.Uri.parse(`command:ariana.openWebview?${encodeURIComponent(JSON.stringify([
                    sortedTracesById.map(([traceId, _]) => traceId),
                    'trace'
                ]))}`);


                let markdownSring =  new vscode.MarkdownString("### 🕵️ Ariana traces\n\n" + `#### [Explore in side panel](${showDropdownCommandUri})\n\n` + top3Recent.join('\n\n') + (howManyAfter > 0 ? `\n\n...and [${howManyAfter} more traces](${showDropdownCommandUri})` : ''));
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

export function deactivate() {
    // DropdownWebview.hide();
    if (vscode.window.activeTextEditor) {
        vscode.window.activeTextEditor.setDecorations(highlightDecorationType, []);
        vscode.window.activeTextEditor.setDecorations(highlightInBetweenDecorationType, []);
        vscode.window.activeTextEditor.setDecorations(highlightLeftDecorationType, []);
        vscode.window.activeTextEditor.setDecorations(highlightRightDecorationType, []);
        vscode.window.activeTextEditor.setDecorations(hoverDecorationType, []);
        vscode.window.activeTextEditor.setDecorations(hoverInBetweenDecorationType, []);
        vscode.window.activeTextEditor.setDecorations(hoverLeftDecorationType, []);
        vscode.window.activeTextEditor.setDecorations(hoverRightDecorationType, []);
        vscode.window.activeTextEditor.setDecorations(errorDecorationType, []);
        vscode.window.activeTextEditor.setDecorations(errorInBetweenDecorationType, []);
        vscode.window.activeTextEditor.setDecorations(errorLeftDecorationType, []);
        vscode.window.activeTextEditor.setDecorations(errorRightDecorationType, []);
    }
}