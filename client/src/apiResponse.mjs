export async function readApiResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!/^application\/(?:json|[\w.+-]+\+json)(?:\s*;|$)/i.test(contentType)) {
    if (response.status === 429) {
      throw new Error('The service is temporarily limiting requests. Wait a minute, then try again.');
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
