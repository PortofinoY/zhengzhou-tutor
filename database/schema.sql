-- 郑州大学生上门家教小程序 MVP 数据库结构
-- 可用于 MySQL / PostgreSQL / SQLite 改造时的字段基线。

CREATE TABLE user (
  id INTEGER PRIMARY KEY,
  openid VARCHAR(128) UNIQUE,
  phone VARCHAR(20),
  account_username VARCHAR(80) UNIQUE,
  account_password_hash VARCHAR(256),
  nickname VARCHAR(80),
  avatar VARCHAR(500),
  current_role VARCHAR(20),
  roles TEXT,
  profile_status VARCHAR(30) NOT NULL DEFAULT 'pending_role',
  account_status VARCHAR(20) NOT NULL DEFAULT 'normal',
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until DATETIME,
  registered_at DATETIME NOT NULL,
  last_login_at DATETIME,
  updated_at DATETIME NOT NULL
);

CREATE TABLE parent_profile (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  parent_name VARCHAR(40) NOT NULL,
  phone VARCHAR(20) NOT NULL,
  district VARCHAR(80) NOT NULL,
  child_grade VARCHAR(40) NOT NULL,
  subjects TEXT NOT NULL,
  available_time TEXT,
  remark TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(id)
);

CREATE TABLE teacher (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  real_name VARCHAR(40) NOT NULL,
  gender VARCHAR(10) NOT NULL,
  phone VARCHAR(20),
  school VARCHAR(80) NOT NULL,
  major VARCHAR(80) NOT NULL,
  grade VARCHAR(40) NOT NULL,
  avatar VARCHAR(500) NOT NULL,
  introduction TEXT NOT NULL,
  teaching_experience TEXT,
  gaokao_score TEXT,
  english_level TEXT,
  teacher_certificate TEXT,
  competition_experience TEXT,
  ability_proof_text TEXT,
  suitable_tags TEXT,
  hourly_rate INTEGER NOT NULL,
  service_areas TEXT NOT NULL,
  available_times TEXT NOT NULL,
  audit_status VARCHAR(20) NOT NULL,
  order_status VARCHAR(20) NOT NULL DEFAULT 'available',
  rating DECIMAL(3,2) NOT NULL DEFAULT 5.0,
  completed_order_count INTEGER NOT NULL DEFAULT 0,
  is_recommended BOOLEAN NOT NULL DEFAULT FALSE,
  reject_reason TEXT,
  banned_reason TEXT,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (user_id) REFERENCES user(id)
);

CREATE TABLE teacher_subject (
  id INTEGER PRIMARY KEY,
  teacher_id INTEGER NOT NULL,
  subject VARCHAR(40) NOT NULL,
  teach_grade VARCHAR(40) NOT NULL,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (teacher_id) REFERENCES teacher(id)
);

CREATE TABLE teacher_certification (
  id INTEGER PRIMARY KEY,
  teacher_id INTEGER NOT NULL,
  material_type VARCHAR(40) NOT NULL,
  image_url VARCHAR(500) NOT NULL,
  audit_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  uploaded_at DATETIME NOT NULL,
  FOREIGN KEY (teacher_id) REFERENCES teacher(id)
);

CREATE TABLE tutor_order (
  id INTEGER PRIMARY KEY,
  order_no VARCHAR(40) NOT NULL UNIQUE,
  parent_user_id INTEGER NOT NULL,
  teacher_id INTEGER NOT NULL,
  subject VARCHAR(40) NOT NULL,
  student_grade VARCHAR(40) NOT NULL,
  appointment_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  service_area VARCHAR(80) NOT NULL,
  address VARCHAR(200) NOT NULL,
  contact_name VARCHAR(40) NOT NULL,
  contact_phone VARCHAR(20) NOT NULL,
  note TEXT,
  status VARCHAR(20) NOT NULL,
  close_reason TEXT,
  previous_status VARCHAR(20),
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (parent_user_id) REFERENCES user(id),
  FOREIGN KEY (teacher_id) REFERENCES teacher(id)
);

CREATE TABLE review (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL UNIQUE,
  parent_user_id INTEGER NOT NULL,
  teacher_id INTEGER NOT NULL,
  star_rating INTEGER NOT NULL,
  attitude_rating INTEGER NOT NULL,
  punctuality_rating INTEGER NOT NULL,
  clarity_rating INTEGER NOT NULL,
  child_acceptance_rating INTEGER NOT NULL,
  content TEXT,
  is_visible BOOLEAN NOT NULL DEFAULT TRUE,
  hidden_reason TEXT,
  created_at DATETIME NOT NULL,
  FOREIGN KEY (order_id) REFERENCES tutor_order(id),
  FOREIGN KEY (parent_user_id) REFERENCES user(id),
  FOREIGN KEY (teacher_id) REFERENCES teacher(id)
);

CREATE TABLE complaint (
  id INTEGER PRIMARY KEY,
  complaint_no VARCHAR(40) NOT NULL UNIQUE,
  order_id INTEGER NOT NULL,
  complainant_user_id INTEGER NOT NULL,
  complainant_role VARCHAR(20) NOT NULL,
  target_user_id INTEGER NOT NULL,
  reason VARCHAR(60) NOT NULL,
  description TEXT NOT NULL,
  images TEXT,
  status VARCHAR(20) NOT NULL,
  result TEXT,
  handler_admin_id INTEGER,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  FOREIGN KEY (order_id) REFERENCES tutor_order(id),
  FOREIGN KEY (complainant_user_id) REFERENCES user(id),
  FOREIGN KEY (handler_admin_id) REFERENCES admin_user(id)
);

CREATE TABLE admin_user (
  id INTEGER PRIMARY KEY,
  username VARCHAR(80) NOT NULL UNIQUE,
  phone VARCHAR(20) UNIQUE,
  password_hash VARCHAR(256) NOT NULL,
  role VARCHAR(20) NOT NULL,
  account_status VARCHAR(20) NOT NULL DEFAULT 'normal',
  failed_login_count INTEGER NOT NULL DEFAULT 0,
  locked_until DATETIME,
  last_login_at DATETIME,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE admin_login_ticket (
  id INTEGER PRIMARY KEY,
  ticket VARCHAR(120) NOT NULL UNIQUE,
  admin_id INTEGER NOT NULL,
  used BOOLEAN NOT NULL DEFAULT FALSE,
  expired_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL,
  used_at DATETIME,
  FOREIGN KEY (admin_id) REFERENCES admin_user(id)
);

CREATE INDEX idx_teacher_audit_order_status ON teacher (audit_status, order_status);
CREATE INDEX idx_parent_profile_user ON parent_profile (user_id);
CREATE INDEX idx_order_parent ON tutor_order (parent_user_id, status);
CREATE INDEX idx_order_teacher ON tutor_order (teacher_id, status);
CREATE INDEX idx_complaint_status ON complaint (status);
CREATE INDEX idx_admin_login_ticket ON admin_login_ticket (ticket, used, expired_at);
