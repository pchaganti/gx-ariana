import { Worker } from 'worker_threads';
import * as path from 'path';
import { Webview } from 'vscode';
import { LightTrace } from '../bindings/LightTrace';
import { Timeline } from '../timeline/timelineTypes';

export class TimelineService {
  private worker: Worker;
  private accumulatedTraces: LightTrace[] = [];
  private latestTimeline: Timeline | null = null;
  private webview: Webview | null = null;
  private isComputing = false;

  constructor() {
    const workerPath = path.join(__dirname, 'timeline', 'timeline.worker.js');
    this.worker = new Worker(workerPath);

    this.worker.on('message', (message: { type: 'success', timeline: Timeline } | { type: 'error', error: string } | { type: 'benchmark', duration: number }) => {
      if (message.type === 'success') {
        this.latestTimeline = message.timeline;
        this.sendTimelineToWebview();
        this.isComputing = false; // Only set to false after successful computation
      } else if (message.type === 'benchmark') {
        console.log(`Timeline computation took ${message.duration.toFixed(2)} ms`);
      } else if (message.type === 'error') {
        console.error('Timeline worker error:', message.error);
        this.isComputing = false; // Also set to false on error
      }
    });

    this.worker.on('error', (error) => {
      console.error('Timeline worker crashed:', error);
      this.isComputing = false;
      // Optionally, you might want to try and restart the worker
    });

    this.worker.on('exit', (code) => {
      if (code !== 0) {
        console.error(`Timeline worker stopped with exit code ${code}`);
      }
    });
  }

  public setWebview(webview: Webview) {
    this.webview = webview;
  }

  public addTraces(newTraces: LightTrace[]) {
    this.accumulatedTraces.push(...newTraces);
    this.requestTimelineComputation();
  }

  public requestTimelineComputation() {
    if (this.isComputing || this.accumulatedTraces.length === 0) {
      return;
    }
    this.isComputing = true;
    this.worker.postMessage(this.accumulatedTraces);
  }

  public sendTimelineToWebview() {
    if (!this.webview) {
      return;
    }

    if (this.latestTimeline) {
      this.webview.postMessage({
        type: 'timeline-update',
        value: this.latestTimeline,
      });
    } else if (this.accumulatedTraces.length > 0) {
      this.requestTimelineComputation();
    } else {
      // No timeline and no traces, send an empty state to the webview
      // so it doesn't get stuck in a loading state forever.
      this.webview.postMessage({
        type: 'timeline-update',
        value: {
          clusters: [],
          spans: [],
          families: [],
          uniqueTimestamps: [],
          interTimestamps: [],
          timestampToPosition: {},
        } as Timeline,
      });
    }
  }

  public dispose() {
    this.worker.terminate();
  }
}
