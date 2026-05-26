# schemas.py
# Pydantic schemas supporting JWT models and cursor pagination for high-perf listing queries

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

# User Schemas
class UserBase(BaseModel):
    username: str
    displayName: str
    avatar: Optional[str] = None
    bio: Optional[str] = None

class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    displayName: Optional[str] = None
    bio: Optional[str] = None
    avatar: Optional[str] = None

class UserOut(UserBase):
    id: str
    verificationBadge: bool
    role: str
    createdAt: datetime
    banned: bool
    warnCount: int
    googleEmail: Optional[str] = None
    telegramId: Optional[str] = None
    telegramUsername: Optional[str] = None

    class Config:
        from_attributes = True

class UserMinimal(BaseModel):
    id: str
    username: str
    displayName: str
    avatar: Optional[str] = None
    verificationBadge: bool
    role: str

    class Config:
        from_attributes = True


# Auth Schemas
class AuthLogin(BaseModel):
    username: str
    password: Optional[str] = None # Support secure pass
    displayName: Optional[str] = None

class TokenResponse(BaseModel):
    accessToken: str
    refreshToken: str
    user: UserOut

class GoogleAuth(BaseModel):
    email: str
    name: Optional[str] = None
    avatar: Optional[str] = None
    credential: Optional[str] = None # Added for secure backend validation

class TelegramLink(BaseModel):
    telegramId: str
    telegramUsername: Optional[str] = None


# Post Schemas
class PostCreate(BaseModel):
    text: str = Field(..., max_length=500)
    imageUrl: Optional[str] = None
    gifUrl: Optional[str] = None

class PostOut(BaseModel):
    id: str
    authorId: str
    text: str
    createdAt: datetime
    imageUrl: Optional[str] = None
    gifUrl: Optional[str] = None
    likeCount: int
    commentCount: int
    repostCount: int
    repostedFrom: Optional[str] = None
    author: Optional[UserMinimal] = None
    originalAuthor: Optional[UserMinimal] = None
    isLiked: Optional[bool] = False
    isOwner: Optional[bool] = False

    class Config:
        from_attributes = True

# Pagination Models
class PaginatedPosts(BaseModel):
    posts: List[PostOut]
    nextCursor: Optional[str] = None

class PaginatedComments(BaseModel):
    comments: List[CommentOut] = []
    nextCursor: Optional[str] = None

class PaginatedNotifications(BaseModel):
    notifications: List[NotificationOut] = []
    nextCursor: Optional[str] = None


# Comment Schemas
class CommentCreate(BaseModel):
    text: str

class CommentOut(BaseModel):
    id: str
    userId: str
    postId: str
    text: str
    createdAt: datetime
    author: Optional[UserMinimal] = None

    class Config:
        from_attributes = True


# Follow Schemas
class FollowOut(BaseModel):
    id: str
    followerId: str
    followingId: str
    createdAt: datetime

    class Config:
        from_attributes = True


# Notification Schemas
class NotificationOut(BaseModel):
    id: str
    userId: str
    type: str
    text: str
    read: bool
    sourceUserId: Optional[str] = None
    sourcePostId: Optional[str] = None
    createdAt: datetime
    sourceUser: Optional[UserMinimal] = None

    class Config:
        from_attributes = True


# Moderation Log Schemas
class ModerationLogCreate(BaseModel):
    targetUserId: str
    reason: Optional[str] = None

class ModerationLogOut(BaseModel):
    id: str
    moderatorId: str
    actionType: str
    targetUserId: Optional[str] = None
    targetPostId: Optional[str] = None
    reason: Optional[str] = None
    createdAt: datetime
    moderator: Optional[UserMinimal] = None
    targetUser: Optional[UserMinimal] = None

    class Config:
        from_attributes = True


# General Response wrappers
class StandardResponse(BaseModel):
    success: bool
    message: str
