-- 采购平台 MySQL Schema

CREATE DATABASE IF NOT EXISTS assc_srm
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE assc_srm;

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  feishu_open_id VARCHAR(128) NOT NULL DEFAULT '',
  feishu_user_id VARCHAR(128) NOT NULL DEFAULT '',
  name VARCHAR(100) NOT NULL DEFAULT '',
  avatar VARCHAR(500) NOT NULL DEFAULT '',
  role VARCHAR(20) NOT NULL DEFAULT 'pm',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_feishu_open_id (feishu_open_id),
  INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS projects (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL DEFAULT '',
  no VARCHAR(50) NOT NULL DEFAULT '',
  owner VARCHAR(100) NOT NULL DEFAULT '',
  budget DECIMAL(12,2) DEFAULT 0,
  category VARCHAR(100) NOT NULL DEFAULT '',
  department VARCHAR(50) NOT NULL DEFAULT '',
  task_type VARCHAR(100) NOT NULL DEFAULT '',
  is_single_source VARCHAR(10) NOT NULL DEFAULT '',
  procurement_method VARCHAR(50) NOT NULL DEFAULT '',
  plan_start DATE DEFAULT NULL,
  plan_end DATE DEFAULT NULL,
  current_stage VARCHAR(50) NOT NULL DEFAULT 'requirement',
  status VARCHAR(50) NOT NULL DEFAULT '进行中',
  remark TEXT,
  company VARCHAR(20) NOT NULL DEFAULT 'ZT',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE INDEX idx_name (name),
  INDEX idx_no (no),
  INDEX idx_owner (owner),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS nodes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL DEFAULT 0,
  stage_key VARCHAR(50) NOT NULL DEFAULT '',
  stage_label VARCHAR(100) NOT NULL DEFAULT '',
  `order` INT NOT NULL DEFAULT 0,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  plan_start DATE DEFAULT NULL,
  plan_end DATE DEFAULT NULL,
  actual_date DATE DEFAULT NULL,
  note TEXT,
  abnormal_reason TEXT,
  assignee VARCHAR(100) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_project_id (project_id),
  INDEX idx_stage_key (stage_key),
  UNIQUE INDEX idx_project_stage (project_id, stage_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS issues (
  id INT AUTO_INCREMENT PRIMARY KEY,
  project_id INT NOT NULL DEFAULT 0,
  stage_key VARCHAR(50) NOT NULL DEFAULT '',
  description TEXT,
  assignee VARCHAR(100) NOT NULL DEFAULT '',
  priority VARCHAR(20) NOT NULL DEFAULT '中',
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_project_id (project_id),
  INDEX idx_status (status),
  INDEX idx_assignee (assignee)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `groups` (
  id INT AUTO_INCREMENT PRIMARY KEY,
  chat_id VARCHAR(128) NOT NULL DEFAULT '',
  project_id INT NOT NULL DEFAULT 0,
  project_name VARCHAR(200) NOT NULL DEFAULT '',
  bound_at VARCHAR(50) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE INDEX idx_chat_id (chat_id),
  INDEX idx_project_id (project_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS weekly_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_chat_ids TEXT,
  specific_users TEXT,
  updated_at VARCHAR(50) NOT NULL DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
