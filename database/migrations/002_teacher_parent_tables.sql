CREATE TABLE IF NOT EXISTS parent_profiles (
  id BIGINT UNSIGNED PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL,
  parent_name VARCHAR(40) NOT NULL, phone VARCHAR(24) NULL, district VARCHAR(80) NOT NULL,
  child_grade VARCHAR(48) NOT NULL, subjects_json JSON NOT NULL, available_time_json JSON NOT NULL,
  child_situation TEXT NULL, teacher_requirement TEXT NULL, remark TEXT NULL,
  created_at VARCHAR(40) NOT NULL, updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS teachers (
  id BIGINT UNSIGNED PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, real_name VARCHAR(40) NOT NULL,
  gender VARCHAR(16) NOT NULL, phone VARCHAR(24) NULL, contact_wechat VARCHAR(80) NULL,
  school VARCHAR(120) NOT NULL, major VARCHAR(120) NOT NULL, grade VARCHAR(48) NOT NULL,
  avatar VARCHAR(1024) NULL, introduction TEXT NOT NULL, teaching_experience TEXT NULL,
  gaokao_score TEXT NULL, english_level TEXT NULL, teacher_certificate TEXT NULL,
  competition_experience TEXT NULL, ability_proof_text TEXT NULL, suitable_tags_json JSON NOT NULL,
  hourly_rate_cents INT UNSIGNED NOT NULL, service_areas_json JSON NOT NULL,
  available_times_json JSON NOT NULL, audit_status VARCHAR(24) NOT NULL,
  order_status VARCHAR(24) NOT NULL, rating DECIMAL(4,2) NOT NULL DEFAULT 5.00,
  completed_order_count INT UNSIGNED NOT NULL DEFAULT 0, is_recommended TINYINT(1) NOT NULL DEFAULT 0,
  reject_reason TEXT NULL, banned_reason TEXT NULL, created_at VARCHAR(40) NOT NULL,
  updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS teacher_subjects (
  id BIGINT UNSIGNED PRIMARY KEY, teacher_id BIGINT UNSIGNED NOT NULL,
  subject VARCHAR(48) NOT NULL, teach_grade VARCHAR(48) NOT NULL, created_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS teacher_certifications (
  id BIGINT UNSIGNED PRIMARY KEY, teacher_id BIGINT UNSIGNED NOT NULL,
  material_type VARCHAR(64) NOT NULL, image_url VARCHAR(1024) NOT NULL,
  audit_status VARCHAR(24) NOT NULL, uploaded_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
