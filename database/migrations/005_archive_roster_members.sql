ALTER TABLE citizens
  ADD COLUMN deleted_at DATETIME(3) NULL;

ALTER TABLE citizens
  ADD KEY idx_cit_active_house (household_id, deleted_at);
