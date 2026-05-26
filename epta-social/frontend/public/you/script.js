// Данные пользователя
let userData = {
    username: '@username',
    status: 'Добавить статус',
    currentStatus: 'online'
};

// Текущий фильтр и вкладка
let currentFilter = 'date';
let currentTab = 'wall';

// Массив постов на стене
let posts = JSON.parse(localStorage.getItem('epta_wall_posts') || '[]');
posts = posts.map(p => ({...p, date: new Date(p.date), files: p.files || [], views: p.views || 0, viewedBy: p.viewedBy || []}));

// Публичные посты для ленты
let publicPosts = JSON.parse(localStorage.getItem('epta_public_posts') || '[]');
publicPosts = publicPosts.map(p => ({...p, date: new Date(p.date), files: p.files || [], views: p.views || 0, viewedBy: p.viewedBy || []}));

// Файлы для загрузки
let pendingFiles = [];
let currentPostId = null;

// ID текущего пользователя (уникальный для сессии)
const currentUserId = localStorage.getItem('epta_user_id') || 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('epta_user_id', currentUserId);

// Форматирование чисел (1K, 1.2M и т.д.)
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

// Инициализация
document.addEventListener('DOMContentLoaded', function() {
    changeStatus('online');
    createFallingNumbers();
    renderPosts();
    
    document.addEventListener('click', function(e) {
        const dropdown = document.getElementById('statusDropdown');
        const dot = document.getElementById('statusDot');
        if (dropdown && dot && !dot.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.classList.remove('show');
        }
    });
});

function saveWallPosts() {
    const clean = posts.map(p => ({
        id: p.id, text: p.text, date: p.date, views: p.views, viewedBy: p.viewedBy,
        isPublic: p.isPublic, author: p.author, avatar: p.avatar,
        files: []
    }));
    localStorage.setItem('epta_wall_posts', JSON.stringify(clean));
}

function savePublicPosts() {
    const clean = publicPosts.map(p => ({
        id: p.id, text: p.text, date: p.date, views: p.views, viewedBy: p.viewedBy,
        isPublic: p.isPublic, author: p.author, avatar: p.avatar,
        files: []
    }));
    localStorage.setItem('epta_public_posts', JSON.stringify(clean));
}

function createFallingNumbers() {
    const container = document.getElementById('fallingNumbers');
    if (!container) return;
    
    function spawnNumber() {
        const number = document.createElement('div');
        number.className = 'falling-number';
        number.textContent = '42';
        
        const size = Math.random() * 14 + 10;
        const left = Math.random() * 100;
        const duration = Math.random() * 12 + 8;
        const delay = Math.random() * 5;
        
        number.style.cssText = `
            left: ${left}%;
            font-size: ${size}px;
            animation-duration: ${duration}s;
            animation-delay: ${delay}s;
        `;
        
        container.appendChild(number);
        
        setTimeout(() => {
            if (number.parentNode) number.remove();
        }, (duration + delay) * 1000 + 500);
    }
    
    for (let i = 0; i < 15; i++) {
        setTimeout(() => spawnNumber(), i * 150);
    }
    
    setInterval(() => {
        if (container.children.length < 45) {
            for (let i = 0; i < 3; i++) {
                setTimeout(() => spawnNumber(), i * 100);
            }
        }
    }, 600);
}

function toggleMenu() {
    document.getElementById('menuPanel').classList.toggle('active');
}

document.addEventListener('click', function(e) {
    const menu = document.getElementById('burgerMenu');
    const panel = document.getElementById('menuPanel');
    if (menu && panel && !menu.contains(e.target) && panel.classList.contains('active')) {
        panel.classList.remove('active');
    }
});

function toggleStatusDropdown(event) {
    event.stopPropagation();
    document.getElementById('statusDropdown').classList.toggle('show');
}

function changeStatus(status) {
    const wrapper = document.getElementById('avatarWrapper');
    wrapper.classList.remove('status-online', 'status-inactive', 'status-dnd', 'status-offline');
    switch(status) {
        case 'online': wrapper.classList.add('status-online'); break;
        case 'inactive': wrapper.classList.add('status-inactive'); break;
        case 'dnd': wrapper.classList.add('status-dnd'); break;
        case 'offline': wrapper.classList.add('status-offline'); break;
    }
    userData.currentStatus = status;
    document.getElementById('statusDropdown').classList.remove('show');
}

function handleFiles(files) {
    const MAX = 10 * 1024 * 1024;
    for (let f of files) {
        if (f.size > MAX) { return; }
        if (!pendingFiles.find(x => x.name === f.name && x.size === f.size)) pendingFiles.push(f);
    }
    updateFileList();
    document.getElementById('fileInput').value = '';
}

function updateFileList() {
    const el = document.getElementById('fileList');
    if (!el) return;
    el.innerHTML = pendingFiles.map((f, i) => `<div class="file-item">${f.name} (${(f.size/1024/1024).toFixed(2)} MB) <span class="remove-file" onclick="removeFile(${i})">x</span></div>`).join('');
}

function removeFile(i) { pendingFiles.splice(i, 1); updateFileList(); }

function setFilter(filter, btn) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderPosts();
}

function sortPosts(arr) {
    switch(currentFilter) {
        case 'date': return arr.sort((a, b) => b.date - a.date);
        case 'views': return arr.sort((a, b) => (b.views||0) - (a.views||0));
        case 'reposts': return arr.sort((a, b) => Reposts.getRepostCount(b.id) - Reposts.getRepostCount(a.id));
        case 'likes': return arr.sort((a, b) => Likes.getLikeCount(b.id) - Likes.getLikeCount(a.id));
        case 'comments': return arr.sort((a, b) => Comments.getCommentCount(b.id) - Comments.getCommentCount(a.id));
        default: return arr;
    }
}

function formatDateTime(date) {
    const d = new Date(date);
    const now = new Date();
    const days = Math.floor((now - d) / 86400000);
    const time = d.toLocaleTimeString('ru-RU', {hour:'2-digit', minute:'2-digit'});
    const dm = d.toLocaleDateString('ru-RU', {day:'numeric', month:'long'});
    if (days === 0) return `сегодня в ${time}`;
    if (days === 1) return `вчера в ${time}`;
    return `${dm} в ${time}`;
}

function renderPostFiles(files) {
    if (!files || !files.length) return '';
    let html = '<div class="post-files">';
    for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (f instanceof File || f instanceof Blob) {
            const url = URL.createObjectURL(f);
            if (f.type.startsWith('image/')) {
                html += `<img src="${url}" class="post-file-image" onclick="window.open(this.src)">`;
            } else if (f.type.startsWith('video/')) {
                html += `<video src="${url}" class="post-file-video" controls></video>`;
            } else {
                html += `<div class="post-file-other">📎 ${f.name} (${(f.size/1024/1024).toFixed(2)} MB)</div>`;
            }
        }
    }
    html += '</div>';
    return html;
}

function incrementViews(postId) {
    const post = posts.find(p => p.id === postId);
    if (post && !post.viewedBy?.includes(currentUserId)) {
        if (!post.viewedBy) post.viewedBy = [];
        post.viewedBy.push(currentUserId);
        post.views = post.viewedBy.length;
        saveWallPosts();
        return true;
    }
    return false;
}

function renderPosts() {
    const container = document.getElementById('postsContainer');
    if (!container) return;
    const sorted = sortPosts([...posts]);
    if (!sorted.length) {
        container.innerHTML = '<p style="text-align:center;padding:60px;color:#888;">Нет постов. Напиши первый!</p>';
        return;
    }
    container.innerHTML = sorted.map(post => {
        const isLiked = Likes.hasLiked(post.id, 'currentUser');
        const viewsCount = formatNumber(post.views || 0);
        const repostCount = formatNumber(Reposts.getRepostCount(post.id));
        const likeCount = formatNumber(Likes.getLikeCount(post.id));
        const commentCount = formatNumber(Comments.getCommentCount(post.id));
        
        return `
        <div class="post" data-post-id="${post.id}">
            <div class="post-header">
                <div class="post-avatar-placeholder" style="width:36px;height:36px;">
                    <img src="../png/portrait.png" class="avatar-img-small" alt="">
                </div>
                <div class="post-header-info">
                    <span class="post-author">${escapeHtml(post.author || userData.username)}</span>
                    <span class="post-date">${formatDateTime(post.date)}${post.isPublic ? ' (Публичный)' : ''}</span>
                </div>
            </div>
            ${post.text ? `<div class="post-text">${escapeHtml(post.text)}</div>` : ''}
            ${renderPostFiles(post.files || [])}
            
            <div class="post-actions">
                <div class="stat-view">
                    <img src="../png/eye.png" class="icon-16" alt=""> ${viewsCount}
                </div>
                <button class="post-action-btn" onclick="repostPost(${post.id})">
                    <img src="../png/refresh.png" class="icon-16" alt=""> ${repostCount}
                </button>
                <button class="post-action-btn ${isLiked ? 'liked' : ''}" onclick="likePost(${post.id}, this)" style="${isLiked ? 'color:#61DE2A;' : ''}">
                    <img src="../png/${isLiked ? 'heart_on' : 'heart_off'}.png" class="icon-16" alt=""> ${likeCount}
                </button>
                <button class="post-action-btn" onclick="openComments(${post.id})">
                    <img src="../png/comment.png" class="icon-16" alt=""> ${commentCount}
                </button>
            </div>
        </div>
    `}).join('');
    
    // Увеличиваем просмотры для постов в зоне видимости (только 1 раз за пользователя)
    setTimeout(() => {
        sorted.forEach(post => {
            const postElement = document.querySelector(`.post[data-post-id="${post.id}"]`);
            if (postElement && isElementInViewport(postElement)) {
                const viewed = incrementViews(post.id);
                if (viewed) {
                    // Обновляем только цифру просмотров, не перерисовывая всё
                    const viewsElement = postElement.querySelector('.stat-view');
                    if (viewsElement) {
                        const newViews = formatNumber(post.views + 1);
                        viewsElement.innerHTML = `<img src="../png/eye.png" class="icon-16" alt=""> ${newViews}`;
                    }
                }
            }
        });
    }, 100);
}

function isElementInViewport(el) {
    const rect = el.getBoundingClientRect();
    return rect.top < window.innerHeight - 100 && rect.bottom > 0;
}

// Отслеживание просмотров при скролле (только уникальные)
let viewTimeout;
let processedPosts = new Set();

window.addEventListener('scroll', function() {
    if (viewTimeout) clearTimeout(viewTimeout);
    viewTimeout = setTimeout(() => {
        document.querySelectorAll('.post').forEach(postEl => {
            const postId = parseInt(postEl.dataset.postId);
            if (postId && !processedPosts.has(postId) && isElementInViewport(postEl)) {
                processedPosts.add(postId);
                const viewed = incrementViews(postId);
                if (viewed) {
                    const viewsElement = postEl.querySelector('.stat-view');
                    if (viewsElement) {
                        const post = posts.find(p => p.id === postId);
                        const newViews = formatNumber(post?.views || 0);
                        viewsElement.innerHTML = `<img src="../png/eye.png" class="icon-16" alt=""> ${newViews}`;
                    }
                }
            }
        });
    }, 300);
});

function switchTab(btn, tabName) {
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    currentTab = tabName;
    const wall = document.getElementById('wallContent');
    const fb = document.getElementById('filtersBar');
    if (tabName === 'wall') {
        fb.style.display = 'flex';
        wall.innerHTML = `
            <div class="post-editor">
                <div class="post-avatar-placeholder">
                    <img src="../png/portrait.png" class="avatar-img-small" alt="">
                </div>
                <div class="post-input-wrapper">
                    <textarea class="post-input" placeholder="Что нового?" id="postInput"></textarea>
                    <div class="post-actions-bar">
                        <input type="file" id="fileInput" style="display:none" multiple onchange="handleFiles(this.files)">
                        <button class="post-action-icon glass-btn" onclick="document.getElementById('fileInput').click()">
                            <img src="../png/camera.png" class="icon-20" alt="">
                        </button>
                        <div class="file-list" id="fileList"></div>
                        <label class="toggle-switch">
                            <input type="checkbox" id="publicCheckbox">
                            <span class="toggle-slider"></span>
                            <span class="toggle-label">Публичный</span>
                        </label>
                        <button class="post-submit glass-btn" onclick="addPost()">
                            <img src="../png/paper-plane.png" class="icon-18" alt="">
                        </button>
                    </div>
                </div>
            </div>
            <div id="postsContainer"></div>
        `;
        renderPosts();
    } else {
        fb.style.display = 'none';
        wall.innerHTML = `<p style="text-align:center;padding:60px;color:#888;">${tabName === 'photos' ? '📷 Фотки будут тут' : '🎬 Видео будут тут'}</p>`;
    }
}

function addPost() {
    const input = document.getElementById('postInput');
    if (!input) return;
    const text = input.value.trim();
    const isPublic = document.getElementById('publicCheckbox')?.checked || false;
    if (!text && !pendingFiles.length) {
        return;
    }
    
    const post = {
        id: Date.now(),
        text: text,
        date: new Date(),
        views: 0,
        viewedBy: [],
        isPublic: isPublic,
        author: userData.username,
        avatar: 'portrait.png',
        files: [...pendingFiles]
    };
    
    posts.unshift(post);
    saveWallPosts();
    if (isPublic) { 
        publicPosts.unshift({...post, files: []}); 
        savePublicPosts(); 
    }
    pendingFiles = [];
    updateFileList();
    
    renderPosts();
    
    input.value = '';
    const cb = document.getElementById('publicCheckbox');
    if (cb) cb.checked = false;
}

function likePost(postId, btnElement) {
    const btn = btnElement || event?.target?.closest('.post-action-btn');
    if (!btn) return;
    
    if (btn.classList.contains('liked')) {
        btn.classList.remove('liked');
        btn.style.color = '';
        Likes.removeLike(postId, 'currentUser');
        const img = btn.querySelector('img');
        if (img) img.src = '../png/heart_off.png';
    } else {
        btn.classList.add('liked');
        btn.style.color = '#61DE2A';
        Likes.addLike(postId, 'currentUser');
        const img = btn.querySelector('img');
        if (img) img.src = '../png/heart_on.png';
    }
    
    const newCount = formatNumber(Likes.getLikeCount(postId));
    btn.innerHTML = `<img src="../png/${btn.classList.contains('liked') ? 'heart_on' : 'heart_off'}.png" class="icon-16" alt=""> ${newCount}`;
    
    // Обновляем сортировку если фильтр по лайкам
    if (currentFilter === 'likes') {
        renderPosts();
    }
}

function openComments(postId) {
    currentPostId = postId;
    document.getElementById('commentsModal').classList.add('active');
    renderComments(postId);
}

function closeCommentsModal() {
    document.getElementById('commentsModal').classList.remove('active');
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
    const list = document.getElementById('commentsList');
    const comments = Comments.getComments(postId);
    list.innerHTML = comments.length ? comments.map(c => `
        <div class="comment-item">
            <div class="comment-header">
                <div class="comment-avatar"><img src="../png/portrait.png" class="avatar-img-small" alt=""></div>
                <span class="comment-author">${escapeHtml(c.author)}</span>
                <span class="comment-date">${formatDateTime(new Date(c.date))}</span>
            </div>
            <div class="comment-text">${escapeHtml(c.text)}</div>
        </div>
    `).join('') : '<p style="color:#666;text-align:center;padding:20px;">💬 Нет комментариев</p>';
}

function repostPost(postId) {
    if (Reposts.hasReposted(postId, 'currentUser')) {
        Reposts.removeRepost(postId, 'currentUser');
    } else {
        Reposts.addRepost(postId, 'currentUser');
    }
    renderPosts();
}

function editStatus() {
    document.getElementById('statusInput').value = userData.status === 'Добавить статус' ? '' : userData.status;
    document.getElementById('statusModal').classList.add('active');
    document.getElementById('statusInput').focus();
}

function closeStatusModal() { document.getElementById('statusModal').classList.remove('active'); }

function saveStatus() {
    const s = document.getElementById('statusInput').value.trim();
    if (s) { 
        userData.status = s; 
        document.getElementById('profileStatus').textContent = s; 
    }
    closeStatusModal();
}

let isFriend = false;
function toggleFriend() {
    const btn = document.getElementById('addFriendBtn');
    if (!isFriend) {
        btn.innerHTML = '<img src="../png/users-alt.png" class="icon-18" alt=""> ✓ Друзья';
    } else {
        btn.innerHTML = '<img src="../png/users-alt.png" class="icon-18" alt=""> Добавить в друзья';
    }
    isFriend = !isFriend;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.getElementById('statusModal')?.addEventListener('click', function(e) { if (e.target === this) closeStatusModal(); });
document.getElementById('commentsModal')?.addEventListener('click', function(e) { if (e.target === this) closeCommentsModal(); });

document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.ctrlKey && document.activeElement?.id === 'postInput') addPost();
});

window.Likes = Likes;
window.Reposts = Reposts;
window.Comments = Comments;
window.likePost = likePost;