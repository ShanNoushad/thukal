// Browser-side helper: calls our API with the current session's token
export async function apiCall(session, onUnauthorized, path, options = {}) {
  const token = await session.getToken();
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  let body = options.body;
  if (options.json) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(options.json);
  }

  const res = await fetch(path, { ...options, headers, body });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401) {
    onUnauthorized('Session expired, please login again');
    throw new Error(data.error || 'Login required');
  }
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const money = (n) => (n === null || n === undefined ? '-' : Number(n).toFixed(2));
