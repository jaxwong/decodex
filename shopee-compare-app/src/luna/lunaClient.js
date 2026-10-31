const BASE = import.meta.env.VITE_LUNA_API_BASE_URL || '';

export class LunaApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = 'LunaApiError';
    this.status = status;
    this.details = details;
  }
}

async function request(path, { token, method = 'GET', body, signal } = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
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
  createSession: (signal) => request('/api/demo-sessions', { method: 'POST', signal }),
  getCatalog: (token, signal) => request('/api/catalog', { token, signal }),
  createComparison: (token, items, signal) =>
    request('/api/comparisons', { token, method: 'POST', body: { items }, signal }),
  getComparison: (token, id, signal) =>
    request(`/api/comparisons/${encodeURIComponent(id)}`, { token, signal }),
  ask: (token, id, payload, signal) =>
    request(`/api/comparisons/${encodeURIComponent(id)}/ask`, {
      token, method: 'POST', body: payload, signal,
    }),
};
