-- AI Chat Tables for Pashkovsky Group
-- Run this migration in Supabase SQL Editor

-- Create ai_sessions table
CREATE TABLE IF NOT EXISTS ai_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  client_id TEXT NOT NULL,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create index for client_id lookups
CREATE INDEX IF NOT EXISTS idx_ai_sessions_client_id ON ai_sessions(client_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_last_activity ON ai_sessions(last_activity DESC);

-- Create ai_messages table
CREATE TABLE IF NOT EXISTS ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES ai_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for session lookups
CREATE INDEX IF NOT EXISTS idx_ai_messages_session_id ON ai_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created_at ON ai_messages(created_at);

-- Create rate_limits table for tracking message limits
CREATE TABLE IF NOT EXISTS ai_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  message_count INT DEFAULT 0,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_rate_limits_client_id ON ai_rate_limits(client_id);

-- Enable Row Level Security
ALTER TABLE ai_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_rate_limits ENABLE ROW LEVEL SECURITY;

-- Create policies for service role access
CREATE POLICY "Service role can do everything on ai_sessions" ON ai_sessions
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role can do everything on ai_messages" ON ai_messages
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Service role can do everything on ai_rate_limits" ON ai_rate_limits
  FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime for ai_messages
ALTER PUBLICATION supabase_realtime ADD TABLE ai_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE ai_sessions;



