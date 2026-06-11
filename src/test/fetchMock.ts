/**
 * Extract the request URL as a string from any of the argument shapes
 * accepted by the global `fetch` function.
 */
export function urlOf(input: string | URL | Request): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  return input.url;
}
