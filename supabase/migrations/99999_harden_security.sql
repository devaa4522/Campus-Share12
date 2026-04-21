-- Migration: Harden Security (Ghost-Proofing and Walled Garden)

-- 1. Add student_id_hash for Ghost-proofing (Blacklisting)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS student_id_hash text UNIQUE;

-- Create an index for quick lookup during onboarding to prevent banned users
CREATE INDEX IF NOT EXISTS idx_profiles_student_id_hash ON public.profiles(student_id_hash);

-- 2. Walled Garden Security (Strict RLS based on college_domain)

-- Ensure RLS is enabled
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- ITEMS TABLE POLICIES
-- Users can only view items if the item's college_domain matches their profile's college_domain
CREATE POLICY "Users can only view items from their college" 
ON public.items 
FOR SELECT 
USING (
  college_domain = (
    SELECT college_domain FROM public.profiles WHERE id = auth.uid()
  )
);

-- Users can only insert items into their own college domain
CREATE POLICY "Users can only create items in their college" 
ON public.items 
FOR INSERT 
WITH CHECK (
  college_domain = (
    SELECT college_domain FROM public.profiles WHERE id = auth.uid()
  ) AND user_id = auth.uid()
);

-- TASKS TABLE POLICIES
-- Users can only view tasks if the task's college_domain matches their profile's college_domain
CREATE POLICY "Users can only view tasks from their college" 
ON public.tasks 
FOR SELECT 
USING (
  college_domain = (
    SELECT college_domain FROM public.profiles WHERE id = auth.uid()
  )
);

-- Users can only insert tasks into their own college domain
CREATE POLICY "Users can only create tasks in their college" 
ON public.tasks 
FOR INSERT 
WITH CHECK (
  college_domain = (
    SELECT college_domain FROM public.profiles WHERE id = auth.uid()
  ) AND user_id = auth.uid()
);

-- Note: The above policies assume `auth.uid()` corresponds to a profile row. 
-- In production, joining `profiles` for every read row could affect performance.
-- For higher performance, store `college_domain` inside `auth.users.raw_user_meta_data` 
-- and access it via `(auth.jwt() -> 'user_metadata' ->> 'college_domain')`.

