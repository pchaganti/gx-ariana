import { parentPort } from 'worker_threads';
import { LightTrace } from '../bindings/LightTrace';
import { lightTracesToTimeline } from './timelineComputation';
import { Timeline } from './timelineTypes';

if (!parentPort) {
  throw new Error('This script must be run as a worker thread.');
}

parentPort.on('message', (traces: LightTrace[]) => {
  try {
    const startTime = performance.now();
    const timeline: Timeline = lightTracesToTimeline(traces);
    const endTime = performance.now();
    const duration = endTime - startTime;

    parentPort!.postMessage({ type: 'benchmark', duration });
    parentPort!.postMessage({ type: 'success', timeline });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred in the timeline worker.';
    parentPort!.postMessage({ type: 'error', error: errorMessage });
  }
});
