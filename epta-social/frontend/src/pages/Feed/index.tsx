import { useEffect, useState } from 'react';
import { usePostsStore } from '@store/posts';

export function Feed() {
  const { posts, isLoading, loadPosts, createPost, likePost } = usePostsStore();
  const [text, setText] = useState('');

  useEffect(() => {
    loadPosts();
  }, [loadPosts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    await createPost(text);
    setText('');
  };

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ marginBottom: '2rem' }}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Что нового?"
          style={{ width: '100%', padding: '1rem', minHeight: '100px' }}
        />
        <button type="submit">Опубликовать</button>
      </form>

      {isLoading && <div>Загрузка...</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {posts.map((post) => (
          <div key={post.id} style={{ padding: '1rem', background: '#1a1a1a', borderRadius: '8px' }}>
            <div style={{ marginBottom: '0.5rem' }}>
              <strong>{post.author?.displayName}</strong>
            </div>
            <p>{post.text}</p>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '1rem' }}>
              <button onClick={() => likePost(post.id)}>
                {post.isLiked ? '❤️' : '🤍'} {post.likeCount}
              </button>
              <span>💬 {post.commentCount}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
