'use strict';

/*
  Production trigger guard for V8.

  The large green gust must only start when a page that is already running
  crosses an actual five-minute boundary. Loading or refreshing the page
  during the first ten seconds of :00, :05, :10, etc. must remain in the
  normal clock state.

  ?demo=1 intentionally keeps the immediate demo behaviour for testing.
*/
(() => {
  const initial = getTimeParts();
  let lastMinuteKey = `${initial.hh}:${initial.mm}`;
  let liveEventStartPerf = null;

  eventWindow = function guardedEventWindow() {
    if (DEMO_MODE) {
      const elapsed = performance.now() - DEMO_START;
      return { active: elapsed < EVENT_DURATION_MS, elapsed };
    }

    const now = getTimeParts();
    const minuteKey = `${now.hh}:${now.mm}`;
    const second = Number(now.ss);

    if (liveEventStartPerf !== null) {
      const elapsed = performance.now() - liveEventStartPerf;
      if (elapsed < EVENT_DURATION_MS) {
        lastMinuteKey = minuteKey;
        return { active: true, elapsed };
      }
      liveEventStartPerf = null;
    }

    if (minuteKey !== lastMinuteKey) {
      const isFiveMinuteBoundary = Number(now.mm) % 5 === 0;

      // Only fire if this running page actually observes the :00 second.
      // This prevents a load, refresh or wake-up at :05 / :06 etc. from
      // starting the installation sequence late.
      if (isFiveMinuteBoundary && second === 0) {
        const fractionalSecond = Date.now() % 1000;
        liveEventStartPerf = performance.now() - fractionalSecond;
        lastMinuteKey = minuteKey;
        return {
          active: true,
          elapsed: performance.now() - liveEventStartPerf
        };
      }

      lastMinuteKey = minuteKey;
    }

    return { active: false, elapsed: 0 };
  };
})();
