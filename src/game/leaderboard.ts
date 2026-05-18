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
const TURNSTILE_SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_ACTION = 'leaderboard';
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim() ?? '';
const TURNSTILE_TIMEOUT_MS = 10_000;

let turnstileScriptPromise: Promise<TurnstileApi> | null = null;

export async function fetchLeaderboard(): Promise<LeaderboardResponse> {
  const response = await fetch(LEADERBOARD_ENDPOINT, {
    headers: { Accept: 'application/json' }
  });

  return readLeaderboardResponse(response);
}

export async function submitLeaderboardScore(name: string, score: number): Promise<LeaderboardSubmitResponse> {
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

export function isLeaderboardScoreQualified(score: number, entries: readonly LeaderboardEntry[]): boolean {
  if (!Number.isInteger(score) || score <= 0) {
    return false;
  }

  if (entries.length < LEADERBOARD_SIZE) {
    return true;
  }

  const lowestTopScore = entries[entries.length - 1]?.score ?? 0;
  return score > lowestTopScore;
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
