-- DELIMITER CHANGED FOR COMPATIBILITY WITH MYSQL.CONNECTOR:
-- ALSO, TRIGGER CREATION WITHOUT DELIMITERS FOR WORKING WITH MYSQL.CONNECTOR:

CREATE DATABASE IF NOT EXISTS alexicon CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci$$

USE alexicon$$

CREATE TABLE IF NOT EXISTS users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(63) NOT NULL,
    surname VARCHAR(63) NOT NULL,
    nickname VARCHAR(63) NOT NULL,
    at_sign VARCHAR(63),
    birthday DATE NOT NULL,
    gender VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    password VARCHAR(255),
    profile_pic VARCHAR(255),
    cover_pic VARCHAR(255),
    type ENUM('human', 'agent') NOT NULL DEFAULT 'human',
    followers_count BIGINT UNSIGNED DEFAULT 0,
    following_count BIGINT UNSIGNED DEFAULT 0,
    posts_count BIGINT UNSIGNED DEFAULT 0,
    services JSON DEFAULT '{}',
    settings JSON DEFAULT '{}',
    api_code TEXT,
    registration_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified TINYINT(1) NOT NULL DEFAULT 0,
    verify_key VARCHAR(128),
    origin VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

CREATE TABLE IF NOT EXISTS settings (
    user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
    show_nsfw TINYINT(1) NOT NULL DEFAULT 0,
    hide_deadname TINYINT(1) NOT NULL DEFAULT 0,
    replace_deadname TINYINT(1) NOT NULL DEFAULT 0,
    deadname VARCHAR(255),
    chosen_name VARCHAR(255),
    language VARCHAR(16) NOT NULL DEFAULT 'en',
    extra JSON DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_settings_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    INDEX idx_settings_language (language)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

CREATE TABLE IF NOT EXISTS user_services (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    service VARCHAR(63) NOT NULL,
    tier TINYINT UNSIGNED NOT NULL DEFAULT 0,
    active TINYINT(1) NOT NULL DEFAULT 1,
    subscription_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME NULL,
    metadata JSON DEFAULT '{}',
    UNIQUE KEY unique_user_service (user_id, service),
    INDEX idx_user_services_user (user_id),
    INDEX idx_user_services_service (service),
    INDEX idx_user_services_active (active),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

CREATE TABLE IF NOT EXISTS active_tokens (
    jti VARCHAR(63) PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

CREATE TABLE IF NOT EXISTS api_keys (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(127) NOT NULL,
    key_prefix VARCHAR(32) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    services JSON DEFAULT '[]',
    scopes JSON DEFAULT '[]',
    active TINYINT(1) NOT NULL DEFAULT 1,
    last_used_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at DATETIME NULL,
    UNIQUE KEY unique_api_key_hash (key_hash),
    INDEX idx_api_keys_user (user_id),
    INDEX idx_api_keys_prefix (key_prefix),
    INDEX idx_api_keys_active (active),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

CREATE TABLE IF NOT EXISTS reports (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    author_id BIGINT UNSIGNED NOT NULL,
    service VARCHAR(255) NOT NULL,
    type ENUM('post', 'comment', 'message') NOT NULL,
    route MEDIUMTEXT NOT NULL,
    message MEDIUMTEXT NOT NULL,
    report_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    origin VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    owner_id BIGINT UNSIGNED NOT NULL,
    seen TINYINT(1) NOT NULL DEFAULT 0,
    service ENUM('alexicon', 'yipnet', 'alyx') NOT NULL DEFAULT 'alexicon',
    content JSON DEFAULT '{}',
    event VARCHAR(255) NOT NULL,
    notif_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

CREATE TABLE IF NOT EXISTS push_tokens (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    token TEXT NOT NULL,
    platform VARCHAR(32) NOT NULL DEFAULT 'android',
    services JSON DEFAULT '["alexicon","yipnet","alyx"]',
    active TINYINT(1) NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_token (user_id, token(191)),
    INDEX idx_push_tokens_user (user_id),
    INDEX idx_push_tokens_platform (platform),
    INDEX idx_push_tokens_active (active),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

CREATE TABLE IF NOT EXISTS badges (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    code VARCHAR(63) NOT NULL UNIQUE,
    name VARCHAR(127) NOT NULL,
    description VARCHAR(255),
    image VARCHAR(255) NOT NULL,
    service ENUM('alexicon', 'yipnet') NOT NULL DEFAULT 'yipnet',
    rarity ENUM('common', 'rare', 'epic', 'legendary') NOT NULL DEFAULT 'common',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

CREATE TABLE IF NOT EXISTS user_badges (
    user_id BIGINT UNSIGNED NOT NULL,
    badge_id BIGINT UNSIGNED NOT NULL,
    awarded_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    awarded_by BIGINT UNSIGNED NULL,
    reason VARCHAR(255),
    PRIMARY KEY (user_id, badge_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (badge_id) REFERENCES badges(id) ON DELETE CASCADE,
    FOREIGN KEY (awarded_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_badges_user (user_id),
    INDEX idx_user_badges_badge (badge_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

CREATE TABLE IF NOT EXISTS follows (
    follower_id BIGINT UNSIGNED NOT NULL,
    followed_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, followed_id),
    FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (followed_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

CREATE TABLE IF NOT EXISTS blocks (
    blocker_id BIGINT UNSIGNED NOT NULL,
    blocked_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (blocker_id, blocked_id),
    FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

CREATE TABLE IF NOT EXISTS posts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    owner_id BIGINT UNSIGNED NOT NULL,
    content MEDIUMTEXT NOT NULL,
    media JSON DEFAULT '[]',
    shared_by_list JSON DEFAULT '[]',
    sharing_id BIGINT UNSIGNED NULL,
    private_post TINYINT(1) NOT NULL DEFAULT 0,
    nsfw_post TINYINT(1) NOT NULL DEFAULT 0,
    ai_generated TINYINT(1) NOT NULL DEFAULT 0,
    comment_count BIGINT(20) DEFAULT 0,
    post_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    origin VARCHAR(255),
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

CREATE TABLE IF NOT EXISTS comments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT UNSIGNED NOT NULL,
    parent_id BIGINT UNSIGNED NULL,
    owner_id BIGINT UNSIGNED NOT NULL,
    content MEDIUMTEXT NOT NULL,
    media JSON DEFAULT '[]',
    ai_generated TINYINT(1) NOT NULL DEFAULT 0,
    comment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    origin VARCHAR(255),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (owner_id) REFERENCES users(id),
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
    INDEX idx_comments_parent_id (parent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

CREATE TABLE IF NOT EXISTS yipnet_statistics (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    target_type ENUM('post', 'comment', 'profile') NOT NULL,
    target_id BIGINT UNSIGNED NOT NULL,
    event_type ENUM('view', 'vote', 'unvote') NOT NULL,
    actor_id BIGINT UNSIGNED NULL,
    vote_type ENUM('heart', 'up', 'down') NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ip_hash VARCHAR(128),
    user_agent VARCHAR(255),
    origin VARCHAR(255),

    INDEX idx_target (target_type, target_id),
    INDEX idx_event (event_type),
    INDEX idx_actor (actor_id),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

CREATE TABLE IF NOT EXISTS yipnet_stat_view_locks (
    target_type ENUM('post', 'comment', 'profile') NOT NULL,
    target_id BIGINT UNSIGNED NOT NULL,
    visitor_key VARCHAR(191) NOT NULL,
    viewed_on DATE NOT NULL,

    PRIMARY KEY (target_type, target_id, visitor_key, viewed_on)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

CREATE TABLE IF NOT EXISTS conversations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(63) NOT NULL,
    current_group_pic VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

CREATE TABLE IF NOT EXISTS conversation_participants (
    conversation_id BIGINT UNSIGNED NOT NULL,
    user_id BIGINT UNSIGNED NOT NULL,
    role ENUM('member', 'admin', 'owner') NOT NULL DEFAULT 'member',
    joined_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (conversation_id, user_id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

CREATE TABLE IF NOT EXISTS messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    sender_id BIGINT UNSIGNED NOT NULL,
    receiver_id BIGINT UNSIGNED NULL,
    conversation_id BIGINT UNSIGNED NOT NULL,
    content TEXT NOT NULL,
    media JSON DEFAULT '[]',
    deleted TINYINT(1) NOT NULL DEFAULT 0,
    msg_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    origin VARCHAR(255),
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

CREATE TABLE IF NOT EXISTS votes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    target_type ENUM('post', 'comment', 'message') NOT NULL,
    target_id BIGINT UNSIGNED NOT NULL,
    vote_type ENUM('heart', 'up', 'down') NOT NULL,
    vote_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_vote (user_id, target_type, target_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

CREATE TABLE IF NOT EXISTS files (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    rel_path VARCHAR(512) NOT NULL,
    mime_type VARCHAR(127),
    size BIGINT UNSIGNED,
    visibility ENUM('private', 'public', 'custom') NOT NULL DEFAULT 'public',
    allowed_users JSON DEFAULT '[]',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_rel_path (rel_path),
    INDEX idx_visibility (visibility)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

-- alyx

CREATE TABLE IF NOT EXISTS alyx_projects (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    owner_id BIGINT UNSIGNED NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    memory MEDIUMTEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

CREATE TABLE IF NOT EXISTS alyx_chats (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    owner_id BIGINT UNSIGNED NOT NULL,
    project_id BIGINT UNSIGNED NULL,
    title VARCHAR(255) DEFAULT 'Untitled chat',
    model VARCHAR(255),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES alyx_projects(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

CREATE TABLE IF NOT EXISTS alyx_messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    chat_id BIGINT UNSIGNED NOT NULL,
    role ENUM('user', 'assistant', 'system', 'tool') NOT NULL,
    content MEDIUMTEXT NOT NULL,
    metadata JSON DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (chat_id) REFERENCES alyx_chats(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

-- subscriptions

CREATE TABLE IF NOT EXISTS credits (
    user_id BIGINT UNSIGNED NOT NULL,
    service VARCHAR(63) NOT NULL DEFAULT 'alyx',
    balance DECIMAL(12, 4) NOT NULL DEFAULT 0,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, service),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_credits_service (service)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

CREATE TABLE IF NOT EXISTS credit_transactions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    service VARCHAR(63) NOT NULL DEFAULT 'alyx',
    type ENUM('purchase', 'usage', 'refund', 'bonus', 'adjustment') NOT NULL,
    amount DECIMAL(12, 4) NOT NULL,
    balance_after DECIMAL(12, 4) NOT NULL,
    description VARCHAR(255),
    metadata JSON DEFAULT '{}',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_credit_transactions_user_service (user_id, service),
    INDEX idx_credit_transactions_type (type),
    INDEX idx_credit_transactions_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

CREATE TABLE IF NOT EXISTS subscription_orders (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,

    provider ENUM('test', 'mercadopago', 'paypal') NOT NULL DEFAULT 'test',
    provider_order_id VARCHAR(255) NULL,

    status ENUM('pending', 'paid', 'cancelled', 'failed') NOT NULL DEFAULT 'pending',

    services JSON DEFAULT '[]',
    credit_packs JSON DEFAULT '[]',

    subtotal DECIMAL(12, 2) NOT NULL DEFAULT 0,
    total DECIMAL(12, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(8) NOT NULL DEFAULT 'MXN',

    metadata JSON DEFAULT '{}',

    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    paid_at DATETIME NULL,
    cancelled_at DATETIME NULL,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,

    INDEX idx_subscription_orders_user (user_id),
    INDEX idx_subscription_orders_status (status),
    INDEX idx_subscription_orders_provider (provider),
    INDEX idx_subscription_orders_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci$$

-- posts_count +1
DROP TRIGGER IF EXISTS after_post_insert$$
CREATE TRIGGER after_post_insert
AFTER INSERT ON posts
FOR EACH ROW
BEGIN
    UPDATE users
    SET posts_count = COALESCE(posts_count, 0) + 1
    WHERE id = NEW.owner_id;
END$$

-- posts_count -1
DROP TRIGGER IF EXISTS after_post_delete$$
CREATE TRIGGER after_post_delete
AFTER DELETE ON posts
FOR EACH ROW
BEGIN
    UPDATE users
    SET posts_count = GREATEST(COALESCE(posts_count, 0) - 1, 0)
    WHERE id = OLD.owner_id;
END$$

-- follows counters +1
DROP TRIGGER IF EXISTS after_follow_insert$$
CREATE TRIGGER after_follow_insert
AFTER INSERT ON follows
FOR EACH ROW
BEGIN
    UPDATE users
    SET following_count = COALESCE(following_count, 0) + 1
    WHERE id = NEW.follower_id;

    UPDATE users
    SET followers_count = COALESCE(followers_count, 0) + 1
    WHERE id = NEW.followed_id;
END$$

-- follows counters -1
DROP TRIGGER IF EXISTS after_follow_delete$$
CREATE TRIGGER after_follow_delete
AFTER DELETE ON follows
FOR EACH ROW
BEGIN
    UPDATE users
    SET following_count = GREATEST(COALESCE(following_count, 0) - 1, 0)
    WHERE id = OLD.follower_id;

    UPDATE users
    SET followers_count = GREATEST(COALESCE(followers_count, 0) - 1, 0)
    WHERE id = OLD.followed_id;
END$$

-- comment_count +1
DROP TRIGGER IF EXISTS after_comment_insert$$
CREATE TRIGGER after_comment_insert
AFTER INSERT ON comments
FOR EACH ROW
BEGIN
    UPDATE posts
    SET comment_count = COALESCE(comment_count, 0) + 1
    WHERE id = NEW.post_id;
END$$

-- comment_count -1
DROP TRIGGER IF EXISTS after_comment_delete$$
CREATE TRIGGER after_comment_delete
AFTER DELETE ON comments
FOR EACH ROW
BEGIN
    UPDATE posts
    SET comment_count = GREATEST(COALESCE(comment_count, 0) - 1, 0)
    WHERE id = OLD.post_id;
END$$

-- specific triggers for data integrity:

DROP TRIGGER IF EXISTS before_follow_insert$$
CREATE TRIGGER before_follow_insert
BEFORE INSERT ON follows
FOR EACH ROW
BEGIN
    IF NEW.follower_id = NEW.followed_id THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'A user cannot follow themselves';
    END IF;
END$$

DROP TRIGGER IF EXISTS before_block_insert$$
CREATE TRIGGER before_block_insert
BEFORE INSERT ON blocks
FOR EACH ROW
BEGIN
    IF NEW.blocker_id = NEW.blocked_id THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'A user cannot block themselves';
    END IF;
END$$

DROP TRIGGER IF EXISTS after_block_insert$$
CREATE TRIGGER after_block_insert
AFTER INSERT ON blocks
FOR EACH ROW
BEGIN
    DELETE FROM follows
    WHERE 
        (follower_id = NEW.blocker_id AND followed_id = NEW.blocked_id)
        OR
        (follower_id = NEW.blocked_id AND followed_id = NEW.blocker_id);
END$$