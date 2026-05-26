import { create } from 'zustand';
import type { Post } from '@types/api';
import { api } from '@api/client';

interface PostsState {
  posts: Post[];
  isLoading: boolean;
  loadPosts: () => Promise<void>;
  createPost: (text: string) => Promise<void>;
  likePost: (postId: string) => Promise<void>;
}

export const usePostsStore = create<PostsState>((set, get) => ({
  posts: [],
  isLoading: false,

  loadPosts: async () => {
    set({ isLoading: true });
    try {
      const data = await api.getPosts();
      set({ posts: data.posts, isLoading: false });
    } catch {
      set({ isLoading: false });
    }
  },

  createPost: async (text) => {
    const post = await api.createPost(text);
    set((state) => ({ posts: [post, ...state.posts] }));
  },

  likePost: async (postId) => {
    const post = get().posts.find((p) => p.id === postId);
    if (!post) return;

    if (post.isLiked) {
      await api.unlikePost(postId);
      set((state) => ({
        posts: state.posts.map((p) =>
          p.id === postId ? { ...p, isLiked: false, likeCount: p.likeCount - 1 } : p
        ),
      }));
    } else {
      await api.likePost(postId);
      set((state) => ({
        posts: state.posts.map((p) =>
          p.id === postId ? { ...p, isLiked: true, likeCount: p.likeCount + 1 } : p
        ),
      }));
    }
  },
}));
