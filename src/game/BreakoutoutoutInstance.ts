import type { ToneName } from './sound';

export const BOARD_WIDTH = 12;
export const BOARD_HEIGHT = 16;
export const WALL_THICKNESS = 0.34;
export const PLAYFIELD_DEPTH = 0.15;
export const PADDLE_WIDTH = 2.35;
export const PADDLE_HEIGHT = 0.34;
export const PADDLE_DEPTH = PLAYFIELD_DEPTH;
export const PADDLE_Y = -5.95;
export const PADDLE_SPEED = 11.5;
export const BALL_RADIUS = 0.22;
export const BALL_SPEED = 7.1;
export const FIXED_STEP = 1 / 90;
export const BRICK_COLS = 9;
export const BRICK_ROWS = 6;
export const BRICK_GAP = 0.13;
export const BRICK_HEIGHT = 0.46;
export const BRICK_DEPTH = PLAYFIELD_DEPTH;
export const BRICK_TOP_Y = 5.55;
export const BRICK_LEFT_PAD = 0.72;
export const HALF_WIDTH = BOARD_WIDTH / 2;
export const HALF_HEIGHT = BOARD_HEIGHT / 2;
const SPLITTER_ROW = BRICK_ROWS - 2;
const AUTOPILOT_ROW = BRICK_ROWS - 3;
const AUTOPILOT_COL = Math.max(1, Math.floor(BRICK_COLS / 2) - 2);
const LIFE_ROW = BRICK_ROWS - 3;
const LIFE_COL = Math.min(BRICK_COLS - 2, Math.floor(BRICK_COLS / 2) + 2);
const PROJECTOR_ROW = BRICK_ROWS - 4;
const PROJECTOR_COL = Math.floor(BRICK_COLS / 2);
const SPLITTER_COLOR = 0xd946ef;
const AUTOPILOT_COLOR = 0x34d399;
const LIFE_COLOR = 0xfb7185;
const PROJECTOR_COLOR = 0x38bdf8;
const AUTOPILOT_DURATION = 10;
const PATH_PROJECTION_DURATION = 12;
const AUTOPILOT_BOUNCE_OFFSET_MIN = 0.08;
const AUTOPILOT_BOUNCE_OFFSET_RANGE = 0.16;
const SPLIT_BONUS_MIN_Y = -2.1;
const SPLIT_BONUS_MAX_Y = BRICK_TOP_Y + 0.1;
const SPLITTER_BALL_SAFE_SECONDS = 0.42;
const SPLITTER_BALL_SAFE_PADDING = 0.72;
const MIN_MOVING_BALL_SPEED = 0.0001;
const MIN_BALL_VERTICAL_DIRECTION = 0.18;
const MAX_BALL_SPEED_FACTOR = 1.25;
const READY_DURATION = 5;
const FATAL_MISS_WARNING_LEAD = BALL_RADIUS * 3;
const FATAL_MISS_Y = PADDLE_Y + PADDLE_HEIGHT / 2 + BALL_RADIUS + FATAL_MISS_WARNING_LEAD;
const PADDLE_HITBOX_HORIZONTAL_GRACE = BALL_RADIUS * 0.6;
const PADDLE_HITBOX_TOP_GRACE = BALL_RADIUS * 0.5;
const PADDLE_HITBOX_BOTTOM_GRACE = BALL_RADIUS * 0.15;
const PADDLE_OVERLAP_RECOVERY_DEPTH = BALL_RADIUS * 0.45;
const PLAYFIELD_LEFT = -HALF_WIDTH + BALL_RADIUS;
const PLAYFIELD_RIGHT = HALF_WIDTH - BALL_RADIUS;
const PLAYFIELD_TOP = HALF_HEIGHT - BALL_RADIUS;
const PLAYFIELD_BOTTOM = -HALF_HEIGHT + BALL_RADIUS;
const BALL_READY_Y = PADDLE_Y + 0.56;
const PHYSICS_EPSILON = 0.000001;
const PHYSICS_CORNER_TOLERANCE = 0.00001;
const PHYSICS_SURFACE_CLEARANCE = 0.0001;
const MAX_COLLISIONS_PER_STEP = 8;

export type Phase = 'ready' | 'playing' | 'cleared' | 'game-over';
export type BrickKind = 'normal' | 'splitter' | 'autopilot' | 'life' | 'projector';
export const SPECIAL_BRICK_KINDS = ['splitter', 'autopilot', 'life', 'projector'] as const;
export type SpecialBrickKind = typeof SPECIAL_BRICK_KINDS[number];

export type BreakoutInput = {
  left: boolean;
  right: boolean;
  paddleX?: number;
};

export type BreakoutoutoutOptions = {
  autopilot?: boolean;
  sandbox?: boolean;
  specialBrickKinds?: readonly SpecialBrickKind[];
};

export type BrickSnapshot = {
  id: string;
  row: number;
  col: number;
  x: number;
  y: number;
  width: number;
  height: number;
  color: number;
  points: number;
  kind: BrickKind;
  hit: boolean;
};

export type BreakoutoutoutSnapshot = {
  score: number;
  lives: number;
  phase: Phase;
  readyRemaining: number;
  fatalMissPending: boolean;
  paddleX: number;
  targetPaddleX: number;
  autoPilotRemaining: number;
  autoPilotActive: boolean;
  persistentAutoPilotActive: boolean;
  pathProjectionRemaining: number;
  pathProjectionActive: boolean;
  ballSpeedMultiplier: number;
  ball: {
    x: number;
    y: number;
    vx: number;
    vy: number;
  };
  bricks: BrickSnapshot[];
};

export type BreakoutoutoutRenderState = BreakoutoutoutSnapshot & {
  id: number;
};

export type BallPathProjectionPoint = {
  x: number;
  y: number;
};

export type BallPathProjectionOptions = {
  input?: BreakoutInput;
  maxBounces?: number;
  maxDistance?: number;
  maxSeconds?: number;
  sampleSpacing?: number;
};

type BallSnapshot = BreakoutoutoutSnapshot['ball'];
type BallState = BallSnapshot;

type SplitRealitySnapshotOptions = {
  specialBrickKinds?: readonly SpecialBrickKind[];
  random?: () => number;
};

export type BreakoutoutoutEvent =
  | { type: 'sound'; name: ToneName }
  | {
    type: 'brick-hit';
    x: number;
    y: number;
    color: number;
    kind: BrickKind;
    points: number;
  }
  | { type: 'split'; x: number; y: number; color: number; snapshot: BreakoutoutoutSnapshot }
  | { type: 'fatal-miss' }
  | { type: 'state-changed' };

type Brick = BrickSnapshot;

type PhysicsAdvanceResult = {
  bricksToRemove: Brick[];
  touchedFloor: boolean;
  touchedPaddle: boolean;
  touchedWall: boolean;
  traveled: number;
};

type PhysicsCollisionKind = 'wall' | 'floor' | 'paddle' | 'brick';

type SweptBallHit = {
  time: number;
  normalX: number;
  normalY: number;
  touchedWall: boolean;
  touchedFloor: boolean;
  touchedPaddle: boolean;
  bricks: Brick[];
};

type PhysicsRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function createSplitRealitySnapshot(
  snapshot: BreakoutoutoutSnapshot,
  optionsOrRandom: SplitRealitySnapshotOptions | (() => number) = {}
): BreakoutoutoutSnapshot {
  const options = typeof optionsOrRandom === 'function' ? { random: optionsOrRandom } : optionsOrRandom;
  const random = options.random ?? Math.random;
  const specialBrickKinds = createSpecialBrickKindSet(options.specialBrickKinds);
  const clonedBricks = snapshot.bricks.map((brick) => ({ ...brick }));
  const additions = createSplitBonusBricks(clonedBricks, snapshot.ball, specialBrickKinds, random);

  return {
    ...snapshot,
    ball: { ...snapshot.ball },
    bricks: [...clonedBricks, ...additions]
  };
}

export class BreakoutoutoutInstance {
  readonly id: number;

  private ball!: BallState;
  private bricks: Brick[] = [];
  private score = 0;
  private lives = 3;
  private phase: Phase = 'ready';
  private readyRemaining = READY_DURATION;
  private fatalMissPending = false;
  private paddleX = 0;
  private targetPaddleX = 0;
  private autoPilotRemaining = 0;
  private pathProjectionRemaining = 0;
  private ballSpeedMultiplier = 1;
  private gameSpeed = 1;
  private lastBallDirectionX = 0;
  private lastBallDirectionY = 1;
  private readonly persistentAutopilot: boolean;
  private readonly sandbox: boolean;
  private readonly specialBrickKinds: ReadonlySet<SpecialBrickKind>;
  private readonly collisionResult = createPhysicsAdvanceResult();
  private readonly nearestHit = createSweptBallHit();
  private readonly candidateHit = createSweptBallHit();
  private readonly paddleRect: PhysicsRect = {
    x: 0,
    y: PADDLE_Y + (PADDLE_HITBOX_TOP_GRACE - PADDLE_HITBOX_BOTTOM_GRACE) / 2,
    width: PADDLE_WIDTH + PADDLE_HITBOX_HORIZONTAL_GRACE * 2,
    height: PADDLE_HEIGHT + PADDLE_HITBOX_TOP_GRACE + PADDLE_HITBOX_BOTTOM_GRACE
  };

  constructor(id: number, snapshot?: BreakoutoutoutSnapshot, options: BreakoutoutoutOptions = {}) {
    this.id = id;
    this.persistentAutopilot = options.autopilot ?? false;
    this.sandbox = options.sandbox ?? false;
    this.specialBrickKinds = createSpecialBrickKindSet(options.specialBrickKinds);

    if (snapshot) {
      this.score = snapshot.score;
      this.lives = snapshot.lives;
      this.phase = snapshot.phase;
      this.readyRemaining = snapshot.phase === 'ready'
        ? clamp(snapshot.readyRemaining ?? READY_DURATION, 0, READY_DURATION)
        : 0;
      this.fatalMissPending = snapshot.fatalMissPending ?? false;
      this.paddleX = snapshot.paddleX;
      this.targetPaddleX = snapshot.targetPaddleX;
      this.autoPilotRemaining = snapshot.autoPilotRemaining ?? 0;
      this.pathProjectionRemaining = snapshot.pathProjectionRemaining ?? 0;
      this.ballSpeedMultiplier = snapshot.ballSpeedMultiplier ?? 1;
    }

    this.createPhysicsState(snapshot);
    this.createBricks(snapshot?.bricks);

    if (this.phase !== 'playing') {
      this.holdBallOnPaddle();
    }
  }

  step(delta: number, input: BreakoutInput, events: BreakoutoutoutEvent[] = []): BreakoutoutoutEvent[] {
    events.length = 0;
    this.updateFatalMissPending(events);
    this.updatePaddle(delta, input);

    if (this.phase === 'ready') {
      this.holdBallOnPaddle();
      this.readyRemaining = Math.max(0, this.readyRemaining - delta * this.gameSpeed);
      if (this.readyRemaining <= 0) {
        this.launchOrAdvanceInto(events);
      }
      return events;
    }

    if (this.phase !== 'playing') {
      this.holdBallOnPaddle();
      return events;
    }

    const collisions = this.advanceBall(delta);
    if (!this.persistentAutopilot) {
      this.autoPilotRemaining = Math.max(0, this.autoPilotRemaining - delta * this.gameSpeed);
    }
    this.pathProjectionRemaining = Math.max(0, this.pathProjectionRemaining - delta * this.gameSpeed);
    this.resolveCollisions(collisions, events);
    if (this.phase === 'playing') {
      this.updateFatalMissPending(events);
    }
    if (this.phase === 'playing') {
      this.keepBallPlanar();
    }
    return events;
  }

  launchOrAdvance(): BreakoutoutoutEvent[] {
    const events: BreakoutoutoutEvent[] = [];
    this.launchOrAdvanceInto(events);
    return events;
  }

  private launchOrAdvanceInto(events: BreakoutoutoutEvent[]): void {
    if (this.phase !== 'ready' || this.gameSpeed <= MIN_MOVING_BALL_SPEED) {
      return;
    }

    this.phase = 'playing';
    this.readyRemaining = 0;
    this.ball.vx = 0;
    this.ball.vy = this.launchBallSpeed;

    events.push(
      { type: 'sound', name: 'launch' },
      { type: 'state-changed' }
    );
  }

  restart(): BreakoutoutoutEvent[] {
    if (this.phase === 'game-over' || this.phase === 'cleared') {
      return [];
    }

    this.score = 0;
    this.lives = 3;
    this.fatalMissPending = false;
    this.setReadyPhase();
    this.paddleX = 0;
    this.targetPaddleX = 0;
    this.autoPilotRemaining = 0;
    this.pathProjectionRemaining = 0;
    this.clearRemainingBricks();
    this.createBricks();
    this.holdBallOnPaddle();
    return [{ type: 'state-changed' }];
  }

  snapshot(): BreakoutoutoutSnapshot {
    return {
      score: this.score,
      lives: this.lives,
      phase: this.phase,
      readyRemaining: this.readyRemaining,
      fatalMissPending: this.fatalMissPending,
      paddleX: this.paddleX,
      targetPaddleX: this.targetPaddleX,
      autoPilotRemaining: this.autoPilotRemaining,
      autoPilotActive: this.isTemporaryAutopilotActive,
      persistentAutoPilotActive: this.isPersistentAutopilotActive,
      pathProjectionRemaining: this.pathProjectionRemaining,
      pathProjectionActive: this.isPathProjectionActive,
      ballSpeedMultiplier: this.ballSpeedMultiplier,
      ball: { ...this.ball },
      bricks: this.bricks.map(toBrickSnapshot)
    };
  }

  getRenderState(target?: BreakoutoutoutRenderState): BreakoutoutoutRenderState {
    if (!target) {
      return {
        id: this.id,
        score: this.score,
        lives: this.lives,
        phase: this.phase,
        readyRemaining: this.readyRemaining,
        fatalMissPending: this.fatalMissPending,
        paddleX: this.paddleX,
        targetPaddleX: this.targetPaddleX,
        autoPilotRemaining: this.autoPilotRemaining,
        autoPilotActive: this.isTemporaryAutopilotActive,
        persistentAutoPilotActive: this.isPersistentAutopilotActive,
        pathProjectionRemaining: this.pathProjectionRemaining,
        pathProjectionActive: this.isPathProjectionActive,
        ballSpeedMultiplier: this.ballSpeedMultiplier,
        ball: { ...this.ball },
        bricks: this.bricks
      };
    }

    target.id = this.id;
    target.score = this.score;
    target.lives = this.lives;
    target.phase = this.phase;
    target.readyRemaining = this.readyRemaining;
    target.fatalMissPending = this.fatalMissPending;
    target.paddleX = this.paddleX;
    target.targetPaddleX = this.targetPaddleX;
    target.autoPilotRemaining = this.autoPilotRemaining;
    target.autoPilotActive = this.isTemporaryAutopilotActive;
    target.persistentAutoPilotActive = this.isPersistentAutopilotActive;
    target.pathProjectionRemaining = this.pathProjectionRemaining;
    target.pathProjectionActive = this.isPathProjectionActive;
    target.ballSpeedMultiplier = this.ballSpeedMultiplier;
    target.ball.x = this.ball.x;
    target.ball.y = this.ball.y;
    target.ball.vx = this.ball.vx;
    target.ball.vy = this.ball.vy;
    target.bricks = this.bricks;
    return target;
  }

  getPhase(): Phase {
    return this.phase;
  }

  hasFatalMissPending(): boolean {
    return this.fatalMissPending;
  }

  setBallSpeedMultiplier(multiplier: number): void {
    this.rememberBallDirection();
    const factor = multiplier / this.ballSpeedMultiplier;
    this.ballSpeedMultiplier = multiplier;
    const speed = Math.hypot(this.ball.vx, this.ball.vy);

    if (speed > MIN_MOVING_BALL_SPEED) {
      this.setCappedBallVelocity(this.ball.vx * factor, this.ball.vy * factor);
    } else if (this.phase === 'playing' && this.gameSpeed > 0) {
      this.restoreBallVelocityFromDirection();
    }
  }

  getBallSpeedMultiplier(): number {
    return this.ballSpeedMultiplier;
  }

  setGameSpeed(speed: number): void {
    const nextSpeed = clamp(speed, 0, 1);
    if (nextSpeed === this.gameSpeed) {
      return;
    }

    this.rememberBallDirection();
    const previousSpeed = this.gameSpeed;
    this.gameSpeed = nextSpeed;

    if (this.phase !== 'playing') {
      return;
    }

    const currentSpeed = Math.hypot(this.ball.vx, this.ball.vy);

    if (nextSpeed <= MIN_MOVING_BALL_SPEED) {
      this.ball.vx = 0;
      this.ball.vy = 0;
      return;
    }

    if (currentSpeed > MIN_MOVING_BALL_SPEED && previousSpeed > MIN_MOVING_BALL_SPEED) {
      const factor = nextSpeed / previousSpeed;
      this.setCappedBallVelocity(this.ball.vx * factor, this.ball.vy * factor);
      return;
    }

    this.restoreBallVelocityFromDirection();
  }

  isActive(): boolean {
    return this.phase === 'ready' || this.phase === 'playing';
  }

  hasPersistentAutopilot(): boolean {
    return this.persistentAutopilot;
  }

  isCleared(): boolean {
    return this.phase === 'cleared';
  }

  forceGameOver(): BreakoutoutoutEvent[] {
    if (this.phase === 'game-over') {
      return [];
    }

    this.phase = 'game-over';
    this.readyRemaining = 0;
    this.lives = 0;
    this.fatalMissPending = false;
    this.autoPilotRemaining = 0;
    this.pathProjectionRemaining = 0;
    this.holdBallOnPaddle();
    return [{ type: 'state-changed' }];
  }

  placePaddleAt(x: number): void {
    if (!this.isActive()) {
      return;
    }

    this.setPaddleTarget(x);

    if (this.phase !== 'playing') {
      this.setPaddlePosition(this.targetPaddleX);
    }
  }

  projectBallPath(options: BallPathProjectionOptions = {}): BallPathProjectionPoint[] {
    if (this.phase !== 'playing' || this.currentBallSpeed <= MIN_MOVING_BALL_SPEED) {
      return [];
    }

    const projection = new BreakoutoutoutInstance(this.id, this.snapshot(), {
      autopilot: this.persistentAutopilot,
      sandbox: true,
      specialBrickKinds: [...this.specialBrickKinds]
    });
    projection.gameSpeed = this.gameSpeed;

    try {
      return projection.simulateProjectedBallPath(options);
    } finally {
      projection.dispose();
    }
  }

  dispose(): void {
    this.clearRemainingBricks();
  }

  private createPhysicsState(snapshot?: BreakoutoutoutSnapshot): void {
    const paddleX = snapshot?.paddleX ?? 0;
    const ball = snapshot?.ball;

    this.ball = {
      x: ball?.x ?? paddleX,
      y: ball?.y ?? BALL_READY_Y,
      vx: ball?.vx ?? 0,
      vy: ball?.vy ?? 0
    };
  }

  private createBricks(brickSnapshots?: BrickSnapshot[]): void {
    const snapshots = brickSnapshots ?? createFreshBrickSnapshots(this.specialBrickKinds);
    this.bricks = snapshots.map((snapshot) => ({ ...snapshot }));
  }

  private updatePaddle(delta: number, input: BreakoutInput): void {
    const maxStep = PADDLE_SPEED * this.gameSpeed * delta;

    if (this.phase === 'playing' && this.isPaddleAutopilotActive) {
      const step = clamp(this.ball.x - this.paddleX, -maxStep, maxStep);
      this.setPaddlePosition(this.paddleX + step);
      return;
    }

    if (typeof input.paddleX === 'number' && Number.isFinite(input.paddleX)) {
      this.setPaddleTarget(input.paddleX);
      this.movePaddleTowardTarget(maxStep);
      return;
    }

    const direction = Number(input.right) - Number(input.left);
    if (direction !== 0) {
      this.setPaddlePosition(this.paddleX + direction * maxStep);
      return;
    }

    this.syncPaddleBody();
  }

  private setPaddleTarget(x: number): void {
    this.targetPaddleX = clamp(x, this.minPaddleX, this.maxPaddleX);
  }

  private movePaddleTowardTarget(maxStep: number): void {
    const targetX = this.targetPaddleX;
    const step = clamp(this.targetPaddleX - this.paddleX, -maxStep, maxStep);
    this.setPaddlePosition(this.paddleX + step);
    this.targetPaddleX = targetX;
  }

  private setPaddlePosition(x: number): void {
    this.paddleX = clamp(x, this.minPaddleX, this.maxPaddleX);
    this.targetPaddleX = this.paddleX;
    this.syncPaddleBody();
  }

  private syncPaddleBody(): void {
    if (this.phase !== 'playing') {
      this.holdBallOnPaddle();
    }
  }

  private holdBallOnPaddle(): void {
    this.ball.x = this.paddleX;
    this.ball.y = BALL_READY_Y;
    this.ball.vx = 0;
    this.ball.vy = 0;
  }

  private setReadyPhase(): void {
    this.phase = 'ready';
    this.readyRemaining = READY_DURATION;
    this.fatalMissPending = false;
  }

  private updateFatalMissPending(events: BreakoutoutoutEvent[]): void {
    const nextPending = !this.sandbox
      && this.phase === 'playing'
      && this.lives === 1
      && this.ball.vy < -PHYSICS_EPSILON
      && this.ball.y < FATAL_MISS_Y;

    if (nextPending === this.fatalMissPending) {
      return;
    }

    this.fatalMissPending = nextPending;
    if (nextPending) {
      events.push({ type: 'fatal-miss' });
    }
    events.push({ type: 'state-changed' });
  }

  private resolveCollisions(collisions: PhysicsAdvanceResult, events: BreakoutoutoutEvent[]): void {
    if (collisions.touchedFloor) {
      this.loseLife(events);
      return;
    }

    if (collisions.touchedPaddle) {
      events.push({ type: 'sound', name: 'paddle' });
    }

    if (collisions.touchedWall && collisions.bricksToRemove.length === 0) {
      events.push({ type: 'sound', name: 'wall' });
    }

    for (const brick of collisions.bricksToRemove) {
      this.removeBrick(brick, events);
    }
  }

  private simulateProjectedBallPath(options: BallPathProjectionOptions): BallPathProjectionPoint[] {
    const maxSeconds = Math.max(options.maxSeconds ?? 8, FIXED_STEP);
    const maxSteps = Math.max(1, Math.ceil(maxSeconds / FIXED_STEP));
    const maxDistance = Math.max(options.maxDistance ?? Number.POSITIVE_INFINITY, 0);
    const maxBounces = Math.max(1, Math.floor(options.maxBounces ?? Number.POSITIVE_INFINITY));
    const sampleSpacing = Math.max(options.sampleSpacing ?? BALL_RADIUS, MIN_MOVING_BALL_SPEED);
    const input = options.input ?? { left: false, right: false };
    const start = this.ball;
    const points: BallPathProjectionPoint[] = [{ x: start.x, y: start.y }];
    let lastSampleX = start.x;
    let lastSampleY = start.y;
    let traveled = 0;
    let bounces = 0;

    for (let step = 0; step < maxSteps && traveled < maxDistance && bounces < maxBounces; step += 1) {
      if (this.phase !== 'playing') {
        break;
      }

      const previousX = this.ball.x;
      const previousY = this.ball.y;
      this.updatePaddle(FIXED_STEP, input);
      const collisions = this.advanceBall(FIXED_STEP);
      const current = this.ball;
      const stepDistance = collisions.traveled || Math.hypot(current.x - previousX, current.y - previousY);
      traveled += stepDistance;

      const shouldStop = collisions.touchedFloor || collisions.touchedPaddle || traveled >= maxDistance;
      const sampleDistance = Math.hypot(current.x - lastSampleX, current.y - lastSampleY);
      if (sampleDistance >= sampleSpacing || shouldStop) {
        points.push({ x: current.x, y: current.y });
        lastSampleX = current.x;
        lastSampleY = current.y;
      }

      if (shouldStop) {
        break;
      }

      if (collisions.touchedWall || collisions.bricksToRemove.length > 0) {
        bounces += Math.max(1, collisions.bricksToRemove.length);
      }

      for (const brick of collisions.bricksToRemove) {
        this.removeBrick(brick, null);
      }

      if (this.phase === 'playing') {
        this.keepBallPlanar();
      }
    }

    return points.length > 1 ? points : [];
  }

  private advanceBall(delta: number): PhysicsAdvanceResult {
    const result = this.collisionResult;
    resetPhysicsAdvanceResult(result);
    let remaining = delta;

    for (let collisionCount = 0; collisionCount < MAX_COLLISIONS_PER_STEP && remaining > PHYSICS_EPSILON; collisionCount += 1) {
      const speed = this.currentBallSpeed;
      if (speed <= MIN_MOVING_BALL_SPEED) {
        break;
      }

      const hit = this.nearestHit;
      if (!this.findNearestBallHit(remaining, result.bricksToRemove, hit)) {
        this.ball.x += this.ball.vx * remaining;
        this.ball.y += this.ball.vy * remaining;
        result.traveled += speed * remaining;
        break;
      }

      const travelTime = Math.max(0, hit.time);
      this.ball.x += this.ball.vx * travelTime;
      this.ball.y += this.ball.vy * travelTime;
      result.traveled += speed * travelTime;
      remaining = Math.max(0, remaining - travelTime);

      result.touchedFloor ||= hit.touchedFloor;
      result.touchedPaddle ||= hit.touchedPaddle;
      result.touchedWall ||= hit.touchedWall;

      for (const brick of hit.bricks) {
        if (!brick.hit) {
          addBrickToList(result.bricksToRemove, brick);
        }
      }

      if (hit.touchedFloor) {
        this.ball.x = clamp(this.ball.x, PLAYFIELD_LEFT, PLAYFIELD_RIGHT);
        this.ball.y = PLAYFIELD_BOTTOM;
        break;
      }

      if (hit.touchedPaddle) {
        this.applyPaddleBounce();
      } else {
        this.reflectBall(hit.normalX, hit.normalY);
        this.separateBallFromSurface(hit.normalX, hit.normalY);
      }
    }

    return result;
  }

  private findNearestBallHit(maxTime: number, ignoredBricks: readonly Brick[], nearest: SweptBallHit): boolean {
    resetSweptBallHit(nearest);
    this.findNearestWallHit(maxTime, nearest);

    this.paddleRect.x = this.paddleX;
    if (this.findPaddleHit(maxTime, this.candidateHit)) {
      mergeSweptBallHit(nearest, this.candidateHit);
    }

    for (const brick of this.bricks) {
      if (brick.hit || ignoredBricks.includes(brick)) {
        continue;
      }

      if (this.sweptRectHit(brick, 'brick', brick, maxTime, this.candidateHit)) {
        mergeSweptBallHit(nearest, this.candidateHit);
      }
    }

    return hasSweptBallHit(nearest);
  }

  private findPaddleHit(maxTime: number, out: SweptBallHit): boolean {
    if (this.sweptRectHit(this.paddleRect, 'paddle', null, maxTime, out)) {
      return true;
    }

    return this.findPaddleOverlapRecoveryHit(out);
  }

  private findNearestWallHit(maxTime: number, nearest: SweptBallHit): void {
    if (this.ball.vx < -PHYSICS_EPSILON) {
      if (createAxisHit(
        (PLAYFIELD_LEFT - this.ball.x) / this.ball.vx,
        1,
        0,
        'wall',
        null,
        maxTime,
        this.candidateHit
      )) {
        mergeSweptBallHit(nearest, this.candidateHit);
      }
    } else if (this.ball.vx > PHYSICS_EPSILON) {
      if (createAxisHit(
        (PLAYFIELD_RIGHT - this.ball.x) / this.ball.vx,
        -1,
        0,
        'wall',
        null,
        maxTime,
        this.candidateHit
      )) {
        mergeSweptBallHit(nearest, this.candidateHit);
      }
    }

    if (this.ball.vy > PHYSICS_EPSILON) {
      if (createAxisHit(
        (PLAYFIELD_TOP - this.ball.y) / this.ball.vy,
        0,
        -1,
        'wall',
        null,
        maxTime,
        this.candidateHit
      )) {
        mergeSweptBallHit(nearest, this.candidateHit);
      }
    } else if (this.ball.vy < -PHYSICS_EPSILON) {
      if (createAxisHit(
        (PLAYFIELD_BOTTOM - this.ball.y) / this.ball.vy,
        0,
        1,
        'floor',
        null,
        maxTime,
        this.candidateHit
      )) {
        mergeSweptBallHit(nearest, this.candidateHit);
      }
    }
  }

  private sweptRectHit(
    rect: PhysicsRect,
    target: PhysicsCollisionKind,
    brick: Brick | null,
    maxTime: number,
    out: SweptBallHit
  ): boolean {
    resetSweptBallHit(out);
    const minX = rect.x - rect.width / 2 - BALL_RADIUS;
    const maxX = rect.x + rect.width / 2 + BALL_RADIUS;
    const minY = rect.y - rect.height / 2 - BALL_RADIUS;
    const maxY = rect.y + rect.height / 2 + BALL_RADIUS;
    let entryTime = Number.NEGATIVE_INFINITY;
    let exitTime = Number.POSITIVE_INFINITY;
    let normalX = 0;
    let normalY = 0;

    if (Math.abs(this.ball.vx) <= PHYSICS_EPSILON) {
      if (this.ball.x < minX || this.ball.x > maxX) {
        return false;
      }
    } else {
      const nearX = (minX - this.ball.x) / this.ball.vx;
      const farX = (maxX - this.ball.x) / this.ball.vx;
      const xEntry = Math.min(nearX, farX);
      const xExit = Math.max(nearX, farX);
      const xNormal = nearX > farX ? 1 : -1;
      if (xEntry > entryTime + PHYSICS_CORNER_TOLERANCE) {
        entryTime = xEntry;
        normalX = xNormal;
        normalY = 0;
      } else if (Math.abs(xEntry - entryTime) <= PHYSICS_CORNER_TOLERANCE) {
        normalX = xNormal;
      }
      exitTime = Math.min(exitTime, xExit);
    }

    if (Math.abs(this.ball.vy) <= PHYSICS_EPSILON) {
      if (this.ball.y < minY || this.ball.y > maxY) {
        return false;
      }
    } else {
      const nearY = (minY - this.ball.y) / this.ball.vy;
      const farY = (maxY - this.ball.y) / this.ball.vy;
      const yEntry = Math.min(nearY, farY);
      const yExit = Math.max(nearY, farY);
      const yNormal = nearY > farY ? 1 : -1;
      if (yEntry > entryTime + PHYSICS_CORNER_TOLERANCE) {
        entryTime = yEntry;
        normalX = 0;
        normalY = yNormal;
      } else if (Math.abs(yEntry - entryTime) <= PHYSICS_CORNER_TOLERANCE) {
        normalY = yNormal;
      }
      exitTime = Math.min(exitTime, yExit);
    }

    if (
      entryTime > exitTime
      || entryTime <= PHYSICS_EPSILON
      || entryTime - maxTime > PHYSICS_CORNER_TOLERANCE
    ) {
      return false;
    }

    out.time = entryTime;
    out.normalX = normalX;
    out.normalY = normalY;
    addSweptBallTarget(out, target, brick);
    return true;
  }

  private findPaddleOverlapRecoveryHit(out: SweptBallHit): boolean {
    resetSweptBallHit(out);

    if (this.ball.vy > PHYSICS_EPSILON) {
      return false;
    }

    const minX = this.paddleRect.x - this.paddleRect.width / 2 - BALL_RADIUS;
    const maxX = this.paddleRect.x + this.paddleRect.width / 2 + BALL_RADIUS;
    const maxY = this.paddleRect.y + this.paddleRect.height / 2 + BALL_RADIUS;
    const minY = PADDLE_Y + PADDLE_HEIGHT / 2 - BALL_RADIUS - PADDLE_OVERLAP_RECOVERY_DEPTH;

    if (this.ball.x < minX || this.ball.x > maxX || this.ball.y < minY || this.ball.y > maxY) {
      return false;
    }

    out.time = 0;
    out.normalX = 0;
    out.normalY = 1;
    addSweptBallTarget(out, 'paddle', null);
    return true;
  }

  private reflectBall(normalX: number, normalY: number): void {
    if (normalX !== 0) {
      this.ball.vx *= -1;
    }
    if (normalY !== 0) {
      this.ball.vy *= -1;
    }
  }

  private separateBallFromSurface(normalX: number, normalY: number): void {
    this.ball.x = clamp(
      this.ball.x + normalX * PHYSICS_SURFACE_CLEARANCE,
      PLAYFIELD_LEFT,
      PLAYFIELD_RIGHT
    );
    this.ball.y = clamp(
      this.ball.y + normalY * PHYSICS_SURFACE_CLEARANCE,
      PLAYFIELD_BOTTOM,
      PLAYFIELD_TOP
    );
  }

  private applyPaddleBounce(): void {
    const centeredOffset = (this.ball.x - this.paddleX) / (PADDLE_WIDTH / 2);
    const offset = this.paddleBounceOffset(centeredOffset);
    const speed = this.capBallSpeed(Math.max(this.paddleBounceBallSpeed, this.currentBallSpeed));
    const angle = offset * 1.04;
    this.ball.vx = Math.sin(angle) * speed;
    this.ball.vy = Math.cos(angle) * speed;
    this.ball.y = Math.max(this.ball.y, PADDLE_Y + PADDLE_HEIGHT / 2 + BALL_RADIUS + PHYSICS_SURFACE_CLEARANCE);
  }

  private removeBrick(brick: Brick, events: BreakoutoutoutEvent[] | null): void {
    brick.hit = true;
    this.score += brick.points;

    if (events) {
      events.push({
        type: 'brick-hit',
        x: brick.x,
        y: brick.y,
        color: brick.color,
        kind: brick.kind,
        points: brick.points
      });
      events.push({ type: 'sound', name: getBrickSound(brick.kind) });
    }

    if (events && brick.kind === 'splitter') {
      events.push({ type: 'split', x: brick.x, y: brick.y, color: brick.color, snapshot: this.snapshot() });
    }

    if (brick.kind === 'autopilot') {
      this.autoPilotRemaining = AUTOPILOT_DURATION;
    }

    if (brick.kind === 'life') {
      this.lives += 1;
    }

    if (brick.kind === 'projector') {
      this.pathProjectionRemaining = PATH_PROJECTION_DURATION;
    }

    if (this.hasClearedRequiredBricks()) {
      this.clearOptionalSplitterBricks();
      this.phase = 'cleared';
      this.autoPilotRemaining = 0;
      this.pathProjectionRemaining = 0;
      if (events) {
        events.push({ type: 'sound', name: 'clear' });
      }
    }

    if (events) {
      events.push({ type: 'state-changed' });
    }
  }

  private hasClearedRequiredBricks(): boolean {
    return this.bricks.every((item) => item.kind === 'splitter' || item.hit);
  }

  private clearOptionalSplitterBricks(): void {
    for (const brick of this.bricks) {
      if (brick.kind !== 'splitter' || brick.hit) {
        continue;
      }

      brick.hit = true;
    }
  }

  private keepBallPlanar(): void {
    const speed = this.capBallSpeed(Math.max(this.currentBallSpeed, this.minimumBallSpeed));

    if (speed <= MIN_MOVING_BALL_SPEED) {
      this.ball.vx = 0;
      this.ball.vy = 0;
      return;
    }

    const planarSpeed = this.currentBallSpeed || speed;
    let normalizedX = this.ball.vx / planarSpeed;
    let normalizedY = this.ball.vy / planarSpeed;
    if (Math.abs(normalizedY) < MIN_BALL_VERTICAL_DIRECTION) {
      normalizedY = Math.sign(normalizedY || 1) * MIN_BALL_VERTICAL_DIRECTION;
      normalizedX = Math.sign(normalizedX || this.lastBallDirectionX || 1)
        * Math.sqrt(1 - normalizedY * normalizedY);
    }
    this.lastBallDirectionX = normalizedX;
    this.lastBallDirectionY = normalizedY;

    this.ball.x = clamp(this.ball.x, PLAYFIELD_LEFT, PLAYFIELD_RIGHT);
    this.ball.y = Math.min(this.ball.y, PLAYFIELD_TOP);
    this.ball.vx = normalizedX * speed;
    this.ball.vy = normalizedY * speed;
  }

  private loseLife(events: BreakoutoutoutEvent[]): void {
    if (this.sandbox) {
      this.setReadyPhase();
      this.autoPilotRemaining = 0;
      this.holdBallOnPaddle();
      events.push(
        { type: 'sound', name: 'life' },
        { type: 'state-changed' }
      );
      return;
    }

    this.lives -= 1;
    if (this.lives > 0) {
      this.setReadyPhase();
    } else {
      this.phase = 'game-over';
      this.readyRemaining = 0;
    }
    this.fatalMissPending = false;
    this.autoPilotRemaining = 0;
    this.holdBallOnPaddle();
    events.push(
      { type: 'sound', name: 'life' },
      { type: 'state-changed' }
    );
  }

  private clearRemainingBricks(): void {
    this.bricks = [];
  }

  private get minPaddleX(): number {
    return -HALF_WIDTH + WALL_THICKNESS + PADDLE_WIDTH / 2;
  }

  private get maxPaddleX(): number {
    return HALF_WIDTH - WALL_THICKNESS - PADDLE_WIDTH / 2;
  }

  private get currentBallSpeed(): number {
    return Math.hypot(this.ball.vx, this.ball.vy);
  }

  private get launchBallSpeed(): number {
    return BALL_SPEED * this.ballSpeedMultiplier * this.gameSpeed;
  }

  private get minimumBallSpeed(): number {
    return BALL_SPEED * this.ballSpeedMultiplier * this.gameSpeed;
  }

  private get maximumBallSpeed(): number {
    return this.minimumBallSpeed * MAX_BALL_SPEED_FACTOR;
  }

  private get paddleBounceBallSpeed(): number {
    return BALL_SPEED * this.ballSpeedMultiplier * this.gameSpeed;
  }

  private get isPaddleAutopilotActive(): boolean {
    return this.phase !== 'game-over'
      && this.phase !== 'cleared'
      && (this.persistentAutopilot || this.autoPilotRemaining > 0);
  }

  private get isTemporaryAutopilotActive(): boolean {
    return this.phase !== 'game-over'
      && this.phase !== 'cleared'
      && this.autoPilotRemaining > 0;
  }

  private get isPersistentAutopilotActive(): boolean {
    return this.phase !== 'game-over'
      && this.phase !== 'cleared'
      && this.persistentAutopilot;
  }

  private get isPathProjectionActive(): boolean {
    return this.phase !== 'game-over'
      && this.phase !== 'cleared'
      && this.pathProjectionRemaining > 0;
  }

  private paddleBounceOffset(centeredOffset: number): number {
    if (!this.isPaddleAutopilotActive) {
      return clamp(centeredOffset, -1, 1);
    }

    const sign = Math.random() < 0.5 ? -1 : 1;
    const randomOffset = sign * (AUTOPILOT_BOUNCE_OFFSET_MIN + Math.random() * AUTOPILOT_BOUNCE_OFFSET_RANGE);
    const offset = clamp(centeredOffset + randomOffset, -1, 1);
    return Math.abs(offset) < AUTOPILOT_BOUNCE_OFFSET_MIN ? sign * AUTOPILOT_BOUNCE_OFFSET_MIN : offset;
  }

  private rememberBallDirection(): void {
    const speed = Math.hypot(this.ball.vx, this.ball.vy);

    if (speed <= MIN_MOVING_BALL_SPEED) {
      return;
    }

    this.lastBallDirectionX = this.ball.vx / speed;
    this.lastBallDirectionY = this.ball.vy / speed;
  }

  private restoreBallVelocityFromDirection(): void {
    const speed = this.minimumBallSpeed;
    if (speed <= MIN_MOVING_BALL_SPEED) {
      this.ball.vx = 0;
      this.ball.vy = 0;
      return;
    }

    this.ball.vx = this.lastBallDirectionX * speed;
    this.ball.vy = this.lastBallDirectionY * speed;
  }

  private setCappedBallVelocity(x: number, y: number): void {
    const speed = Math.hypot(x, y);
    const cappedSpeed = this.capBallSpeed(speed);

    if (speed <= MIN_MOVING_BALL_SPEED || cappedSpeed === speed) {
      this.ball.vx = x;
      this.ball.vy = y;
      return;
    }

    const scale = cappedSpeed / speed;
    this.ball.vx = x * scale;
    this.ball.vy = y * scale;
  }

  private capBallSpeed(speed: number): number {
    if (this.maximumBallSpeed <= MIN_MOVING_BALL_SPEED) {
      return 0;
    }

    return Math.min(speed, this.maximumBallSpeed);
  }
}

function createPhysicsAdvanceResult(): PhysicsAdvanceResult {
  return {
    bricksToRemove: [],
    touchedFloor: false,
    touchedPaddle: false,
    touchedWall: false,
    traveled: 0
  };
}

function resetPhysicsAdvanceResult(result: PhysicsAdvanceResult): void {
  result.bricksToRemove.length = 0;
  result.touchedFloor = false;
  result.touchedPaddle = false;
  result.touchedWall = false;
  result.traveled = 0;
}

function createSweptBallHit(): SweptBallHit {
  return {
    time: Number.POSITIVE_INFINITY,
    normalX: 0,
    normalY: 0,
    touchedWall: false,
    touchedFloor: false,
    touchedPaddle: false,
    bricks: []
  };
}

function resetSweptBallHit(hit: SweptBallHit): void {
  hit.time = Number.POSITIVE_INFINITY;
  hit.normalX = 0;
  hit.normalY = 0;
  hit.touchedWall = false;
  hit.touchedFloor = false;
  hit.touchedPaddle = false;
  hit.bricks.length = 0;
}

function hasSweptBallHit(hit: SweptBallHit): boolean {
  return hit.time < Number.POSITIVE_INFINITY;
}

function createAxisHit(
  time: number,
  normalX: number,
  normalY: number,
  target: PhysicsCollisionKind,
  brick: Brick | null,
  maxTime: number,
  out: SweptBallHit
): boolean {
  resetSweptBallHit(out);
  if (time <= PHYSICS_EPSILON || time - maxTime > PHYSICS_CORNER_TOLERANCE) {
    return false;
  }

  out.time = time;
  out.normalX = normalX;
  out.normalY = normalY;
  addSweptBallTarget(out, target, brick);
  return true;
}

function mergeSweptBallHit(current: SweptBallHit, candidate: SweptBallHit): void {
  if (!hasSweptBallHit(candidate)) {
    return;
  }

  if (!hasSweptBallHit(current) || candidate.time < current.time - PHYSICS_CORNER_TOLERANCE) {
    copySweptBallHit(current, candidate);
    return;
  }

  if (Math.abs(candidate.time - current.time) <= PHYSICS_CORNER_TOLERANCE) {
    current.time = Math.min(current.time, candidate.time);
    current.normalX ||= candidate.normalX;
    current.normalY ||= candidate.normalY;
    current.touchedWall ||= candidate.touchedWall;
    current.touchedFloor ||= candidate.touchedFloor;
    current.touchedPaddle ||= candidate.touchedPaddle;
    for (const brick of candidate.bricks) {
      addBrickToList(current.bricks, brick);
    }
  }
}

function copySweptBallHit(target: SweptBallHit, source: SweptBallHit): void {
  target.time = source.time;
  target.normalX = source.normalX;
  target.normalY = source.normalY;
  target.touchedWall = source.touchedWall;
  target.touchedFloor = source.touchedFloor;
  target.touchedPaddle = source.touchedPaddle;
  target.bricks.length = 0;
  for (const brick of source.bricks) {
    target.bricks.push(brick);
  }
}

function addSweptBallTarget(hit: SweptBallHit, target: PhysicsCollisionKind, brick: Brick | null): void {
  if (target === 'wall') {
    hit.touchedWall = true;
    return;
  }

  if (target === 'floor') {
    hit.touchedFloor = true;
    return;
  }

  if (target === 'paddle') {
    hit.touchedPaddle = true;
    return;
  }

  if (brick) {
    addBrickToList(hit.bricks, brick);
  }
}

function addBrickToList(bricks: Brick[], brick: Brick): void {
  if (!bricks.includes(brick)) {
    bricks.push(brick);
  }
}

function createFreshBrickSnapshots(specialBrickKinds: ReadonlySet<SpecialBrickKind>): BrickSnapshot[] {
  const brickWidth = (BOARD_WIDTH - BRICK_LEFT_PAD * 2 - BRICK_GAP * (BRICK_COLS - 1)) / BRICK_COLS;
  const palette = [0xf45b69, 0xf59f00, 0xf7d154, 0x2ec4b6, 0x4cc9f0, 0xa78bfa];
  const splitCol = Math.floor(BRICK_COLS / 2);
  const bricks: BrickSnapshot[] = [];

  for (let row = 0; row < BRICK_ROWS; row += 1) {
    for (let col = 0; col < BRICK_COLS; col += 1) {
      const kind = getFreshBrickKind(row, col, splitCol, specialBrickKinds);
      const x = -HALF_WIDTH + BRICK_LEFT_PAD + brickWidth / 2 + col * (brickWidth + BRICK_GAP);
      const y = BRICK_TOP_Y - row * (BRICK_HEIGHT + BRICK_GAP);
      const color = getBrickColor(kind, row, palette);

      bricks.push({
        id: `${row}:${col}`,
        row,
        col,
        x,
        y,
        width: brickWidth,
        height: BRICK_HEIGHT,
        color,
        points: getBrickPoints(kind, row),
        kind,
        hit: false
      });
    }
  }

  return bricks;
}

function createSplitBonusBricks(
  existingBricks: BrickSnapshot[],
  carriedBall: BallSnapshot,
  specialBrickKinds: ReadonlySet<SpecialBrickKind>,
  random: () => number
): BrickSnapshot[] {
  const brickWidth = (BOARD_WIDTH - BRICK_LEFT_PAD * 2 - BRICK_GAP * (BRICK_COLS - 1)) / BRICK_COLS;
  const normalPalette = [0xf45b69, 0xf59f00, 0xf7d154, 0x2ec4b6, 0x4cc9f0, 0xa78bfa];
  const additions: BrickSnapshot[] = [];
  const kinds: BrickKind[] = specialBrickKinds.has('splitter')
    ? ['splitter', 'normal', 'normal']
    : ['normal', 'normal', 'normal'];
  const activeSpecialKinds = getActiveSpecialBrickKinds(existingBricks);

  for (let index = 0; index < kinds.length; index += 1) {
    const kind = kinds[index];
    const placed = kind === 'splitter'
      ? placeSplitBonusBrick({
          id: `split-${existingBricks.length}-${index}`,
          width: brickWidth,
          height: BRICK_HEIGHT,
          existingBricks: [...existingBricks, ...additions],
          carriedBall,
          random
        })
      : placeBonusBrick({
          id: `split-${existingBricks.length}-${index}`,
          kind,
          width: brickWidth,
          height: BRICK_HEIGHT,
          color: normalPalette[Math.floor(random() * normalPalette.length)],
          existingBricks: [...existingBricks, ...additions],
          random
        });
    additions.push(placed);
    if (isSpecialBrickKind(placed.kind)) {
      activeSpecialKinds.add(placed.kind);
    }
  }

  for (const kind of SPECIAL_BRICK_KINDS) {
    if (!specialBrickKinds.has(kind) || activeSpecialKinds.has(kind)) {
      continue;
    }

    const placed = placeSpecialBonusBrick({
      id: `split-special-${existingBricks.length}-${kind}`,
      kind,
      width: brickWidth,
      height: BRICK_HEIGHT,
      existingBricks: [...existingBricks, ...additions],
      carriedBall,
      random
    });
    additions.push(placed);
    activeSpecialKinds.add(kind);
  }

  return additions;
}

function getActiveSpecialBrickKinds(bricks: readonly BrickSnapshot[]): Set<SpecialBrickKind> {
  const kinds = new Set<SpecialBrickKind>();

  for (const brick of bricks) {
    if (!brick.hit && isSpecialBrickKind(brick.kind)) {
      kinds.add(brick.kind);
    }
  }

  return kinds;
}

function isSpecialBrickKind(kind: BrickKind): kind is SpecialBrickKind {
  return kind !== 'normal';
}

function placeSpecialBonusBrick(options: {
  id: string;
  kind: SpecialBrickKind;
  width: number;
  height: number;
  existingBricks: BrickSnapshot[];
  carriedBall: BallSnapshot;
  random: () => number;
}): BrickSnapshot {
  if (options.kind === 'splitter') {
    return placeSplitBonusBrick(options);
  }

  return placeBonusBrick({
    id: options.id,
    kind: options.kind,
    width: options.width,
    height: options.height,
    color: getSpecialBrickColor(options.kind),
    existingBricks: options.existingBricks,
    random: options.random
  });
}

function placeSplitBonusBrick(options: {
  id: string;
  width: number;
  height: number;
  existingBricks: BrickSnapshot[];
  carriedBall: BallSnapshot;
  random: () => number;
}): BrickSnapshot {
  const minX = -HALF_WIDTH + WALL_THICKNESS + options.width / 2 + 0.18;
  const maxX = HALF_WIDTH - WALL_THICKNESS - options.width / 2 - 0.18;

  for (let attempt = 0; attempt < 120; attempt += 1) {
    const x = minX + options.random() * (maxX - minX);
    const y = SPLIT_BONUS_MIN_Y + options.random() * (SPLIT_BONUS_MAX_Y - SPLIT_BONUS_MIN_Y);
    if (isSafeSplitBonusPlacement(x, y, options.width, options.height, options.existingBricks, options.carriedBall)) {
      return createBonusBrickSnapshot(
        {
          id: options.id,
          kind: 'splitter',
          width: options.width,
          height: options.height,
          color: SPLITTER_COLOR
        },
        x,
        y,
        -1,
        -1
      );
    }
  }

  const fallbackColumns = 8;
  const fallbackRows = 8;
  const fallbackCandidates = shuffle(
    Array.from({ length: fallbackColumns * fallbackRows }, (_value, index) => ({
      col: index % fallbackColumns,
      row: Math.floor(index / fallbackColumns)
    })),
    options.random
  );

  for (const candidate of fallbackCandidates) {
    const x = minX + (candidate.col / Math.max(1, fallbackColumns - 1)) * (maxX - minX);
    const y = SPLIT_BONUS_MIN_Y
      + (candidate.row / Math.max(1, fallbackRows - 1)) * (SPLIT_BONUS_MAX_Y - SPLIT_BONUS_MIN_Y);
    if (isSafeSplitBonusPlacement(x, y, options.width, options.height, options.existingBricks, options.carriedBall)) {
      return createBonusBrickSnapshot(
        {
          id: options.id,
          kind: 'splitter',
          width: options.width,
          height: options.height,
          color: SPLITTER_COLOR
        },
        x,
        y,
        -1,
        -1
      );
    }
  }

  return createBonusBrickSnapshot(
    {
      id: options.id,
      kind: 'splitter',
      width: options.width,
      height: options.height,
      color: SPLITTER_COLOR
    },
    0,
    SPLIT_BONUS_MIN_Y,
    -1,
    -1
  );
}

function placeBonusBrick(options: {
  id: string;
  kind: BrickKind;
  width: number;
  height: number;
  color: number;
  existingBricks: BrickSnapshot[];
  random: () => number;
}): BrickSnapshot {
  const minX = -HALF_WIDTH + WALL_THICKNESS + options.width / 2 + 0.18;
  const maxX = HALF_WIDTH - WALL_THICKNESS - options.width / 2 - 0.18;
  const minY = SPLIT_BONUS_MIN_Y;
  const maxY = SPLIT_BONUS_MAX_Y;

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const x = minX + options.random() * (maxX - minX);
    const y = minY + options.random() * (maxY - minY);
    if (!overlapsActiveBrick(x, y, options.width, options.height, options.existingBricks)) {
      return createBonusBrickSnapshot(options, x, y, -1, -1);
    }
  }

  const fallbackColumns = 8;
  const fallbackRows = 8;
  for (let row = fallbackRows - 1; row >= 0; row -= 1) {
    for (let col = 0; col < fallbackColumns; col += 1) {
      const x = minX + (col / Math.max(1, fallbackColumns - 1)) * (maxX - minX);
      const y = minY + (row / Math.max(1, fallbackRows - 1)) * (maxY - minY);
      if (!overlapsActiveBrick(x, y, options.width, options.height, options.existingBricks)) {
        return createBonusBrickSnapshot(options, x, y, -1, -1);
      }
    }
  }

  return createBonusBrickSnapshot(options, 0, minY, -1, -1);
}

function createBonusBrickSnapshot(
  options: {
    id: string;
    kind: BrickKind;
    width: number;
    height: number;
    color: number;
  },
  x: number,
  y: number,
  row: number,
  col: number
): BrickSnapshot {
  return {
    id: options.id,
    row,
    col,
    x,
    y,
    width: options.width,
    height: options.height,
    color: options.color,
    points: getBonusBrickPoints(options.kind),
    kind: options.kind,
    hit: false
  };
}

function getFreshBrickKind(
  row: number,
  col: number,
  splitCol: number,
  specialBrickKinds: ReadonlySet<SpecialBrickKind>
): BrickKind {
  if (specialBrickKinds.has('splitter') && row === SPLITTER_ROW && col === splitCol) {
    return 'splitter';
  }

  if (specialBrickKinds.has('autopilot') && row === AUTOPILOT_ROW && col === AUTOPILOT_COL) {
    return 'autopilot';
  }

  if (specialBrickKinds.has('life') && row === LIFE_ROW && col === LIFE_COL) {
    return 'life';
  }

  if (specialBrickKinds.has('projector') && row === PROJECTOR_ROW && col === PROJECTOR_COL) {
    return 'projector';
  }

  return 'normal';
}

function getBrickColor(kind: BrickKind, row: number, palette: number[]): number {
  if (kind === 'splitter') {
    return SPLITTER_COLOR;
  }

  if (kind === 'autopilot') {
    return AUTOPILOT_COLOR;
  }

  if (kind === 'life') {
    return LIFE_COLOR;
  }

  if (kind === 'projector') {
    return PROJECTOR_COLOR;
  }

  return palette[row % palette.length];
}

function getSpecialBrickColor(kind: SpecialBrickKind): number {
  if (kind === 'splitter') {
    return SPLITTER_COLOR;
  }

  if (kind === 'autopilot') {
    return AUTOPILOT_COLOR;
  }

  if (kind === 'life') {
    return LIFE_COLOR;
  }

  return PROJECTOR_COLOR;
}

function getBrickPoints(kind: BrickKind, row: number): number {
  if (kind === 'splitter') {
    return 180;
  }

  if (kind === 'autopilot') {
    return 140;
  }

  if (kind === 'life') {
    return 120;
  }

  if (kind === 'projector') {
    return 150;
  }

  return (BRICK_ROWS - row) * 10;
}

function getBonusBrickPoints(kind: BrickKind): number {
  if (kind === 'splitter') {
    return 200;
  }

  if (kind === 'autopilot') {
    return 160;
  }

  if (kind === 'life') {
    return 140;
  }

  if (kind === 'projector') {
    return 170;
  }

  return 80;
}

function getBrickSound(kind: BrickKind): ToneName {
  if (kind === 'splitter') {
    return 'split';
  }

  if (kind === 'autopilot') {
    return 'auto';
  }

  if (kind === 'life') {
    return 'extraLife';
  }

  if (kind === 'projector') {
    return 'projector';
  }

  return 'brick';
}

function overlapsActiveBrick(
  x: number,
  y: number,
  width: number,
  height: number,
  existingBricks: BrickSnapshot[]
): boolean {
  const spacing = BRICK_GAP + 0.04;

  return existingBricks.some((brick) => {
    if (brick.hit) {
      return false;
    }

    const xOverlap = Math.abs(x - brick.x) < (width + brick.width) / 2 + spacing;
    const yOverlap = Math.abs(y - brick.y) < (height + brick.height) / 2 + spacing;
    return xOverlap && yOverlap;
  });
}

function isSafeSplitBonusPlacement(
  x: number,
  y: number,
  width: number,
  height: number,
  existingBricks: BrickSnapshot[],
  carriedBall: BallSnapshot
): boolean {
  return !overlapsActiveBrick(x, y, width, height, existingBricks)
    && !isNearCarriedBallPath(x, y, width, height, carriedBall);
}

function isNearCarriedBallPath(x: number, y: number, width: number, height: number, ball: BallSnapshot): boolean {
  const immediateRadius = Math.max(width, height) / 2 + BALL_RADIUS + SPLITTER_BALL_SAFE_PADDING;
  const immediateDistance = Math.hypot(x - ball.x, y - ball.y);

  if (immediateDistance < immediateRadius) {
    return true;
  }

  const futureX = ball.x + ball.vx * SPLITTER_BALL_SAFE_SECONDS;
  const futureY = ball.y + ball.vy * SPLITTER_BALL_SAFE_SECONDS;
  return distanceToSegment(x, y, ball.x, ball.y, futureX, futureY) < immediateRadius;
}

function distanceToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1);
  return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
  }

  return items;
}

function toBrickSnapshot(brick: Brick): BrickSnapshot {
  return { ...brick };
}

function createSpecialBrickKindSet(kinds: readonly SpecialBrickKind[] | undefined): ReadonlySet<SpecialBrickKind> {
  return new Set(kinds ?? SPECIAL_BRICK_KINDS);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
