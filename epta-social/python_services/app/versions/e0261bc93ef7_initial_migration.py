"""initial migration

Revision ID: e0261bc93ef7
Revises: None
Create Date: 2026-05-19 23:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic
revision: str = 'e0261bc93ef7'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users Table
    op.create_table(
        'users',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('username', sa.String(), nullable=False),
        sa.Column('displayName', sa.String(), nullable=False),
        sa.Column('avatar', sa.String(), nullable=True),
        sa.Column('bio', sa.String(), nullable=True),
        sa.Column('verificationBadge', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('role', sa.String(), nullable=True, server_default='user'),
        sa.Column('passwordHash', sa.String(), nullable=True),
        sa.Column('createdAt', sa.DateTime(), nullable=True),
        sa.Column('banned', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('warnCount', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('googleEmail', sa.String(), nullable=True),
        sa.Column('telegramId', sa.String(), nullable=True),
        sa.Column('telegramUsername', sa.String(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_users_id', 'users', ['id'])
    op.create_index('idx_users_username', 'users', ['username'], unique=True)
    op.create_index('idx_users_google_email', 'users', ['googleEmail'], unique=True)
    op.create_index('idx_users_telegram_id', 'users', ['telegramId'], unique=True)
    op.create_index('idx_users_created_at', 'users', ['createdAt'])

    # Sessions Table
    op.create_table(
        'user_sessions',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('userId', sa.String(), nullable=False),
        sa.Column('refreshTokenHash', sa.String(), nullable=False),
        sa.Column('expiresAt', sa.DateTime(), nullable=False),
        sa.Column('revoked', sa.Boolean(), nullable=True, server_default='false'),
        sa.Column('createdAt', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['userId'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_sessions_id', 'user_sessions', ['id'])
    op.create_index('idx_sessions_refresh_token_hash', 'user_sessions', ['refreshTokenHash'], unique=True)
    op.create_index('idx_sessions_user_id', 'user_sessions', ['userId'])

    # Posts Table
    op.create_table(
        'posts',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('authorId', sa.String(), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('createdAt', sa.DateTime(), nullable=True),
        sa.Column('imageUrl', sa.String(), nullable=True),
        sa.Column('gifUrl', sa.String(), nullable=True),
        sa.Column('likeCount', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('commentCount', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('repostCount', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('repostedFrom', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['authorId'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['repostedFrom'], ['posts.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_posts_id', 'posts', ['id'])
    op.create_index('idx_posts_author_id', 'posts', ['authorId'])
    op.create_index('idx_posts_created_at', 'posts', ['createdAt'])

    # Comments Table
    op.create_table(
        'comments',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('userId', sa.String(), nullable=False),
        sa.Column('postId', sa.String(), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('createdAt', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['postId'], ['posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['userId'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_comments_id', 'comments', ['id'])
    op.create_index('idx_comments_post_id', 'comments', ['postId'])
    op.create_index('idx_comments_user_id', 'comments', ['userId'])
    op.create_index('idx_comments_created_at', 'comments', ['createdAt'])

    # Likes Table
    op.create_table(
        'likes',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('userId', sa.String(), nullable=False),
        sa.Column('postId', sa.String(), nullable=False),
        sa.Column('createdAt', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['postId'], ['posts.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['userId'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_likes_id', 'likes', ['id'])
    op.create_index('idx_likes_post_id', 'likes', ['postId'])
    op.create_index('idx_likes_user_id', 'likes', ['userId'])
    op.create_index('idx_likes_created_at', 'likes', ['createdAt'])

    # Follows Table
    op.create_table(
        'follows',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('followerId', sa.String(), nullable=False),
        sa.Column('followingId', sa.String(), nullable=False),
        sa.Column('createdAt', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['followerId'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['followingId'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_follows_id', 'follows', ['id'])
    op.create_index('idx_follows_follower_id', 'follows', ['followerId'])
    op.create_index('idx_follows_following_id', 'follows', ['followingId'])

    # Moderation Logs Table
    op.create_table(
        'moderation_logs',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('moderatorId', sa.String(), nullable=False),
        sa.Column('actionType', sa.String(), nullable=False),
        sa.Column('targetUserId', sa.String(), nullable=True),
        sa.Column('targetPostId', sa.String(), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('createdAt', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['moderatorId'], ['users.id']),
        sa.ForeignKeyConstraint(['targetUserId'], ['users.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_mod_logs_id', 'moderation_logs', ['id'])
    op.create_index('idx_mod_logs_moderator_id', 'moderation_logs', ['moderatorId'])
    op.create_index('idx_mod_logs_action_type', 'moderation_logs', ['actionType'])

    # Notifications Table
    op.create_table(
        'notifications',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('userId', sa.String(), nullable=False),
        sa.Column('type', sa.String(), nullable=False),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('read', sa.Boolean(), server_default='false'),
        sa.Column('sourceUserId', sa.String(), nullable=True),
        sa.Column('sourcePostId', sa.String(), nullable=True),
        sa.Column('createdAt', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['userId'], ['users.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['sourceUserId'], ['users.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_notifications_id', 'notifications', ['id'])
    op.create_index('idx_notifications_user_id', 'notifications', ['userId'])
    op.create_index('idx_notifications_created_at', 'notifications', ['createdAt'])

    # Compound uniqueness constraint migrations
    op.create_unique_constraint('idx_follows_compound', 'follows', ['followerId', 'followingId'])
    op.create_unique_constraint('idx_likes_compound', 'likes', ['userId', 'postId'])


def downgrade() -> None:
    op.drop_table('notifications')
    op.drop_table('moderation_logs')
    op.drop_table('follows')
    op.drop_table('likes')
    op.drop_table('comments')
    op.drop_table('posts')
    op.drop_table('user_sessions')
    op.drop_table('users')
