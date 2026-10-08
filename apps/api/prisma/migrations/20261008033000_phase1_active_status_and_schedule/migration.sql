-- Rename the unused lifecycle value and store planned dates separately
-- from the timestamps written when a session is activated or ended.
ALTER TYPE "session_status" RENAME VALUE 'LIVE' TO 'ACTIVE';

ALTER TABLE "sessions"
ADD COLUMN "scheduled_start_at" TIMESTAMPTZ(3),
ADD COLUMN "scheduled_end_at" TIMESTAMPTZ(3);
