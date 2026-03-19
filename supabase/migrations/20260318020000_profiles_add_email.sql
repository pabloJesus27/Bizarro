-- Add email column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email text;

-- Backfill existing users from auth.users
UPDATE profiles
SET email = auth.users.email
FROM auth.users
WHERE profiles.id = auth.users.id;

-- Create trigger to auto-populate email on new user registration
CREATE OR REPLACE FUNCTION sync_user_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET email = NEW.email
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- Trigger fires after insert on auth.users
CREATE OR REPLACE TRIGGER on_auth_user_created_sync_email
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sync_user_email();

-- Also trigger on email update
CREATE OR REPLACE TRIGGER on_auth_user_updated_sync_email
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW EXECUTE FUNCTION sync_user_email();
