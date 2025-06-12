import { parentPort } from 'worker_threads';
import { LightTrace } from '../bindings/LightTrace';
import { lightTracesToTimeline } from './timelineComputation';

if (!parentPort) {
  throw new Error('This script must be run as a worker thread.');
}

parentPort.on('message', (message: { traces: LightTrace[], workspaceRoots: string[] }) => {
  try {
    const { traces, workspaceRoots } = message;
    const { timeline, benchmarks } = lightTracesToTimeline(traces, workspaceRoots);
    parentPort!.postMessage({ type: 'benchmark', benchmarks });
    parentPort!.postMessage({ type: 'success', timeline });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred in the timeline worker.';
    parentPort!.postMessage({ type: 'error', error: errorMessage });
  }
});
