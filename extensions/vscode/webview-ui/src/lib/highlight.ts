import { postMessageToExtension } from "../utils/vscode";

export const requestHighlight = (file: string, startLine: number, startCol: number, endLine: number, endCol: number): void => {
    console.log('Requesting highlight', file, startLine, startCol, endLine, endCol);
    postMessageToExtension({
        command: 'highlightCode',
        file,
        startLine: startLine + 1,
        startCol: startCol + 1,
        endLine: endLine + 1,
        endCol: endCol + 2
    });
};