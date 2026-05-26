-- Add data_consent_accepted field to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS data_consent_accepted BOOLEAN DEFAULT FALSE;
