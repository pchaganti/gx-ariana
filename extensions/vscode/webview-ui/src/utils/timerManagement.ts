/**
 * Timer management utilities that handle cancellation of timers when the webview is reloaded
 */

// Store the current render nonce
let currentRenderNonce: string | null = null;

// Maps to track active timers and intervals by ID
const activeTimeouts: Map<string, { id: number, nonce: string | null }> = new Map();
const activeIntervals: Map<string, { id: number, nonce: string | null }> = new Map();

/**
 * Sets the current render nonce
 * @param nonce The new render nonce
 */
export function setCurrentRenderNonce(nonce: string): void {
  console.log('Setting current render nonce:', nonce);
  currentRenderNonce = nonce;
}

/**
 * Gets the current render nonce
 */
export function getCurrentRenderNonce(): string | null {
  return currentRenderNonce;
}

/**
 * setTimeout that will only execute if the current render nonce matches the one it was created with
 * This prevents stale timers from running after hot reload
 * @param callback The callback to execute
 * @param delay The delay in milliseconds
 * @param id Optional unique identifier for this timeout
 * @returns The timer ID
 */
export function setTimeoutCancelIfDifferentNonce(
  callback: (...args: any[]) => void,
  delay: number,
  id?: string
): number {
  const nonceAtCreation = currentRenderNonce;
  
  // If an ID is provided and a timeout with this ID already exists
  if (id && activeTimeouts.has(id)) {
    const existingTimeout = activeTimeouts.get(id)!;
    
    // If existing timeout has different nonce, clear it
    if (existingTimeout.nonce !== nonceAtCreation) {
      clearTimeoutSafe(existingTimeout.id);
    } else {
      // Same nonce, keep existing timeout and ignore this new one
      return existingTimeout.id;
    }
  }
  
  const timeoutId = window.setTimeout(() => {
    // Only run the callback if the nonce hasn't changed
    if (nonceAtCreation === currentRenderNonce) {
      callback();
    } else {
      console.log('Cancelled stale timeout callback due to nonce mismatch');
    }
    
    // Remove from active timeouts map when done
    if (id) {
      activeTimeouts.delete(id);
    }
  }, delay);
  
  // Store the timeout ID if an ID was provided
  if (id) {
    activeTimeouts.set(id, { id: timeoutId, nonce: nonceAtCreation });
  }
  
  return timeoutId;
}

/**
 * setInterval that will cancel if the current render nonce changes
 * This prevents stale intervals from running after hot reload
 * @param callback The callback to execute
 * @param delay The delay in milliseconds
 * @param id Optional unique identifier for this interval
 * @returns The interval ID
 */
export function setIntervalCancelIfDifferentNonce(
  callback: (...args: any[]) => void,
  delay: number,
  id?: string
): number {
  const nonceAtCreation = currentRenderNonce;
  
  // If an ID is provided and an interval with this ID already exists
  if (id && activeIntervals.has(id)) {
    const existingInterval = activeIntervals.get(id)!;
    
    // If existing interval has different nonce, clear it
    if (existingInterval.nonce !== nonceAtCreation) {
      clearIntervalSafe(existingInterval.id);
    } else {
      // Same nonce, keep existing interval and ignore this new one
      return existingInterval.id;
    }
  }
  
  const intervalId = window.setInterval(() => {
    // Check if the nonce has changed
    if (nonceAtCreation !== currentRenderNonce) {
      console.log('Cancelling stale interval due to nonce mismatch');
      clearInterval(intervalId);
      
      // Remove from active intervals map
      if (id) {
        activeIntervals.delete(id);
      }
      return;
    }
    
    // Nonce hasn't changed, safe to run the callback
    callback();
  }, delay);
  
  // Store the interval ID if an ID was provided
  if (id) {
    activeIntervals.set(id, { id: intervalId, nonce: nonceAtCreation });
  }
  
  return intervalId;
}

/**
 * Clears a timeout
 * @param timeoutId The timeout ID to clear
 */
export function clearTimeoutSafe(timeoutId: number): void {
  window.clearTimeout(timeoutId);
}

/**
 * Clears an interval
 * @param intervalId The interval ID to clear
 */
export function clearIntervalSafe(intervalId: number): void {
  window.clearInterval(intervalId);
}
