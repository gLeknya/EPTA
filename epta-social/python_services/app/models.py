# models.py
# SQLAlchemy Models with explicit database indexes and counter columns for PostgreSQL and SQLite

from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import relationship
import datetime
try:
    from .database import Base
except (ImportError, ValueError):
    from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    displayName = Column(String, nullable=False)
    avatar = Column(String, nullable=True)
    bio = Column(String, nullable=True)
    verificationBadge = Column(Boolean, default=False)
    role = Column(String, default="user", index=True) # 'user', 'moderator', 'admin'
    passwordHash = Column(String, nullable=True) # Secure password security
    createdAt = Column(DateTime, default=datetime.datetime.utcnow, index=True)
    banned = Column(Boolean, default=False, index=True)
    warnCount = Column(Integer, default=0)
    googleEmail = Column(String, unique=True, index=True, nullable=True)
    telegramId = Column(String, unique=True, index=True, nullable=True)
    telegramUsername = Column(String, nullable=True)

    # Relationships
    posts = relationship("Post", back_populates="author", cascade="all, delete-orphan", foreign_keys="Post.authorId")
    comments = relationship("Comment", back_populates="user", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="user", cascade="all, delete-orphan")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(String, primary_key=True, index=True)
    userId = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    refreshTokenHash = Column(String, nullable=False, unique=True, index=True)
    expiresAt = Column(DateTime, nullable=False, index=True)
    revoked = Column(Boolean, default=False, index=True)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow)

    user = relationship("User", back_populates="sessions")


class Post(Base):
    __tablename__ = "posts"

    id = Column(String, primary_key=True, index=True)
    authorId = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow, index=True) # Fast cursor sorting index
    imageUrl = Column(String, nullable=True)
    gifUrl = Column(String, nullable=True)
    
    # Direct fast-counter column fields (prevents constant slow SQL SELECT COUNT(*))
    likeCount = Column(Integer, default=0, nullable=False, index=True)
    commentCount = Column(Integer, default=0, nullable=False, index=True)
    repostCount = Column(Integer, default=0, nullable=False, index=True)
    
    repostedFrom = Column(String, ForeignKey("posts.id", ondelete="SET NULL"), nullable=True, index=True)

    # Relationships
    author = relationship("User", back_populates="posts", foreign_keys=[authorId])
    comments = relationship("Comment", back_populates="post", cascade="all, delete-orphan")
    likes = relationship("Like", back_populates="post", cascade="all, delete-orphan")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(String, primary_key=True, index=True)
    userId = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    postId = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(Text, nullable=False)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    # Relationships
    user = relationship("User", back_populates="comments")
    post = relationship("Post", back_populates="comments")


class Like(Base):
    __tablename__ = "likes"

    id = Column(String, primary_key=True, index=True)
    userId = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    postId = Column(String, ForeignKey("posts.id", ondelete="CASCADE"), nullable=False, index=True)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow, index=True)

    # Relationships
    user = relationship("User", back_populates="likes")
    post = relationship("Post", back_populates="likes")


class Follow(Base):
    __tablename__ = "follows"

    id = Column(String, primary_key=True, index=True)
    followerId = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    followingId = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow, index=True)


class ModerationLog(Base):
    __tablename__ = "moderation_logs"

    id = Column(String, primary_key=True, index=True)
    moderatorId = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    actionType = Column(String, nullable=False, index=True) # 'ban', 'unban', 'warn', 'delete_post', 'verify', 'unverify', 'set_role'
    targetUserId = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    targetPostId = Column(String, nullable=True, index=True)
    reason = Column(Text, nullable=True)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow, index=True)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(String, primary_key=True, index=True)
    userId = Column(String, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    type = Column(String, nullable=False, index=True) # 'like', 'comment', 'follow', 'moderation', 'system', 'repost'
    text = Column(Text, nullable=False)
    read = Column(Boolean, default=False, index=True)
    sourceUserId = Column(String, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    sourcePostId = Column(String, nullable=True, index=True)
    createdAt = Column(DateTime, default=datetime.datetime.utcnow, index=True)


# Compound Indexes for rapid relation lookups
Index("idx_follows_compound", Follow.followerId, Follow.followingId, unique=True)
Index("idx_likes_compound", Like.userId, Like.postId, unique=True)
Index("idx_comments_compound", Comment.postId, Comment.createdAt)
