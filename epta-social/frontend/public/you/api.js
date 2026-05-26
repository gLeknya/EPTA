// API адаптер для интеграции с backend enta_new
const API_BASE_URL = 'http://localhost:8000';

class APIClient {
    constructor() {
        this.accessToken = localStorage.getItem('access_token');
    }

    async request(endpoint, options = {}) {
        const url = `${API_BASE_URL}${endpoint}`;
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };

        if (this.accessToken) {
            headers['Authorization'] = `Bearer ${this.accessToken}`;
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers,
                credentials: 'include'
            });

            if (response.status === 401) {
                const refreshed = await this.refreshToken();
                if (refreshed) {
                    headers['Authorization'] = `Bearer ${this.accessToken}`;
                    return fetch(url, { ...options, headers, credentials: 'include' });
                }
                throw new Error('Требуется авторизация');
            }

            return response;
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    async refreshToken() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                this.accessToken = data.accessToken;
                localStorage.setItem('access_token', data.accessToken);
                return true;
            }
            return false;
        } catch {
            return false;
        }
    }

    // Auth
    async login(username, password = null, displayName = null) {
        const response = await this.request('/api/auth/login', {
            method: 'POST',
            body: JSON.stringify({ username, password, displayName })
        });
        const data = await response.json();
        if (data.accessToken) {
            this.accessToken = data.accessToken;
            localStorage.setItem('access_token', data.accessToken);
            localStorage.setItem('current_user', JSON.stringify(data.user));
        }
        return data;
    }

    async logout() {
        await this.request('/api/auth/logout', { method: 'POST' });
        this.accessToken = null;
        localStorage.removeItem('access_token');
        localStorage.removeItem('current_user');
    }

    async getMe() {
        const response = await this.request('/api/auth/me');
        return response.json();
    }

    // Users
    async getUser(userId) {
        const response = await this.request(`/api/users/${userId}`);
        return response.json();
    }

    async getUserByUsername(username) {
        const response = await this.request(`/api/users/by-username/${username}`);
        return response.json();
    }

    async updateProfile(data) {
        const response = await this.request('/api/users/me/update', {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
        return response.json();
    }

    async followUser(userId) {
        const response = await this.request(`/api/users/${userId}/follow`, { method: 'POST' });
        return response.json();
    }

    async unfollowUser(userId) {
        const response = await this.request(`/api/users/${userId}/unfollow`, { method: 'POST' });
        return response.json();
    }

    // Posts
    async getPosts(cursor = null, limit = 20) {
        const params = new URLSearchParams({ limit });
        if (cursor) params.append('cursor', cursor);
        const response = await this.request(`/api/posts?${params}`);
        return response.json();
    }

    async createPost(text, imageUrl = null, gifUrl = null) {
        const response = await this.request('/api/posts', {
            method: 'POST',
            body: JSON.stringify({ text, imageUrl, gifUrl })
        });
        return response.json();
    }

    async deletePost(postId) {
        const response = await this.request(`/api/posts/${postId}`, { method: 'DELETE' });
        return response.json();
    }

    async likePost(postId) {
        const response = await this.request(`/api/posts/${postId}/like`, { method: 'POST' });
        return response.json();
    }

    async unlikePost(postId) {
        const response = await this.request(`/api/posts/${postId}/unlike`, { method: 'POST' });
        return response.json();
    }

    async repostPost(postId) {
        const response = await this.request(`/api/posts/${postId}/repost`, { method: 'POST' });
        return response.json();
    }

    // Comments
    async getComments(postId) {
        const response = await this.request(`/api/posts/${postId}/comments`);
        return response.json();
    }

    async createComment(postId, text) {
        const response = await this.request(`/api/posts/${postId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ text })
        });
        return response.json();
    }

    // Notifications
    async getNotifications() {
        const response = await this.request('/api/notifications');
        return response.json();
    }

    async markNotificationsRead(notificationIds) {
        const response = await this.request('/api/notifications/read', {
            method: 'POST',
            body: JSON.stringify({ notificationIds })
        });
        return response.json();
    }
}

const api = new APIClient();
