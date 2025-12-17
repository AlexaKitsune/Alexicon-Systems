-- DELIMITER CHANGED FOR COMPATIBILITY WITH MYSQL.CONNECTOR:
-- ALSO, TRIGGER CREATION WITHOUT DELIMITERS FOR WORKING WITH MYSQL.CONNECTOR:

CREATE DATABASE IF NOT EXISTS alexicon CHARACTER SET utf8 COLLATE utf8_unicode_ci$$

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
    current_profile_pic VARCHAR(255),
    current_cover_pic VARCHAR(255),
    list_positive JSON DEFAULT '[]',
    list_negative JSON DEFAULT '[]',
    list_positive_external JSON DEFAULT '[]',
    list_negative_external JSON DEFAULT '[]',
    services JSON DEFAULT '{}',
    settings JSON DEFAULT '{}',
    api_code TEXT,
    registration_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    verified TINYINT(1) NOT NULL DEFAULT 0,
    verify_key VARCHAR(128),
    verify_key_refresh DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    origin VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci$$

CREATE TABLE IF NOT EXISTS active_tokens (
    jti VARCHAR(63) PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci$$

CREATE TABLE IF NOT EXISTS reports (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    author BIGINT UNSIGNED NOT NULL,
    service VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL,
    route MEDIUMTEXT NOT NULL,
    message MEDIUMTEXT NOT NULL,
    report_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    origin VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci$$

CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    owner_id BIGINT UNSIGNED NOT NULL,
    seen TINYINT(1) NOT NULL DEFAULT 0,
    event VARCHAR(255) NOT NULL,
    content JSON DEFAULT '{}',
    service VARCHAR(255),
    notif_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci$$

CREATE TABLE IF NOT EXISTS posts (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    owner_id BIGINT UNSIGNED NOT NULL,
    content MEDIUMTEXT NOT NULL,
    media JSON DEFAULT '[]',
    shared_by_list JSON DEFAULT '[]',
    share_id BIGINT(20) DEFAULT 0,
    private_post TINYINT(0) NOT NULL,
    nsfw_post TINYINT(1) NOT NULL,
    comment_count BIGINT(20) DEFAULT 0,
    list_vote_heart JSON DEFAULT '[]',
    list_vote_up JSON DEFAULT '[]',
    list_vote_down JSON DEFAULT '[]',
    ai_generated TINYINT(0) NOT NULL DEFAULT 0,
    post_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    origin VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci$$

CREATE TABLE IF NOT EXISTS comments (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    post_id BIGINT UNSIGNED NOT NULL,
    owner_id BIGINT UNSIGNED NOT NULL,
    content MEDIUMTEXT NOT NULL,
    media JSON DEFAULT '[]',
    list_vote_heart JSON DEFAULT '[]',
    list_vote_up JSON DEFAULT '[]',
    list_vote_down JSON DEFAULT '[]',
    ai_generated TINYINT(0) NOT NULL DEFAULT 0,
    comment_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    origin VARCHAR(255),
    FOREIGN KEY (post_id) REFERENCES posts(id),
    FOREIGN KEY (owner_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci$$

CREATE TABLE IF NOT EXISTS messages (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    sender_id BIGINT UNSIGNED NOT NULL,
    receiver_id BIGINT UNSIGNED NOT NULL,
    conversation_id BIGINT UNSIGNED NOT NULL,
    content TEXT NOT NULL,
    media JSON DEFAULT '[]',
    list_vote_heart JSON DEFAULT '[]',
    list_vote_up JSON DEFAULT '[]',
    list_vote_down JSON DEFAULT '[]',
    deleted TINYINT(0) NOT NULL DEFAULT 0,
    msg_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    origin VARCHAR(255),
    FOREIGN KEY (sender_id) REFERENCES users(id),
    FOREIGN KEY (receiver_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci$$

CREATE TABLE IF NOT EXISTS conversations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(63) NOT NULL,
    participants JSON DEFAULT '[]',
    admins JSON DEFAULT '[]',
    current_group_pic VARCHAR(255)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci$$

CREATE TABLE IF NOT EXISTS files (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rel_path VARCHAR(512) NOT NULL,
  mime_type VARCHAR(127),
  size BIGINT UNSIGNED,
  visibility ENUM('private','public','custom') NOT NULL DEFAULT 'private',
  allowed_users JSON DEFAULT '[]',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_rel_path (rel_path),
  INDEX idx_visibility (visibility)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci$$

-- Increments comment_count +1 when new comment:
DROP TRIGGER IF EXISTS after_comment_insert$$
CREATE TRIGGER after_comment_insert
AFTER INSERT ON comments
FOR EACH ROW
BEGIN
    UPDATE posts SET comment_count = COALESCE(comment_count, 0) + 1 WHERE id = NEW.post_id;
END$$

-- Decrements comment_count -1 when comment deleted:
DROP TRIGGER IF EXISTS after_comment_delete$$
CREATE TRIGGER after_comment_delete
AFTER DELETE ON comments
FOR EACH ROW
BEGIN
    UPDATE posts SET comment_count = COALESCE(comment_count, 0) - 1 WHERE id = OLD.post_id;
END$$