-- Manual migration for preserving AI draft metadata on committed transactions.
--
-- MySQL:
-- ALTER TABLE transactions ADD COLUMN currency VARCHAR(8);
-- ALTER TABLE transactions ADD COLUMN merchant VARCHAR(255);
-- ALTER TABLE transactions ADD COLUMN source_text VARCHAR(1000);
--
-- H2:
-- ALTER TABLE transactions ADD COLUMN IF NOT EXISTS currency VARCHAR(8);
-- ALTER TABLE transactions ADD COLUMN IF NOT EXISTS merchant VARCHAR(255);
-- ALTER TABLE transactions ADD COLUMN IF NOT EXISTS source_text VARCHAR(1000);

ALTER TABLE transactions ADD COLUMN currency VARCHAR(8);
ALTER TABLE transactions ADD COLUMN merchant VARCHAR(255);
ALTER TABLE transactions ADD COLUMN source_text VARCHAR(1000);
