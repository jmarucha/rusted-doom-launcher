/**
 * Error utilities for Tauri apps.
 * Tauri often throws strings instead of Error objects, so we handle both.
 */

/**
 * Extract message from any thrown value (Error, string, or object).
 */
export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return JSON.stringify(e);
}

/**
 * Check if error is "file/directory not found" (expected on first run).
 */
export function isNotFoundError(e: unknown): boolean {
  const msg = getErrorMessage(e).toLowerCase();
  return (
    msg.includes("no such file") ||
    msg.includes("enoent") ||
    msg.includes("not found") ||
    msg.includes("does not exist")
  );
}

/**
 * Check if error is "already exists" (expected when creating existing dir).
 */
export function isExistsError(e: unknown): boolean {
  const msg = getErrorMessage(e).toLowerCase();
  return msg.includes("eexist") || msg.includes("already exists");
}
