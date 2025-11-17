/**
 * Shared API client for making authenticated requests to the Memory Server API
 */

const API_BASE = '/api';

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  warning?: string;
}

class ApiClient {
  private apiKey: string | null = null;

  constructor() {
    // Try to load API key from localStorage
    this.apiKey = localStorage.getItem('memory_server_api_key');
  }

  /**
   * Set the API key for authenticated requests
   */
  setApiKey(key: string) {
    this.apiKey = key;
    localStorage.setItem('memory_server_api_key', key);
  }

  /**
   * Clear the stored API key
   */
  clearApiKey() {
    this.apiKey = null;
    localStorage.removeItem('memory_server_api_key');
  }

  /**
   * Get the current API key
   */
  getApiKey(): string | null {
    return this.apiKey;
  }

  /**
   * Get default headers including Authorization
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.apiKey) {
      headers['Authorization'] = `Bearer ${this.apiKey}`;
    }

    return headers;
  }

  /**
   * Make a GET request
   */
  async get<T>(path: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText })) as { error?: string };
      throw new Error(errorData.error || `Request failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Make a POST request
   */
  async post<T>(path: string, body?: any): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText })) as { error?: string };
      throw new Error(errorData.error || `Request failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Make a PUT request
   */
  async put<T>(path: string, body?: any): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText })) as { error?: string };
      throw new Error(errorData.error || `Request failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Make a PATCH request
   */
  async patch<T>(path: string, body?: any): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText })) as { error?: string };
      throw new Error(errorData.error || `Request failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Make a DELETE request
   */
  async delete<T>(path: string): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE}${path}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText })) as { error?: string };
      throw new Error(errorData.error || `Request failed: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Bootstrap: Create first API key without authentication
   * Only works when no keys exist in the database
   */
  async bootstrap<T>(body: any): Promise<ApiResponse<T>> {
    const response = await fetch(`${API_BASE}/admin/keys/bootstrap`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Explicitly no Authorization header for bootstrap
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: response.statusText })) as { error?: string };
      throw new Error(errorData.error || `Request failed: ${response.statusText}`);
    }

    return response.json();
  }
}

// Export a singleton instance
export const api = new ApiClient();
