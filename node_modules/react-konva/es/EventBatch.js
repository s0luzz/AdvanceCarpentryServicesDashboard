import { flushSync } from 'react-dom';
const pending = new Set();
const pendingUnmounts = new Set();
const enqueue = typeof queueMicrotask === 'function'
    ? queueMicrotask
    : (callback) => Promise.resolve().then(callback);
let depth = 0;
const batches = new WeakMap();
export function addPendingUnmount(callback) {
    pendingUnmounts.add(callback);
    return () => {
        pendingUnmounts.delete(callback);
    };
}
// Hidden Stages may be deleted without another layout cleanup. Prepare their
// root removals before either a scheduled render or a Stage's inline flush.
export function prepareUnmounts() {
    for (const callback of pendingUnmounts)
        callback();
}
export function getEventBatch(batch) {
    if (!batch)
        return batchEvents;
    let wrapped = batches.get(batch);
    if (!wrapped) {
        // Konva deduplicates shared callbacks when several Stages drag together.
        wrapped = (run) => batchEvents(() => batch(run));
        batches.set(batch, wrapped);
    }
    return wrapped;
}
// React's host scheduler stays asynchronous while a handler or subscription is
// running. A completed native input batch can finish those same scheduled jobs.
export function scheduleMicrotask(callback) {
    const run = () => {
        if (pending.delete(run)) {
            prepareUnmounts();
            callback();
        }
    };
    pending.add(run);
    enqueue(run);
}
export function batchEvents(callback) {
    if (depth)
        return callback();
    depth++;
    try {
        // DOM-owned state must be scheduled inside this scope. Flush it before
        // finishing canvas work, so Stage can transfer the final DOM-owned props.
        flushSync(callback);
    }
    finally {
        try {
            // Canvas effects can schedule DOM state, and DOM effects can schedule
            // more canvas work. Finish that work in a DOM scope too. Empty input
            // does not add a second flush, and queued microtasks become no-ops.
            while (pending.size) {
                flushSync(() => {
                    for (const run of pending)
                        run();
                });
            }
        }
        finally {
            depth--;
        }
    }
}
