// Публичные посты из хранилища
let publicPosts = JSON.parse(localStorage.getItem('epta_public_posts') || '[]');
publicPosts = publicPosts.map(p => ({...p, date: new Date(p.date), files: p.files || []}));

let currentFeedFilter = 'date';
let currentFeedTab = 'recommendations';
let currentFeedPostId = null;

// Заглушка контактов (потом из чатов)
let recentContacts = [
    {name: '@alex', avatar: ':)'},
    {name: '@maria', avatar: ':)'},
    {name: '@dmitry', avatar: ':)'}
];

document.addEventListener('DOMContentLoaded', function() {
    createFallingNumbers();
    refreshPublicPosts();
    renderFeed();
    updateSidebar();
});

// Обновление публичных постов из хранилища
function refreshPublicPosts() {
    publicPosts = JSON.parse(localStorage.getItem('epta_public_posts') || '[]');
    publicPosts = publicPosts.map(p => ({...p, date: new Date(p.date), files: p.files || []}));
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

function switchFeedTab(btn, tabName) {
    document.querySelectorAll('.feed-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    currentFeedTab = tabName;
    refreshPublicPosts();
    renderFeed();
}

function setFeedFilter(filter, btn) {
    currentFeedFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderFeed();
}

// Сохранение
function savePublicPosts() {
    localStorage.setItem('epta_public_posts', JSON.stringify(publicPosts));
}

// Извлечение хештегов
function extractHashtags(text) {
    const matches = text.match(/#[а-яА-ЯёЁa-zA-Z0-9_]+/g);
    return matches ? [...new Set(matches)] : [];
}

// Рейтинг хештегов
function calculateHashtagRank() {
    const hashtagStats = {};
    refreshPublicPosts();
    
    publicPosts.forEach(post => {
        const tags = extractHashtags(post.text || '');
        const score = (Likes.getLikeCount(post.id) || 0) + 
                      (Comments.getCommentCount(post.id) || 0) + 
                      (Reposts.getRepostCount(post.id) || 0) +
                      (post.views || 0);
        
        tags.forEach(tag => {
            if (!hashtagStats[tag]) hashtagStats[tag] = 0;
            hashtagStats[tag] += score;
        });
    });
    
    return Object.entries(hashtagStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
}

// Топ постов
function calculateTopPosts() {
    refreshPublicPosts();
    return [...publicPosts]
        .map(post => ({
            ...post,
            totalScore: (Likes.getLikeCount(post.id) || 0) + 
                       (Comments.getCommentCount(post.id) || 0) + 
                       (Reposts.getRepostCount(post.id) || 0)
        }))
        .sort((a, b) => b.totalScore - a.totalScore)
        .slice(0, 5);
}

// Обновление сайдбара
function updateSidebar() {
    const hashtagsContainer = document.getElementById('topHashtags');
    if (hashtagsContainer) {
        const topHashtags = calculateHashtagRank();
        hashtagsContainer.innerHTML = topHashtags.length === 0 
            ? '<span style="color:#666;font-size:13px;">Пока нет хештегов</span>'
            : topHashtags.map(([tag, score]) => 
                `<a href="#" class="hashtag">${tag} (${score})</a>`
            ).join('');
    }
    
    const topPostsContainer = document.getElementById('topPosts');
    if (topPostsContainer) {
        const topPosts = calculateTopPosts();
        topPostsContainer.innerHTML = topPosts.length === 0
            ? '<div style="color:#666;font-size:13px;text-align:center;padding:20px;">Пока нет постов</div>'
            : topPosts.map((post, i) => `
                <div class="popular-post-item">
                    <div class="popular-post-rank">#${i + 1}</div>
                    <div class="popular-post-info">
                        <div class="popular-post-text">${escapeHtml((post.text || '').substring(0, 50))}${post.text && post.text.length > 50 ? '...' : ''}</div>
                        <div class="popular-post-stats">${post.totalScore} очков</div>
                    </div>
                </div>
            `).join('');
    }
}

function sortFeedPosts(arr) {
    switch(currentFeedFilter) {
        case 'date': return arr.sort((a, b) => b.date - a.date);
        case 'views': return arr.sort((a, b) => (b.views || 0) - (a.views || 0));
        case 'reposts': return arr.sort((a, b) => Reposts.getRepostCount(b.id) - Reposts.getRepostCount(a.id));
        case 'likes': return arr.sort((a, b) => Likes.getLikeCount(b.id) - Likes.getLikeCount(a.id));
        case 'comments': return arr.sort((a, b) => Comments.getCommentCount(b.id) - Comments.getCommentCount(a.id));
        default: return arr;
    }
}

function createFileURL(file) {
    return URL.createObjectURL(file);
}

function renderPostFiles(files) {
    if (!files || !files.length) return '';
    return `<div class="post-files">${files.map(file => {
        const url = createFileURL(file);
        if (file.type && file.type.startsWith('image/')) return `<img src="${url}" class="post-file-image" onclick="window.open('${url}')">`;
        if (file.type && file.type.startsWith('video/')) return `<video src="${url}" class="post-file-video" controls></video>`;
        return `<div class="post-file-other">${file.name} (${(file.size/1024/1024).toFixed(2)} MB)</div>`;
    }).join('')}</div>`;
}

function formatDateTime(date) {
    const now = new Date();
    const d = new Date(date);
    const days = Math.floor((now - d) / 86400000);
    const time = d.toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'});
    const dayMonth = d.toLocaleDateString('ru-RU', {day: 'numeric', month: 'long'});
    
    if (days === 0) return `сегодня в ${time}`;
    if (days === 1) return `вчера в ${time}`;
    return `${dayMonth} в ${time}`;
}

function renderFeed() {
    const container = document.getElementById('feedPosts');
    if (!container) return;
    
    refreshPublicPosts();
    let posts = sortFeedPosts([...publicPosts]);
    
    if (!posts.length) {
        container.innerHTML = '<p style="text-align:center;padding:60px;color:#888;font-size:18px;">Пока нет публичных постов</p>';
        return;
    }
    
    container.innerHTML = posts.map(post => `
        <div class="feed-post">
            <div class="feed-post-header">
                <div class="feed-post-avatar">${post.avatar || ':)'}</div>
                <div class="feed-post-info">
                    <div class="feed-post-author">${escapeHtml(post.author || '@username')}</div>
                    <div class="feed-post-date">${formatDateTime(post.date)}</div>
                </div>
            </div>
            ${post.text ? `<div class="feed-post-text">${escapeHtml(post.text)}</div>` : ''}
            ${post.files ? renderPostFiles(post.files) : ''}
            <div class="feed-post-stats">
                <span>${post.views || 0} просмотров</span>
                <span>${Reposts.getRepostCount(post.id)} репостов</span>
                <span>${Likes.getLikeCount(post.id)} лайков</span>
                <span>${Comments.getCommentCount(post.id)} комментов</span>
            </div>
            <div class="feed-post-actions">
                <button class="post-action-btn" onclick="likeFeedPost(this, ${post.id})">Like (${Likes.getLikeCount(post.id)})</button>
                <button class="post-action-btn" onclick="openFeedComments(${post.id})">Comment (${Comments.getCommentCount(post.id)})</button>
                <button class="post-action-btn" onclick="openRepostModal(${post.id})">Repost (${Reposts.getRepostCount(post.id)})</button>
            </div>
        </div>
    `).join('');
}

function likeFeedPost(btn, postId) {
    if (btn.classList.contains('liked')) {
        btn.classList.remove('liked');
        Likes.removeLike(postId, 'currentUser');
    } else {
        btn.classList.add('liked');
        Likes.addLike(postId, 'currentUser');
    }
    renderFeed();
    updateSidebar();
}

// Репост с выбором контакта
function openRepostModal(postId) {
    currentFeedPostId = postId;
    const modal = document.getElementById('repostModal');
    const contactsContainer = document.getElementById('repostContacts');
    
    contactsContainer.innerHTML = recentContacts.map(contact => `
        <div class="repost-contact-item" onclick="sendRepost(${postId}, '${escapeHtml(contact.name)}')">
            <div class="comment-avatar">${contact.avatar}</div>
            <span>${escapeHtml(contact.name)}</span>
        </div>
    `).join('') + `
        <div class="repost-contact-item" onclick="sendRepost(${postId}, 'all')">
            <div class="comment-avatar">...</div>
            <span>Всем друзьям</span>
        </div>
    `;
    
    modal.classList.add('active');
}

function closeRepostModal() {
    document.getElementById('repostModal').classList.remove('active');
    currentFeedPostId = null;
}

function sendRepost(postId, target) {
    Reposts.addRepost(postId, 'currentUser');
    closeRepostModal();
    renderFeed();
    updateSidebar();
}

function openFeedComments(postId) {
    currentFeedPostId = postId;
    document.getElementById('feedCommentsModal').classList.add('active');
    renderFeedComments(postId);
}

function closeFeedComments() {
    document.getElementById('feedCommentsModal').classList.remove('active');
    currentFeedPostId = null;
}

function addFeedComment() {
    const input = document.getElementById('feedCommentInput');
    const text = input.value.trim();
    if (text && currentFeedPostId) {
        Comments.addComment(currentFeedPostId, text, '@username');
        input.value = '';
        renderFeedComments(currentFeedPostId);
        renderFeed();
        updateSidebar();
    }
}

function renderFeedComments(postId) {
    const list = document.getElementById('feedCommentsList');
    const comments = Comments.getComments(postId);
    list.innerHTML = comments.length === 0 
        ? '<p style="color:#666;text-align:center;padding:20px;">Нет комментариев</p>'
        : comments.map(c => `<div class="comment-item"><div class="comment-header"><div class="comment-avatar">:)</div><span class="comment-author">${escapeHtml(c.author)}</span><span class="comment-date">${formatDateTime(new Date(c.date))}</span></div><div class="comment-text">${escapeHtml(c.text)}</div></div>`).join('');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('click', function(e) {
    const modal = document.getElementById('feedCommentsModal');
    if (modal && e.target === modal) closeFeedComments();
    const repostModal = document.getElementById('repostModal');
    if (repostModal && e.target === repostModal) closeRepostModal();
});