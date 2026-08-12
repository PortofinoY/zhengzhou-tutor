-- 郑育星上门家教 MySQL 8 当前完整结构（迁移版本 7）
-- 生产环境请执行 npm run db:migrate，不要直接用本文件覆盖已有数据库。
-- 时间统一保存为 ISO 8601 文本，金额统一保存为整数分。
-- 本阶段不启用数据库外键，避免历史 JSON 数据迁移被中断；关联一致性由导入核验和服务事务保证。

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INT PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  checksum CHAR(64) NOT NULL,
  applied_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS app_state_lock (
  id TINYINT PRIMARY KEY
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

CREATE TABLE IF NOT EXISTS parent_profiles (
  id BIGINT UNSIGNED PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  parent_name VARCHAR(40) NOT NULL,
  phone VARCHAR(24) NULL,
  district VARCHAR(80) NOT NULL,
  child_grade VARCHAR(48) NOT NULL,
  subjects_json JSON NOT NULL,
  available_time_json JSON NOT NULL,
  child_situation TEXT NULL,
  teacher_requirement TEXT NULL,
  remark TEXT NULL,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS teachers (
  id BIGINT UNSIGNED PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  real_name VARCHAR(40) NOT NULL,
  gender VARCHAR(16) NOT NULL,
  phone VARCHAR(24) NULL,
  contact_wechat VARCHAR(80) NULL,
  school VARCHAR(120) NOT NULL,
  major VARCHAR(120) NOT NULL,
  grade VARCHAR(48) NOT NULL,
  avatar VARCHAR(1024) NULL,
  introduction TEXT NOT NULL,
  teaching_experience TEXT NULL,
  gaokao_score TEXT NULL,
  english_level TEXT NULL,
  teacher_certificate TEXT NULL,
  competition_experience TEXT NULL,
  ability_proof_text TEXT NULL,
  suitable_tags_json JSON NOT NULL,
  hourly_rate_cents INT UNSIGNED NOT NULL,
  service_areas_json JSON NOT NULL,
  available_times_json JSON NOT NULL,
  audit_status VARCHAR(24) NOT NULL,
  order_status VARCHAR(24) NOT NULL,
  rating DECIMAL(4,2) NOT NULL DEFAULT 5.00,
  completed_order_count INT UNSIGNED NOT NULL DEFAULT 0,
  is_recommended TINYINT(1) NOT NULL DEFAULT 0,
  reject_reason TEXT NULL,
  banned_reason TEXT NULL,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS teacher_subjects (
  id BIGINT UNSIGNED PRIMARY KEY,
  teacher_id BIGINT UNSIGNED NOT NULL,
  subject VARCHAR(48) NOT NULL,
  teach_grade VARCHAR(48) NOT NULL,
  created_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS teacher_certifications (
  id BIGINT UNSIGNED PRIMARY KEY,
  teacher_id BIGINT UNSIGNED NOT NULL,
  material_type VARCHAR(64) NOT NULL,
  image_url VARCHAR(1024) NOT NULL,
  audit_status VARCHAR(24) NOT NULL,
  uploaded_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS parent_requirements (
  id BIGINT UNSIGNED PRIMARY KEY,
  parent_user_id BIGINT UNSIGNED NOT NULL,
  parent_display_name VARCHAR(80) NOT NULL,
  district VARCHAR(80) NOT NULL,
  child_grade VARCHAR(48) NOT NULL,
  subject VARCHAR(48) NOT NULL,
  expected_time VARCHAR(160) NULL,
  budget_price_cents INT UNSIGNED NOT NULL,
  study_situation TEXT NULL,
  teacher_requirement TEXT NULL,
  contact_phone VARCHAR(24) NULL,
  contact_wechat VARCHAR(80) NULL,
  contact_visible_consent TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(24) NOT NULL,
  is_recommended TINYINT(1) NOT NULL DEFAULT 0,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tutor_orders (
  id BIGINT UNSIGNED PRIMARY KEY,
  order_no VARCHAR(48) NOT NULL,
  parent_user_id BIGINT UNSIGNED NOT NULL,
  teacher_id BIGINT UNSIGNED NOT NULL,
  subject VARCHAR(48) NOT NULL,
  student_grade VARCHAR(48) NOT NULL,
  appointment_date VARCHAR(16) NOT NULL,
  start_time VARCHAR(16) NOT NULL,
  end_time VARCHAR(16) NOT NULL,
  service_area VARCHAR(80) NOT NULL,
  address VARCHAR(300) NOT NULL,
  contact_name VARCHAR(48) NOT NULL,
  contact_phone VARCHAR(24) NOT NULL,
  note TEXT NULL,
  status VARCHAR(32) NOT NULL,
  reject_reason TEXT NULL,
  close_reason TEXT NULL,
  previous_status VARCHAR(32) NULL,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_status_logs (
  id BIGINT UNSIGNED PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  from_status VARCHAR(32) NULL,
  to_status VARCHAR(32) NOT NULL,
  actor_type VARCHAR(24) NOT NULL,
  actor_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  reason VARCHAR(500) NULL,
  created_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS reviews (
  id BIGINT UNSIGNED PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  parent_user_id BIGINT UNSIGNED NOT NULL,
  teacher_id BIGINT UNSIGNED NOT NULL,
  star_rating TINYINT UNSIGNED NOT NULL,
  attitude_rating TINYINT UNSIGNED NOT NULL,
  punctuality_rating TINYINT UNSIGNED NOT NULL,
  clarity_rating TINYINT UNSIGNED NOT NULL,
  child_acceptance_rating TINYINT UNSIGNED NOT NULL,
  content TEXT NULL,
  is_visible TINYINT(1) NOT NULL DEFAULT 1,
  hidden_reason TEXT NULL,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS complaints (
  id BIGINT UNSIGNED PRIMARY KEY,
  complaint_no VARCHAR(48) NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  complainant_user_id BIGINT UNSIGNED NOT NULL,
  complainant_role VARCHAR(24) NOT NULL,
  target_user_id BIGINT UNSIGNED NOT NULL,
  reason VARCHAR(80) NOT NULL,
  description TEXT NOT NULL,
  images_json JSON NOT NULL,
  status VARCHAR(24) NOT NULL,
  result TEXT NULL,
  handler_admin_id BIGINT UNSIGNED NULL,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS unlock_records (
  id BIGINT UNSIGNED PRIMARY KEY,
  buyer_user_id BIGINT UNSIGNED NOT NULL,
  buyer_role VARCHAR(24) NOT NULL,
  target_type VARCHAR(40) NOT NULL,
  target_id BIGINT UNSIGNED NOT NULL,
  amount_cents INT UNSIGNED NOT NULL,
  pay_status VARCHAR(24) NOT NULL,
  pay_order_no VARCHAR(64) NULL,
  unlock_status VARCHAR(24) NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  paid_at VARCHAR(40) NULL,
  expired_at VARCHAR(40) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payment_orders (
  id BIGINT UNSIGNED PRIMARY KEY,
  order_no VARCHAR(64) NOT NULL,
  merchant_order_no VARCHAR(64) NULL,
  channel_transaction_id VARCHAR(128) NULL,
  buyer_user_id BIGINT UNSIGNED NOT NULL,
  buyer_role VARCHAR(24) NOT NULL,
  target_type VARCHAR(40) NOT NULL,
  target_id BIGINT UNSIGNED NOT NULL,
  amount_cents INT UNSIGNED NOT NULL,
  pay_status VARCHAR(24) NOT NULL,
  pay_mode VARCHAR(24) NULL,
  pay_channel VARCHAR(32) NULL,
  callback_status VARCHAR(24) NULL,
  idempotency_key VARCHAR(128) NULL,
  refund_status VARCHAR(24) NULL,
  refund_amount_cents INT UNSIGNED NOT NULL DEFAULT 0,
  created_at VARCHAR(40) NOT NULL,
  paid_at VARCHAR(40) NULL,
  refunded_at VARCHAR(40) NULL,
  closed_at VARCHAR(40) NULL,
  updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS contact_logs (
  id BIGINT UNSIGNED PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  role VARCHAR(24) NOT NULL,
  target_type VARCHAR(40) NOT NULL,
  target_id BIGINT UNSIGNED NOT NULL,
  contact_status VARCHAR(24) NOT NULL,
  note TEXT NULL,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS frontend_configs (
  id BIGINT UNSIGNED PRIMARY KEY,
  config_key VARCHAR(100) NOT NULL,
  config_value_json JSON NOT NULL,
  config_type VARCHAR(24) NOT NULL,
  description VARCHAR(300) NULL,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS admin_operation_logs (
  id BIGINT UNSIGNED PRIMARY KEY,
  admin_id BIGINT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  target_type VARCHAR(48) NOT NULL,
  target_id BIGINT UNSIGNED NULL,
  detail TEXT NULL,
  payload_json JSON NOT NULL,
  created_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS uploaded_files (
  id BIGINT UNSIGNED PRIMARY KEY,
  owner_user_id BIGINT UNSIGNED NOT NULL,
  purpose VARCHAR(64) NOT NULL,
  storage_provider VARCHAR(32) NOT NULL,
  storage_key VARCHAR(512) NOT NULL,
  public_url VARCHAR(1024) NOT NULL,
  mime_type VARCHAR(80) NOT NULL,
  size_bytes BIGINT UNSIGNED NOT NULL,
  status VARCHAR(24) NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE UNIQUE INDEX uq_app_users_openid ON app_users (openid);
CREATE UNIQUE INDEX uq_app_users_phone ON app_users (phone);
CREATE UNIQUE INDEX uq_app_users_username ON app_users (account_username);
CREATE UNIQUE INDEX uq_admin_users_username ON admin_users (username);
CREATE UNIQUE INDEX uq_admin_users_phone ON admin_users (phone);
CREATE UNIQUE INDEX uq_admin_login_tickets_ticket ON admin_login_tickets (ticket);
CREATE UNIQUE INDEX uq_token_revocations_hash ON token_revocations (token_hash);
CREATE UNIQUE INDEX uq_parent_profiles_user ON parent_profiles (user_id);
CREATE UNIQUE INDEX uq_teachers_user ON teachers (user_id);
CREATE UNIQUE INDEX uq_teacher_subject ON teacher_subjects (teacher_id, subject, teach_grade);
CREATE UNIQUE INDEX uq_order_no ON tutor_orders (order_no);
CREATE UNIQUE INDEX uq_review_order ON reviews (order_id);
CREATE UNIQUE INDEX uq_complaint_no ON complaints (complaint_no);
CREATE UNIQUE INDEX uq_unlock_target ON unlock_records (buyer_user_id, target_type, target_id);
CREATE UNIQUE INDEX uq_payment_order_no ON payment_orders (order_no);
CREATE UNIQUE INDEX uq_payment_merchant_no ON payment_orders (merchant_order_no);
CREATE UNIQUE INDEX uq_payment_idempotency ON payment_orders (idempotency_key);
CREATE UNIQUE INDEX uq_frontend_config_key ON frontend_configs (config_key);
CREATE UNIQUE INDEX uq_uploaded_storage_key ON uploaded_files (storage_provider, storage_key);

CREATE INDEX idx_users_status ON app_users (account_status, profile_status);
CREATE INDEX idx_teacher_visibility ON teachers (audit_status, order_status, is_recommended);
CREATE INDEX idx_teacher_subject_filter ON teacher_subjects (subject, teach_grade, teacher_id);
CREATE INDEX idx_teacher_certification ON teacher_certifications (teacher_id, audit_status);
CREATE INDEX idx_requirement_filter ON parent_requirements (status, child_grade, subject, district, created_at);
CREATE INDEX idx_order_parent_status ON tutor_orders (parent_user_id, status, created_at);
CREATE INDEX idx_order_teacher_status ON tutor_orders (teacher_id, status, created_at);
CREATE INDEX idx_order_status_log ON order_status_logs (order_id, created_at);
CREATE INDEX idx_review_teacher ON reviews (teacher_id, is_visible, created_at);
CREATE INDEX idx_complaint_status ON complaints (status, created_at);
CREATE INDEX idx_unlock_buyer ON unlock_records (buyer_user_id, buyer_role, created_at);
CREATE INDEX idx_payment_buyer_status ON payment_orders (buyer_user_id, pay_status, created_at);
CREATE INDEX idx_contact_target ON contact_logs (user_id, target_type, target_id);
CREATE INDEX idx_phone_verification ON phone_verifications (phone, expires_at);
CREATE INDEX idx_operation_log ON admin_operation_logs (admin_id, action, created_at);
CREATE INDEX idx_uploaded_owner ON uploaded_files (owner_user_id, purpose, created_at);
