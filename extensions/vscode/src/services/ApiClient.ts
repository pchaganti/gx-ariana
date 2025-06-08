import { Trace } from '../bindings/Trace';
import { VaultPublicData } from '../bindings/VaultPublicData';
import { GetVaultsBySecretKeysRequest } from '../bindings/GetVaultsBySecretKeysRequest';
import { BatchTracesDetailsRequest } from '../bindings/BatchTracesDetailsRequest';
import { getConfig } from '../config';

/**
 * Fetches full trace details from the server for a given set of trace IDs.
 * @param vaultSecretKey The secret key of the vault.
 * @param traceIds An array of trace IDs to fetch details for.
 * @returns A promise that resolves to an array of Trace objects or null if an error occurs.
 */
export async function fetchFullTraces(vaultSecretKey: string, traceIds: string[]): Promise<Trace[] | null> {
    if (traceIds.length === 0) {
        console.log('fetchFullTraces called with empty traceIds, returning empty array.');
        return [];
    }

    const apiUrl = getConfig().apiUrl;
    const endpoint = `${apiUrl}/vaults/traces/${vaultSecretKey}/batch_details`;

    const payload: BatchTracesDetailsRequest = {
        trace_ids: traceIds,
    };

    console.log(`ArianaApiClient: Fetching ${traceIds.length} full traces from ${endpoint} for vault ${vaultSecretKey}`);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            console.error(`ArianaApiClient: Error fetching full traces for ${vaultSecretKey}: ${response.status} ${response.statusText}`);
            try {
                const errorBody = await response.json();
                console.error('ArianaApiClient: Error body:', errorBody);
            } catch (e) {
                // Ignore if error body is not JSON or not present
            }
            return null;
        }

        const fullTraces: Trace[] = await response.json();
        console.log(`ArianaApiClient: Successfully fetched ${fullTraces.length} full traces for ${vaultSecretKey}`);
        return fullTraces;
    } catch (error) {
        console.error(`ArianaApiClient: Network or other error fetching full traces for ${vaultSecretKey}:`, error);
        return null;
    }
}

/**
 * Fetches public data for multiple vaults from the server using their secret keys.
 * @param secretKeys An array of vault secret keys.
 * @returns A promise that resolves to an array of VaultPublicData objects or null for keys not found/errored.
 */
export async function getVaultsPublicDataByKeys(secretKeys: string[]): Promise<Array<VaultPublicData | null>> {
    if (secretKeys.length === 0) {
        console.log('ApiClient: getVaultsPublicDataByKeys called with empty secretKeys, returning empty array.');
        return [];
    }

    const apiUrl = getConfig().apiUrl;
    const endpoint = `${apiUrl}/unauthenticated/vaults/get-from-secret`;

    const payload: GetVaultsBySecretKeysRequest = { 
        secret_keys: secretKeys 
    };

    console.log(`ApiClient: Fetching public data for ${secretKeys.length} vaults from ${endpoint}`);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorBody = await response.text().catch(() => "Could not read error body");
            console.error(`ApiClient: Error fetching vault public data: ${response.status} ${response.statusText}. Response: ${errorBody}`);
            return secretKeys.map(() => null); // Return null for each key on error
        }

        const publicDataArray = await response.json() as Array<VaultPublicData | null>;
        console.log(`ApiClient: Successfully fetched public data for ${publicDataArray.filter(d => d !== null).length} of ${secretKeys.length} vaults.`);
        return publicDataArray;
    } catch (error) {
        console.error('ApiClient: Network or other error fetching vault public data:', error);
        return secretKeys.map(() => null); // Return null for each key on error
    }
}
