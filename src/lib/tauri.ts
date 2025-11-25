// Check if we're running in Tauri context
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

// Log Tauri context status for debugging
export function logTauriStatus(): void {
  console.log("Tauri context check:", {
    hasWindow: typeof window !== "undefined",
    hasTauriInternals: typeof window !== "undefined" && "__TAURI_INTERNALS__" in window,
    tauriInternals: typeof window !== "undefined" ? (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ : undefined,
  });
}
