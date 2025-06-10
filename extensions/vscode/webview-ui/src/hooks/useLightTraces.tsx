import type { LightTrace } from '../bindings/LightTrace';
import { useSharedState } from './shared/useSharedState';

export function useLightTraces() {
  const traces = useSharedState<LightTrace[]>(
    'lightTraces',
    [],
    'lightTraces',
    'getLightTraces'
  );

  return traces;
}
