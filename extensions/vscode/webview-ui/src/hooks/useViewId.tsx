import { useSharedState } from './shared/useSharedState';

export function useViewId(): string | null {
  const viewId = useSharedState<string | null>(
    'viewId',
    null,
    'viewId',
    'getViewId',
    (message) => message.value
  );

  return viewId;
}
