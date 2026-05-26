import type { AuthResponse, User, Post, PaginatedPosts } from '@types/api';

const API_BASE = '/api';

class APIClient {
  private token: string | null = localStorage.getItem('token');

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers,
      credentials: 'include',
    });

    if (response.status === 401) {
      const refreshed = await this.refreshToken();
      if (refreshed) return this.request(endpoint, options);
      throw new Error('Unauthorized');
    }

    if (!response.ok) throw new Error('API Error');
    return response.json();
  }

  private async refreshToken(): Promise<boolean> {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        this.token = data.accessToken;
        localStorage.setItem('token', data.accessToken);
        return true;
      }
    } catch {}
    return false;
  }

  async login(username: string, password?: string): Promise<AuthResponse> {
    const data = await this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.token = data.accessToken;
    localStorage.setItem('token', data.accessToken);
    return data;
  }

  async logout(): Promise<void> {
    await this.request('/auth/logout', { method: 'POST' });
    this.token = null;
    localStorage.removeItem('token');
  }

  async getMe(): Promise<User> {
    return this.request<User>('/auth/me');
  }

  async getPosts(cursor?: string): Promise<PaginatedPosts> {
    const params = cursor ? `?cursor=${cursor}` : '';
    return this.request<PaginatedPosts>(`/posts${params}`);
  }

  async createPost(text: string, imageUrl?: string): Promise<Post> {
    return this.request<Post>('/posts', {
      method: 'POST',
      body: JSON.stringify({ text, imageUrl }),
    });
  }

  async likePost(postId: string): Promise<void> {
    await this.request(`/posts/${postId}/like`, { method: 'POST' });
  }

  async unlikePost(postId: string): Promise<void> {
    await this.request(`/posts/${postId}/unlike`, { method: 'POST' });
  }
}

export const api = new APIClient();
