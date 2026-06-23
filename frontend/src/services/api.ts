const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

const getHeaders = () => {
  const token = localStorage.getItem('vtov_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
};

export const api = {
  // Authentication
  async register(username: string, email: string, password: string) {
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Registration failed');
    return data;
  },

  async login(email: string, password: string) {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Login failed');
    return data;
  },

  async getMe() {
    const response = await fetch(`${API_URL}/api/auth/me`, {
      headers: getHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch current user');
    return data.user;
  },

  async guestLogin() {
    const response = await fetch(`${API_URL}/api/auth/guest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Guest login failed');
    return data;
  },

  // Query Management
  async processQuery(prompt: string) {
    const response = await fetch(`${API_URL}/api/query/process`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ prompt })
    });
    const data = await response.json();
    if (!response.ok) {
      return {
        hasError: true,
        error: data.error || 'Failed to run query',
        sql: data.sql,
        explanation: data.explanation,
        confidence: data.confidence,
        status: data.status
      };
    }
    return data;
  },

  async getHistory() {
    const response = await fetch(`${API_URL}/api/query/history`, {
      headers: getHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch history');
    return data.history;
  },

  async clearHistory() {
    const response = await fetch(`${API_URL}/api/query/history`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to clear history');
    return data;
  },

  async deleteHistoryItem(id: number) {
    const response = await fetch(`${API_URL}/api/query/history/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to delete history item');
    return data;
  },

  async getSchema() {
    const response = await fetch(`${API_URL}/api/query/schema`, {
      headers: getHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch schema');
    return data.schema;
  },

  async getAnalytics() {
    const response = await fetch(`${API_URL}/api/query/analytics`, {
      headers: getHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch analytics');
    return data;
  },

  // Database Connection Manager Mappings
  async testConnection(engine: string, config: any) {
    const response = await fetch(`${API_URL}/api/connection/test`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ engine, config })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Connection test failed');
    return data;
  },

  async saveConnection(name: string, engine: string, config: any, isActive: boolean) {
    const response = await fetch(`${API_URL}/api/connection/save`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ name, engine, config, is_active: isActive })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to save connection profile');
    return data;
  },

  async listConnections() {
    const response = await fetch(`${API_URL}/api/connection/list`, {
      headers: getHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch connection profiles');
    return data.connections;
  },

  async activateConnection(id: number) {
    const response = await fetch(`${API_URL}/api/connection/activate/${id}`, {
      method: 'POST',
      headers: getHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to activate connection');
    return data;
  },

  async deleteConnection(id: number) {
    const response = await fetch(`${API_URL}/api/connection/${id}`, {
      method: 'DELETE',
      headers: getHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to delete connection');
    return data;
  }
};
