export interface SimulatorLoop {
  start: () => void;
  stop: () => void;
}

export function createSimulatorLoop(options: {
  onMotionTick: (dtMs: number) => void;
  onPublishTick: () => void;
  motionIntervalMs?: number;
  publishIntervalMs?: number;
}): SimulatorLoop {
  let lastTick = Date.now();
  let motionTimer: ReturnType<typeof setInterval> | null = null;
  let publishTimer: ReturnType<typeof setInterval> | null = null;

  return {
    start: () => {
      if (motionTimer || publishTimer) return;
      lastTick = Date.now();
      motionTimer = setInterval(() => {
        const now = Date.now();
        const dt = now - lastTick;
        lastTick = now;
        options.onMotionTick(dt);
      }, options.motionIntervalMs ?? 100);
      publishTimer = setInterval(
        () => options.onPublishTick(),
        options.publishIntervalMs ?? 250
      );
    },

    stop: () => {
      if (motionTimer) clearInterval(motionTimer);
      if (publishTimer) clearInterval(publishTimer);
      motionTimer = null;
      publishTimer = null;
    },
  };
}
