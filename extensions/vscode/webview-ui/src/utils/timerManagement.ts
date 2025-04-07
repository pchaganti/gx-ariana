/**
 * Timer management utilities that handle cancellation of timers when the webview is reloaded
 */

// Store the current render nonce
let currentRenderNonce: string | null = null;

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
 * @returns The timer ID
 */
export function setTimeoutCancelIfDifferentNonce(
  callback: (...args: any[]) => void,
  delay: number
): number {
  const nonceAtCreation = currentRenderNonce;
  
  return window.setTimeout(() => {
    // Only run the callback if the nonce hasn't changed
    if (nonceAtCreation === currentRenderNonce) {
      callback();
    } else {
      console.log('Cancelled stale timeout callback due to nonce mismatch');
    }
  }, delay);
}

/**
 * setInterval that will cancel if the current render nonce changes
 * This prevents stale intervals from running after hot reload
 * @param callback The callback to execute
 * @param delay The delay in milliseconds
 * @returns The interval ID
 */
export function setIntervalCancelIfDifferentNonce(
  callback: (...args: any[]) => void,
  delay: number
): number {
  const nonceAtCreation = currentRenderNonce;
  
  const intervalId = window.setInterval(() => {
    // Check if the nonce has changed
    if (nonceAtCreation !== currentRenderNonce) {
      console.log('Cancelling stale interval due to nonce mismatch');
      clearInterval(intervalId);
      return;
    }
    
    // Nonce hasn't changed, safe to run the callback
    callback();
  }, delay);
  
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
