-- Manual migration for existing databases.
-- Run once before enabling per-user AI provider settings.
--
-- MySQL:
-- ALTER TABLE user_settings ADD COLUMN ai_api_key_encrypted VARCHAR(2048);
-- ALTER TABLE user_settings ADD COLUMN ai_api_key_last4 VARCHAR(8);
-- ALTER TABLE user_settings ADD COLUMN ai_base_url VARCHAR(255);
-- ALTER TABLE user_settings ADD COLUMN ai_model VARCHAR(100);
--
-- H2:
-- ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS ai_api_key_encrypted VARCHAR(2048);
-- ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS ai_api_key_last4 VARCHAR(8);
-- ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS ai_base_url VARCHAR(255);
-- ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS ai_model VARCHAR(100);

ALTER TABLE user_settings ADD COLUMN ai_api_key_encrypted VARCHAR(2048);
ALTER TABLE user_settings ADD COLUMN ai_api_key_last4 VARCHAR(8);
ALTER TABLE user_settings ADD COLUMN ai_base_url VARCHAR(255);
ALTER TABLE user_settings ADD COLUMN ai_model VARCHAR(100);
