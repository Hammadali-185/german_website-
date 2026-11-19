export function createLiveFallback(intervalMs: number, refresh: () => void) {
  let timer: ReturnType<typeof setInterval> | null = null;
  return {
    disconnected() {
      if (timer) return;
      timer = setInterval(refresh, intervalMs);
    },
    connected() {
      if (!timer) return;
      clearInterval(timer);
      timer = null;
    },
    stop() {
      this.connected();
    },
    polling() {
      return timer !== null;
    },
  };
}
