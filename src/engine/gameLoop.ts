/**
 * Terminal game loop using setInterval + high-resolution timing.
 * Replaces the browser's requestAnimationFrame.
 */

import { MAX_DELTA_TIME_SEC } from '../constants.js';

export interface GameLoopCallbacks {
  update: (dt: number) => void;
  render: () => void;
}

export function startGameLoop(
  targetFps: number,
  callbacks: GameLoopCallbacks,
): { stop: () => void } {
  const intervalMs = Math.round(1000 / targetFps);
  let lastTime = process.hrtime.bigint();
  let stopped = false;

  const timer = setInterval(() => {
    if (stopped) return;
    const now = process.hrtime.bigint();
    const dtNs = Number(now - lastTime);
    lastTime = now;
    const dt = Math.min(dtNs / 1_000_000_000, MAX_DELTA_TIME_SEC);

    callbacks.update(dt);
    callbacks.render();
  }, intervalMs);

  return {
    stop: () => {
      stopped = true;
      clearInterval(timer);
    },
  };
}
