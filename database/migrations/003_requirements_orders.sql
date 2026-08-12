CREATE TABLE IF NOT EXISTS parent_requirements (
  id BIGINT UNSIGNED PRIMARY KEY, parent_user_id BIGINT UNSIGNED NOT NULL,
  parent_display_name VARCHAR(80) NOT NULL, district VARCHAR(80) NOT NULL,
  child_grade VARCHAR(48) NOT NULL, subject VARCHAR(48) NOT NULL, expected_time VARCHAR(160) NULL,
  budget_price_cents INT UNSIGNED NOT NULL, study_situation TEXT NULL, teacher_requirement TEXT NULL,
  contact_phone VARCHAR(24) NULL, contact_wechat VARCHAR(80) NULL,
  contact_visible_consent TINYINT(1) NOT NULL DEFAULT 0, status VARCHAR(24) NOT NULL,
  is_recommended TINYINT(1) NOT NULL DEFAULT 0, created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tutor_orders (
  id BIGINT UNSIGNED PRIMARY KEY, order_no VARCHAR(48) NOT NULL,
  parent_user_id BIGINT UNSIGNED NOT NULL, teacher_id BIGINT UNSIGNED NOT NULL,
  subject VARCHAR(48) NOT NULL, student_grade VARCHAR(48) NOT NULL,
  appointment_date VARCHAR(16) NOT NULL, start_time VARCHAR(16) NOT NULL, end_time VARCHAR(16) NOT NULL,
  service_area VARCHAR(80) NOT NULL, address VARCHAR(300) NOT NULL, contact_name VARCHAR(48) NOT NULL,
  contact_phone VARCHAR(24) NOT NULL, note TEXT NULL, status VARCHAR(32) NOT NULL,
  reject_reason TEXT NULL, close_reason TEXT NULL, previous_status VARCHAR(32) NULL,
  created_at VARCHAR(40) NOT NULL, updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_status_logs (
  id BIGINT UNSIGNED PRIMARY KEY, order_id BIGINT UNSIGNED NOT NULL,
  from_status VARCHAR(32) NULL, to_status VARCHAR(32) NOT NULL,
  actor_type VARCHAR(24) NOT NULL, actor_id BIGINT UNSIGNED NOT NULL DEFAULT 0,
  reason VARCHAR(500) NULL, created_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
