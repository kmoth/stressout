import './style.css';
import { BreakoutGame } from './game/BreakoutGame';
import { SPECIAL_BRICK_KINDS, type SpecialBrickKind } from './game/BreakoutoutoutInstance';

const SPECIAL_BRICK_PARAM_NAMES = ['specialBricks', 'specialBrickTypes', 'specialBrickKinds', 'specialBrick'] as const;
const SPECIAL_BRICK_KIND_ALIASES: Readonly<Record<string, SpecialBrickKind>> = {
  splitter: 'splitter',
  split: 'splitter',
  autopilot: 'autopilot',
  auto: 'autopilot',
  life: 'life',
  lives: 'life',
  extralife: 'life',
  'extra-life': 'life',
  projector: 'projector',
  projection: 'projector',
  predictor: 'projector',
  path: 'projector'
};

const root = document.querySelector<HTMLDivElement>('#app');
const BALL_SPEED_MULTIPLIER_CAP_PARAM_NAMES = [
  'ballSpeedMultiplierActiveGameCap',
  'ballSpeedMultiplierInstanceCap',
  'ballSpeedCapInstances',
  'ballSpeedCap'
] as const;

if (!root) {
  throw new Error('Missing #app root element.');
}

const searchParams = new URLSearchParams(window.location.search);
const autopilot = parseBooleanParam(searchParams, 'autopilot');
const sandbox = parseBooleanParam(searchParams, 'sandbox') || parseBooleanParam(searchParams, 'sandboxMode');
const specialBrickKinds = parseSpecialBrickKinds(searchParams);
const initialInstanceCount = parseIntegerParam(searchParams, ['instances', 'instanceCount', 'initialInstances']);
const ballSpeedMultiplierActiveGameCap = parseIntegerParam(searchParams, BALL_SPEED_MULTIPLIER_CAP_PARAM_NAMES);

BreakoutGame.create(root, {
  autopilot,
  sandbox,
  specialBrickKinds,
  initialInstanceCount,
  ballSpeedMultiplierActiveGameCap
}).catch((error: unknown) => {
  console.error(error);
  root.innerHTML = `
    <main class="boot-error">
      <h1>Breakout failed to start.</h1>
      <p>Open the developer console for details.</p>
    </main>
  `;
});

function parseBooleanParam(params: URLSearchParams, key: string): boolean {
  const value = params.get(key);
  if (value === null) {
    return false;
  }

  if (value.trim() === '') {
    return true;
  }

  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
}

function parseIntegerParam(params: URLSearchParams, keys: readonly string[]): number | undefined {
  for (const key of keys) {
    const value = params.get(key);
    if (value === null) {
      continue;
    }

    const parsed = Number.parseInt(value.trim(), 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
}

function parseSpecialBrickKinds(params: URLSearchParams): readonly SpecialBrickKind[] | undefined {
  const rawValues = SPECIAL_BRICK_PARAM_NAMES.flatMap((key) => params.getAll(key));
  if (rawValues.length === 0) {
    return undefined;
  }

  const tokens = rawValues
    .flatMap((value) => value.split(/[,\s]+/))
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length > 0);

  if (tokens.includes('all')) {
    return [...SPECIAL_BRICK_KINDS];
  }

  if (tokens.includes('none') || tokens.includes('normal')) {
    return [];
  }

  const enabledKinds = new Set<SpecialBrickKind>();
  for (const token of tokens) {
    const kind = SPECIAL_BRICK_KIND_ALIASES[token];
    if (kind) {
      enabledKinds.add(kind);
    }
  }

  return enabledKinds.size > 0
    ? SPECIAL_BRICK_KINDS.filter((kind) => enabledKinds.has(kind))
    : undefined;
}
