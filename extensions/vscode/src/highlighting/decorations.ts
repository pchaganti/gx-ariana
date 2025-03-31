import * as vscode from 'vscode';

const baseHighlightDecoration = {
    backgroundColor: 'hsla(120, 80%, 31%, 0.2)',
    borderWidth: '1.5px',
    borderStyle: 'solid',
    borderColor: 'hsla(120, 80%, 31%, 0.5)',
};

const baseErrorDecoration = {
    backgroundColor: 'hsla(0, 80%, 31%, 0.2)',
    borderWidth: '1.5px',
    borderStyle: 'solid',
    borderColor: 'hsla(0, 80%, 31%, 0.5)',
};

// Normal decorations
export const highlightDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseHighlightDecoration,
    borderRadius: '10px',
});

export const highlightInBetweenDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseHighlightDecoration,
    borderRadius: '0px',
});

export const highlightLeftDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseHighlightDecoration,
    borderRadius: '10px 0 0 10px',
});

export const highlightRightDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseHighlightDecoration,
    borderRadius: '0 10px 10px 0',
});

// Error decorations
export const errorDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseErrorDecoration,
    borderRadius: '10px',
});

export const errorInBetweenDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseErrorDecoration,
    borderRadius: '0px',
});

export const errorLeftDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseErrorDecoration,
    borderRadius: '10px 0 0 10px',
});

export const errorRightDecorationType = vscode.window.createTextEditorDecorationType({
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

export const hoverDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseHoverDecoration,
    borderRadius: '10px'
});

export const hoverInBetweenDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseHoverDecoration,
    borderRadius: '0px',
});

export const hoverLeftDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseHoverDecoration,
    borderRadius: '10px 0 0 10px',
});

export const hoverRightDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseHoverDecoration,
    borderRadius: '0 10px 10px 0',
});

// Hover error decorations
export const hoverErrorDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseHoverErrorDecoration,
    borderRadius: '10px'
});

export const hoverErrorInBetweenDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseHoverErrorDecoration,
    borderRadius: '0px',
});

export const hoverErrorLeftDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseHoverErrorDecoration,
    borderRadius: '10px 0 0 10px',
});

export const hoverErrorRightDecorationType = vscode.window.createTextEditorDecorationType({
    ...baseHoverErrorDecoration,
    borderRadius: '0 10px 10px 0',
});

export function clearDecorations(editor: vscode.TextEditor, decoratedRanges: Map<vscode.Range, vscode.TextEditorDecorationType>) {
    decoratedRanges.clear();
    editor.setDecorations(highlightDecorationType, []);
    editor.setDecorations(highlightInBetweenDecorationType, []);
    editor.setDecorations(highlightLeftDecorationType, []);
    editor.setDecorations(highlightRightDecorationType, []);
    editor.setDecorations(hoverDecorationType, []);
    editor.setDecorations(hoverInBetweenDecorationType, []);
    editor.setDecorations(hoverLeftDecorationType, []);
    editor.setDecorations(hoverRightDecorationType, []);
    editor.setDecorations(errorDecorationType, []);
    editor.setDecorations(errorInBetweenDecorationType, []);
    editor.setDecorations(errorLeftDecorationType, []);
    editor.setDecorations(errorRightDecorationType, []);
}