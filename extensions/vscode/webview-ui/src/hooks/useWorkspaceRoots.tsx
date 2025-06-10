import { useSharedState } from './shared/useSharedState';

export function useWorkspaceRoots(): string[] {
  const workspaceRoots = useSharedState<string[]>(
    'workspaceRoots',
    [],
    'workspaceRoots',
    'getWorkspaceRoots',
    (message) => message.value || []
  );

  return workspaceRoots;
}
