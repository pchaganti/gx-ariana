import * as crypto from 'crypto';
import * as os from 'os';

export function generateMachineId(): string {
    // Combine multiple system-specific identifiers
    const identifiers = [
        os.hostname(),
        os.platform(),
        os.arch(),
        os.cpus()[0]?.model,
        os.totalmem(),
        process.env.COMPUTERNAME,
        process.env.USERDOMAIN,
    ].filter(Boolean);

    // Create a hash of the combined identifiers
    const hash = crypto.createHash('sha256')
        .update(identifiers.join('|'))
        .digest('hex');

    return hash;
}

export const machineId = generateMachineId();