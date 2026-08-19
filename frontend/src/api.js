/**
 * API client for camply-web backend
 */

const API_BASE = '/api';

async function request(path, options = {}) {
    const url = `${API_BASE}${path}`;
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
        ...options,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Request failed' }));
        throw new Error(error.detail || `HTTP ${response.status}`);
    }

    if (response.status === 204) return null;
    return response.json();
}

export const api = {
    // Searches
    getSearches: () => request('/searches'),
    getSearch: (id) => request(`/searches/${id}`),
    createSearch: (data) => request('/searches', { method: 'POST', body: JSON.stringify(data) }),
    updateSearch: (id, data) => request(`/searches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    deleteSearch: (id) => request(`/searches/${id}`, { method: 'DELETE' }),
    runSearch: (id) => request(`/searches/${id}/run`, { method: 'POST' }),
    getHistory: (id) => request(`/searches/${id}/history`),
    getSearchLogs: (id) => request(`/searches/${id}/logs`),

    // Settings
    getSettings: () => request('/settings'),
    updateSettings: (settings) => request('/settings', { method: 'PUT', body: JSON.stringify({ settings }) }),

    // Metadata
    getProviders: () => request('/providers'),
    getNotificationMethods: () => request('/notification-methods'),
};
