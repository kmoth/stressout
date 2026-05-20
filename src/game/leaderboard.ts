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

export type ScoreboardAdapter = {
  load: () => Promise<LeaderboardResponse>;
  submit: (name: string, score: number) => Promise<LeaderboardSubmitResponse>;
  isScoreQualified: (score: number, entries: readonly LeaderboardEntry[]) => boolean;
};

const LEADERBOARD_SIZE = 10;
const LEADERBOARD_RULESET = 'default-v1';
const LOCAL_LEADERBOARD_STORAGE_KEY = `breakoutoutout.leaderboard.${LEADERBOARD_RULESET}`;

let localLeaderboardMemoryEntries: LeaderboardEntry[] = [];

class LocalScoreboardAdapter implements ScoreboardAdapter {
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
  return new LocalScoreboardAdapter();
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

function isLeaderboardEntry(value: unknown): value is LeaderboardEntry {
  return Boolean(value)
    && typeof value === 'object'
    && typeof (value as LeaderboardEntry).name === 'string'
    && typeof (value as LeaderboardEntry).score === 'number'
    && Number.isFinite((value as LeaderboardEntry).score);
}
