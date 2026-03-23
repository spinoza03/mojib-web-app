-- ============================================================
-- Add missing reminder & cooldown columns to bot_configs.
-- These are required by the reminder service and settings page.
-- ============================================================

ALTER TABLE public.bot_configs
  ADD COLUMN IF NOT EXISTS cooldown_seconds INTEGER DEFAULT 60;

ALTER TABLE public.bot_configs
  ADD COLUMN IF NOT EXISTS reminder_message TEXT
    DEFAULT 'مرحبا {patient_name}، هاد تذكير بالموعد ديالك في {clinic_name} نهار {time}. نتمناو نشوفوك!';

ALTER TABLE public.bot_configs
  ADD COLUMN IF NOT EXISTS reminder_rules JSONB DEFAULT '[]'::jsonb;
