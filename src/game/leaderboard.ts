export type LeaderboardEntry = {
  name: string;
  score: number;
};

export type LeaderboardResponse = {
  entries: LeaderboardEntry[];
};

export type LeaderboardSubmitResponse = LeaderboardResponse & {
  accepted: boolean;
};

export type ScoreboardMode = 'local' | 'live';

export type ScoreboardAdapter = {
  readonly mode: ScoreboardMode;
  load: () => Promise<LeaderboardResponse>;
  submit: (name: string, score: number) => Promise<LeaderboardSubmitResponse>;
  isScoreQualified: (score: number, entries: readonly LeaderboardEntry[]) => boolean;
};

type TurnstileRenderOptions = {
  sitekey: string;
  action?: string;
  execution?: 'render' | 'execute';
  appearance?: 'always' | 'execute' | 'interaction-only';
  size?: 'normal' | 'compact' | 'flexible' | 'invisible';
  callback?: (token: string) => void;
  'error-callback'?: () => void;
  'expired-callback'?: () => void;
  'timeout-callback'?: () => void;
};

type TurnstileApi = {
  render: (container: string | HTMLElement, options: TurnstileRenderOptions) => string;
  execute: (container: string | HTMLElement) => void;
  reset: (widgetId: string) => void;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const LEADERBOARD_ENDPOINT = '/api/leaderboard';
const LEADERBOARD_SIZE = 10;
const LEADERBOARD_RULESET = 'default-v1';
const LOCAL_LEADERBOARD_STORAGE_KEY = `breakoutoutout.leaderboard.${LEADERBOARD_RULESET}`;
const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_ACTION = 'leaderboard';
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? '';
const TURNSTILE_TIMEOUT_MS = 10_000;

let turnstileScriptPromise: Promise<TurnstileApi> | null = null;
let localLeaderboardMemoryEntries: LeaderboardEntry[] = [];

class LiveScoreboardAdapter implements ScoreboardAdapter {
  readonly mode = 'live' as const;

  async load(): Promise<LeaderboardResponse> {
    return fetchLiveLeaderboard();
  }

  async submit(name: string, score: number): Promise<LeaderboardSubmitResponse> {
    return submitLiveLeaderboardScore(name, score);
  }

  isScoreQualified(score: number, entries: readonly LeaderboardEntry[]): boolean {
    return isLeaderboardScoreQualified(score, entries);
  }
}

class LocalScoreboardAdapter implements ScoreboardAdapter {
  readonly mode = 'local' as const;

  async load(): Promise<LeaderboardResponse> {
    return { entries: this.readEntries() };
  }

  async submit(name: string, score: number): Promise<LeaderboardSubmitResponse> {
    const entry = normalizeSubmittedEntry(name, score);
    if (!entry) {
      throw new Error('Invalid local leaderboard submission.');
    }

    const entries = this.readEntries();
    if (!isLeaderboardScoreQualified(entry.score, entries)) {
      return { accepted: false, entries };
    }

    const nextEntries = sortLeaderboardEntries([...entries, entry]).slice(0, LEADERBOARD_SIZE);
    this.writeEntries(nextEntries);
    return { accepted: true, entries: nextEntries };
  }

  isScoreQualified(score: number, entries: readonly LeaderboardEntry[]): boolean {
    return isLeaderboardScoreQualified(score, entries);
  }

  private readEntries(): LeaderboardEntry[] {
    try {
      const raw = window.localStorage.getItem(LOCAL_LEADERBOARD_STORAGE_KEY);
      if (!raw) {
        return [...localLeaderboardMemoryEntries];
      }

      const parsed = JSON.parse(raw) as unknown;
      const entries = sanitizeStoredEntries(parsed);
      localLeaderboardMemoryEntries = entries;
      return entries;
    } catch {
      return [...localLeaderboardMemoryEntries];
    }
  }

  private writeEntries(entries: readonly LeaderboardEntry[]): void {
    const normalizedEntries = sortLeaderboardEntries(entries).slice(0, LEADERBOARD_SIZE);
    localLeaderboardMemoryEntries = normalizedEntries;

    try {
      window.localStorage.setItem(LOCAL_LEADERBOARD_STORAGE_KEY, JSON.stringify(normalizedEntries));
    } catch {
      // Local testing should continue with in-memory scores if storage is unavailable.
    }
  }
}

export function createScoreboardAdapter(): ScoreboardAdapter {
  const mode = requestedScoreboardMode() ?? (isLocalRuntime() ? 'local' : 'live');
  return mode === 'local'
    ? new LocalScoreboardAdapter()
    : new LiveScoreboardAdapter();
}

async function fetchLiveLeaderboard(): Promise<LeaderboardResponse> {
  const response = await fetch(LEADERBOARD_ENDPOINT, {
    headers: { Accept: 'application/json' }
  });

  return readLeaderboardResponse(response);
}

async function submitLiveLeaderboardScore(name: string, score: number): Promise<LeaderboardSubmitResponse> {
  const turnstileToken = await getTurnstileToken();
  const response = await fetch(LEADERBOARD_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ name, score, ruleset: LEADERBOARD_RULESET, turnstileToken })
  });

  return readLeaderboardResponse(response);
}

function isLeaderboardScoreQualified(score: number, entries: readonly LeaderboardEntry[]): boolean {
  if (!Number.isInteger(score) || score <= 0) {
    return false;
  }

  if (entries.length < LEADERBOARD_SIZE) {
    return true;
  }

  const lowestTopScore = entries[entries.length - 1]?.score ?? 0;
  return score > lowestTopScore;
}

function requestedScoreboardMode(): ScoreboardMode | null {
  const params = new URLSearchParams(window.location.search);
  const paramMode = normalizeScoreboardMode(params.get('scoreboard') ?? params.get('leaderboard'));
  if (paramMode) {
    return paramMode;
  }

  return normalizeScoreboardMode(import.meta.env.VITE_SCOREBOARD_MODE);
}

function normalizeScoreboardMode(value: string | undefined | null): ScoreboardMode | null {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'local' || normalized === 'live' ? normalized : null;
}

function isLocalRuntime(): boolean {
  if (import.meta.env.DEV) {
    return true;
  }

  const hostname = window.location.hostname.toLowerCase();
  return hostname === 'localhost'
    || hostname === '127.0.0.1'
    || hostname === '::1'
    || hostname.endsWith('.localhost');
}

function normalizeSubmittedEntry(name: string, score: number): LeaderboardEntry | null {
  const normalizedName = name.trim().toUpperCase();
  const normalizedScore = Math.floor(score);
  if (!/^[A-Z0-9]{1,6}$/.test(normalizedName) || normalizedScore <= 0) {
    return null;
  }

  return {
    name: normalizedName,
    score: normalizedScore
  };
}

function sanitizeStoredEntries(value: unknown): LeaderboardEntry[] {
  const rawEntries = Array.isArray(value)
    ? value
    : value && typeof value === 'object' && Array.isArray((value as LeaderboardResponse).entries)
      ? (value as LeaderboardResponse).entries
      : [];

  return sortLeaderboardEntries(
    rawEntries
      .map((entry) => {
        if (!isLeaderboardEntry(entry)) {
          return null;
        }

        return normalizeSubmittedEntry(entry.name, entry.score);
      })
      .filter((entry): entry is LeaderboardEntry => entry !== null)
  ).slice(0, LEADERBOARD_SIZE);
}

function sortLeaderboardEntries(entries: readonly LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((left, right) => right.score - left.score);
}

async function readLeaderboardResponse<T extends LeaderboardResponse>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null) as unknown;
  if (!response.ok) {
    const message = payload && typeof payload === 'object' && 'error' in payload
      ? String(payload.error)
      : `Leaderboard request failed with ${response.status}.`;
    throw new Error(message);
  }

  if (!isLeaderboardResponse(payload)) {
    throw new Error('Leaderboard response was malformed.');
  }

  return payload as T;
}

async function getTurnstileToken(): Promise<string> {
  if (TURNSTILE_SITE_KEY.length === 0) {
    throw new Error('Turnstile site key is not configured.');
  }

  const turnstile = await loadTurnstileScript();
  const container = createTurnstileContainer();

  return new Promise((resolve, reject) => {
    let settled = false;
    const timeout = window.setTimeout(() => {
      finish(() => reject(new Error('Turnstile verification timed out.')));
    }, TURNSTILE_TIMEOUT_MS);
    const widgetId = turnstile.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      action: TURNSTILE_ACTION,
      execution: 'execute',
      appearance: 'execute',
      size: 'invisible',
      callback: (token) => {
        finish(() => resolve(token));
      },
      'error-callback': () => {
        finish(() => reject(new Error('Turnstile verification failed.')));
      },
      'expired-callback': () => {
        finish(() => reject(new Error('Turnstile verification expired.')));
      },
      'timeout-callback': () => {
        finish(() => reject(new Error('Turnstile verification timed out.')));
      }
    });

    function finish(complete: () => void): void {
      if (settled) {
        return;
      }

      settled = true;
      window.clearTimeout(timeout);
      try {
        turnstile.remove(widgetId);
      } catch {
        try {
          turnstile.reset(widgetId);
        } catch {
          // Cleanup is best-effort; it should not mask the token result.
        }
      }
      container.remove();
      complete();
    }

    turnstile.execute(container);
  });
}

async function loadTurnstileScript(): Promise<TurnstileApi> {
  if (window.turnstile) {
    return window.turnstile;
  }

  turnstileScriptPromise ??= new Promise((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT_URL}"]`);
    const script = existingScript ?? document.createElement('script');
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (window.turnstile) {
        resolve(window.turnstile);
        return;
      }

      reject(new Error('Turnstile script loaded without an API.'));
    };
    script.onerror = () => reject(new Error('Turnstile script failed to load.'));

    if (!existingScript) {
      document.head.appendChild(script);
    }
  });

  return turnstileScriptPromise;
}

function createTurnstileContainer(): HTMLElement {
  const container = document.createElement('div');
  container.className = 'turnstile-host';
  container.setAttribute('aria-hidden', 'true');
  container.style.position = 'fixed';
  container.style.left = '-10000px';
  container.style.bottom = '0';
  container.style.width = '0';
  container.style.height = '0';
  container.style.overflow = 'hidden';
  container.style.pointerEvents = 'none';
  document.body.appendChild(container);
  return container;
}

function isLeaderboardResponse(value: unknown): value is LeaderboardResponse {
  return Boolean(value)
    && typeof value === 'object'
    && Array.isArray((value as LeaderboardResponse).entries)
    && (value as LeaderboardResponse).entries.every(isLeaderboardEntry);
}

function isLeaderboardEntry(value: unknown): value is LeaderboardEntry {
  return Boolean(value)
    && typeof value === 'object'
    && typeof (value as LeaderboardEntry).name === 'string'
    && typeof (value as LeaderboardEntry).score === 'number'
    && Number.isFinite((value as LeaderboardEntry).score);
}
