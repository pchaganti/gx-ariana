import { postMessageToExtension } from "../utils/vscode";

export const requestHighlight = (file: string, startLine: number, startCol: number, endLine: number, endCol: number): void => {
    console.log('Requesting highlight', file, startLine, startCol, endLine, endCol);
    postMessageToExtension({
        command: 'highlight',
        file,
        startLine,
        startCol,
        endLine,
        endCol
    });
};