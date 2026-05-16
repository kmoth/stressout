import RAPIER from '@dimforge/rapier3d-compat';
import type { Collider, EventQueue, RigidBody, World } from '@dimforge/rapier3d-compat';
import type { ToneName } from './sound';

export const BOARD_WIDTH = 12;
export const BOARD_HEIGHT = 16;
export const WALL_THICKNESS = 0.34;
export const PLAYFIELD_DEPTH = 0.15;
export const PADDLE_WIDTH = 2.35;
export const PADDLE_HEIGHT = 0.34;
export const PADDLE_DEPTH = PLAYFIELD_DEPTH;
export const PADDLE_Y = -6.45;
export const PADDLE_SPEED = 11.5;
export const BALL_RADIUS = 0.22;
export const BALL_SPEED = 7.1;
export const FIXED_STEP = 1 / 90;
export const BRICK_COLS = 10;
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
const SPLITTER_COLOR = 0xd946ef;
const AUTOPILOT_COLOR = 0x34d399;
const LIFE_COLOR = 0xfb7185;
const AUTOPILOT_DURATION = 10;
const AUTOPILOT_BOUNCE_OFFSET_MIN = 0.08;
const AUTOPILOT_BOUNCE_OFFSET_RANGE = 0.16;
const SPLIT_BONUS_MIN_Y = -2.1;
const SPLIT_BONUS_MAX_Y = BRICK_TOP_Y + 0.1;
const SPLITTER_BALL_SAFE_SECONDS = 0.42;
const SPLITTER_BALL_SAFE_PADDING = 0.72;
const MIN_MOVING_BALL_SPEED = 0.0001;
const READY_DURATION = 5;

export type Phase = 'ready' | 'playing' | 'cleared' | 'game-over';
export type BrickKind = 'normal' | 'splitter' | 'autopilot' | 'life';
export const SPECIAL_BRICK_KINDS = ['splitter', 'autopilot', 'life'] as const;
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
  paddleX: number;
  targetPaddleX: number;
  autoPilotRemaining: number;
  autoPilotActive: boolean;
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

type BallSnapshot = BreakoutoutoutSnapshot['ball'];

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
  | { type: 'state-changed' };

type Brick = BrickSnapshot & {
  body?: RigidBody;
  collider?: Collider;
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

  private readonly world: World;
  private readonly eventQueue: EventQueue;
  private readonly brickByCollider = new Map<number, Brick>();

  private paddleBody!: RigidBody;
  private paddleCollider!: Collider;
  private ballBody!: RigidBody;
  private ballCollider!: Collider;
  private floorCollider!: Collider;
  private bricks: Brick[] = [];
  private score = 0;
  private lives = 3;
  private phase: Phase = 'ready';
  private readyRemaining = READY_DURATION;
  private paddleX = 0;
  private targetPaddleX = 0;
  private autoPilotRemaining = 0;
  private ballSpeedMultiplier = 1;
  private gameSpeed = 1;
  private lastBallDirectionX = 0;
  private lastBallDirectionY = 1;
  private readonly persistentAutopilot: boolean;
  private readonly sandbox: boolean;
  private readonly specialBrickKinds: ReadonlySet<SpecialBrickKind>;

  constructor(id: number, snapshot?: BreakoutoutoutSnapshot, options: BreakoutoutoutOptions = {}) {
    this.id = id;
    this.persistentAutopilot = options.autopilot ?? false;
    this.sandbox = options.sandbox ?? false;
    this.specialBrickKinds = createSpecialBrickKindSet(options.specialBrickKinds);
    this.world = new RAPIER.World({ x: 0, y: 0, z: 0 });
    this.eventQueue = new RAPIER.EventQueue(false);

    if (snapshot) {
      this.score = snapshot.score;
      this.lives = snapshot.lives;
      this.phase = snapshot.phase;
      this.readyRemaining = snapshot.phase === 'ready'
        ? clamp(snapshot.readyRemaining ?? READY_DURATION, 0, READY_DURATION)
        : 0;
      this.paddleX = snapshot.paddleX;
      this.targetPaddleX = snapshot.targetPaddleX;
      this.autoPilotRemaining = snapshot.autoPilotRemaining ?? 0;
      this.ballSpeedMultiplier = snapshot.ballSpeedMultiplier ?? 1;
    }

    this.createRigidBodies(snapshot);
    this.createWalls();
    this.createBricks(snapshot?.bricks);

    if (this.phase !== 'playing') {
      this.holdBallOnPaddle();
    }
  }

  step(delta: number, input: BreakoutInput): BreakoutoutoutEvent[] {
    const events: BreakoutoutoutEvent[] = [];
    this.updatePaddle(delta, input);

    if (this.phase === 'ready') {
      this.holdBallOnPaddle();
      this.readyRemaining = Math.max(0, this.readyRemaining - delta * this.gameSpeed);
      if (this.readyRemaining <= 0) {
        events.push(...this.launchOrAdvance());
      }
      return events;
    }

    if (this.phase !== 'playing') {
      this.holdBallOnPaddle();
      return events;
    }

    this.world.timestep = delta;
    this.world.step(this.eventQueue);
    if (!this.persistentAutopilot) {
      this.autoPilotRemaining = Math.max(0, this.autoPilotRemaining - delta * this.gameSpeed);
    }
    events.push(...this.resolveCollisions());
    if (this.phase === 'playing') {
      this.keepBallPlanar();
    }
    return events;
  }

  launchOrAdvance(): BreakoutoutoutEvent[] {
    if (this.phase !== 'ready' || this.gameSpeed <= MIN_MOVING_BALL_SPEED) {
      return [];
    }

    const angle = -0.38 + Math.random() * 0.76;
    this.phase = 'playing';
    this.readyRemaining = 0;
    this.ballBody.setLinvel(
      {
        x: Math.sin(angle) * this.launchBallSpeed,
        y: Math.cos(angle) * this.launchBallSpeed,
        z: 0
      },
      true
    );

    return [
      { type: 'sound', name: 'launch' },
      { type: 'state-changed' }
    ];
  }

  restart(): BreakoutoutoutEvent[] {
    if (this.phase === 'game-over' || this.phase === 'cleared') {
      return [];
    }

    this.score = 0;
    this.lives = 3;
    this.setReadyPhase();
    this.paddleX = 0;
    this.targetPaddleX = 0;
    this.autoPilotRemaining = 0;
    this.paddleBody.setNextKinematicTranslation({ x: 0, y: PADDLE_Y, z: 0 });
    this.paddleBody.setTranslation({ x: 0, y: PADDLE_Y, z: 0 }, true);
    this.clearRemainingBricks();
    this.createBricks();
    this.holdBallOnPaddle();
    return [{ type: 'state-changed' }];
  }

  snapshot(): BreakoutoutoutSnapshot {
    const ballPosition = this.ballBody.translation();
    const ballVelocity = this.ballBody.linvel();

    return {
      score: this.score,
      lives: this.lives,
      phase: this.phase,
      readyRemaining: this.readyRemaining,
      paddleX: this.paddleX,
      targetPaddleX: this.targetPaddleX,
      autoPilotRemaining: this.autoPilotRemaining,
      autoPilotActive: this.isAutopilotActive,
      ballSpeedMultiplier: this.ballSpeedMultiplier,
      ball: {
        x: ballPosition.x,
        y: ballPosition.y,
        vx: ballVelocity.x,
        vy: ballVelocity.y
      },
      bricks: this.bricks.map(toBrickSnapshot)
    };
  }

  getRenderState(): BreakoutoutoutRenderState {
    const ballPosition = this.ballBody.translation();
    const ballVelocity = this.ballBody.linvel();

    return {
      id: this.id,
      score: this.score,
      lives: this.lives,
      phase: this.phase,
      readyRemaining: this.readyRemaining,
      paddleX: this.paddleX,
      targetPaddleX: this.targetPaddleX,
      autoPilotRemaining: this.autoPilotRemaining,
      autoPilotActive: this.isAutopilotActive,
      ballSpeedMultiplier: this.ballSpeedMultiplier,
      ball: {
        x: ballPosition.x,
        y: ballPosition.y,
        vx: ballVelocity.x,
        vy: ballVelocity.y
      },
      bricks: this.bricks
    };
  }

  setBallSpeedMultiplier(multiplier: number): void {
    this.rememberBallDirection();
    const factor = multiplier / this.ballSpeedMultiplier;
    this.ballSpeedMultiplier = multiplier;
    const velocity = this.ballBody.linvel();
    const speed = Math.hypot(velocity.x, velocity.y);

    if (speed > MIN_MOVING_BALL_SPEED) {
      this.ballBody.setLinvel({ x: velocity.x * factor, y: velocity.y * factor, z: 0 }, true);
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

    const velocity = this.ballBody.linvel();
    const currentSpeed = Math.hypot(velocity.x, velocity.y);

    if (nextSpeed <= MIN_MOVING_BALL_SPEED) {
      this.ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    if (currentSpeed > MIN_MOVING_BALL_SPEED && previousSpeed > MIN_MOVING_BALL_SPEED) {
      const factor = nextSpeed / previousSpeed;
      this.ballBody.setLinvel({ x: velocity.x * factor, y: velocity.y * factor, z: 0 }, true);
      return;
    }

    this.restoreBallVelocityFromDirection();
  }

  isActive(): boolean {
    return this.phase === 'ready' || this.phase === 'playing';
  }

  isCleared(): boolean {
    return this.phase === 'cleared';
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

  dispose(): void {
    this.clearRemainingBricks();
    this.world.removeRigidBody(this.ballBody);
    this.world.removeRigidBody(this.paddleBody);
  }

  private createRigidBodies(snapshot?: BreakoutoutoutSnapshot): void {
    const paddleX = snapshot?.paddleX ?? 0;
    const ball = snapshot?.ball;

    this.paddleBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(paddleX, PADDLE_Y, 0)
    );
    this.paddleCollider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(PADDLE_WIDTH / 2, PADDLE_HEIGHT / 2, PADDLE_DEPTH / 2)
        .setRestitution(1)
        .setFriction(0)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      this.paddleBody
    );

    this.ballBody = this.world.createRigidBody(
      RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(ball?.x ?? paddleX, ball?.y ?? PADDLE_Y + 0.55, 0)
        .setLinvel(ball?.vx ?? 0, ball?.vy ?? 0, 0)
        .setCcdEnabled(true)
        .setCanSleep(false)
    );
    this.ballCollider = this.world.createCollider(
      RAPIER.ColliderDesc.ball(BALL_RADIUS)
        .setRestitution(1)
        .setFriction(0)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      this.ballBody
    );
  }

  private createWalls(): void {
    const walls = [
      { x: -HALF_WIDTH - WALL_THICKNESS / 2, y: 0, width: WALL_THICKNESS, height: BOARD_HEIGHT + 0.6 },
      { x: HALF_WIDTH + WALL_THICKNESS / 2, y: 0, width: WALL_THICKNESS, height: BOARD_HEIGHT + 0.6 },
      { x: 0, y: HALF_HEIGHT + WALL_THICKNESS / 2, width: BOARD_WIDTH + WALL_THICKNESS * 2, height: WALL_THICKNESS },
      { x: 0, y: -HALF_HEIGHT - WALL_THICKNESS / 2, width: BOARD_WIDTH + WALL_THICKNESS * 2, height: WALL_THICKNESS, isFloor: true }
    ];

    for (const wall of walls) {
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(wall.x, wall.y, 0));
      const collider = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(wall.width / 2, wall.height / 2, PADDLE_DEPTH / 2)
          .setRestitution(1)
          .setFriction(0)
          .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
        body
      );

      if (wall.isFloor) {
        this.floorCollider = collider;
      }
    }
  }

  private createBricks(brickSnapshots?: BrickSnapshot[]): void {
    const snapshots = brickSnapshots ?? createFreshBrickSnapshots(this.specialBrickKinds);
    this.bricks = snapshots.map((snapshot) => ({ ...snapshot }));
    this.brickByCollider.clear();

    for (const brick of this.bricks) {
      if (!brick.hit) {
        this.attachBrickBody(brick);
      }
    }
  }

  private attachBrickBody(brick: Brick): void {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(brick.x, brick.y, 0));
    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(brick.width / 2, brick.height / 2, BRICK_DEPTH / 2)
        .setRestitution(1)
        .setFriction(0)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),
      body
    );
    brick.body = body;
    brick.collider = collider;
    this.brickByCollider.set(collider.handle, brick);
  }

  private updatePaddle(delta: number, input: BreakoutInput): void {
    const maxStep = PADDLE_SPEED * this.gameSpeed * delta;

    if (this.phase === 'playing' && this.isAutopilotActive) {
      const ballX = this.ballBody.translation().x;
      const step = clamp(ballX - this.paddleX, -maxStep, maxStep);
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
    this.paddleBody.setNextKinematicTranslation({ x: this.paddleX, y: PADDLE_Y, z: 0 });

    if (this.phase !== 'playing') {
      this.paddleBody.setTranslation({ x: this.paddleX, y: PADDLE_Y, z: 0 }, true);
      this.holdBallOnPaddle();
    }
  }

  private holdBallOnPaddle(): void {
    this.ballBody.setTranslation({ x: this.paddleX, y: PADDLE_Y + 0.56, z: 0 }, true);
    this.ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
  }

  private setReadyPhase(): void {
    this.phase = 'ready';
    this.readyRemaining = READY_DURATION;
  }

  private resolveCollisions(): BreakoutoutoutEvent[] {
    const events: BreakoutoutoutEvent[] = [];
    const bricksToRemove = new Set<Brick>();
    let touchedPaddle = false;
    let touchedWall = false;
    let touchedFloor = false;

    this.eventQueue.drainCollisionEvents((handleA: number, handleB: number, started: boolean) => {
      if (!started) {
        return;
      }

      const hasBall = handleA === this.ballCollider.handle || handleB === this.ballCollider.handle;
      if (!hasBall) {
        return;
      }

      const otherHandle = handleA === this.ballCollider.handle ? handleB : handleA;
      const brick = this.brickByCollider.get(otherHandle);
      if (brick && !brick.hit) {
        bricksToRemove.add(brick);
        return;
      }

      if (otherHandle === this.floorCollider.handle) {
        touchedFloor = true;
      } else if (otherHandle === this.paddleCollider.handle) {
        touchedPaddle = true;
      } else {
        touchedWall = true;
      }
    });

    if (touchedFloor) {
      return this.loseLife();
    }

    if (touchedPaddle) {
      this.applyPaddleBounce();
      events.push({ type: 'sound', name: 'paddle' });
    }

    if (touchedWall && bricksToRemove.size === 0) {
      events.push({ type: 'sound', name: 'wall' });
    }

    for (const brick of bricksToRemove) {
      events.push(...this.removeBrick(brick));
    }

    return events;
  }

  private applyPaddleBounce(): void {
    const ballPosition = this.ballBody.translation();
    const centeredOffset = (ballPosition.x - this.paddleX) / (PADDLE_WIDTH / 2);
    const offset = this.paddleBounceOffset(centeredOffset);
    const speed = Math.max(this.paddleBounceBallSpeed, this.currentBallSpeed);
    const angle = offset * 1.04;
    this.ballBody.setLinvel({ x: Math.sin(angle) * speed, y: Math.cos(angle) * speed, z: 0 }, true);
    this.ballBody.setTranslation({ x: ballPosition.x, y: Math.max(ballPosition.y, PADDLE_Y + 0.52), z: 0 }, true);
  }

  private removeBrick(brick: Brick): BreakoutoutoutEvent[] {
    const events: BreakoutoutoutEvent[] = [];
    brick.hit = true;

    if (brick.collider) {
      this.brickByCollider.delete(brick.collider.handle);
    }

    if (brick.body) {
      this.world.removeRigidBody(brick.body);
    }

    brick.body = undefined;
    brick.collider = undefined;
    this.score += brick.points;

    events.push({
      type: 'brick-hit',
      x: brick.x,
      y: brick.y,
      color: brick.color,
      kind: brick.kind,
      points: brick.points
    });
    events.push({ type: 'sound', name: getBrickSound(brick.kind) });

    if (brick.kind === 'splitter') {
      events.push({ type: 'split', x: brick.x, y: brick.y, color: brick.color, snapshot: this.snapshot() });
    }

    if (brick.kind === 'autopilot') {
      this.autoPilotRemaining = AUTOPILOT_DURATION;
    }

    if (brick.kind === 'life') {
      this.lives += 1;
    }

    if (this.hasClearedRequiredBricks()) {
      this.clearOptionalSplitterBricks();
      this.phase = 'cleared';
      this.autoPilotRemaining = 0;
      events.push({ type: 'sound', name: 'clear' });
    }

    events.push({ type: 'state-changed' });
    return events;
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
      if (brick.collider) {
        this.brickByCollider.delete(brick.collider.handle);
      }

      if (brick.body) {
        this.world.removeRigidBody(brick.body);
      }

      brick.body = undefined;
      brick.collider = undefined;
    }
  }

  private keepBallPlanar(): void {
    const position = this.ballBody.translation();
    const velocity = this.ballBody.linvel();
    const speed = Math.max(this.currentBallSpeed, this.minimumBallSpeed);

    if (speed <= MIN_MOVING_BALL_SPEED) {
      this.ballBody.setTranslation({ x: position.x, y: position.y, z: 0 }, true);
      this.ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    const planarSpeed = Math.hypot(velocity.x, velocity.y) || speed;
    const normalizedX = velocity.x / planarSpeed;
    const normalizedY = velocity.y / planarSpeed;
    this.lastBallDirectionX = normalizedX;
    this.lastBallDirectionY = normalizedY;

    this.ballBody.setTranslation({ x: position.x, y: position.y, z: 0 }, true);
    this.ballBody.setLinvel(
      {
        x: normalizedX * speed,
        y: Math.abs(normalizedY) < 0.18 ? Math.sign(normalizedY || 1) * speed * 0.18 : normalizedY * speed,
        z: 0
      },
      true
    );
  }

  private loseLife(): BreakoutoutoutEvent[] {
    if (this.sandbox) {
      this.setReadyPhase();
      this.autoPilotRemaining = 0;
      this.holdBallOnPaddle();
      return [
        { type: 'sound', name: 'life' },
        { type: 'state-changed' }
      ];
    }

    this.lives -= 1;
    if (this.lives > 0) {
      this.setReadyPhase();
    } else {
      this.phase = 'game-over';
      this.readyRemaining = 0;
    }
    this.autoPilotRemaining = 0;
    this.holdBallOnPaddle();
    return [
      { type: 'sound', name: 'life' },
      { type: 'state-changed' }
    ];
  }

  private clearRemainingBricks(): void {
    for (const brick of this.bricks) {
      if (!brick.hit && brick.body) {
        this.world.removeRigidBody(brick.body);
      }
      brick.body = undefined;
      brick.collider = undefined;
    }
    this.bricks = [];
    this.brickByCollider.clear();
  }

  private get minPaddleX(): number {
    return -HALF_WIDTH + WALL_THICKNESS + PADDLE_WIDTH / 2;
  }

  private get maxPaddleX(): number {
    return HALF_WIDTH - WALL_THICKNESS - PADDLE_WIDTH / 2;
  }

  private get currentBallSpeed(): number {
    const velocity = this.ballBody.linvel();
    return Math.hypot(velocity.x, velocity.y);
  }

  private get launchBallSpeed(): number {
    return BALL_SPEED * this.ballSpeedMultiplier * this.gameSpeed;
  }

  private get minimumBallSpeed(): number {
    return BALL_SPEED * this.ballSpeedMultiplier * this.gameSpeed;
  }

  private get paddleBounceBallSpeed(): number {
    return BALL_SPEED * this.ballSpeedMultiplier * this.gameSpeed;
  }

  private get isAutopilotActive(): boolean {
    return this.phase !== 'game-over'
      && this.phase !== 'cleared'
      && (this.persistentAutopilot || this.autoPilotRemaining > 0);
  }

  private paddleBounceOffset(centeredOffset: number): number {
    if (!this.isAutopilotActive) {
      return clamp(centeredOffset, -1, 1);
    }

    const sign = Math.random() < 0.5 ? -1 : 1;
    const randomOffset = sign * (AUTOPILOT_BOUNCE_OFFSET_MIN + Math.random() * AUTOPILOT_BOUNCE_OFFSET_RANGE);
    const offset = clamp(centeredOffset + randomOffset, -1, 1);
    return Math.abs(offset) < AUTOPILOT_BOUNCE_OFFSET_MIN ? sign * AUTOPILOT_BOUNCE_OFFSET_MIN : offset;
  }

  private rememberBallDirection(): void {
    const velocity = this.ballBody.linvel();
    const speed = Math.hypot(velocity.x, velocity.y);

    if (speed <= MIN_MOVING_BALL_SPEED) {
      return;
    }

    this.lastBallDirectionX = velocity.x / speed;
    this.lastBallDirectionY = velocity.y / speed;
  }

  private restoreBallVelocityFromDirection(): void {
    const speed = this.minimumBallSpeed;
    if (speed <= MIN_MOVING_BALL_SPEED) {
      this.ballBody.setLinvel({ x: 0, y: 0, z: 0 }, true);
      return;
    }

    this.ballBody.setLinvel(
      {
        x: this.lastBallDirectionX * speed,
        y: this.lastBallDirectionY * speed,
        z: 0
      },
      true
    );
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
  }

  return additions;
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

  return palette[row % palette.length];
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
  const { body: _body, collider: _collider, ...snapshot } = brick;
  return snapshot;
}

function createSpecialBrickKindSet(kinds: readonly SpecialBrickKind[] | undefined): ReadonlySet<SpecialBrickKind> {
  return new Set(kinds ?? SPECIAL_BRICK_KINDS);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
