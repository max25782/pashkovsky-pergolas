-- Migration: Add source column to ai_sessions for AI Director
-- This migration adds a 'source' column to distinguish between different types of AI chats

-- Add source column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ai_sessions' AND column_name = 'source'
  ) THEN
    ALTER TABLE ai_sessions 
    ADD COLUMN source TEXT DEFAULT 'general';
  END IF;
END $$;

-- Update existing sessions to have source = 'general'
UPDATE ai_sessions 
SET source = 'general' 
WHERE source IS NULL;

-- Create index for faster lookups by source
CREATE INDEX IF NOT EXISTS idx_ai_sessions_source 
ON ai_sessions(source);

-- Create composite index for company + source lookups
CREATE INDEX IF NOT EXISTS idx_ai_sessions_client_source 
ON ai_sessions(client_id, source);

-- Add comment explaining source values
COMMENT ON COLUMN ai_sessions.source IS 'Type of AI chat: general (public site), director (AI Director in CRM), website (legacy)';

-- Show summary
DO $$
DECLARE
  total_sessions INTEGER;
  director_sessions INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_sessions FROM ai_sessions;
  SELECT COUNT(*) INTO director_sessions FROM ai_sessions WHERE source = 'director';
  
  RAISE NOTICE 'Migration 028 completed successfully';
  RAISE NOTICE 'Total AI sessions: %', total_sessions;
  RAISE NOTICE 'AI Director sessions: %', director_sessions;
END $$;


