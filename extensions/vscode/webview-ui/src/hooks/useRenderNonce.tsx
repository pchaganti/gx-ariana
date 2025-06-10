import { useEffect } from 'react';
import { useSharedState } from './shared/useSharedState';
import { setCurrentRenderNonce } from '../utils/timerManagement';

export function useRenderNonce(): string | null {
  const renderNonce = useSharedState<string | null>(
    'renderNonce',
    null,
    'renderNonce',
    'getViewId', // Still triggered by getViewId
    (message) => message.value
  );

  useEffect(() => {
    if (renderNonce) {
      setCurrentRenderNonce(renderNonce);
    }
  }, [renderNonce]);

  return renderNonce;
}
