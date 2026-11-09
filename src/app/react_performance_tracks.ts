type PerformanceTrackDetail = {
  devtools?: { track?: string; trackGroup?: string };
} | null;

function clearReactPerformanceMeasures(
  entries: readonly PerformanceEntry[]
): void {
  const names = new Set<string>();
  for (const entry of entries) {
    const detail = (entry as PerformanceMeasure)
      .detail as PerformanceTrackDetail;
    if (
      detail?.devtools?.track === "Components ⚛" ||
      detail?.devtools?.trackGroup === "Scheduler ⚛"
    ) {
      names.add(entry.name);
    }
  }
  // React's copied prop details otherwise remain in the browser timing buffer.
  for (const name of names) performance.clearMeasures(name);
}

export function startReactPerformanceTrackCleanup(): () => void {
  const observer = new PerformanceObserver((list) => {
    clearReactPerformanceMeasures(list.getEntries());
  });
  observer.observe({ type: "measure", buffered: true });
  return () => {
    clearReactPerformanceMeasures(observer.takeRecords());
    observer.disconnect();
  };
}
