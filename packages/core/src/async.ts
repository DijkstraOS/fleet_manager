export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export async function retryUntil<T>(
  operation: () => Promise<T>,
  options: { timeoutMs: number; delayMs?: number; describe: string },
): Promise<T> {
  const { timeoutMs, delayMs = 250, describe } = options;
  const startedAt = Date.now();
  let lastError: unknown;

  while (Date.now() - startedAt < timeoutMs) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      await delay(delayMs);
    }
  }

  throw new Error(`${describe} within ${timeoutMs}ms: ${formatError(lastError)}`);
}
