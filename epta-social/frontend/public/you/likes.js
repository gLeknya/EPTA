const Likes = {
    likes: {},
    
    addLike: function(postId, userId) {
        if (!this.likes[postId]) {
            this.likes[postId] = [];
        }
        if (!this.likes[postId].includes(userId)) {
            this.likes[postId].push(userId);
        }
    },
    
    removeLike: function(postId, userId) {
        if (this.likes[postId]) {
            this.likes[postId] = this.likes[postId].filter(id => id !== userId);
        }
    },
    
    hasLiked: function(postId, userId) {
        return (this.likes[postId] || []).includes(userId);
    },
    
    getLikeCount: function(postId) {
        return (this.likes[postId] || []).length;
    }
};

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
        btn.style.color = '#ff4444';
        Likes.addLike(postId, 'currentUser');
        const img = btn.querySelector('img');
        if (img) img.src = '../png/heart_on.png';
    }
    
    const span = btn.querySelector('span');
    const count = Likes.getLikeCount(postId);
    if (span) span.textContent = count;
    
    if (typeof renderPosts === 'function') renderPosts();
}