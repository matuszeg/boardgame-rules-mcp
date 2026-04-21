export interface RetryOptions {
  delays?: number[]; // ms delays between attempts; length = max retries
}

const DEFAULT_DELAYS = [1000, 2000];

const RETRYABLE = (status: number) => status >= 500;

export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  { delays = DEFAULT_DELAYS }: RetryOptions = {}
): Promise<Response> {
  let lastRes: Response | undefined;
  const maxAttempts = delays.length + 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const res = await fetch(url, options);
      if (!RETRYABLE(res.status) || attempt === maxAttempts - 1) return res;
      lastRes = res;
    } catch (err) {
      if (attempt === maxAttempts - 1) throw err;
    }
    await sleep(delays[attempt]);
  }

  return lastRes!;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
