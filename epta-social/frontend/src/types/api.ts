export interface User {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  bio: string | null;
  verificationBadge: boolean;
  role: 'user' | 'moderator' | 'admin';
}

export interface Post {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
  imageUrl: string | null;
  likeCount: number;
  commentCount: number;
  isLiked: boolean;
  author?: User;
}

export interface PaginatedPosts {
  posts: Post[];
  nextCursor: string | null;
}

export interface AuthResponse {
  accessToken: string;
  user: User;
}
