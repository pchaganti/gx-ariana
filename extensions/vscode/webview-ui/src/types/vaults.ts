import { VaultPublicData } from "../bindings/VaultPublicData";

export interface StoredVaultData extends VaultPublicData {
  dir: string; // Local directory path
}
