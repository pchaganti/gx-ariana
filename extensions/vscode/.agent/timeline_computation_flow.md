# Timeline Computation Dataflow in the VS Code Extension

This document outlines the entire dataflow for processing trace data, from its reception in the extension to its final rendering as an interactive timeline in the webview.

## High-Level Overview

The process is designed to be non-blocking and efficient. Raw trace data (`LightTrace`) is received by a central service, which offloads the heavy computation to a dedicated web worker. The worker processes the traces, transforms them into a structured `Timeline` object, and sends the result back. The main extension thread then forwards this `Timeline` object to the webview, which uses React to render the interactive visualization.

```mermaid
graph TD
    A[Trace Data Source] -->|New Traces| B(TimelineService);
    B -->|postMessage(traces)| C{Timeline Worker};
    C -->|lightTracesToTimeline()| D[timelineComputation.ts];
    D -->|{ timeline, benchmarks }| C; // D processes traces into a structured Timeline, building relationships (call tree or AST-based)
    C -->|postMessage(result)| B;
    B -->|postMessage(timeline)| E(Webview UI);
    E -->|React Renders| F[VaultTimelineView.tsx];
    F -->|requestHighlight| B;
```

---

## Data Flow Stages

### 1. Trace Ingestion (`TimelineService.ts`)

- **Entry Point**: The `TimelineService.addTraces(newTraces: LightTrace[])` method is the initial entry point for new data.
- **Buffering**: It receives an array of `LightTrace` objects and appends them to an internal `accumulatedTraces` array. This allows the system to batch-process incoming data.
- **Triggering Computation**: After adding traces, it calls `requestTimelineComputation()` to initiate the processing pipeline.

### 2. Worker Dispatch (`TimelineService.ts`)

- **Gatekeeping**: `requestTimelineComputation()` acts as a controller. It checks if a computation is already in progress (`isComputing`) or if there are no new traces. If either is true, it exits to prevent redundant work.
- **Offloading**: If conditions are met, it sets `isComputing = true` and sends the *entire* `accumulatedTraces` buffer to the dedicated worker thread using `worker.postMessage()`.

### 3. Core Computation (`timeline.worker.ts` & `timelineComputation.ts`)

- **Worker Listener (`timeline.worker.ts`)**: The worker script listens for the `'message'` event. Upon receiving the `LightTrace[]` array, it immediately calls the `lightTracesToTimeline` function.
- **Processing Logic (`timelineComputation.ts`)**: This is where the main data transformation happens:
    1.  **Group Traces**: Raw traces are grouped into a nested map: `filepath -> parent_id -> trace_id` for easier processing.
    2.  **Create Spans**: It iterates through the groups to create `Span` objects. A `Span` represents a single function execution, capturing its start/end timestamps and error state.
    3.  **Create Families**: It then creates `Family` objects, which group all `Span`s belonging to the same function (`parent_id`).
    4.  **Building Relationship Tree**: A critical step is to reconstruct the hierarchy of execution or structure. It links `Family` objects together by analyzing the `parent_id` and `trace_id` relationships in the original traces. This effectively builds a tree that can represent the program's execution flow (call tree) or static AST relationships, depending on the nature of the traces.
    5.  **Assemble Timeline**: Finally, it assembles the complete `Timeline` object, which contains lists of all spans, families, and clusters (root-level families), along with a map of timestamps for rendering.
- **Returning Data**: The worker sends the computed `timeline` and performance `benchmarks` back to the `TimelineService` in separate `success` and `benchmark` messages.

### 4. Result Handling (`TimelineService.ts`)

- **Message Listener**: The `TimelineService` listens for messages from the worker.
- **On Success**: When a `'success'` message is received, it stores the new timeline in `this.latestTimeline`, resets the `isComputing` flag to `false`, and calls `sendTimelineToWebview()`.
- **On Error**: If an error occurs in the worker, it's caught, logged, and the `isComputing` flag is also reset.

### 5. Webview Rendering (`VaultTimelineView.tsx`)

- **Data Reception**: The `VaultTimelineView` React component uses a `useSharedState` hook to listen for `'timeline-update'` messages from the extension. This hook is how it receives the final `Timeline` object.
- **State Handling**: The component shows appropriate UI for loading, empty, or error states.
- **Component Breakdown**:
    - `VaultTimelineView`: The main component that iterates over `clusters`.
    - `TimelineCluster`: Renders a collapsible section for each cluster.
    - `FamilyComponent`: Renders a row for each family, containing all its spans.
    - `SpanComponent`: Renders an individual span as a horizontal bar. Its position and width are calculated based on its start and end timestamps.
- **Interactivity**: Hovering over a `SpanComponent` triggers a `requestHighlight` message back to the extension, which then highlights the corresponding code in the editor.

---

## Key Data Structures (`timelineTypes.ts`)

- **`LightTrace`**: The raw, minimal data point received from the server, containing a timestamp, type (`Enter`, `Exit`, `Error`), and position info.
- **`Span`**: Represents a single, complete execution of a function. Contains start/end timestamps, position, and links to child families.
- **`Family`**: A collection of all `Span`s that belong to the same function definition.
- **`Cluster`**: A group of root-level families that represent the start of an execution flow (e.g., a request handler).
- **`Timeline`**: The final, comprehensive object sent to the webview, containing all clusters, families, spans, and timestamp mapping required for rendering.
