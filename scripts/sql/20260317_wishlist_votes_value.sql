-- Adds support for upvote/downvote on wishlist items.
-- Run this in Supabase SQL editor (or via your migration workflow).

ALTER TABLE IF EXISTS wishlist_votes
ADD COLUMN IF NOT EXISTS value INTEGER NOT NULL DEFAULT 1;

-- Backfill any existing rows that may have NULL value
UPDATE wishlist_votes
SET value = 1
WHERE value IS NULL;

-- Optional: ensure only -1/1 values are stored
-- (Supabase/Postgres supports CHECK constraints)
ALTER TABLE IF EXISTS wishlist_votes
DROP CONSTRAINT IF EXISTS wishlist_votes_value_check;

ALTER TABLE wishlist_votes
ADD CONSTRAINT wishlist_votes_value_check CHECK (value IN (-1, 1));

