type Env = {
  LEADERBOARD_DB?: D1Database;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_HOSTNAME?: string;
};

type LeaderboardEntry = {
  name: string;
  score: number;
};

type TurnstileOutcome = {
  success: boolean;
  hostname?: string;
  action?: string;
  'error-codes'?: string[];
};

const LEADERBOARD_LIMIT = 10;
const LEADERBOARD_RULESET = 'default-v1';
const RETAINED_SCORE_ROWS = 50;
const MAX_ACCEPTED_SCORE = 999_999;
const RATE_LIMIT_WINDOW_SECONDS = 300;
const RATE_LIMIT_MAX_SUBMISSIONS = 5;
const TURNSTILE_ACTION = 'leaderboard';

let schemaReady: Promise<void> | null = null;

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const db = databaseFromEnv(env);
  await ensureSchema(db);
  const entries = await readLeaderboard(db);

  return json({ entries }, 200, {
    'Cache-Control': 'public, max-age=30'
  });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const db = databaseFromEnv(env);
  await ensureSchema(db);

  const body = await readJson(request);
  const name = parseName(body?.name);
  const score = parseScore(body?.score);
  const ruleset = typeof body?.ruleset === 'string' ? body.ruleset : '';
  const turnstileToken = typeof body?.turnstileToken === 'string' ? body.turnstileToken : '';

  if (!name || score === null || ruleset !== LEADERBOARD_RULESET) {
    return json({ error: 'Invalid leaderboard submission.' }, 400);
  }

  const rateLimit = await consumeRateLimit(db, request);
  if (!rateLimit.allowed) {
    return json({ error: 'Too many leaderboard submissions. Try again later.' }, 429, {
      'Retry-After': String(rateLimit.retryAfter)
    });
  }

  const turnstile = await validateTurnstile(env, turnstileToken, clientIp(request));
  if (!turnstile.valid) {
    return json({ error: turnstile.error }, turnstile.status);
  }

  const currentEntries = await readLeaderboard(db);
  if (!isScoreQualified(score, currentEntries)) {
    return json({ accepted: false, entries: currentEntries });
  }

  await db.prepare('INSERT INTO scores (name, score) VALUES (?, ?)').bind(name, score).run();
  await db.prepare(`
    DELETE FROM scores
    WHERE id NOT IN (
      SELECT id
      FROM scores
      ORDER BY score DESC, created_at ASC, id ASC
      LIMIT ?
    )
  `).bind(RETAINED_SCORE_ROWS).run();

  const entries = await readLeaderboard(db);
  const accepted = entries.some((entry) => entry.name === name && entry.score === score);
  return json({ accepted, entries });
};

export const onRequestOptions: PagesFunction = async () => new Response(null, {
  status: 204,
  headers: {
    Allow: 'GET, POST, OPTIONS'
  }
});

function databaseFromEnv(env: Env): D1Database {
  if (!env.LEADERBOARD_DB) {
    throw new Error('LEADERBOARD_DB binding is not configured.');
  }

  return env.LEADERBOARD_DB;
}

function ensureSchema(db: D1Database): Promise<void> {
  schemaReady ??= db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        score INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE INDEX IF NOT EXISTS scores_rank_idx
      ON scores(score DESC, created_at ASC, id ASC)
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS submission_limits (
        key TEXT PRIMARY KEY,
        window_start INTEGER NOT NULL,
        attempts INTEGER NOT NULL
      )
    `)
  ]).then(() => undefined).catch((error) => {
    schemaReady = null;
    throw error;
  });

  return schemaReady;
}

async function readLeaderboard(db: D1Database): Promise<LeaderboardEntry[]> {
  const result = await db.prepare(`
    SELECT name, score
    FROM scores
    ORDER BY score DESC, created_at ASC, id ASC
    LIMIT ?
  `).bind(LEADERBOARD_LIMIT).all<LeaderboardEntry>();

  return result.results.map((entry) => ({
    name: entry.name,
    score: entry.score
  }));
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return null;
  }

  const body = await request.json().catch(() => null);
  return body && typeof body === 'object' && !Array.isArray(body)
    ? body as Record<string, unknown>
    : null;
}

function parseName(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  return /^[A-Z0-9]{1,6}$/.test(normalized) ? normalized : null;
}

function parseScore(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0 || value > MAX_ACCEPTED_SCORE) {
    return null;
  }

  return value;
}

function isScoreQualified(score: number, entries: readonly LeaderboardEntry[]): boolean {
  if (entries.length < LEADERBOARD_LIMIT) {
    return true;
  }

  return score > (entries[entries.length - 1]?.score ?? 0);
}

async function consumeRateLimit(
  db: D1Database,
  request: Request
): Promise<{ allowed: boolean; retryAfter: number }> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % RATE_LIMIT_WINDOW_SECONDS);
  const key = await rateLimitKey(request, windowStart);
  const existing = await db.prepare(`
    SELECT attempts
    FROM submission_limits
    WHERE key = ?
  `).bind(key).first<{ attempts: number }>();

  if (existing && existing.attempts >= RATE_LIMIT_MAX_SUBMISSIONS) {
    return {
      allowed: false,
      retryAfter: RATE_LIMIT_WINDOW_SECONDS - (now - windowStart)
    };
  }

  if (existing) {
    await db.prepare(`
      UPDATE submission_limits
      SET attempts = attempts + 1
      WHERE key = ?
    `).bind(key).run();
  } else {
    await db.prepare(`
      INSERT INTO submission_limits (key, window_start, attempts)
      VALUES (?, ?, 1)
    `).bind(key, windowStart).run();
  }

  if (Math.random() < 0.05) {
    await db.prepare(`
      DELETE FROM submission_limits
      WHERE window_start < ?
    `).bind(windowStart - RATE_LIMIT_WINDOW_SECONDS).run();
  }

  return { allowed: true, retryAfter: 0 };
}

async function rateLimitKey(request: Request, windowStart: number): Promise<string> {
  const source = `${clientIp(request)}:${request.headers.get('user-agent') ?? ''}:${windowStart}`;
  const encoded = new TextEncoder().encode(source);
  const digest = await crypto.subtle.digest('SHA-256', encoded);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function clientIp(request: Request): string {
  return request.headers.get('CF-Connecting-IP')
    ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? 'unknown';
}

async function validateTurnstile(
  env: Env,
  token: string,
  remoteIp: string
): Promise<{ valid: true } | { valid: false; status: number; error: string }> {
  const secret = env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    return {
      valid: false,
      status: 503,
      error: 'Turnstile is not configured.'
    };
  }

  if (!token.trim()) {
    return {
      valid: false,
      status: 403,
      error: 'Turnstile verification is required.'
    };
  }

  const form = new URLSearchParams({
    secret,
    response: token,
    remoteip: remoteIp
  });
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: form
  });
  const outcome = await response.json().catch(() => null) as TurnstileOutcome | null;

  if (!response.ok || !outcome?.success) {
    return {
      valid: false,
      status: 403,
      error: 'Turnstile verification failed.'
    };
  }

  if (outcome.action && outcome.action !== TURNSTILE_ACTION) {
    return {
      valid: false,
      status: 403,
      error: 'Turnstile action mismatch.'
    };
  }

  const expectedHostname = env.TURNSTILE_HOSTNAME?.trim();
  if (expectedHostname && outcome.hostname !== expectedHostname) {
    return {
      valid: false,
      status: 403,
      error: 'Turnstile hostname mismatch.'
    };
  }

  return { valid: true };
}

function json(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...headers
    }
  });
}
