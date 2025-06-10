import React from 'react';
import { useEditorState } from '../hooks/useEditorState';

interface EditorStateDisplayProps {
  className?: string;
}

export function EditorStateDisplay({ className }: EditorStateDisplayProps) {
  const editorState = useEditorState();

  if (!editorState.activeFile) {
    return (
      <div className={className}>
        <h3>Editor State</h3>
        <p>No file is currently open</p>
      </div>
    );
  }

  return (
    <div className={className}>
      <h3>Editor State</h3>
      <div>
        <strong>Active File:</strong>
        <br />
        <code>{editorState.activeFile}</code>
      </div>
      
      {editorState.selection && (
        <div style={{ marginTop: '10px' }}>
          <strong>Selection:</strong>
          <br />
          Lines {editorState.selection.startLine + 1}-{editorState.selection.endLine + 1}
          {editorState.selection.startLine === editorState.selection.endLine && (
            <span>, chars {editorState.selection.startCharacter}-{editorState.selection.endCharacter}</span>
          )}
        </div>
      )}

      {editorState.visibleRange && (
        <div style={{ marginTop: '10px' }}>
          <strong>Visible Range:</strong>
          <br />
          Lines {editorState.visibleRange.startLine + 1}-{editorState.visibleRange.endLine + 1}
        </div>
      )}
    </div>
  );
}
