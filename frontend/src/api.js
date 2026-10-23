
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function getToken() {
  return localStorage.getItem('marst_token') || '';
}

export function saveSession(token, user) {
  localStorage.setItem('marst_token', token);
  localStorage.setItem('marst_user', JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem('marst_token');
  localStorage.removeItem('marst_user');
}

export function getSavedUser() {
  try {
    return JSON.parse(localStorage.getItem('marst_user') || 'null');
  } catch {
    return null;
  }
}

export async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `요청 실패 (${response.status})`);
  }

  return data;
}

export { API_URL };
