-- Email delivery preferences are independent from the existing in-app notification preferences.
-- Existing accounts default to all email categories enabled, but delivery is guarded by EMAIL_NOTIFICATIONS_ENABLED.
ALTER TABLE users
  ADD COLUMN email_notification_prefs JSON NULL AFTER notification_prefs;

CREATE TABLE email_notification_outbox (
  email_notification_id BIGINT PRIMARY KEY AUTO_INCREMENT,
  notification_id INT NOT NULL,
  user_id INT NOT NULL,
  category VARCHAR(32) NOT NULL,
  delivery_mode ENUM('immediate','digest') NOT NULL,
  status ENUM('queued','processing','sent','skipped','failed') NOT NULL DEFAULT 'queued',
  attempts INT NOT NULL DEFAULT 0,
  due_at DATETIME NOT NULL,
  locked_at DATETIME NULL,
  claim_token VARCHAR(50) NULL,
  sent_at DATETIME NULL,
  last_error VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_email_notification (notification_id),
  KEY idx_email_delivery (status, due_at),
  KEY idx_email_user (user_id, status, due_at),
  CONSTRAINT fk_email_outbox_notification FOREIGN KEY (notification_id) REFERENCES notifications(notification_id),
  CONSTRAINT fk_email_outbox_user FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
