/**
 * Error checking utilities for handling expected vs unexpected errors.
 *
 * Use these to only catch specific expected errors (like file-not-found)
 * instead of silently swallowing all errors with empty catch blocks.
 */

/**
 * Check if error is "file/directory not found" (expected when file doesn't exist yet)
 */
export function isNotFoundError(e: unknown): boolean {
  if (e instanceof Error) {
    const msg = e.message.toLowerCase();
    return (
      msg.includes("no such file") ||
      msg.includes("enoent") ||
      msg.includes("not found") ||
      msg.includes("does not exist")
    );
  }
  return false;
}

/**
 * Check if error is "already exists" (expected when creating dir that exists)
 */
export function isExistsError(e: unknown): boolean {
  if (e instanceof Error) {
    const msg = e.message.toLowerCase();
    return msg.includes("eexist") || msg.includes("already exists");
  }
  return false;
}
