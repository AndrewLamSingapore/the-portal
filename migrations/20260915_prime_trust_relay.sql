-- Ciphertext-only request/result transport. Application authority stays on ABEX.
CREATE TABLE IF NOT EXISTS prime_trust_relay (
  id uuid PRIMARY KEY,
  request text NOT NULL CHECK (length(request) <= 65536),
  fingerprint text NOT NULL CHECK (length(fingerprint) = 64),
  response text CHECK (length(response) <= 65536),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CLAIMED','COMPLETED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  deadline timestamptz NOT NULL DEFAULT now() + interval '60 seconds',
  expires_at timestamptz NOT NULL DEFAULT now() + interval '10 minutes',
  leased_until timestamptz
);
CREATE INDEX IF NOT EXISTS prime_trust_relay_pending ON prime_trust_relay(deadline,leased_until) WHERE response IS NULL;
ALTER TABLE prime_trust_relay ENABLE ROW LEVEL SECURITY;
