let publicPosts = JSON.parse(localStorage.getItem('epta_public_posts') || '[]');
publicPosts = publicPosts.map(p => ({...p, date: new Date(p.date), files: p.files || [], views: p.views || 0, viewedBy: p.viewedBy || []}));

let currentFeedFilter = 'date';
let currentFeedTab = 'recommendations';
let currentFeedPostId = null;

let recentContacts = [
    {name: '@alex', avatar: '../png/portrait.png'},
    {name: '@maria', avatar: '../png/portrait.png'},
    {name: '@dmitry', avatar: '../png/portrait.png'}
];

// ID текущего пользователя
const currentUserId = localStorage.getItem('epta_user_id') || 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
localStorage.setItem('epta_user_id', currentUserId);

// Форматирование чисел
function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

document.addEventListener('DOMContentLoaded', function() {
    createFallingNumbers();
    refreshPublicPosts();
    renderFeed();
    updateSidebar();
});

function refreshPublicPosts() {
    publicPosts = JSON.parse(localStorage.getItem('epta_public_posts') || '[]');
    publicPosts = publicPosts.map(p => ({...p, date: new Date(p.date), files: p.files || [], views: p.views || 0, viewedBy: p.viewedBy || []}));
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
        number.style.cssText = `left: ${left}%; font-size: ${size}px; animation-duration: ${duration}s; animation-delay: ${delay}s;`;
        container.appendChild(number);
        setTimeout(() => { if (number.parentNode) number.remove(); }, (duration + delay) * 1000 + 500);
    }
    
    for (let i = 0; i < 15; i++) setTimeout(() => spawnNumber(), i * 150);
    setInterval(() => { if (container.children.length < 45) { for (let i = 0; i < 3; i++) setTimeout(() => spawnNumber(), i * 100); } }, 600);
}

function toggleMenu() { document.getElementById('menuPanel').classList.toggle('active'); }

document.addEventListener('click', function(e) {
    const menu = document.getElementById('burgerMenu');
    const panel = document.getElementById('menuPanel');
    if (menu && panel && !menu.contains(e.target) && panel.classList.contains('active')) panel.classList.remove('active');
    if (e.target.id === 'feedCommentsModal') closeFeedComments();
    if (e.target.id === 'repostModal') closeRepostModal();
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
    document.querySelectorAll('#filtersBar .filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    renderFeed();
}

function extractHashtags(text) {
    const matches = text.match(/#[а-яА-ЯёЁa-zA-Z0-9_]+/g);
    return matches ? [...new Set(matches)] : [];
}

function calculateHashtagRank() {
    const hashtagStats = {};
    refreshPublicPosts();
    publicPosts.forEach(post => {
        const tags = extractHashtags(post.text || '');
        const score = (Likes.getLikeCount(post.id) || 0) + (Comments.getCommentCount(post.id) || 0) + (Reposts.getRepostCount(post.id) || 0) + (post.views || 0);
        tags.forEach(tag => { if (!hashtagStats[tag]) hashtagStats[tag] = 0; hashtagStats[tag] += score; });
    });
    return Object.entries(hashtagStats).sort((a, b) => b[1] - a[1]).slice(0, 10);
}

function calculateTopPosts() {
    refreshPublicPosts();
    return [...publicPosts].map(post => ({
        ...post,
        totalScore: (Likes.getLikeCount(post.id) || 0) + (Comments.getCommentCount(post.id) || 0) + (Reposts.getRepostCount(post.id) || 0) + (post.views || 0)
    })).sort((a, b) => b.totalScore - a.totalScore).slice(0, 5);
}

function updateSidebar() {
    const hc = document.getElementById('topHashtags');
    if (hc) {
        const th = calculateHashtagRank();
        hc.innerHTML = th.length === 0 ? '<span style="color:#666;font-size:13px;">Пока нет хештегов</span>' : th.map(([tag, score]) => `<a href="#" class="hashtag" onclick="searchByHashtag('${tag.replace('#', '')}'); return false;">${tag} (${score})</a>`).join('');
    }
    const tc = document.getElementById('topPosts');
    if (tc) {
        const tp = calculateTopPosts();
        tc.innerHTML = tp.length === 0 ? '<div style="color:#666;font-size:13px;text-align:center;padding:20px;">Пока нет постов</div>' : tp.map((post, i) => `
            <div class="popular-post-item" onclick="scrollToPost(${post.id})">
                <div class="popular-post-rank">#${i + 1}</div>
                <div class="popular-post-info">
                    <div class="popular-post-text">${escapeHtml((post.text || '').substring(0, 50))}${post.text && post.text.length > 50 ? '...' : ''}</div>
                    <div class="popular-post-stats">${post.totalScore} очков</div>
                </div>
            </div>
        `).join('');
    }
}

function searchByHashtag(tag) {
    const searchInput = document.querySelector('.search-input');
    if (searchInput) searchInput.value = '#' + tag;
}

function scrollToPost(postId) {
    const postElement = document.querySelector(`.feed-post[data-post-id="${postId}"]`);
    if (postElement) {
        postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        postElement.style.borderColor = '#61DE2A';
        postElement.style.boxShadow = '0 0 20px rgba(97, 222, 42, 0.5)';
        setTimeout(() => {
            postElement.style.borderColor = '';
            postElement.style.boxShadow = '';
        }, 2000);
    }
}

function sortFeedPosts(arr) {
    switch(currentFeedFilter) {
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

function incrementViews(postId) {
    const post = publicPosts.find(p => p.id === postId);
    if (post && !post.viewedBy?.includes(currentUserId)) {
        if (!post.viewedBy) post.viewedBy = [];
        post.viewedBy.push(currentUserId);
        post.views = post.viewedBy.length;
        localStorage.setItem('epta_public_posts', JSON.stringify(publicPosts.map(p => ({...p, files: []}))));
        return true;
    }
    return false;
}

let processedViews = new Set();

function renderFeed() {
    const container = document.getElementById('feedPosts');
    if (!container) return;
    refreshPublicPosts();
    let posts = sortFeedPosts([...publicPosts]);
    if (!posts.length) {
        container.innerHTML = '<p style="text-align:center;padding:60px;color:#888;font-size:18px;">Пока нет публичных постов</p>';
        return;
    }
    container.innerHTML = posts.map(post => {
        const isLiked = Likes.hasLiked(post.id, 'currentUser');
        const viewsCount = formatNumber(post.views || 0);
        const repostCount = formatNumber(Reposts.getRepostCount(post.id));
        const likeCount = formatNumber(Likes.getLikeCount(post.id));
        const commentCount = formatNumber(Comments.getCommentCount(post.id));
        
        return `
        <div class="feed-post" data-post-id="${post.id}">
            <div class="feed-post-header">
                <div class="feed-post-avatar"><img src="../png/portrait.png" alt=""></div>
                <div class="feed-post-info">
                    <div class="feed-post-author">${escapeHtml(post.author || '@username')}</div>
                    <div class="feed-post-date">${formatDateTime(post.date)}</div>
                </div>
            </div>
            ${post.text ? `<div class="feed-post-text">${escapeHtml(post.text)}</div>` : ''}
            
            <div class="feed-post-actions">
                <div class="stat-view">
                    <img src="../png/eye.png" class="icon-16" alt=""> ${viewsCount}
                </div>
                <button class="post-action-btn" onclick="repostFeedPost(${post.id})">
                    <img src="../png/refresh.png" class="icon-16" alt=""> ${repostCount}
                </button>
                <button class="post-action-btn ${isLiked ? 'liked' : ''}" onclick="likeFeedPost(this, ${post.id})" style="${isLiked ? 'color:#61DE2A;' : ''}">
                    <img src="../png/${isLiked ? 'heart_on' : 'heart_off'}.png" class="icon-16" alt=""> ${likeCount}
                </button>
                <button class="post-action-btn" onclick="openFeedComments(${post.id})">
                    <img src="../png/comment.png" class="icon-16" alt=""> ${commentCount}
                </button>
            </div>
        </div>
    `}).join('');
    
    // Уникальные просмотры
    setTimeout(() => {
        posts.forEach(post => {
            const postElement = document.querySelector(`.feed-post[data-post-id="${post.id}"]`);
            if (postElement && isElementInViewport(postElement) && !processedViews.has(post.id)) {
                processedViews.add(post.id);
                const viewed = incrementViews(post.id);
                if (viewed) {
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

let viewTimeout;
window.addEventListener('scroll', function() {
    if (viewTimeout) clearTimeout(viewTimeout);
    viewTimeout = setTimeout(() => {
        document.querySelectorAll('.feed-post').forEach(postEl => {
            const postId = parseInt(postEl.dataset.postId);
            if (postId && !processedViews.has(postId) && isElementInViewport(postEl)) {
                processedViews.add(postId);
                const viewed = incrementViews(postId);
                if (viewed) {
                    const viewsElement = postEl.querySelector('.stat-view');
                    if (viewsElement) {
                        const post = publicPosts.find(p => p.id === postId);
                        const newViews = formatNumber(post?.views || 0);
                        viewsElement.innerHTML = `<img src="../png/eye.png" class="icon-16" alt=""> ${newViews}`;
                    }
                }
            }
        });
    }, 300);
});

function likeFeedPost(btn, postId) {
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
    
    updateSidebar();
    if (currentFeedFilter === 'likes') renderFeed();
}

function repostFeedPost(postId) {
    if (Reposts.hasReposted(postId, 'currentUser')) {
        Reposts.removeRepost(postId, 'currentUser');
    } else {
        Reposts.addRepost(postId, 'currentUser');
    }
    renderFeed();
    updateSidebar();
}

function openRepostModal(postId) {
    currentFeedPostId = postId;
    document.getElementById('repostModal').classList.add('active');
    document.getElementById('repostContacts').innerHTML = recentContacts.map(c => `
        <div class="repost-contact-item" onclick="sendRepost(${postId}, '${escapeHtml(c.name)}')">
            <img src="${c.avatar}" class="icon-24" alt="" style="border-radius:50%;"> <span>${escapeHtml(c.name)}</span>
        </div>
    `).join('') + `
        <div class="repost-contact-item" onclick="sendRepost(${postId}, 'all')">
            <img src="../png/users-alt.png" class="icon-24" alt=""> <span>Всем друзьям</span>
        </div>
    `;
}

function closeRepostModal() { document.getElementById('repostModal').classList.remove('active'); }

function sendRepost(postId, target) {
    if (Reposts.hasReposted(postId, 'currentUser')) {
        Reposts.removeRepost(postId, 'currentUser');
    } else {
        Reposts.addRepost(postId, 'currentUser');
    }
    closeRepostModal();
    renderFeed();
    updateSidebar();
}

function openFeedComments(postId) {
    currentFeedPostId = postId;
    document.getElementById('feedCommentsModal').classList.add('active');
    renderFeedComments(postId);
}

function closeFeedComments() { document.getElementById('feedCommentsModal').classList.remove('active'); }

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
        ? '<p style="color:#666;text-align:center;padding:20px;">💬 Нет комментариев</p>'
        : comments.map(c => `<div class="comment-item"><div class="comment-header"><img src="../png/portrait.png" class="icon-20" alt="" style="border-radius:50%;"><span class="comment-author">${escapeHtml(c.author)}</span><span class="comment-date">${formatDateTime(new Date(c.date))}</span></div><div class="comment-text">${escapeHtml(c.text)}</div></div>`).join('');
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}