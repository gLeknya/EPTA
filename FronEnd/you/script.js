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
posts = posts.map(p => ({...p, date: new Date(p.date)}));

// Публичные посты для ленты
let publicPosts = JSON.parse(localStorage.getItem('epta_public_posts') || '[]');
publicPosts = publicPosts.map(p => ({...p, date: new Date(p.date)}));

// Файлы для загрузки (только в памяти)
let pendingFiles = [];

// Текущий пост для комментариев
let currentPostId = null;

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
    const clean = posts.map(p => ({id: p.id, text: p.text, date: p.date, views: p.views, isPublic: p.isPublic, author: p.author, avatar: p.avatar}));
    localStorage.setItem('epta_wall_posts', JSON.stringify(clean));
}

function savePublicPosts() {
    const clean = publicPosts.map(p => ({id: p.id, text: p.text, date: p.date, views: p.views, isPublic: p.isPublic, author: p.author, avatar: p.avatar}));
    localStorage.setItem('epta_public_posts', JSON.stringify(clean));
}

function createFallingNumbers() {
    const container = document.getElementById('fallingNumbers');
    if (!container) return;
    setInterval(() => {
        const number = document.createElement('div');
        number.className = 'falling-number';
        number.textContent = '42';
        number.style.left = Math.random() * 100 + '%';
        number.style.animationDuration = (Math.random() * 10 + 8) + 's';
        number.style.fontSize = (Math.random() * 10 + 12) + 'px';
        container.appendChild(number);
        setTimeout(() => number.remove(), 18000);
    }, 800);
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
        if (f.size > MAX) { showNotification(`Файл "${f.name}" больше 10 МБ!`); continue; }
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

function showNotification(msg) {
    const n = document.getElementById('notification');
    n.textContent = msg;
    n.classList.add('show');
    setTimeout(() => n.classList.remove('show'), 2000);
}

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
    return `<div class="post-files">${files.map(f => {
        const url = URL.createObjectURL(f);
        if (f.type.startsWith('image/')) return `<img src="${url}" class="post-file-image">`;
        if (f.type.startsWith('video/')) return `<video src="${url}" class="post-file-video" controls></video>`;
        return `<div class="post-file-other">${f.name} (${(f.size/1024/1024).toFixed(2)} MB)</div>`;
    }).join('')}</div>`;
}

function renderPosts() {
    const container = document.getElementById('postsContainer');
    if (!container) return;
    const sorted = sortPosts([...posts]);
    if (!sorted.length) {
        container.innerHTML = '<p style="text-align:center;padding:60px;color:#888;">Нет постов. Напиши первый!</p>';
        return;
    }
    container.innerHTML = sorted.map(post => `
        <div class="post">
            <div class="post-header">
                <div class="post-avatar-placeholder" style="width:36px;height:36px;font-size:18px;">${post.avatar||':)'}</div>
                <div class="post-header-info">
                    <span class="post-author">${escapeHtml(post.author||userData.username)}</span>
                    <span class="post-date">${formatDateTime(post.date)}${post.isPublic?' (Публичный)':''}</span>
                </div>
            </div>
            ${post.text?`<div class="post-text">${escapeHtml(post.text)}</div>`:''}
            <div class="post-stats">
                <span>${post.views||0} просмотров</span>
                <span>${Reposts.getRepostCount(post.id)} репостов</span>
                <span>${Likes.getLikeCount(post.id)} лайков</span>
                <span>${Comments.getCommentCount(post.id)} комментов</span>
            </div>
            <div class="post-actions">
                <button class="post-action-btn" onclick="likePost(this,${post.id})">Like (${Likes.getLikeCount(post.id)})</button>
                <button class="post-action-btn" onclick="openComments(${post.id})">Comment (${Comments.getCommentCount(post.id)})</button>
                <button class="post-action-btn" onclick="repostPost(${post.id})">Repost (${Reposts.getRepostCount(post.id)})</button>
            </div>
        </div>
    `).join('');
}

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
                <div class="post-avatar-placeholder">:)</div>
                <div class="post-input-wrapper">
                    <textarea class="post-input" placeholder="Что нового?" id="postInput"></textarea>
                    <div class="post-actions-bar">
                        <input type="file" id="fileInput" style="display:none" multiple onchange="handleFiles(this.files)">
                        <button class="post-action-icon glass-btn" onclick="document.getElementById('fileInput').click()">+</button>
                        <div class="file-list" id="fileList"></div>
                        <label style="color:#61DE2A;font-size:12px;display:flex;align-items:center;gap:5px;margin-left:10px">
                            <input type="checkbox" id="publicCheckbox"> Публичный
                        </label>
                        <button class="post-submit glass-btn" onclick="addPost()">></button>
                    </div>
                </div>
            </div>
            <div id="postsContainer"></div>
        `;
        renderPosts();
    } else {
        fb.style.display = 'none';
        wall.innerHTML = `<p style="text-align:center;padding:60px;color:#888;">${tabName==='photos'?'Фотки будут тут':'Видео будут тут'}</p>`;
    }
}

function addPost() {
    const input = document.getElementById('postInput');
    if (!input) return;
    const text = input.value.trim();
    const isPublic = document.getElementById('publicCheckbox')?.checked || false;
    if (!text && !pendingFiles.length) return;
    
    const post = {
        id: Date.now(),
        text: text,
        date: new Date(),
        views: 0,
        isPublic: isPublic,
        author: userData.username,
        avatar: ':)',
        files: [...pendingFiles]
    };
    
    posts.unshift(post);
    saveWallPosts();
    if (isPublic) { publicPosts.unshift({...post, files:[]}); savePublicPosts(); }
    pendingFiles = [];
    updateFileList();
    renderPosts();
    input.value = '';
    const cb = document.getElementById('publicCheckbox');
    if (cb) cb.checked = false;
}

function likePost(btn, postId) {
    if (btn.classList.contains('liked')) {
        btn.classList.remove('liked');
        Likes.removeLike(postId, 'currentUser');
    } else {
        btn.classList.add('liked');
        Likes.addLike(postId, 'currentUser');
    }
    renderPosts();
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
            <div class="comment-header"><div class="comment-avatar">:)</div><span class="comment-author">${escapeHtml(c.author)}</span><span class="comment-date">${formatDateTime(new Date(c.date))}</span></div>
            <div class="comment-text">${escapeHtml(c.text)}</div>
        </div>
    `).join('') : '<p style="color:#666;text-align:center;padding:20px;">Нет комментариев</p>';
}

function repostPost(postId) {
    Reposts.addRepost(postId, 'currentUser');
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
    if (s) { userData.status = s; document.getElementById('profileStatus').textContent = s; }
    closeStatusModal();
}

function toggleFriend() {
    const btn = document.getElementById('addFriendBtn');
    btn.textContent = btn.textContent.includes('Добавить') ? 'Друзья' : 'Добавить в друзья';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.getElementById('statusModal').addEventListener('click', function(e) { if (e.target === this) closeStatusModal(); });
document.getElementById('commentsModal').addEventListener('click', function(e) { if (e.target === this) closeCommentsModal(); });

document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.ctrlKey && document.activeElement?.id === 'postInput') addPost();
});