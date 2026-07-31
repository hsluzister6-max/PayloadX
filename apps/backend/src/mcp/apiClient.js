import axios from 'axios';

const DEFAULT_BASE =
  process.env.PAYLOADX_BASE_URL ||
  process.env.PAYLOADX_SERVER_URL ||
  'https://payload-x-884697093779.europe-west1.run.app';

/**
 * Authenticated HTTP client for PayloadX REST API.
 * Only needs base URL + Bearer token — no Mongo / JWT_SECRET.
 */
export function createApiClient({ baseUrl = DEFAULT_BASE, token } = {}) {
  if (!token) throw new Error('PAYLOADX_TOKEN is required');

  const api = axios.create({
    baseURL: String(baseUrl).replace(/\/$/, ''),
    timeout: 30000,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  return {
    baseUrl: api.defaults.baseURL,
    async get(path, params) {
      const { data } = await api.get(path, { params });
      return data;
    },
    async post(path, body) {
      const { data } = await api.post(path, body);
      return data;
    },
    async put(path, body) {
      const { data } = await api.put(path, body);
      return data;
    },
    async del(path) {
      const { data } = await api.delete(path);
      return data;
    },
  };
}

export { DEFAULT_BASE };
