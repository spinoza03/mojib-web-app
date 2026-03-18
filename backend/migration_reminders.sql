-- ============================================
-- SQL Migration: Add Reminder & Cooldown columns
-- Run this in Supabase SQL Editor (Dashboard → SQL)
-- ============================================

-- 1. Add cooldown_seconds to bot_configs (if not already present)
ALTER TABLE bot_configs 
ADD COLUMN IF NOT EXISTS cooldown_seconds INTEGER DEFAULT 60;

-- 2. Add reminder_message to bot_configs
ALTER TABLE bot_configs 
ADD COLUMN IF NOT EXISTS reminder_message TEXT DEFAULT 'مرحبا {patient_name}، هاد تذكير بالموعد ديالك في {clinic_name} نهار {time}. نتمناو نشوفوك!';

-- 3. Add reminder_rules to bot_configs (JSONB array)
-- Example value: [{"minutes_before": 1440, "enabled": true}, {"minutes_before": 30, "enabled": true}]
ALTER TABLE bot_configs 
ADD COLUMN IF NOT EXISTS reminder_rules JSONB DEFAULT '[]'::jsonb;

-- 4. Add reminders_sent to appointments (JSONB array of integers)
-- Tracks which reminder rules (by minutes_before) have been sent for this appointment
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS reminders_sent JSONB DEFAULT '[]'::jsonb;
