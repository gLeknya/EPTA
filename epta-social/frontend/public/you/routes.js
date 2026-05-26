// Маппинг роутов между FronEnd и Backend API

const ROUTE_MAPPING = {
    // Аутентификация
    auth: {
        login: '/api/auth/login',           // POST - вход/регистрация
        logout: '/api/auth/logout',         // POST - выход
        refresh: '/api/auth/refresh',       // POST - обновление токена
        me: '/api/auth/me',                 // GET - текущий пользователь
        google: '/api/auth/google',         // POST - вход через Google
        telegram: '/api/auth/telegram-link' // POST - привязка Telegram
    },
    
    // Пользователи
    users: {
        getById: (userId) => `/api/users/${userId}`,                    // GET
        getByUsername: (username) => `/api/users/by-username/${username}`, // GET
        updateMe: '/api/users/me/update',                               // PATCH
        follow: (userId) => `/api/users/${userId}/follow`,              // POST
        unfollow: (userId) => `/api/users/${userId}/unfollow`           // POST
    },
    
    // Посты
    posts: {
        list: '/api/posts',                                    // GET - лента постов (cursor pagination)
        create: '/api/posts',                                  // POST - создать пост
        delete: (postId) => `/api/posts/${postId}`,           // DELETE
        like: (postId) => `/api/posts/${postId}/like`,        // POST
        unlike: (postId) => `/api/posts/${postId}/unlike`,    // POST
        repost: (postId) => `/api/posts/${postId}/repost`,    // POST
        comments: (postId) => `/api/posts/${postId}/comments` // GET/POST
    },
    
    // Уведомления
    notifications: {
        list: '/api/notifications',      // GET
        markRead: '/api/notifications/read' // POST
    },
    
    // Модерация (только для модераторов/админов)
    moderation: {
        logs: '/api/moderation/logs',    // GET
        warn: '/api/moderation/warn',    // POST
        ban: '/api/moderation/ban',      // POST
        unban: '/api/moderation/unban',  // POST
        verify: '/api/moderation/verify', // POST
        setRole: '/api/moderation/role'  // POST
    },
    
    // Загрузка файлов
    upload: '/api/upload' // POST - загрузка изображений
};

// Схемы данных для запросов
const REQUEST_SCHEMAS = {
    login: {
        username: 'string (required)',
        password: 'string (optional)',
        displayName: 'string (optional)'
    },
    
    createPost: {
        text: 'string (required, max 500)',
        imageUrl: 'string (optional)',
        gifUrl: 'string (optional)'
    },
    
    createComment: {
        text: 'string (required)'
    },
    
    updateProfile: {
        displayName: 'string (optional)',
        bio: 'string (optional)',
        avatar: 'string (optional)'
    }
};

// Схемы ответов
const RESPONSE_SCHEMAS = {
    user: {
        id: 'string',
        username: 'string',
        displayName: 'string',
        avatar: 'string | null',
        bio: 'string | null',
        verificationBadge: 'boolean',
        role: 'string (user|moderator|admin)',
        createdAt: 'datetime',
        banned: 'boolean',
        warnCount: 'number'
    },
    
    post: {
        id: 'string',
        authorId: 'string',
        text: 'string',
        createdAt: 'datetime',
        imageUrl: 'string | null',
        gifUrl: 'string | null',
        likeCount: 'number',
        commentCount: 'number',
        repostCount: 'number',
        repostedFrom: 'string | null',
        author: 'UserMinimal',
        isLiked: 'boolean',
        isOwner: 'boolean'
    },
    
    paginatedPosts: {
        posts: 'Post[]',
        nextCursor: 'string | null'
    }
};
