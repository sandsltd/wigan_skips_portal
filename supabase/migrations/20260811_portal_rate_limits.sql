CREATE TABLE IF NOT EXISTS public.portal_rate_limits (
  scope text NOT NULL CHECK (char_length(scope) BETWEEN 1 AND 80),
  subject_hash text NOT NULL CHECK (subject_hash ~ '^[0-9a-f]{64}$'),
  request_count integer NOT NULL CHECK (request_count > 0),
  window_started_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (scope, subject_hash)
);

CREATE INDEX IF NOT EXISTS portal_rate_limits_expires_at_idx
  ON public.portal_rate_limits (expires_at);

ALTER TABLE public.portal_rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.portal_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.portal_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_portal_rate_limit(
  p_scope text,
  p_subject_hash text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS TABLE (
  allowed boolean,
  retry_after_seconds integer,
  remaining integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  rate_limit_row public.portal_rate_limits%ROWTYPE;
BEGIN
  IF p_scope IS NULL OR char_length(p_scope) NOT BETWEEN 1 AND 80 THEN
    RAISE EXCEPTION 'Invalid rate-limit scope';
  END IF;
  IF p_subject_hash IS NULL OR p_subject_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Invalid rate-limit subject';
  END IF;
  IF p_limit < 1 OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'Invalid rate-limit policy';
  END IF;

  -- Retain expired counters briefly for troubleshooting, but prevent
  -- one-off subjects from accumulating forever.
  DELETE FROM public.portal_rate_limits
  WHERE expires_at <= v_now - interval '1 day';

  INSERT INTO public.portal_rate_limits (
    scope,
    subject_hash,
    request_count,
    window_started_at,
    expires_at
  )
  VALUES (
    p_scope,
    p_subject_hash,
    1,
    v_now,
    v_now + make_interval(secs => p_window_seconds)
  )
  ON CONFLICT (scope, subject_hash) DO UPDATE
  SET
    request_count = CASE
      WHEN portal_rate_limits.expires_at <= v_now THEN 1
      ELSE portal_rate_limits.request_count + 1
    END,
    window_started_at = CASE
      WHEN portal_rate_limits.expires_at <= v_now THEN v_now
      ELSE portal_rate_limits.window_started_at
    END,
    expires_at = CASE
      WHEN portal_rate_limits.expires_at <= v_now
        THEN v_now + make_interval(secs => p_window_seconds)
      ELSE portal_rate_limits.expires_at
    END
  RETURNING * INTO rate_limit_row;

  allowed := rate_limit_row.request_count <= p_limit;
  remaining := GREATEST(p_limit - rate_limit_row.request_count, 0);
  retry_after_seconds := CASE
    WHEN allowed THEN 0
    ELSE GREATEST(
      1,
      CEIL(EXTRACT(EPOCH FROM (rate_limit_row.expires_at - v_now)))::integer
    )
  END;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_portal_rate_limit(text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_portal_rate_limit(text, text, integer, integer)
  TO service_role;

COMMENT ON TABLE public.portal_rate_limits IS
  'Durable fixed-window counters for PaperRoute customer portal access. Subjects are HMAC hashes; raw IP and email values are never stored.';
COMMENT ON FUNCTION public.consume_portal_rate_limit(text, text, integer, integer) IS
  'Atomically consumes one request from a portal rate-limit window and returns the decision.';

NOTIFY pgrst, 'reload schema';
