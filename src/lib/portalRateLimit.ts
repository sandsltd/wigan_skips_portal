import { createHmac } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export interface PortalRateLimitRule {
  scope: string;
  subject: string;
  limit: number;
  windowSeconds: number;
}

export interface PortalRateLimitDecision {
  allowed: boolean;
  retryAfterSeconds: number;
}

interface RateLimitRpcRow {
  allowed: boolean;
  retry_after_seconds: number;
  remaining: number;
}

export class PortalRateLimitUnavailableError extends Error {}

function getHashSecret(override?: string): string {
  const secret = override || process.env.PORTAL_SESSION_SECRET || '';
  if (secret.length < 32) {
    throw new PortalRateLimitUnavailableError('Portal rate-limit secret is not configured');
  }
  return secret;
}

export function hashRateLimitSubject(
  scope: string,
  subject: string,
  secret?: string,
): string {
  return createHmac('sha256', getHashSecret(secret))
    .update(`${scope}\0${subject.trim().toLowerCase()}`)
    .digest('hex');
}

export function getRequestIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || headers.get('x-real-ip')?.trim() || 'unknown';
}

function parseRpcRow(value: unknown): RateLimitRpcRow | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!row || typeof row !== 'object' || Array.isArray(row)) return null;
  const record = row as Record<string, unknown>;
  if (
    typeof record.allowed !== 'boolean' ||
    typeof record.retry_after_seconds !== 'number' ||
    typeof record.remaining !== 'number'
  ) {
    return null;
  }
  return record as unknown as RateLimitRpcRow;
}

export async function enforcePortalRateLimits(
  client: SupabaseClient,
  rules: PortalRateLimitRule[],
): Promise<PortalRateLimitDecision> {
  const decisions = await Promise.all(rules.map(async (rule) => {
    const { data, error } = await client.rpc('consume_portal_rate_limit', {
      p_scope: rule.scope,
      p_subject_hash: hashRateLimitSubject(rule.scope, rule.subject),
      p_limit: rule.limit,
      p_window_seconds: rule.windowSeconds,
    });

    const row = parseRpcRow(data);
    if (error || !row) {
      throw new PortalRateLimitUnavailableError(
        `Portal rate limiter is unavailable: ${error?.message || 'invalid response'}`,
      );
    }
    return row;
  }));

  const denied = decisions.filter((decision) => !decision.allowed);
  return {
    allowed: denied.length === 0,
    retryAfterSeconds: denied.length > 0
      ? Math.max(...denied.map((decision) => decision.retry_after_seconds))
      : 0,
  };
}
