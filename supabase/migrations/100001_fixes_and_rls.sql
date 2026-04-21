-- ============================================================
-- CampusShare: Data Integrity and RLS Fixes
-- ============================================================

-- 1. Fix default value for is_verified on profiles
-- Previously defaulted to true, rendering verification meaningless.
ALTER TABLE public.profiles 
  ALTER COLUMN is_verified SET DEFAULT false;

-- Optionally, reset existing users who haven't been explicitly verified.
-- (Commented out to prevent accidental data modification in production, but you can run this manually)
-- UPDATE public.profiles SET is_verified = false;

-- 2. Prevent Public INSERT on Notifications
-- If there was a blanket INSERT policy allowing anyone to spam notifications, drop it.
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_public" ON public.notifications;

-- Explicitly deny public INSERTS, only service_role (triggers) can insert.
-- We do this by defining no INSERT policy at all, which denies access by default.
-- Ensure RLS is enabled just in case.
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3. Harden Profile SELECT (Prevent full data leak)
-- Only allow authenticated users to view profiles
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by public" ON public.profiles;

CREATE POLICY "Profiles are viewable by authenticated users" 
  ON public.profiles FOR SELECT 
  USING (auth.role() = 'authenticated');
