export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function formatError(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}
