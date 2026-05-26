const Comments = {
    comments: {},
    
    addComment: function(postId, text, author) {
        if (!this.comments[postId]) {
            this.comments[postId] = [];
        }
        const comment = {
            id: Date.now(),
            text: text,
            author: author || '@username',
            date: new Date().toISOString(),
            likes: 0
        };
        this.comments[postId].push(comment);
        return comment;
    },
    
    getComments: function(postId) {
        return this.comments[postId] || [];
    },
    
    getCommentCount: function(postId) {
        return (this.comments[postId] || []).length;
    },
    
    deleteComment: function(postId, commentId) {
        if (this.comments[postId]) {
            this.comments[postId] = this.comments[postId].filter(c => c.id !== commentId);
        }
    },
    
    likeComment: function(postId, commentId) {
        const comments = this.comments[postId] || [];
        const comment = comments.find(c => c.id === commentId);
        if (comment) {
            comment.likes = (comment.likes || 0) + 1;
        }
    }
};