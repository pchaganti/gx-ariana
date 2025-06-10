import { StoredVaultData } from '../types/vaults';
import { useSharedState } from './shared/useSharedState';

export function useFocusedVault() {
  const focusedVault = useSharedState<StoredVaultData | null>(
    'focusedVault',
    null,
    'focusedVault',
    'getFocusedVault'
  );

  return { focusedVault };
}
