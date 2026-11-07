// Shared hard-timeout fetch helpers for browser-side application requests.
// Every network operation must settle; no unbounded promise is allowed.

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export async function fetchWithHardTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 8000,
): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), Math.max(250, Math.min(60_000, timeoutMs)));
  // Forward abort from caller into our controller.
  const external = init.signal;
  const abort = () => ctrl.abort();
  external?.addEventListener("abort", abort, { once: true });
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(timer);
    external?.removeEventListener("abort", abort);
  }
}

export async function fetchJsonWithHardTimeout<T>(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 8000,
): Promise<T> {
  const response = await fetchWithHardTimeout(input, init, timeoutMs);
  if (!response.ok) throw new HttpError(response.status, `HTTP_${response.status}`);
  return response.json() as Promise<T>;
}
