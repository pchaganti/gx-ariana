import type { ArianaCliStatus } from '../lib/cli';
import { useSharedState } from './shared/useSharedState';

export function useCliStatus() {
  const cliStatus = useSharedState<ArianaCliStatus | null>(
    'cliStatus',
    null,
    'arianaCliStatus',
    'getArianaCliStatus'
  );

  return cliStatus;
}
