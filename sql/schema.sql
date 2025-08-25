CREATE TABLE IF NOT EXISTS app_users (
  user_id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_keys (
  user_id UUID PRIMARY KEY REFERENCES app_users(user_id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  encrypted_private_key TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
  id BIGSERIAL PRIMARY KEY,
  sender_id UUID NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES app_users(user_id) ON DELETE CASCADE,
  ciphertext TEXT NOT NULL,
  nonce TEXT NOT NULL,
  ephemeral_public_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_pair ON messages (sender_id, recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_pair_rev ON messages (recipient_id, sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages (recipient_id, created_at DESC);
