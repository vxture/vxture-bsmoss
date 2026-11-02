import { workerOptions, workerFailure, workerRetryMilliseconds, type WorkerOptions, type WorkerFailure } from "./rules.ts";

export const WORKER_STEP_STATUSES = ["idle", "succeeded", "retry", "dead", "busy", "delayed", "terminal", "enqueued", "duplicate"] as const;
export type WorkerStepStatus = typeof WORKER_STEP_STATUSES[number];
export interface WorkerLane { step(signal?: AbortSignal): Promise<{ status: WorkerStepStatus }> }
export interface WorkerEvent { lane: number; status: WorkerStepStatus | "failed"; failure: WorkerFailure | null; consecutiveFailures: number; retryAfterMilliseconds: number }
interface LaneState { completedSteps: number; failedSteps: number; consecutiveFailures: number; availableAt: number; lastEvent: WorkerEvent | null }
export interface WorkerCycle { status: "completed" | "busy" | "stopped"; events: WorkerEvent[] }

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    if (signal.aborted) { resolve(); return; }
    const done = () => { clearTimeout(timer); signal.removeEventListener("abort", done); resolve(); };
    const timer = setTimeout(done, milliseconds); signal.addEventListener("abort", done, { once: true });
  });
}
// No timer is installed by importing this module. The host must supply real
// authorized lanes, explicitly run the loop, own its pool and await shutdown.
export function createWorkerLoop(rawLanes: readonly WorkerLane[], rawOptions: WorkerOptions,
  runtime: { now?: () => number; wait?: (milliseconds: number, signal: AbortSignal) => Promise<void> } = {}) {
  const options = workerOptions(rawOptions), lanes = [...rawLanes];
  if (!lanes.length || lanes.length > 65 || lanes.some(l => typeof l.step !== "function")) throw Error("invalid_worker_lanes");
  const states: LaneState[] = lanes.map(() => ({ completedSteps: 0, failedSteps: 0, consecutiveFailures: 0, availableAt: 0, lastEvent: null }));
  const now = runtime.now ?? (() => performance.now()), sleep = runtime.wait ?? wait;
  let cursor = 0, ticking = false, running = false, lastTime = -Infinity;
  function clock() { const time = now(); if (!Number.isFinite(time) || time < lastTime) throw Error("invalid_worker_clock"); lastTime = time; return time; }
  async function tick(signal?: AbortSignal): Promise<WorkerCycle> {
    if (signal?.aborted) return { status: "stopped", events: [] };
    if (ticking) return { status: "busy", events: [] };
    ticking = true; const events: WorkerEvent[] = []; let visited = 0;
    try {
      while (visited < lanes.length && events.length < options.maxStepsPerTick && !signal?.aborted) {
        const index = cursor; cursor = (cursor + 1) % lanes.length; visited++;
        const state = states[index]!;
        if (clock() < state.availableAt) continue;
        let status: WorkerEvent["status"], failure: WorkerFailure | null = null, retry = 0;
        try {
          const result = await lanes[index]!.step(signal);
          if (!result || !WORKER_STEP_STATUSES.includes(result.status)) throw Error("invalid_worker_step");
          status = result.status; state.completedSteps++; state.consecutiveFailures = 0; state.availableAt = 0;
        } catch (error) {
          status = "failed"; failure = workerFailure(error); state.failedSteps++;
          state.consecutiveFailures = Math.min(Number.MAX_SAFE_INTEGER, state.consecutiveFailures + 1);
          retry = workerRetryMilliseconds(state.consecutiveFailures); state.availableAt = clock() + retry;
        }
        const event: WorkerEvent = { lane: index, status, failure, consecutiveFailures: state.consecutiveFailures, retryAfterMilliseconds: retry };
        state.lastEvent = event; events.push({ ...event });
      }
      return { status: signal?.aborted ? "stopped" : "completed", events };
    } finally { ticking = false; }
  }
  return Object.freeze({
    tick: (signal?: AbortSignal): Promise<WorkerCycle> => running ? Promise.resolve({ status: signal?.aborted ? "stopped" : "busy", events: [] }) : tick(signal),
    snapshot: () => ({ running, ticking, nextLane: cursor, lanes: states.map(s => ({ ...s, lastEvent: s.lastEvent ? { ...s.lastEvent } : null })) }),
    async run(signal: AbortSignal, onCycle: (cycle: WorkerCycle) => void | Promise<void> = () => {}) {
      if (running || ticking) throw Error("worker_already_running");
      running = true;
      try {
        while (!signal.aborted) {
          await onCycle(await tick(signal));
          if (!signal.aborted) await sleep(options.pollMilliseconds, signal);
        }
      } finally { running = false; }
    },
  });
}
