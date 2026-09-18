# 19.2.7: native input synchronization

This release uses the public event hook in Konva 10.5.0.
Older Konva versions remain supported through normal asynchronous React scheduling.

## Changes

- With the new hook, native Konva input commits ordinary React state before each Konva listener returns. This includes state owned above Stage. Controlled Transformer geometry is current before the next frame.
- Handlers within one native listener share a batch. The integration uses React DOM `flushSync` and the custom renderer's host scheduler. It uses no hidden React DOM fields or Konva method patches.
- Stage accepts an optional `eventBatchFunc`, such as MobX `runInAction`. It wraps native Konva work inside the React batch, so reactions finish before React commits. Shared callbacks remain deduplicated across Stages.
- Direct programmatic `fire()` and drag calls outside a native input batch use normal asynchronous React scheduling. They do not force a canvas render after each handler. This preserves batching for event bursts and avoids forced flushes from React lifecycle methods.
- Stage refs support React ref cleanup callbacks. Removed descendants release react-konva listeners. With automatic drawing disabled, Suspense visibility changes request a draw.
- StrictMode Stage cleanup queues canvas-tree removal before pending child updates can render. It preserves child state during effect replay and adds no forced flush.
- Package exports route ES-module imports to the ES build and CommonJS imports to the CommonJS build. Existing minimal imports, with or without `.js`, remain supported. The ES output declares its module type.
- Type declarations remove `getPublicInstance` and `getNativeNode`, which never existed at runtime. Code that references those declarations must use node refs. Group props use Konva's container configuration.

## Timing and compatibility

The existing Konva 7–10 peer range remains. Stage initialization checks whether
`eventBatchFunc` is available. If it is absent, React updates use the normal
asynchronous scheduler. There is no import error or per-handler forced flush.
This fallback does not provide the new native-input commit deadline or fix bugs
inside historical Konva releases. Konva 10.5+ provides the full synchronization
and Transformer improvements. The JSX prop composes with the renderer's Stage
hook. Replacing that hook through a ref remains unsupported.

With Konva 10, Node ES-module imports no longer depend on `require(ESM)` support.
CommonJS `require('react-konva')` still needs a Node version that supports loading
ES modules through `require`. See [Node's module compatibility documentation](https://nodejs.org/api/modules.html#loading-ecmascript-modules-using-require).

DOM-owned state updated by native canvas input now commits synchronously when
the hook is available. Large DOM updates can therefore increase event duration.
Promises and React transitions still follow React scheduling. Direct native DOM
dispatch from an unrelated React effect must wait until after that effect. See
[React's flushSync lifecycle rules](https://react.dev/reference/react-dom/flushSync#im-getting-an-error-flushsync-was-called-from-inside-a-lifecycle-method).
Programmatic Konva events from effects remain supported.

Each native Konva listener has its own boundary. A browser move or release can
reach multiple listeners and cause separate commits if each schedules state.
Event order remains intact. Empty listeners do not cause additional React commits,
though entering their boundaries still calls `flushSync`.

## Validation and performance

All tests install latest published Konva, including the minimum React CI job.
Fallback tests disable its public hook for import, server-rendering, and
programmatic update checks. They do not validate every historical Konva release.

The regular suite includes all former expected-failure cases. It checks native
mouse, touch, cancellation, multiple Stages, effects crossing between renderers,
MobX subscriptions, unmounting, and content-to-window listener order.

`npm test` also enforces commit, render, geometry, and flush counts. Performance
cases cover up to 100 selected nodes and trees with 5,000 canvas nodes and 5,000
DOM elements. The [benchmark guide](https://github.com/konvajs/react-konva/blob/master/benchmarks/README.md) describes the timing runner and measurements.

Validation used registry Konva 10.5.0:

- Chromium, Firefox, and WebKit: 146 correctness tests in both development and production, plus 38 performance checks in each browser. No skipped or expected-failure tests.
- Minimum React and React DOM 19.2.0: the same full Chromium suite passes. The three-browser runs use React 19.2.8.
- Built CommonJS and ES-module imports, server rendering with and without the optional hook, consumer types, and package contents pass validation. Packed-package tests cover imports without `require(ESM)`, minimal imports, and CommonJS. TypeScript tests cover NodeNext, Bundler, and legacy Node resolution.

The installed Konva files match the registry tarball. No local Konva patches are
needed.
