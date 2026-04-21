export interface RetryOptions {
  delays?: number[]; // ms delays between attempts; length = max retries
}

const DEFAULT_DELAYS = [1000, 2000];

const RETRYABLE = (status: number) => status >= 500;

/**
 * Wraps global fetch with retry on 5xx responses and network errors.
 * - 5xx: retries up to delays.length times; returns the last response if all attempts fail.
 * - Network error: retries up to delays.length times; throws the last error if all attempts fail.
 * - Non-5xx (including 4xx): returned immediately without retry.
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  { delays = DEFAULT_DELAYS }: RetryOptions = {}
): Promise<Response> {
  const maxAttempts = delays.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const isLast = attempt === maxAttempts - 1;
    try {
      const res = await fetch(url, options);
      if (!RETRYABLE(res.status) || isLast) return res;
    } catch (err) {
      if (isLast) throw err;
    }
    await sleep(delays[attempt]);
  }

  // unreachable: loop always returns or throws on the final attempt
  throw new Error("fetchWithRetry: unreachable");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
