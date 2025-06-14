import { ConstructionTraceTree } from '../bindings/ConstructionTraceTree';
import { useSharedState } from './shared/useSharedState';

export function useConstructionTree() {
  const tree = useSharedState<ConstructionTraceTree | null>(
    'constructionTree',
    null,
    'constructionTree',
    'getConstructionTree'
  );

  return tree;
}
