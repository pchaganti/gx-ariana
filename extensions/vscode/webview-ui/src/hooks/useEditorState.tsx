import { useSharedState } from './shared/useSharedState';

export interface EditorState {
  /** Currently active file path, or null if no file is open */
  activeFile: string | null;
  /** Selected text range, or null if no selection */
  selection: {
    startLine: number;
    startCharacter: number;
    endLine: number;
    endCharacter: number;
  } | null;
  /** Currently visible line range in the editor */
  visibleRange: {
    startLine: number;
    endLine: number;
  } | null;
}

const initialEditorState: EditorState = {
  activeFile: null,
  selection: null,
  visibleRange: null,
};

export function useEditorState(): EditorState {
  const editorState = useSharedState<EditorState>(
    'editorState',
    initialEditorState,
    'editorState',
    'getEditorState',
    (message) => message.value || initialEditorState
  );

  return editorState;
}
