// Данные пользователя
let userData = {
    username: '@username',
    status: 'Добавить статус!',
    currentStatus: 'online'
};

// Текущий фильтр и вкладка
let currentFilter = 'date';
let currentTab = 'wall';

// Массив постов
let posts = [];

// Файлы для загрузки
let pendingFiles = [];

// Текущий пост для комментариев
let currentPostId = null;

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    changeStatus('online');
    createFallingNumbers();
    renderPosts();
    
    // Закрытие дропдауна при клике вне
    document.addEventListener('click', function(e) {
        const dropdown = document.getElementById('statusDropdown');
        const dot = document.getElementById('statusDot');
        if (dropdown && dot && !dot.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });
});

// Создание падающих чисел 42
function createFallingNumbers() {
    const container = document.getElementById('fallingNumbers');
    
    setInterval(() => {
        const number = document.createElement('div');
        number.className = 'falling-number';
        number.textContent = '42';
        
        const left = Math.random() * 100;
        const duration = Math.random() * 10 + 8;
        const size = Math.random() * 10 + 12;
        
        number.style.left = left + '%';
        number.style.animationDuration = duration + 's';
        number.style.fontSize = size + 'px';
        
        container.appendChild(number);
        
        setTimeout(() => {
            number.remove();
        }, duration * 1000);
    }, 800);
}

// Меню
function toggleMenu() {
    const panel = document.getElementById('menuPanel');
    panel.classList.toggle('active');
}

document.addEventListener('click', function(e) {
    const menu = document.getElementById('burgerMenu');
    const panel = document.getElementById('menuPanel');
    
    if (menu && panel && !menu.contains(e.target) && panel.classList.contains('active')) {
        panel.classList.remove('active');
    }
});

// Переключение дропдауна статуса
function toggleStatusDropdown(event) {
    event.stopPropagation();
    const dropdown = document.getElementById('statusDropdown');
    dropdown.classList.toggle('show');
}

// Изменение статуса онлайн
function changeStatus(status) {
    const wrapper = document.getElementById('avatarWrapper');
    
    wrapper.classList.remove('status-online', 'status-inactive', 'status-dnd', 'status-offline');
    
    switch(status) {
        case 'online':
            wrapper.classList.add('status-online');
            break;
        case 'inactive':
            wrapper.classList.add('status-inactive');
            break;
        case 'dnd':
            wrapper.classList.add('status-dnd');
            break;
        case 'offline':
            wrapper.classList.add('status-offline');
            break;
    }
    
    userData.currentStatus = status;
    
    const dropdown = document.getElementById('statusDropdown');
    dropdown.classList.remove('show');
}

// Обработка файлов
function handleFiles(files) {
    const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
    
    for (let file of files) {
        if (file.size > MAX_SIZE) {
            showNotification(`Файл "${file.name}" превышает 10 МБ!`);
            continue;
        }
        
        if (!pendingFiles.find(f => f.name === file.name && f.size === file.size)) {
            pendingFiles.push(file);
        }
    }
    
    updateFileList();
    document.getElementById('fileInput').value = '';
}

// Обновление списка файлов
function updateFileList() {
    const fileList = document.getElementById('fileList');
    if (!fileList) return;
    
    fileList.innerHTML = pendingFiles.map((file, index) => `
        <div class="file-item">
            📄 ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)
            <span class="remove-file" onclick="removeFile(${index})">✕</span>
        </div>
    `).join('');
}

// Удаление файла из очереди
function removeFile(index) {
    pendingFiles.splice(index, 1);
    updateFileList();
}

// Уведомление
function showNotification(message) {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 2000);
}

// Установка фильтра
function setFilter(filter, btn) {
    currentFilter = filter;
    
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    
    renderPosts();
}

// Сортировка постов
function sortPosts(postsArray) {
    switch(currentFilter) {
        case 'date':
            return postsArray.sort((a, b) => b.date - a.date);
        case 'views':
            return postsArray.sort((a, b) => b.views - a.views);
        case 'reposts':
            return postsArray.sort((a, b) => b.reposts - a.reposts);
        case 'likes':
            return postsArray.sort((a, b) => b.likes - a.likes);
        case 'comments':
            return postsArray.sort((a, b) => Comments.getCommentCount(b.id) - Comments.getCommentCount(a.id));
        default:
            return postsArray;
    }
}

// Создание URL для файла
function createFileURL(file) {
    return URL.createObjectURL(file);
}

// Рендер файлов в посте
function renderPostFiles(files) {
    if (!files || files.length === 0) return '';
    
    return `
        <div class="post-files">
            ${files.map(file => {
                const url = createFileURL(file);
                if (file.type.startsWith('image/')) {
                    return `<img src="${url}" class="post-file-image" alt="${file.name}" onclick="window.open('${url}')">`;
                } else if (file.type.startsWith('video/')) {
                    return `<video src="${url}" class="post-file-video" controls></video>`;
                } else {
                    return `<div class="post-file-other">📄 ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)</div>`;
                }
            }).join('')}
        </div>
    `;
}

// Рендер постов
function renderPosts() {
    const postsContainer = document.getElementById('postsContainer');
    if (!postsContainer) return;
    
    const sortedPosts = sortPosts([...posts]);
    
    postsContainer.innerHTML = sortedPosts.map(post => `
        <div class="post">
            <div class="post-header">
                <div class="post-avatar-placeholder" style="width: 36px; height: 36px; font-size: 18px;">😊</div>
                <div class="post-header-info">
                    <span class="post-author">${escapeHtml(userData.username)}</span>
                    <span class="post-date">${formatDate(post.date)}</span>
                </div>
            </div>
            ${post.text ? `<div class="post-text">${escapeHtml(post.text)}</div>` : ''}
            ${post.files ? renderPostFiles(post.files) : ''}
            <div class="post-stats">
                <span>👁️ ${post.views || 0}</span>
                <span>🔄 ${Reposts.getRepostCount(post.id)}</span>
                <span>❤️ ${Likes.getLikeCount(post.id)}</span>
                <span>💬 ${Comments.getCommentCount(post.id)}</span>
            </div>
            <div class="post-actions">
                <button class="post-action-btn" onclick="likePost(this, ${post.id})">
                    ❤️ <span>${Likes.getLikeCount(post.id)}</span>
                </button>
                <button class="post-action-btn" onclick="openComments(${post.id})">
                    💬 <span>${Comments.getCommentCount(post.id)}</span>
                </button>
                <button class="post-action-btn" onclick="repostPost(${post.id})">
                    🔄 <span>${Reposts.getRepostCount(post.id)}</span>
                </button>
            </div>
        </div>
    `).join('');
}

// Переключение вкладок
function switchTab(btn, tabName) {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => tab.classList.remove('active'));
    btn.classList.add('active');
    
    currentTab = tabName;
    
    const wallContent = document.getElementById('wallContent');
    const filtersBar = document.getElementById('filtersBar');
    
    if (tabName === 'wall') {
        filtersBar.style.display = 'flex';
        wallContent.innerHTML = `
            <div class="post-editor">
                <div class="post-avatar-placeholder" id="editorAvatar">😊</div>
                <div class="post-input-wrapper">
                    <textarea class="post-input" placeholder="Че нового, братан?" id="postInput"></textarea>
                    <div class="post-actions-bar">
                        <input type="file" id="fileInput" style="display: none;" multiple accept="image/*,video/*" onchange="handleFiles(this.files)">
                        <button class="post-action-icon glass-btn" title="Прикрепить файл" onclick="document.getElementById('fileInput').click()">📎</button>
                        <div class="file-list" id="fileList"></div>
                        <button class="post-submit glass-btn" onclick="addPost()">✈️</button>
                    </div>
                </div>
            </div>
            <div id="postsContainer"></div>
        `;
        renderPosts();
        if (pendingFiles.length > 0) updateFileList();
    } else if (tabName === 'photos') {
        filtersBar.style.display = 'flex';
        wallContent.innerHTML = '<p style="text-align: center; padding: 60px; color: #888888; font-size: 18px;">📸 Тут будут фоточки!</p>';
    } else if (tabName === 'videos') {
        filtersBar.style.display = 'flex';
        wallContent.innerHTML = '<p style="text-align: center; padding: 60px; color: #888888; font-size: 18px;">🎥 Видосики будут тут!</p>';
    }
}

// Добавление нового поста
function addPost() {
    const input = document.getElementById('postInput');
    if (!input) return;
    
    const text = input.value.trim();
    
    // Проверяем файлы
    const MAX_SIZE = 10 * 1024 * 1024;
    for (let file of pendingFiles) {
        if (file.size > MAX_SIZE) {
            showNotification(`Файл "${file.name}" превышает 10 МБ и будет удалён!`);
            pendingFiles = pendingFiles.filter(f => f !== file);
            updateFileList();
        }
    }
    
    if (text || pendingFiles.length > 0) {
        const newPost = {
            id: Date.now(),
            text: text || '',
            date: new Date(),
            views: 0,
            files: [...pendingFiles]
        };
        
        posts.unshift(newPost);
        pendingFiles = [];
        updateFileList();
        renderPosts();
        
        if (input) input.value = '';
    }
}

// Лайк поста
function likePost(btn, postId) {
    const span = btn.querySelector('span');
    let count = parseInt(span.textContent);
    
    if (btn.classList.contains('liked')) {
        count--;
        btn.classList.remove('liked');
        btn.style.color = '#888888';
        Likes.removeLike(postId, 'currentUser');
    } else {
        count++;
        btn.classList.add('liked');
        btn.style.color = '#ff4444';
        Likes.addLike(postId, 'currentUser');
    }
    
    span.textContent = count;
}

// Комментарии
function openComments(postId) {
    currentPostId = postId;
    const modal = document.getElementById('commentsModal');
    modal.classList.add('active');
    renderComments(postId);
}

function closeCommentsModal() {
    document.getElementById('commentsModal').classList.remove('active');
    currentPostId = null;
}

function addCommentToPost() {
    const input = document.getElementById('commentInput');
    const text = input.value.trim();
    
    if (text && currentPostId) {
        Comments.addComment(currentPostId, text, userData.username);
        input.value = '';
        renderComments(currentPostId);
        renderPosts();
    }
}

function renderComments(postId) {
    const commentsList = document.getElementById('commentsList');
    const comments = Comments.getComments(postId);
    
    commentsList.innerHTML = comments.length === 0 
        ? '<p style="color: #666; text-align: center; padding: 20px;">Пока нет комментариев</p>'
        : comments.map(comment => `
            <div class="comment-item">
                <div class="comment-header">
                    <div class="comment-avatar">😊</div>
                    <span class="comment-author">${escapeHtml(comment.author)}</span>
                    <span class="comment-date">${formatDate(new Date(comment.date))}</span>
                </div>
                <div class="comment-text">${escapeHtml(comment.text)}</div>
            </div>
        `).join('');
}

// Репост поста
function repostPost(postId) {
    const reposted = Reposts.addRepost(postId, 'currentUser');
    if (reposted) {
        renderPosts();
    }
}

// Редактирование статуса
function editStatus() {
    const modal = document.getElementById('statusModal');
    const input = document.getElementById('statusInput');
    
    input.value = userData.status === 'Добавить статус!' ? '' : userData.status;
    modal.classList.add('active');
    input.focus();
}

function closeStatusModal() {
    document.getElementById('statusModal').classList.remove('active');
}

function saveStatus() {
    const newStatus = document.getElementById('statusInput').value.trim();
    if (newStatus) {
        userData.status = newStatus;
        document.getElementById('profileStatus').textContent = newStatus;
    }
    closeStatusModal();
}

// Друзья
function toggleFriend() {
    const btn = document.getElementById('addFriendBtn');
    if (btn.textContent.includes('Добавить')) {
        btn.innerHTML = '<span>✅</span> Друзья';
    } else {
        btn.innerHTML = '<span>👥</span> Добавить в друзья';
    }
}

// Форматирование даты
function formatDate(date) {
    const now = new Date();
    const diff = now - date;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (days === 0) {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        if (hours === 0) {
            const minutes = Math.floor(diff / (1000 * 60));
            return `${minutes} мин. назад`;
        }
        return `${hours} ч. назад`;
    } else if (days === 1) {
        return 'Вчера';
    } else if (days < 7) {
        return `${days} дн. назад`;
    } else {
        return date.toLocaleDateString('ru-RU');
    }
}

// Экранирование HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Закрытие модальных окон по клику
document.getElementById('statusModal').addEventListener('click', function(e) {
    if (e.target === this) closeStatusModal();
});

document.getElementById('commentsModal').addEventListener('click', function(e) {
    if (e.target === this) closeCommentsModal();
});

// Отправка поста по Ctrl+Enter
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.ctrlKey) {
        const postInput = document.getElementById('postInput');
        if (postInput && document.activeElement === postInput) {
            addPost();
        }
    }
});