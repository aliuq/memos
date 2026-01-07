interface RetryOptions {
  retries: number;
  delay: number;
  onRetry?: (attempt: number, error: any) => void;
}

export async function retry(fn: () => boolean | Promise<boolean>, { retries = 3, delay = 1000, onRetry }: RetryOptions): Promise<boolean> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await fn();
      if (result) return true;
    } catch (error) {
      // Call retry callback
      onRetry?.(attempt + 1, error);
    }

    if (attempt < retries - 1) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return false;
}

/**
 * Render slot function - supports both static content and function that returns content
 *
 * @example
 * ```ts
 * typeof slots.header === "function" ? slots.header(state) : slots.header
 * ```
 */
export function renderSlot<T, D = any>(slot: T | ((state: D) => T), state: D): T {
  return typeof slot === "function" ? (slot as (state: D) => T)(state) : slot;
}
