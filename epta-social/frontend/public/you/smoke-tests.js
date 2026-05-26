// Smoke-тесты для проверки интеграции FronEnd с Backend

const API_BASE_URL = 'http://localhost:8000';

class SmokeTests {
    constructor() {
        this.results = [];
        this.testUser = {
            username: `test_${Date.now()}`,
            displayName: 'Test User'
        };
    }

    async run() {
        console.log('🧪 Запуск smoke-тестов интеграции...\n');
        
        await this.testHealthCheck();
        await this.testAuth();
        await this.testPosts();
        await this.testComments();
        
        this.printResults();
    }

    async test(name, fn) {
        try {
            await fn();
            this.results.push({ name, status: '✅ PASS' });
            console.log(`✅ ${name}`);
        } catch (error) {
            this.results.push({ name, status: '❌ FAIL', error: error.message });
            console.error(`❌ ${name}: ${error.message}`);
        }
    }

    async testHealthCheck() {
        await this.test('Health Check', async () => {
            const response = await fetch(`${API_BASE_URL}/api/health`);
            if (!response.ok) throw new Error('Health check failed');
            const data = await response.json();
            if (data.status !== 'ok') throw new Error('Invalid health status');
        });
    }

    async testAuth() {
        await this.test('Login/Register', async () => {
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(this.testUser),
                credentials: 'include'
            });
            
            if (!response.ok) throw new Error(`Login failed: ${response.status}`);
            const data = await response.json();
            
            if (!data.accessToken) throw new Error('No access token received');
            if (!data.user) throw new Error('No user data received');
            
            this.accessToken = data.accessToken;
            this.userId = data.user.id;
        });

        await this.test('Get Current User', async () => {
            const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            
            if (!response.ok) throw new Error('Failed to get current user');
            const user = await response.json();
            if (user.id !== this.userId) throw new Error('User ID mismatch');
        });

        await this.test('Refresh Token', async () => {
            const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
                method: 'POST',
                credentials: 'include'
            });
            
            if (!response.ok) throw new Error('Token refresh failed');
            const data = await response.json();
            if (!data.accessToken) throw new Error('No new access token');
        });
    }

    async testPosts() {
        await this.test('Create Post', async () => {
            const response = await fetch(`${API_BASE_URL}/api/posts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.accessToken}`
                },
                body: JSON.stringify({ text: 'Test post from smoke tests' })
            });
            
            if (!response.ok) throw new Error('Failed to create post');
            const post = await response.json();
            if (!post.id) throw new Error('No post ID returned');
            this.postId = post.id;
        });

        await this.test('Get Posts Feed', async () => {
            const response = await fetch(`${API_BASE_URL}/api/posts?limit=10`, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            
            if (!response.ok) throw new Error('Failed to get posts');
            const data = await response.json();
            if (!Array.isArray(data.posts)) throw new Error('Invalid posts format');
        });

        await this.test('Like Post', async () => {
            const response = await fetch(`${API_BASE_URL}/api/posts/${this.postId}/like`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            
            if (!response.ok) throw new Error('Failed to like post');
        });

        await this.test('Unlike Post', async () => {
            const response = await fetch(`${API_BASE_URL}/api/posts/${this.postId}/unlike`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            
            if (!response.ok) throw new Error('Failed to unlike post');
        });
    }

    async testComments() {
        await this.test('Create Comment', async () => {
            const response = await fetch(`${API_BASE_URL}/api/posts/${this.postId}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.accessToken}`
                },
                body: JSON.stringify({ text: 'Test comment' })
            });
            
            if (!response.ok) throw new Error('Failed to create comment');
        });

        await this.test('Get Comments', async () => {
            const response = await fetch(`${API_BASE_URL}/api/posts/${this.postId}/comments`, {
                headers: { 'Authorization': `Bearer ${this.accessToken}` }
            });
            
            if (!response.ok) throw new Error('Failed to get comments');
            const comments = await response.json();
            if (!Array.isArray(comments)) throw new Error('Invalid comments format');
        });
    }

    printResults() {
        console.log('\n' + '='.repeat(50));
        console.log('📊 Результаты тестов:');
        console.log('='.repeat(50));
        
        const passed = this.results.filter(r => r.status.includes('PASS')).length;
        const failed = this.results.filter(r => r.status.includes('FAIL')).length;
        
        this.results.forEach(r => {
            console.log(`${r.status} ${r.name}`);
            if (r.error) console.log(`   └─ ${r.error}`);
        });
        
        console.log('='.repeat(50));
        console.log(`✅ Пройдено: ${passed}`);
        console.log(`❌ Провалено: ${failed}`);
        console.log(`📈 Успешность: ${((passed / this.results.length) * 100).toFixed(1)}%`);
        console.log('='.repeat(50));
    }
}

// Запуск тестов
if (typeof window === 'undefined') {
    // Node.js environment
    const tests = new SmokeTests();
    tests.run().catch(console.error);
}
