-- Slip customization: accent color + optional header banner + full template background.
ALTER TABLE organization_settings
  ADD COLUMN slip_accent_color VARCHAR(16) NULL,
  ADD COLUMN slip_header_banner_path VARCHAR(255) NULL,
  ADD COLUMN slip_template_url VARCHAR(500) NULL;
