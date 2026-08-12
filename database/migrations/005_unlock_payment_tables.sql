CREATE TABLE IF NOT EXISTS unlock_records (
  id BIGINT UNSIGNED PRIMARY KEY, buyer_user_id BIGINT UNSIGNED NOT NULL,
  buyer_role VARCHAR(24) NOT NULL, target_type VARCHAR(40) NOT NULL,
  target_id BIGINT UNSIGNED NOT NULL, amount_cents INT UNSIGNED NOT NULL,
  pay_status VARCHAR(24) NOT NULL, pay_order_no VARCHAR(64) NULL,
  unlock_status VARCHAR(24) NOT NULL, created_at VARCHAR(40) NOT NULL,
  paid_at VARCHAR(40) NULL, expired_at VARCHAR(40) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS payment_orders (
  id BIGINT UNSIGNED PRIMARY KEY, order_no VARCHAR(64) NOT NULL,
  merchant_order_no VARCHAR(64) NULL, channel_transaction_id VARCHAR(128) NULL,
  buyer_user_id BIGINT UNSIGNED NOT NULL, buyer_role VARCHAR(24) NOT NULL,
  target_type VARCHAR(40) NOT NULL, target_id BIGINT UNSIGNED NOT NULL,
  amount_cents INT UNSIGNED NOT NULL, pay_status VARCHAR(24) NOT NULL,
  pay_mode VARCHAR(24) NULL, pay_channel VARCHAR(32) NULL, callback_status VARCHAR(24) NULL,
  idempotency_key VARCHAR(128) NULL, refund_status VARCHAR(24) NULL,
  refund_amount_cents INT UNSIGNED NOT NULL DEFAULT 0, created_at VARCHAR(40) NOT NULL,
  paid_at VARCHAR(40) NULL, refunded_at VARCHAR(40) NULL, closed_at VARCHAR(40) NULL,
  updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS contact_logs (
  id BIGINT UNSIGNED PRIMARY KEY, user_id BIGINT UNSIGNED NOT NULL, role VARCHAR(24) NOT NULL,
  target_type VARCHAR(40) NOT NULL, target_id BIGINT UNSIGNED NOT NULL,
  contact_status VARCHAR(24) NOT NULL, note TEXT NULL,
  created_at VARCHAR(40) NOT NULL, updated_at VARCHAR(40) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
