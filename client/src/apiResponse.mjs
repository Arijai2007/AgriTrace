const defaultRetryDelayMs = 60_000;

function retryDelay(response) {
  const value = response.headers.get('retry-after')?.trim();
  if (!value) return defaultRetryDelayMs;
  if (/^\d+$/.test(value)) return Math.max(1_000, Number(value) * 1_000);
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? defaultRetryDelayMs : Math.max(1_000, parsed - Date.now());
}

class RateLimitError extends Error {
  constructor(response) {
    const delayMs = retryDelay(response);
    super(`Too many requests right now. Try again in about ${Math.ceil(delayMs / 1_000)} seconds.`);
    this.delayMs = delayMs;
  }
}

export async function retryStartupRead(read, onWait, wait = delay => new Promise(resolve => setTimeout(resolve, delay))) {
  try {
    return await read();
  } catch (error) {
    if (!(error instanceof RateLimitError) || error.delayMs > defaultRetryDelayMs) throw error;
    onWait?.();
    await wait(error.delayMs);
    return read();
  }
}

export async function readApiResponse(response) {
  if (response.status === 429) {
    throw new RateLimitError(response);
  }
  const contentType = response.headers.get('content-type') || '';
  if (!/^application\/(?:json|[\w.+-]+\+json)(?:\s*;|$)/i.test(contentType)) {
    if ([502, 503, 504].includes(response.status)) {
      throw new Error('The hosted service is temporarily unavailable. Try again in a moment.');
    }
    throw new Error('The service returned an unexpected response. Please try again in a moment.');
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('The service returned an incomplete response. Please try again.');
  }
  if (!response.ok) throw new Error(data?.error || 'Request failed. Please try again.');
  return data;
}
