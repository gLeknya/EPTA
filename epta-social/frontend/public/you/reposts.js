const Reposts = {
    reposts: {},
    
    addRepost: function(postId, userId) {
        if (!this.reposts[postId]) {
            this.reposts[postId] = [];
        }
        if (!this.reposts[postId].includes(userId)) {
            this.reposts[postId].push(userId);
            return true;
        }
        return false;
    },
    
    removeRepost: function(postId, userId) {
        if (this.reposts[postId]) {
            this.reposts[postId] = this.reposts[postId].filter(id => id !== userId);
        }
    },
    
    hasReposted: function(postId, userId) {
        return (this.reposts[postId] || []).includes(userId);
    },
    
    getRepostCount: function(postId) {
        return (this.reposts[postId] || []).length;
    }
};