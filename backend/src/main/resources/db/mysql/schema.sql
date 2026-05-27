CREATE TABLE IF NOT EXISTS users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  UNIQUE KEY uk_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS categories (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  name VARCHAR(120) NOT NULL,
  type VARCHAR(20) NOT NULL,
  icon VARCHAR(120),
  color VARCHAR(40),
  description VARCHAR(500),
  is_default TINYINT NOT NULL DEFAULT 0,
  usage_count INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  CONSTRAINT fk_categories_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT ck_categories_type CHECK (type IN ('income', 'expense', 'both')),
  UNIQUE KEY uk_categories_user_name_active (user_id, name, deleted_at),
  KEY idx_categories_user_id (user_id),
  KEY idx_categories_user_deleted_name (user_id, deleted_at, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  type VARCHAR(20) NOT NULL,
  category VARCHAR(120) NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  description VARCHAR(1000),
  date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT ck_transactions_type CHECK (type IN ('income', 'expense')),
  KEY idx_transactions_user_deleted_created_id (user_id, deleted_at, created_at DESC, id DESC),
  KEY idx_transactions_user_deleted_date (user_id, deleted_at, date),
  KEY idx_transactions_user_type_date (user_id, type, date),
  KEY idx_transactions_user_category (user_id, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS budgets (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  category VARCHAR(120) NOT NULL,
  amount DECIMAL(18,2) NOT NULL,
  period_month VARCHAR(7) NOT NULL,
  color VARCHAR(40),
  icon VARCHAR(120),
  notes VARCHAR(500),
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME,
  CONSTRAINT fk_budgets_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT ck_budgets_amount CHECK (amount > 0),
  UNIQUE KEY uk_budgets_user_category_month_active (user_id, category, period_month, deleted_at),
  KEY idx_budgets_user_month_active (user_id, period_month, deleted_at),
  KEY idx_budgets_user_category (user_id, category)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
