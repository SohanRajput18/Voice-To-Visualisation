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

  // Query Management
  async processQuery(prompt: string) {
    const response = await fetch(`${API_URL}/api/query/process`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ prompt })
    });
    const data = await response.json();
    if (!response.ok) {
      // Return details even if failed so frontend can show validation errors/SQL preview
      return {
        hasError: true,
        error: data.error || 'Failed to run query',
        sql: data.sql,
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

  async getSchema() {
    const response = await fetch(`${API_URL}/api/query/schema`, {
      headers: getHeaders()
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to fetch schema');
    return data.schema;
  }
};
