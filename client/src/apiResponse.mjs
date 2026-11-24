export async function readApiResponse(response) {
  if (response.status === 429) {
    throw new Error('Too many requests right now. Wait a minute before trying again.');
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
