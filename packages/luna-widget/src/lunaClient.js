export class LunaApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'LunaApiError';
    this.status = status;
    this.details = details;
  }
}

async function request(apiBaseUrl, path, { token, method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      signal,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch (error) {
    throw new LunaApiError(`Cannot reach Luna API: ${error.message}`, 0, null);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    const message = typeof detail === 'string'
      ? detail : data?.message || data?.error?.message || `API returned HTTP ${response.status}`;
    throw new LunaApiError(message, response.status, data);
  }
  return data;
}

export const lunaClient = {
  createSession: (apiBaseUrl, signal) => request(apiBaseUrl, '/demo-sessions', { method: 'POST', signal }),
  getCatalog: (apiBaseUrl, token, signal) => request(apiBaseUrl, '/catalog', { token, signal }),
  createComparison: (apiBaseUrl, token, items, signal) =>
    request(apiBaseUrl, '/comparisons', { token, method: 'POST', body: { items }, signal }),
  getComparison: (apiBaseUrl, token, comparisonId, signal) =>
    request(apiBaseUrl, `/comparisons/${encodeURIComponent(comparisonId)}`, { token, signal }),
  getListingGapReport: (apiBaseUrl, token, listingId, signal) =>
    request(apiBaseUrl, `/listings/${encodeURIComponent(listingId)}/gap-report`, { token, signal }),
  ask: (apiBaseUrl, token, comparisonId, payload, signal) =>
    request(apiBaseUrl, `/comparisons/${encodeURIComponent(comparisonId)}/ask`, {
      token, method: 'POST', body: payload, signal,
    }),
  createLiveSession: (apiBaseUrl, token, comparisonId, sdp, signal) =>
    request(apiBaseUrl, `/comparisons/${encodeURIComponent(comparisonId)}/live/session`, {
      token, method: 'POST', body: { sdp }, signal,
    }),
};
