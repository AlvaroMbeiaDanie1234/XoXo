-- Add phone visibility and profile privacy columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_phone BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true;

-- Add comments for documentation
COMMENT ON COLUMN profiles.show_phone IS 'Whether to show phone number publicly';
COMMENT ON COLUMN profiles.is_public IS 'Whether the profile is visible to other users';

-- Insert default reference number setting if not exists
INSERT INTO system_settings (key, value) 
SELECT 'deposit_reference_number', ''
WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE key = 'deposit_reference_number');
