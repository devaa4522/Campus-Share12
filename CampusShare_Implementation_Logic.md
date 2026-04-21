# CampusShare Implementation Logic

This document details the core technical implementation logic of the "Campus Super-App", extracting flow, state changes, and primary hooks across foundational modules.

## 1. Items & Tasks CRUD

The primary data structures are managed directly via Supabase client queries and RPCs rather than central Server Actions.

**Items Execution Flow:**
- **Create**: Handled in `src/app/post/page.tsx` using `supabase.from("items").insert()`. Users specify price types (Free, Karma, Rental).
- **Read**: `src/components/HubClient.tsx` executes complex relational queries (`profiles!inner` joins) against `items`, effectively validating shadowbans via the profile's `banned_until` column and filtering by `college_domain`.
- **Update/Delete**: Maintained in `src/app/items/[id]/edit/page.tsx` via standard `supabase.from("items").update()`.

**Tasks Execution Flow:**
- **Create**: Originate from `PostTaskModal.tsx` via standard `insert()`. 
- **Read**: `TasksClient.tsx` mounts a realtime feed via `supabase.channel('tasks-feed')` streaming `INSERT`, `UPDATE`, and `DELETE` payloads from the `tasks` table. 
- **Claim (Update)**: Clicking "I Can Help" triggers a specific atomic Postgres RPC (`claim_task_atomic`) that inherently handles race conditions if multiple users attempt to claim simultaneously.

## 2. Transaction State Machine

The workflow uses explicit states mapped to UI elements like the `TransactionCard` (inside Messages) or `RequestCard` (inside Dashboard). 

**Lifecycle Trace (`item_requests` & `items`):**
1. **Pending**: A borrower hits request. 
2. **Accepted**: The Lender approves via `DashboardClient.handleUpdateStatus()`.
3. **Rented**: Triggered by the *QR Handshake* (`DashboardClient.handleQRConfirm`), the item physically changes hands.
4. **Returning**: The borrower initiates a return sequence.
5. **Completed**: The Lender scans the Return QR, finalizing the cycle and restoring the item to `available`.

## 3. Karma System Implementation

The integrity of the digital economy rests primarily in PostgreSQL. 

**Database Layer:**
- Hard transfers occur in Postgres RPCs (e.g., `complete_task_handshake` handles escrow clearing and Karma crediting, `handle_lender_cancellation_penalty` slices a 10% penalty if a trade is abandoned after being claimed).
- `profiles.karma_score` tracks explicit points.

**Frontend Layer (Reliability Score):**
- Real-time balances are synced in the Navigation headers using a dedicated `KarmaBadgeClient` subscribing to DB changes.
- The "Trust & Reliability Score" displayed to users is a frontend calculation housed in `src/components/ProfileClient.tsx`:
  ```javascript
  const trustScore = Math.min(100, Math.round(((profile.karma_score ?? 0) / 2000) * 100));
  ```
- Top tier badging ("Top 1% Peer") is conditionally rendered for users with `> 800` karma.

## 4. QR Scanning Workflow

QR functionality executes the critical handovers ("Evidence Locks" / Handshakes), implemented heavily in `DashboardClient.tsx`.

- **Library**: `html5-qrcode` handles live camera ingestion, and `react-qr-code` generates the SVG payloads.
- **Trigger**: When a user clicks "Scan Broker's QR", `Html5Qrcode` boots up requesting `facingMode: "environment"` video access.
- **Validation**: When it decodes a text payload (`scannedPayload`), it compares it against the `expectedTaskId` (or `dealId`). 
- **Action**: If mathematically identical, `handleQRConfirm()` executes:
    - For Tasks: Calls RPC `complete_task_handshake` with the payload string. 
    - For Items: Directly patches the `items` and `item_requests` state sequentially (e.g., flipping status to `rented` or `completed`).
    - *Hardening Upgrade*: Emits native mobile `navigator.vibrate` rhythms (Heartbeat success, fast pulse error) via the `useHaptics` hook.

## 5. Real-time Chat & Limits

The application bridges marketplace functionality directly into direct messaging via `src/components/MessageCenterClient.tsx`.

- **The WebSocket Engine**: 
  - Subscribes to `supabase.channel("public:messages")`.
  - Configures user **Presence** natively (tracking who is online) and catches **Broadcast** events for immediate `isTyping` indicators.
  - Automatically deduplicates "optimistic UI" message injects against verified `postgres_changes` payloads.
  
- **The 5-Message Limit Guardrail**:
  To protect Lenders from spam, borrowers are locked out of texting after 5 pings unless the Lender officially "Accepts". The frontend logic evaluates this via:
  ```javascript
  const isPendingDeal = dealInfo?.status === 'pending' || dealInfo?.status === 'open';
  const isBorrower = dealInfo?.requester_id === userId;
  const borrowerMessageCount = activeConversation?.messages.filter(m => m.sender_id === userId).length || 0;
  
  const isInputLocked = isPendingDeal && isBorrower && borrowerMessageCount >= 5;
  ```
  If `isInputLocked` evaluates to true, the UI `<input>` blocks further transmission, forcing the Lender to take action via the embedded `TransactionCard`.
