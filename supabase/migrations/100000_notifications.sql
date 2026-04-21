-- ============================================================
-- CampusShare: Notification System Migration
-- ============================================================

-- 1. Notifications table (persisted in-app notifications)
CREATE TABLE IF NOT EXISTS public.notifications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  data         JSONB DEFAULT '{}',
  is_read      BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast unread count queries
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, is_read, created_at DESC);

-- 2. Push subscription table (Web Push API)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint     TEXT NOT NULL UNIQUE,
  p256dh       TEXT NOT NULL,
  auth         TEXT NOT NULL,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions(user_id);

-- ============================================================
-- RLS Policies
-- ============================================================

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Notifications: users see only their own
CREATE POLICY "notifications_select_own"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_own"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Push subscriptions: users manage their own
CREATE POLICY "push_subs_all_own"
  ON public.push_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- DB Trigger Functions: Auto-create notifications on events
-- ============================================================

-- Helper: insert a notification row
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id  UUID,
  p_type     TEXT,
  p_title    TEXT,
  p_body     TEXT,
  p_data     JSONB DEFAULT '{}'
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.notifications(user_id, type, title, body, data)
  VALUES (p_user_id, p_type, p_title, p_body, p_data);
END;
$$;

-- Trigger 1: New item request → notify lender
CREATE OR REPLACE FUNCTION public.notify_on_new_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item      RECORD;
  v_requester RECORD;
BEGIN
  -- Adapted: owner_id -> user_id
  SELECT i.title, i.user_id FROM public.items i WHERE i.id = NEW.item_id INTO v_item;
  SELECT p.full_name FROM public.profiles p WHERE p.id = NEW.requester_id INTO v_requester;

  PERFORM public.create_notification(
    v_item.user_id,
    'new_request',
    '📦 New Borrow Request',
    v_requester.full_name || ' wants to borrow your "' || v_item.title || '"',
    jsonb_build_object('item_id', NEW.item_id, 'deal_id', NEW.id, 'requester_id', NEW.requester_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_request ON public.item_requests;
CREATE TRIGGER trg_notify_new_request
  AFTER INSERT ON public.item_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_request();

-- Trigger 2: Request status change → notify requester
CREATE OR REPLACE FUNCTION public.notify_on_request_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_item RECORD;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;

  SELECT title FROM public.items WHERE id = NEW.item_id INTO v_item;

  IF NEW.status = 'accepted' THEN
    PERFORM public.create_notification(
      NEW.requester_id, 'request_accepted',
      '✅ Request Accepted!',
      'Your request for "' || v_item.title || '" was accepted. Head to QR Handshake.',
      jsonb_build_object('item_id', NEW.item_id, 'deal_id', NEW.id)
    );
  ELSIF NEW.status = 'rejected' THEN
    PERFORM public.create_notification(
      NEW.requester_id, 'request_rejected',
      '❌ Request Declined',
      'Your request for "' || v_item.title || '" was declined.',
      jsonb_build_object('item_id', NEW.item_id, 'deal_id', NEW.id)
    );
  ELSIF NEW.status = 'rented' THEN
    PERFORM public.create_notification(
      NEW.requester_id, 'qr_handshake',
      '🤝 QR Handshake Complete',
      '"' || v_item.title || '" is now in your care. Return it on time!',
      jsonb_build_object('item_id', NEW.item_id, 'deal_id', NEW.id)
    );
  ELSIF NEW.status = 'completed' THEN
    -- Notify both parties
    PERFORM public.create_notification(
      NEW.requester_id, 'deal_completed',
      '🏆 Deal Completed',
      'You returned "' || v_item.title || '". Karma credited!',
      jsonb_build_object('item_id', NEW.item_id, 'deal_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_request_status ON public.item_requests;
CREATE TRIGGER trg_notify_request_status
  AFTER UPDATE ON public.item_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_request_status_change();

-- Trigger 3: Task claimed → notify task creator
CREATE OR REPLACE FUNCTION public.notify_on_task_claimed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_task    RECORD;
  v_claimer RECORD;
BEGIN
  -- Adapted: creator_id -> user_id, claimer_id -> claimed_by
  SELECT t.title, t.user_id FROM public.tasks t WHERE t.id = NEW.task_id INTO v_task;
  SELECT p.full_name FROM public.profiles p WHERE p.id = NEW.claimed_by INTO v_claimer;

  PERFORM public.create_notification(
    v_task.user_id,
    'task_claimed',
    '⚡ Task Claimed',
    (COALESCE(v_claimer.full_name, 'Someone')) || ' picked up your task: "' || v_task.title || '"',
    jsonb_build_object('task_id', NEW.task_id, 'claim_id', NEW.id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_claimed ON public.task_claims;
CREATE TRIGGER trg_notify_task_claimed
  AFTER INSERT ON public.task_claims
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_task_claimed();

-- Trigger 4: New message → notify recipient
CREATE OR REPLACE FUNCTION public.notify_on_new_message()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_sender    RECORD;
  v_recipient UUID;
BEGIN
  -- Find the other participant in the conversation
  SELECT
    CASE WHEN c.participant_1 = NEW.sender_id THEN c.participant_2 ELSE c.participant_1 END
  FROM public.conversations c
  WHERE c.id = NEW.conversation_id
  INTO v_recipient;

  SELECT p.full_name FROM public.profiles p WHERE p.id = NEW.sender_id INTO v_sender;

  PERFORM public.create_notification(
    v_recipient,
    'new_message',
    '💬 ' || (COALESCE(v_sender.full_name, 'A user')),
    LEFT(NEW.content, 80) || CASE WHEN length(NEW.content) > 80 THEN '…' ELSE '' END,
    jsonb_build_object('conversation_id', NEW.conversation_id, 'sender_id', NEW.sender_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_message ON public.messages;
CREATE TRIGGER trg_notify_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_on_new_message();

-- ============================================================
-- Mark all as read helper RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read(p_user_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.notifications
  SET is_read = true
  WHERE user_id = p_user_id AND is_read = false;
END;
$$;

-- Enable realtime for notifications table
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
