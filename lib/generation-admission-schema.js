// Server-only additive schema. Bootstrap and PostgreSQL qualification execute these exact statements.
// Do not reset credit on deploy, cold start, lease expiry or a repeated bootstrap.
export const ADMISSION_POLICY = Object.freeze({
  "id": "portal-artifact-generation-v1",
  "allowanceMicroUsd": 10000000,
  "reservationMicroUsd": 1080000,
  "clientPerUtcHour": 12,
  "globalPerUtcHour": 60,
  "concurrentLeases": 2,
  "leaseSeconds": 120,
  "provider": "openai",
  "endpoint": "https://api.openai.com/v1/responses",
  "model": "gpt-5.6-luna",
  "maxOutputTokens": 6000,
  "maxAttempts": 2,
  "maxRequestUtf8Bytes": 65536,
  "pricingReviewedUtc": "2026-10-21",
  "pricingSource": "https://developers.openai.com/api/docs/models/gpt-5.6-luna"
});

export const ADMISSION_SCHEMA_STATEMENTS = Object.freeze([
  `SET LOCAL statement_timeout = '5000ms'`,
  `SELECT pg_advisory_xact_lock(1886351988, 1)`,
  `CREATE SCHEMA IF NOT EXISTS portal_generation_admission`,
  `REVOKE ALL ON SCHEMA portal_generation_admission FROM PUBLIC`,
  `CREATE TABLE IF NOT EXISTS portal_generation_admission.credit (
  policy_id text PRIMARY KEY CHECK (policy_id = 'portal-artifact-generation-v1'),
  allowance_micro_usd bigint NOT NULL CHECK (allowance_micro_usd = 10000000),
  reserved_micro_usd bigint NOT NULL DEFAULT 0 CHECK (reserved_micro_usd BETWEEN 0 AND allowance_micro_usd),
  created_at timestamptz NOT NULL DEFAULT clock_timestamp()
)`,
  `INSERT INTO portal_generation_admission.credit (policy_id, allowance_micro_usd)
VALUES ('portal-artifact-generation-v1', 10000000) ON CONFLICT (policy_id) DO NOTHING`,
  `CREATE TABLE IF NOT EXISTS portal_generation_admission.requests (
  request_id uuid PRIMARY KEY,
  policy_id text NOT NULL REFERENCES portal_generation_admission.credit(policy_id),
  client_hash text NOT NULL CHECK (client_hash ~ '^[a-f0-9]{64}$'),
  admitted_at timestamptz NOT NULL,
  hour_start timestamptz NOT NULL,
  lease_until timestamptz NOT NULL,
  finished_at timestamptz,
  reserved_micro_usd bigint NOT NULL CHECK (reserved_micro_usd = 1080000)
)`,
  `CREATE INDEX IF NOT EXISTS requests_client_hour_idx ON portal_generation_admission.requests (hour_start, client_hash)`,
  `CREATE INDEX IF NOT EXISTS requests_active_idx ON portal_generation_admission.requests (lease_until) WHERE finished_at IS NULL`,
  `CREATE OR REPLACE FUNCTION portal_generation_admission.admit(p_request_id uuid, p_client_hash text)
RETURNS TABLE (accepted boolean, reason text, retry_after_seconds integer, request_id uuid, allowance_micro_usd bigint, reserved_micro_usd bigint, remaining_micro_usd bigint)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = pg_catalog, portal_generation_admission
AS $admit$
DECLARE
  v_credit portal_generation_admission.credit%ROWTYPE;
  v_now timestamptz;
  v_hour timestamptz;
  v_retry integer;
BEGIN
  -- Same transaction lock as bootstrap; no lock is held during provider work.
  PERFORM pg_advisory_xact_lock(1886351988, 1);
  v_now := clock_timestamp();
  v_hour := date_trunc('hour', v_now AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  IF p_request_id IS NULL OR p_client_hash IS NULL OR p_client_hash !~ '^[a-f0-9]{64}$' THEN
    RETURN QUERY SELECT false, 'invalid_identity'::text, 0, p_request_id, NULL::bigint, NULL::bigint, NULL::bigint; RETURN;
  END IF;
  SELECT * INTO STRICT v_credit FROM portal_generation_admission.credit
    WHERE policy_id = 'portal-artifact-generation-v1' FOR UPDATE;
  -- Never acknowledge a reused ticket: an earlier provider outcome may be unknown.
  IF EXISTS (SELECT 1 FROM portal_generation_admission.requests r WHERE r.request_id = p_request_id) THEN
    RETURN QUERY SELECT false, 'duplicate_request'::text, 0, p_request_id, v_credit.allowance_micro_usd, v_credit.reserved_micro_usd, v_credit.allowance_micro_usd - v_credit.reserved_micro_usd; RETURN;
  END IF;
  IF v_credit.reserved_micro_usd + 1080000 > v_credit.allowance_micro_usd THEN
    RETURN QUERY SELECT false, 'credit_exhausted'::text, 0, p_request_id, v_credit.allowance_micro_usd, v_credit.reserved_micro_usd, v_credit.allowance_micro_usd - v_credit.reserved_micro_usd; RETURN;
  END IF;
  v_retry := greatest(1, ceil(extract(epoch FROM v_hour + interval '1 hour' - v_now))::integer);
  IF (SELECT count(*) FROM portal_generation_admission.requests r
      WHERE r.hour_start = v_hour AND r.client_hash = p_client_hash) >= 12 THEN
    RETURN QUERY SELECT false, 'client_rate_limited'::text, v_retry, p_request_id, v_credit.allowance_micro_usd, v_credit.reserved_micro_usd, v_credit.allowance_micro_usd - v_credit.reserved_micro_usd; RETURN;
  END IF;
  IF (SELECT count(*) FROM portal_generation_admission.requests r WHERE r.hour_start = v_hour) >= 60 THEN
    RETURN QUERY SELECT false, 'global_rate_limited'::text, v_retry, p_request_id, v_credit.allowance_micro_usd, v_credit.reserved_micro_usd, v_credit.allowance_micro_usd - v_credit.reserved_micro_usd; RETURN;
  END IF;
  IF (SELECT count(*) FROM portal_generation_admission.requests r
      WHERE r.finished_at IS NULL AND r.lease_until > v_now) >= 2 THEN
    SELECT greatest(1, ceil(extract(epoch FROM min(r.lease_until) - v_now))::integer)
      INTO v_retry FROM portal_generation_admission.requests r
      WHERE r.finished_at IS NULL AND r.lease_until > v_now;
    RETURN QUERY SELECT false, 'concurrency_limited'::text, v_retry, p_request_id, v_credit.allowance_micro_usd, v_credit.reserved_micro_usd, v_credit.allowance_micro_usd - v_credit.reserved_micro_usd; RETURN;
  END IF;
  UPDATE portal_generation_admission.credit AS c
    SET reserved_micro_usd = c.reserved_micro_usd + 1080000
    WHERE c.policy_id = 'portal-artifact-generation-v1' RETURNING c.* INTO v_credit;
  INSERT INTO portal_generation_admission.requests
    (request_id, policy_id, client_hash, admitted_at, hour_start, lease_until, reserved_micro_usd)
    VALUES (p_request_id, 'portal-artifact-generation-v1', p_client_hash, v_now, v_hour, v_now + interval '120 seconds', 1080000);
  RETURN QUERY SELECT true, 'admitted'::text, 0, p_request_id, v_credit.allowance_micro_usd, v_credit.reserved_micro_usd, v_credit.allowance_micro_usd - v_credit.reserved_micro_usd;
END
$admit$`,
  `CREATE OR REPLACE FUNCTION portal_generation_admission.finish(p_request_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, portal_generation_admission
AS $finish$
BEGIN
  PERFORM pg_advisory_xact_lock(1886351988, 1);
  UPDATE portal_generation_admission.requests
    SET finished_at = coalesce(finished_at, clock_timestamp())
    WHERE request_id = p_request_id;
  -- Reservations are permanent even on failure, timeout or uncertain charge.
END
$finish$`,
  `REVOKE ALL ON ALL TABLES IN SCHEMA portal_generation_admission FROM PUBLIC`,
  `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA portal_generation_admission FROM PUBLIC`,
  `DO $client_privileges$
DECLARE client_role text;
BEGIN
  FOREACH client_role IN ARRAY ARRAY['anon', 'authenticated', 'anonymous'] LOOP
    IF EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = client_role) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA portal_generation_admission FROM %I', client_role);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA portal_generation_admission FROM %I', client_role);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA portal_generation_admission FROM %I', client_role);
    END IF;
  END LOOP;
END
$client_privileges$`
]);
