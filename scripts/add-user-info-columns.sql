-- Add user info columns to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS location TEXT;

-- Add visibility columns
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_gender BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_country BOOLEAN DEFAULT true;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS show_location BOOLEAN DEFAULT true;

-- Add comments for documentation
COMMENT ON COLUMN profiles.gender IS 'User gender: male, female, or other';
COMMENT ON COLUMN profiles.age IS 'User age in years';
COMMENT ON COLUMN profiles.country IS 'User country code (e.g., AO for Angola)';
COMMENT ON COLUMN profiles.province IS 'User province/state';
COMMENT ON COLUMN profiles.location IS 'User residence location (city, neighborhood, etc.)';
COMMENT ON COLUMN profiles.show_gender IS 'Whether to show gender publicly';
COMMENT ON COLUMN profiles.show_country IS 'Whether to show country publicly';
COMMENT ON COLUMN profiles.show_location IS 'Whether to show location publicly';