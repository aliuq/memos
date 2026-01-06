interface RetryOptions {
  retries: number;
  delay: number;
}

export async function retry(fn: () => boolean | Promise<boolean>, { retries = 3, delay = 1000 }: RetryOptions): Promise<boolean> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const result = await fn();
      if (result) return true;
    } catch {
      // Continue to next attempt
    }

    if (attempt < retries - 1) {
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  return false;
}
