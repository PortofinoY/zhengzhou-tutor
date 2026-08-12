CREATE TABLE IF NOT EXISTS schema_migrations (
  version INT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  checksum CHAR(64) NOT NULL,
  applied_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS app_state_lock (id TINYINT PRIMARY KEY)
  ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT IGNORE INTO app_state_lock (id) VALUES (1);

CREATE TABLE IF NOT EXISTS app_sequences (
  entity_name VARCHAR(80) PRIMARY KEY,
  next_id BIGINT UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS app_users (
  id BIGINT UNSIGNED PRIMARY KEY,
  openid VARCHAR(128) NULL,
  wechat_session_key VARCHAR(256) NULL,
  unionid VARCHAR(128) NULL,
  phone VARCHAR(24) NULL,
  nickname VARCHAR(80) NULL,
  avatar VARCHAR(1024) NULL,
  current_role VARCHAR(24) NULL,
  roles_json JSON NOT NULL,
  profile_status VARCHAR(32) NOT NULL,
  account_username VARCHAR(80) NULL,
  account_password_hash VARCHAR(256) NULL,
  account_status VARCHAR(24) NOT NULL,
  failed_login_count INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until VARCHAR(40) NULL,
  freeze_reason VARCHAR(500) NULL,
  registered_at VARCHAR(40) NOT NULL,
  last_login_at VARCHAR(40) NULL,
  updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT UNSIGNED PRIMARY KEY,
  username VARCHAR(80) NOT NULL,
  phone VARCHAR(24) NULL,
  password_hash VARCHAR(256) NOT NULL,
  role VARCHAR(32) NOT NULL,
  status VARCHAR(24) NULL,
  account_status VARCHAR(24) NOT NULL,
  failed_login_count INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until VARCHAR(40) NULL,
  last_login_at VARCHAR(40) NULL,
  last_login_time VARCHAR(40) NULL,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admin_login_tickets (
  id BIGINT UNSIGNED PRIMARY KEY,
  ticket VARCHAR(160) NOT NULL,
  admin_id BIGINT UNSIGNED NOT NULL,
  used TINYINT(1) NOT NULL DEFAULT 0,
  expired_at VARCHAR(40) NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  used_at VARCHAR(40) NULL,
  updated_at VARCHAR(40) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS token_revocations (
  id BIGINT UNSIGNED PRIMARY KEY,
  token_hash CHAR(64) NOT NULL,
  token_type VARCHAR(24) NOT NULL,
  subject_id BIGINT UNSIGNED NOT NULL,
  expired_at VARCHAR(40) NOT NULL,
  revoked_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS phone_verifications (
  id BIGINT UNSIGNED PRIMARY KEY,
  phone VARCHAR(24) NOT NULL,
  code VARCHAR(32) NOT NULL,
  failed_count INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until VARCHAR(40) NULL,
  expires_at VARCHAR(40) NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
