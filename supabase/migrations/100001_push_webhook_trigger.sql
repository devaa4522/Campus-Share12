-- ============================================================
-- CampusShare: Push Notification Webhook Trigger
-- ============================================================
-- This migration creates a database trigger that automatically calls
-- the push-notify edge function whenever a new notification is inserted.
-- This is the missing piece that bridges in-app notifications → OS push.
-- ============================================================

-- 1. Enable pg_net extension (HTTP calls from inside Postgres)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- 2. Create trigger function that fires on notification INSERT
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  _supabase_url TEXT;
  _service_key  TEXT;
BEGIN
  -- Read Supabase URL from vault or env
  -- SUPABASE_URL and SERVICE_ROLE_KEY are auto-available in edge functions,
  -- but we need to call the edge function URL directly.
  -- The URL pattern is: https://<project-ref>.supabase.co/functions/v1/push-notify
  
  SELECT decrypted_secret INTO _supabase_url
    FROM vault.decrypted_secrets
   WHERE name = 'SUPABASE_URL'
   LIMIT 1;

  SELECT decrypted_secret INTO _service_key
    FROM vault.decrypted_secrets
   WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
   LIMIT 1;

  -- If vault secrets aren't set, try hardcoded project URL
  IF _supabase_url IS NULL THEN
    _supabase_url := 'https://nfqptzssqcdgnfwqrngs.supabase.co';
  END IF;

  -- Only fire for notification types that should trigger push
  -- (skip if user has no push subscriptions — the edge function handles that)
  
  PERFORM net.http_post(
    url := _supabase_url || '/functions/v1/push-notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(_service_key, '')
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id::TEXT,
      'type',    NEW.type,
      'title',   NEW.title,
      'body',    NEW.body,
      'data',    COALESCE(NEW.data, '{}'::JSONB)
    )
  );

  RETURN NEW;
END;
$$;

-- 3. Create the trigger on the notifications table
DROP TRIGGER IF EXISTS trg_push_on_notification_insert ON public.notifications;
CREATE TRIGGER trg_push_on_notification_insert
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_notification();

-- Note: The edge function was deployed with --no-verify-jwt so it can be called
-- from the database webhook. The function itself validates the payload structure.
