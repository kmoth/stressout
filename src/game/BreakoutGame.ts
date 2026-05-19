import * as THREE from 'three/webgpu';
import { posterize, replaceDefaultUV, screenSize, uniform } from 'three/tsl';
import { barrelUV, colorBleeding, scanlines, vignette } from 'three/examples/jsm/tsl/display/CRT.js';
import { retroPass } from 'three/examples/jsm/tsl/display/RetroPassNode.js';
import { circle } from 'three/examples/jsm/tsl/display/Shape.js';
import { bayerDither } from 'three/examples/jsm/tsl/math/Bayer.js';
import Stats from 'three/examples/jsm/libs/stats.module.js';
import System, {
  Alpha,
  Body,
  Color,
  Emitter,
  Life,
  Mass,
  PointZone,
  Position,
  RadialVelocity,
  Radius,
  Rate,
  Scale,
  Span,
  SpriteRenderer,
  Vector3D
} from 'three-nebula';
import {
  BALL_RADIUS,
  BALL_SPEED,
  BallPathProjectionOptions,
  BOARD_HEIGHT,
  BOARD_WIDTH,
  BreakoutInput,
  BreakoutoutoutEvent,
  BreakoutoutoutInstance,
  BreakoutoutoutOptions,
  BreakoutoutoutRenderState,
  BreakoutoutoutSnapshot,
  // BrickKind,
  BrickSnapshot,
  createSplitRealitySnapshot,
  FIXED_STEP,
  HALF_HEIGHT,
  HALF_WIDTH,
  PADDLE_HEIGHT,
  PADDLE_WIDTH,
  PADDLE_Y,
  PLAYFIELD_DEPTH,
  WALL_THICKNESS
} from './BreakoutoutoutInstance';
import {
  createScoreboardAdapter,
  type LeaderboardEntry,
  type ScoreboardAdapter
} from './leaderboard';
import { SoundBank } from './sound';

type ProjectorBeamSettings = {
  color: number;
  opacity: number;
  dotRadius: number;
  dotSpacing: number;
  marchSpeed: number;
  renderOrder: number;
  z: number;
  maxDots: number;
  maxBounces: number;
  maxDistance: number;
  epsilon: number;
  wallGuard: number;
  cornerTolerance: number;
  surfaceClearance: number;
};

type ProjectorBeamSettingKey = keyof ProjectorBeamSettings;
type ProjectorBeamNumericSettingKey = Exclude<ProjectorBeamSettingKey, 'color'>;

const MAX_DT = 1 / 20;
const PLANE_Z_GAP = 5;
const DEFAULT_INITIAL_INSTANCE_COUNT = 1;
const MAX_INITIAL_INSTANCE_COUNT = 24;
const MAIN_MENU_DEMO_INSTANCE_COUNT = 6;
const SPLIT_GAME_SPEED_TWEEN_DURATION = 0.55;
const SPLIT_PLANE_TRAVEL_DURATION = 0.82;
const SPLIT_PLANE_SPAWN_Z_OFFSET = 0.36;
const SPLIT_BLOOM_DURATION = 1.2;
const SPLIT_GLOW_BASE_OPACITY = 0.3;
const BALL_SPEED_ACTIVE_GAME_SCALE = 0.5;
const DEFAULT_BALL_SPEED_MULTIPLIER_ACTIVE_GAME_CAP = 4;
const BALL_SPEED_MULTIPLIER_TWEEN_DURATION = 2;
const BALL_SPEED_MULTIPLIER_EPSILON = 0.0001;
const FATAL_MISS_BALL_SPEED_MULTIPLIER = 0.035;
const FATAL_MISS_BALL_SPEED_TWEEN_DURATION = 0.28;
const FATAL_MISS_DANGER_COLOR = 0xff1f2d;
const FATAL_MISS_DANGER_EMISSIVE = 0xff0000;
const FATAL_MISS_DANGER_PERIOD = 1.65;
const CAMERA_FOV = 59;
const CAMERA_DISTANCE_PADDING = 1.24;
const CAMERA_ELEVATION = 0;
const CAMERA_PARALLAX_X = 1.64;
const CAMERA_PARALLAX_Y = 1.12;
const CAMERA_PLANE_TRANSITION_DURATION = 0.9;
const CAMERA_PLANE_TRANSITION_EPSILON = 0.001;
const GAME_OVER_CAMERA_ZOOM = 0.72;
const GAME_OVER_CAMERA_TRACK_X = 0.58;
const GAME_OVER_CAMERA_TRACK_Y = 0.64;
const GAME_OVER_CAMERA_PAN_REMAINING_PER_SECOND = 0.08;
const GAME_OVER_CAMERA_ZOOM_REMAINING_PER_SECOND = 0.12;
const GAME_OVER_CAMERA_SHAKE_RAMP_DURATION = 0.82;
const GAME_OVER_CAMERA_SHAKE_X = 0.1;
const GAME_OVER_CAMERA_SHAKE_Y = 0.1;
const GAME_OVER_CAMERA_SHAKE_ROLL = 0.000;
const AUTOPILOT_SELECTION_COOLDOWN = 1;
const AUTOPILOT_SELECTION_PADDLE_APPROACH_DISTANCE = 2.25;
const AUTOPILOT_SELECTION_MIN_APPROACH_SPEED = 0.05;
const TOUCH_SWIPE_MIN_DISTANCE = 44;
const TOUCH_SWIPE_AXIS_RATIO = 1.15;
const SELECTED_OPACITY = 1;
const SLOT_A_OPACITY = 0.08;
const BACKGROUND_OPACITY = 0.15;
const INSTANCE_OPACITY_TWEEN_DURATION = 0.45;
const INSTANCE_OPACITY_EPSILON = 0.001;
const SOUND_MIN_VOLUME = 0.12;
const SOUND_ATTENUATION_DISTANCE = PLANE_Z_GAP * 2.2;
const PADDLE_COLOR = 0xe8f8f6;
const PADDLE_EMISSIVE = 0x1fbfb1;
const PADDLE_AUTOPILOT_COLOR = 0xeafffb;
const PADDLE_AUTOPILOT_EMISSIVE = 0x34d399;
const PADDLE_BASE_EMISSIVE_INTENSITY = 0.28;
const TRAJECTORY_PROJECTION_COLOR = 0x7dd3fc;
const TRAJECTORY_PROJECTION_OPACITY = 0.86;
const TRAJECTORY_PROJECTION_DOT_RADIUS = 0.058;
const TRAJECTORY_PROJECTION_DOT_SPACING = 0.2;
const TRAJECTORY_PROJECTION_MARCH_SPEED = 0.60;
const TRAJECTORY_PROJECTION_RENDER_ORDER = 24;
const TRAJECTORY_PROJECTION_Z = 0.33;
const TRAJECTORY_PROJECTION_MAX_DOTS = 320;
const TRAJECTORY_PROJECTION_MAX_DOTS_LIMIT = 640;
const TRAJECTORY_PROJECTION_MAX_BOUNCES = 52;
const TRAJECTORY_PROJECTION_MAX_DISTANCE = 260;
const TRAJECTORY_PROJECTION_EPSILON = 0.0001;
const TRAJECTORY_PROJECTION_WALL_GUARD = 0.045;
const TRAJECTORY_PROJECTION_CORNER_TOLERANCE = 0.018;
const TRAJECTORY_PROJECTION_SURFACE_CLEARANCE = 0.008;
const TRAJECTORY_PROJECTION_CACHE_MAX_BALL_DRIFT = BALL_RADIUS * 1.35;
const TRAJECTORY_PROJECTION_SIMULATION_SECONDS = 8;
const TRAJECTORY_PROJECTION_SIMULATION_SAMPLE_SPACING = 0.18;
const PROJECTOR_DEBUG_BRICK_COUNT = 34;
const PROJECTOR_DEBUG_BRICK_MIN_WIDTH = 0.56;
const PROJECTOR_DEBUG_BRICK_MAX_WIDTH = 1.34;
const PROJECTOR_DEBUG_BRICK_MIN_HEIGHT = 0.32;
const PROJECTOR_DEBUG_BRICK_MAX_HEIGHT = 0.6;
const PROJECTOR_DEBUG_BRICK_GAP = 0.16;
const PROJECTOR_DEBUG_MIN_Y = PADDLE_Y + 1.35;
const PROJECTOR_DEBUG_MAX_Y = HALF_HEIGHT - 1.05;
const PROJECTOR_DEBUG_ANGLE_SPEED = 1.45;
const PROJECTOR_DEBUG_ANGLE_STEP = 0.08;
const PROJECTOR_DEBUG_MAX_ANGLE = Math.PI * 0.46;
const PROJECTOR_DEBUG_BEAM_SPEED = 1;
const PROJECTOR_DEBUG_TEST_BALL_SPEED = BALL_SPEED;
const PROJECTOR_DEBUG_TEST_MAX_COLLISIONS_PER_FRAME = 8;
const PROJECTOR_DEBUG_COLORS = [0xf45b69, 0xf59f00, 0xf7d154, 0x2ec4b6, 0x4cc9f0, 0xa78bfa, 0x38bdf8] as const;
const PROJECTOR_BEAM_DEFAULTS: ProjectorBeamSettings = {
  color: TRAJECTORY_PROJECTION_COLOR,
  opacity: TRAJECTORY_PROJECTION_OPACITY,
  dotRadius: TRAJECTORY_PROJECTION_DOT_RADIUS,
  dotSpacing: TRAJECTORY_PROJECTION_DOT_SPACING,
  marchSpeed: TRAJECTORY_PROJECTION_MARCH_SPEED,
  renderOrder: TRAJECTORY_PROJECTION_RENDER_ORDER,
  z: TRAJECTORY_PROJECTION_Z,
  maxDots: TRAJECTORY_PROJECTION_MAX_DOTS,
  maxBounces: TRAJECTORY_PROJECTION_MAX_BOUNCES,
  maxDistance: TRAJECTORY_PROJECTION_MAX_DISTANCE,
  epsilon: TRAJECTORY_PROJECTION_EPSILON,
  wallGuard: TRAJECTORY_PROJECTION_WALL_GUARD,
  cornerTolerance: TRAJECTORY_PROJECTION_CORNER_TOLERANCE,
  surfaceClearance: TRAJECTORY_PROJECTION_SURFACE_CLEARANCE
};
const HUD_TEXTURE_SCALE = 2;
const HUD_FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const PLANE_HUD_RENDER_ORDER = 80;
const PLANE_STATUS_WORLD_HEIGHT = 1.35;
const PLANE_STATUS_MAX_WIDTH = BOARD_WIDTH - 1.2;
const PLANE_STATUS_Y = -1.05;
const PLANE_STATUS_Z = 0.88;
const PLANE_RESTART_WORLD_HEIGHT = 0.9;
const PLANE_RESTART_MAX_WIDTH = 6.4;
const PLANE_RESTART_Y = -2.95;
const PLANE_RESTART_Z = 0.9;
const LEADERBOARD_NAME_MAX_LENGTH = 6;
const LEADERBOARD_PANEL_WORLD_HEIGHT = 5.65;
const LEADERBOARD_PANEL_MAX_WIDTH = 7.7;
const LEADERBOARD_PANEL_Y = 2.28;
const LEADERBOARD_PANEL_Z = 0.98;
const PLANE_CORNER_HUD_Z = 0.92;
const PLANE_CORNER_HUD_GAP = 0.28;
const PLANE_SCORE_WORLD_HEIGHT = 0.84;
const PLANE_SCORE_MAX_WIDTH = 9.6;
const PLANE_HEART_WORLD_HEIGHT = 0.68;
const PLANE_HEART_MAX_WIDTH = 7.6;
const MAIN_MENU_RENDER_ORDER = 120;
const MAIN_MENU_CAMERA_DISTANCE = 18.5;
const MAIN_MENU_TITLE_WORLD_HEIGHT = 1.2;
const MAIN_MENU_TITLE_MAX_WIDTH = 9.6;
const MAIN_MENU_TITLE_Y = 1.52;
const MAIN_MENU_SUBTITLE_WORLD_HEIGHT = 0.42;
const MAIN_MENU_SUBTITLE_MAX_WIDTH = 6.8;
const MAIN_MENU_SUBTITLE_Y = 0.62;
const MAIN_MENU_BUTTON_WORLD_HEIGHT = 1.02;
const MAIN_MENU_BUTTON_MAX_WIDTH = 5.35;
const MAIN_MENU_START_BUTTON_Y = -0.68;
const MAIN_MENU_BUTTON_Z = 0.18;
const PAUSE_MENU_RENDER_ORDER = MAIN_MENU_RENDER_ORDER + 10;
const PAUSE_MENU_CAMERA_DISTANCE = MAIN_MENU_CAMERA_DISTANCE - 0.2;
const PAUSE_MENU_PANEL_WORLD_HEIGHT = 3.15;
const PAUSE_MENU_PANEL_MAX_WIDTH = 6.55;
const PAUSE_MENU_TITLE_WORLD_HEIGHT = 0.68;
const PAUSE_MENU_TITLE_MAX_WIDTH = 4.8;
const PAUSE_MENU_TITLE_Y = 0.58;
const PAUSE_MENU_BUTTON_WORLD_HEIGHT = 0.86;
const PAUSE_MENU_BUTTON_MAX_WIDTH = 4.5;
const PAUSE_MENU_BUTTON_Y = -0.58;
const PAUSE_MENU_Z = MAIN_MENU_BUTTON_Z + 0.22;
const SPLIT_TUTORIAL_STORAGE_KEY = 'breakoutoutout.splitTutorialSeen';
const SPLIT_TUTORIAL_DURATION = 5;
const SPLIT_TUTORIAL_WORLD_HEIGHT = 1.18;
const SPLIT_TUTORIAL_MAX_WIDTH = 8.8;
const SPLIT_TUTORIAL_Z_OFFSET = 1.1;
// Change this value to tune the visual z-thickness of the playfield box meshes.
const PLAYFIELD_MESH_DEPTH = PLAYFIELD_DEPTH;
const PLAYFIELD_MESH_DEPTH_BASELINE = 0.55;
const RENDER_MESH_DEPTHS = {
  playfield: PLAYFIELD_MESH_DEPTH,
  backboard: PLAYFIELD_MESH_DEPTH * (0.2 / PLAYFIELD_MESH_DEPTH_BASELINE),
  boardMarker: PLAYFIELD_MESH_DEPTH * (0.04 / PLAYFIELD_MESH_DEPTH_BASELINE)
} as const;
const IDLE_INPUT: BreakoutInput = { left: false, right: false };
// const POST_PROCESSING_DEFAULTS: PostProcessingSettings = {
//   pixelSize: 3,
//   colorLevels: 7,
//   scanlineStrength: 0.16,
//   scanlineDensity: 1,
//   scanlineSpeed: 0,
//   vignetteStrength: 0.36,
//   vignetteSmoothness: 0.48,
//   colorBleeding: 0.00115,
//   barrelCurvature: 0.02,
//   affineDistortion: 0
// };
const POST_PROCESSING_DEFAULTS: PostProcessingSettings = {
  pixelSize: 3,
  colorLevels: 32,
  scanlineStrength: 0.6,
  scanlineDensity: 0.9,
  scanlineSpeed: -0.85,
  vignetteStrength: 0.2,
  vignetteSmoothness: 0.35,
  colorBleeding: 0.0016,
  barrelCurvature: 0.036,
  affineDistortion: 0.28
};
const POST_PROCESSING_REFERENCE_SHORT_SIDE = 720;
const POST_PROCESSING_REFERENCE_WIDTH = 1280;
const POST_PROCESSING_MIN_SCREEN_SCALE = 0.42;
const POST_PROCESSING_CONTROLS: readonly PostProcessingControlDefinition[] = [
  { key: 'pixelSize', label: 'Pixel size', min: 1, max: 8, step: 1, decimals: 0 },
  { key: 'colorLevels', label: 'Color levels', min: 2, max: 32, step: 1, decimals: 0 },
  { key: 'scanlineStrength', label: 'Scanline strength', min: 0, max: 0.6, step: 0.01, decimals: 2 },
  { key: 'scanlineDensity', label: 'Scanline density', min: 0, max: 3, step: 0.05, decimals: 2 },
  { key: 'scanlineSpeed', label: 'Scanline speed', min: -3, max: 3, step: 0.05, decimals: 2 },
  { key: 'vignetteStrength', label: 'Vignette strength', min: 0, max: 0.9, step: 0.01, decimals: 2 },
  { key: 'vignetteSmoothness', label: 'Vignette smoothness', min: 0.1, max: 1.2, step: 0.01, decimals: 2 },
  { key: 'colorBleeding', label: 'Color bleeding', min: 0, max: 0.008, step: 0.00005, decimals: 5 },
  { key: 'barrelCurvature', label: 'Barrel curvature', min: 0, max: 0.18, step: 0.002, decimals: 3 },
  { key: 'affineDistortion', label: 'Affine distortion', min: 0, max: 1, step: 0.01, decimals: 2 }
];
const PHASE_STATUS_LABEL = {
  ready: 'READY',
  playing: '',
  cleared: 'CLEARED',
  'game-over': 'GAME OVER'
} satisfies Record<BreakoutoutoutRenderState['phase'], string>;

type PostProcessingSettings = {
  pixelSize: number;
  colorLevels: number;
  scanlineStrength: number;
  scanlineDensity: number;
  scanlineSpeed: number;
  vignetteStrength: number;
  vignetteSmoothness: number;
  colorBleeding: number;
  barrelCurvature: number;
  affineDistortion: number;
};

type PostProcessingSettingKey = keyof PostProcessingSettings;

type PostProcessingControlDefinition = {
  key: PostProcessingSettingKey;
  label: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
};

type ProjectorBeamControlDefinition = {
  key: ProjectorBeamNumericSettingKey;
  label: string;
  min: number;
  max: number;
  step: number;
  decimals: number;
};

const PROJECTOR_BEAM_CONTROLS: readonly ProjectorBeamControlDefinition[] = [
  { key: 'opacity', label: 'Opacity', min: 0.05, max: 1, step: 0.01, decimals: 2 },
  { key: 'dotRadius', label: 'Dot radius', min: 0.01, max: 0.16, step: 0.001, decimals: 3 },
  { key: 'dotSpacing', label: 'Dot spacing', min: 0.08, max: 1.2, step: 0.01, decimals: 2 },
  { key: 'marchSpeed', label: 'March speed', min: -4, max: 4, step: 0.01, decimals: 2 },
  { key: 'renderOrder', label: 'Render order', min: 0, max: 120, step: 1, decimals: 0 },
  { key: 'z', label: 'Render depth', min: -0.2, max: 1.2, step: 0.01, decimals: 2 },
  { key: 'maxDots', label: 'Max dots', min: 8, max: TRAJECTORY_PROJECTION_MAX_DOTS_LIMIT, step: 1, decimals: 0 },
  { key: 'maxBounces', label: 'Max bounces', min: 1, max: 160, step: 1, decimals: 0 },
  { key: 'maxDistance', label: 'Max distance', min: 8, max: 520, step: 1, decimals: 0 },
  { key: 'epsilon', label: 'Epsilon', min: 0.00001, max: 0.02, step: 0.00001, decimals: 5 },
  { key: 'wallGuard', label: 'Wall guard', min: 0, max: 0.3, step: 0.001, decimals: 3 },
  { key: 'cornerTolerance', label: 'Corner tolerance', min: 0, max: 0.12, step: 0.001, decimals: 3 },
  { key: 'surfaceClearance', label: 'Surface clearance', min: 0.0005, max: 0.05, step: 0.0005, decimals: 4 }
] as const;

type PostProcessingUniforms = {
  colorLevels: THREE.UniformNode<'float', number>;
  scanlineStrength: THREE.UniformNode<'float', number>;
  scanlineDensity: THREE.UniformNode<'float', number>;
  scanlineSpeed: THREE.UniformNode<'float', number>;
  vignetteStrength: THREE.UniformNode<'float', number>;
  vignetteSmoothness: THREE.UniformNode<'float', number>;
  colorBleeding: THREE.UniformNode<'float', number>;
  barrelCurvature: THREE.UniformNode<'float', number>;
  affineDistortion: THREE.UniformNode<'float', number>;
};

type NebulaRuntime = {
  system: any;
  api: {
    Alpha: any;
    Body: any;
    Color: any;
    Emitter: any;
    Life: any;
    Mass: any;
    PointZone: any;
    Position: any;
    RadialVelocity: any;
    Radius: any;
    Rate: any;
    Scale: any;
    Span: any;
    Vector3D: any;
  };
};

type PlaneZTransition = {
  from: number;
  to: number;
  elapsed: number;
  duration: number;
  selectOnComplete: boolean;
  resumeSplitOnComplete?: boolean;
};

type CameraPlaneTransition = {
  from: number;
  to: number;
  elapsed: number;
  duration: number;
};

type GameSpeedTween = {
  from: number;
  to: number;
  elapsed: number;
  duration: number;
  onComplete?: () => void;
};

type BallSpeedMultiplierTween = {
  from: number;
  to: number;
  elapsed: number;
  duration: number;
};

type InstanceOpacityTween = {
  from: number;
  to: number;
  elapsed: number;
  duration: number;
};

type PendingSplit = {
  source: BreakoutoutoutInstance;
  snapshot: BreakoutoutoutSnapshot;
  selectCloneOnComplete: boolean;
};

type SplitBloomPulse = {
  instance: BreakoutoutoutInstance;
  elapsed: number;
  duration: number;
  strength: number;
};

type SplitGlowMesh = {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  baseScale: number;
  pulseScale: number;
};

type TrajectoryPoint = {
  x: number;
  y: number;
};

type TrajectoryObstacle = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TrajectoryHit = {
  distance: number;
  normalX: number;
  normalY: number;
  brickIndex?: number;
};

type TrajectorySegment = {
  start: TrajectoryPoint;
  end: TrajectoryPoint;
  length: number;
  distanceStart: number;
};

type TrajectoryProjectionCache = {
  key: string;
  points: TrajectoryPoint[];
  visibleStartDistance: number;
};

type ProjectorDebugBall = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

type DesiredPlaneView = {
  instance: BreakoutoutoutInstance;
  trackIndex: number;
};

type InstanceSelection = {
  index: number;
  trackOffset: number;
};

type MainMenuAction = 'start';

type PauseMenuAction = 'resume';

type MenuButtonAction = MainMenuAction | PauseMenuAction;

type SplitTutorialMode = 'keyboard' | 'touch';

type LeaderboardLoadState = 'loading' | 'ready' | 'unavailable';

type LeaderboardSubmissionState = 'entry' | 'submitting' | 'submitted' | 'error';

type LeaderboardSubmission = {
  score: number;
  name: string;
  state: LeaderboardSubmissionState;
  message?: string;
};

type LeaderboardPanelMode = Exclude<LeaderboardLoadState, 'ready'> | LeaderboardSubmissionState | 'view';

type LeaderboardPanelState = {
  mode: LeaderboardPanelMode;
  entries: readonly LeaderboardEntry[];
  score: number;
  name: string;
  message: string;
};

type InstanceView = {
  instance: BreakoutoutoutInstance;
  group: THREE.Group;
  trackIndex: number;
  paddleMesh: THREE.Mesh;
  ballMesh: THREE.Mesh;
  trajectoryProjection: TrajectoryProjection;
  wallMeshes: THREE.Mesh[];
  bricks: Map<string, THREE.Mesh>;
  activeBrickIds: Set<string>;
  splitGlowMeshes: SplitGlowMesh[];
  scoreText: HudTextPlane;
  hearts: HudHeartsPlane;
  statusText: HudTextPlane;
  restartButtonText: HudTextPlane;
  leaderboardPanel: LeaderboardPanelPlane;
  renderState: BreakoutoutoutRenderState;
  trajectoryProjectionCache: TrajectoryProjectionCache | null;
  appliedOpacity: number;
  targetOpacity: number;
  terminalVisualsApplied: boolean;
  dangerVisualsApplied: boolean;
  fatalGreyscaleApplied: boolean;
  opacityTween?: InstanceOpacityTween;
  zTransition?: PlaneZTransition;
};

export type BreakoutGameOptions = Pick<BreakoutoutoutOptions, 'autopilot' | 'sandbox' | 'specialBrickKinds'> & {
  initialInstanceCount?: number;
  ballSpeedMultiplierActiveGameCap?: number;
  projectorDebug?: boolean;
  pathProjectionDebug?: boolean;
};

export class BreakoutGame {
  private readonly shell: HTMLDivElement;
  private readonly pauseButton: HTMLButtonElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 180);
  private readonly renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true });
  private readonly renderPipeline: THREE.RenderPipeline;
  private readonly retroScenePass: ReturnType<typeof retroPass>;
  private readonly postProcessingUniforms: PostProcessingUniforms;
  private readonly postProcessingPanel: PostProcessingPanel;
  private readonly projectorBeamPanel: ProjectorBeamPanel | null = null;
  private readonly mainMenu: MainMenuView;
  private readonly pauseMenu: PauseMenuView;
  private readonly splitTutorial = new SplitTutorialView(MAIN_MENU_RENDER_ORDER + 6);
  private readonly scoreboard: ScoreboardAdapter = createScoreboardAdapter();
  private readonly stats = new Stats();
  private readonly sound = new SoundBank();
  private readonly keys = new Set<string>();
  private readonly pointerRaycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private readonly pointerBoardPlane = new THREE.Plane();
  private readonly pointerBoardNormal = new THREE.Vector3();
  private readonly pointerBoardPoint = new THREE.Vector3();
  private readonly pointerBoardHit = new THREE.Vector3();
  private readonly pointerLocalHit = new THREE.Vector3();
  private readonly pointerBoardQuaternion = new THREE.Quaternion();
  private readonly planeHudParentQuaternion = new THREE.Quaternion();
  private readonly planeHudCameraQuaternion = new THREE.Quaternion();
  // private readonly particleTexture: THREE.CanvasTexture;
  private readonly initialInstanceCount: number;
  private readonly autopilot: boolean;
  private readonly projectorDebug: boolean;
  private readonly pathProjectionDebug: boolean;
  private readonly ballSpeedMultiplierActiveGameCap: number;
  private readonly instanceOptions: BreakoutoutoutOptions;
  private readonly instanceSoundPosition = new THREE.Vector3();
  private readonly instances: BreakoutoutoutInstance[] = [];
  private readonly views = new Set<InstanceView>();
  private readonly pendingSplits: PendingSplit[] = [];
  private readonly splitBloomPulses: SplitBloomPulse[] = [];
  private readonly splitGlowActiveInstances = new Set<BreakoutoutoutInstance>();
  private readonly ballSpeedMultiplierTargets = new Map<BreakoutoutoutInstance, number>();
  private readonly ballSpeedMultiplierTweens = new Map<BreakoutoutoutInstance, BallSpeedMultiplierTween>();
  private readonly postProcessingSettings: PostProcessingSettings = { ...POST_PROCESSING_DEFAULTS };
  private readonly projectorBeamSettings: ProjectorBeamSettings = { ...PROJECTOR_BEAM_DEFAULTS };
  private projectorDebugAngle = 0;
  private projectorDebugBricks: BrickSnapshot[] = [];
  private projectorDebugTestBall: ProjectorDebugBall | null = null;

  private nebula: NebulaRuntime | null = null;
  private accumulator = 0;
  private lastTime = performance.now();
  private nextInstanceId = 1;
  private selectedIndex = 0;
  private selectedTrackIndex = 0;
  private lastAutopilotSelectionChangeTime = Number.NEGATIVE_INFINITY;
  private hasNavigatedInstances = false;
  private globalScore = 0;
  private leaderboardLoadState: LeaderboardLoadState = 'loading';
  private leaderboardEntries: LeaderboardEntry[] = [];
  private leaderboardSubmission: LeaderboardSubmission | null = null;
  private leaderboardRefreshId = 0;
  private gameSpeed = 1;
  private gameSpeedTween: GameSpeedTween | null = null;
  private splitSequenceActive = false;
  private fatalMissInstance: BreakoutoutoutInstance | null = null;
  private totalGameOver = false;
  private totalGameCleared = false;
  private gameStarted = false;
  private paused = false;
  private hoveredMenuAction: MainMenuAction | null = null;
  private pressedMenuAction: MainMenuAction | null = null;
  private hoveredPauseMenuAction: PauseMenuAction | null = null;
  private pressedPauseMenuAction: PauseMenuAction | null = null;
  private splitTutorialActive = false;
  private splitTutorialElapsed = 0;
  private splitTutorialSeen = getSplitTutorialSeenFlag();
  private cameraBaseDistance = 24;
  private cameraDistance = 24;
  private cameraFocusX = 0;
  private cameraFocusY = CAMERA_ELEVATION;
  private cameraFocusZ = 0;
  private cameraLookAtX = 0;
  private cameraLookAtY = 0;
  private gameOverCameraElapsed = 0;
  private cameraPlaneTransition: CameraPlaneTransition | null = null;
  private activeTouchPointerId: number | null = null;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchLastX = 0;
  private touchLastY = 0;
  private touchPaddleX: number | null = null;
  private postProcessingScreenScale = 1;
  private postProcessingColorBleedScale = 1;

  private constructor(root: HTMLElement, options: BreakoutGameOptions = {}) {
    this.projectorDebug = options.projectorDebug ?? false;
    this.pathProjectionDebug = options.pathProjectionDebug ?? false;
    this.initialInstanceCount = this.projectorDebug
      ? 1
      : normalizeInitialInstanceCount(options.initialInstanceCount);
    this.autopilot = options.autopilot ?? false;
    if (this.projectorDebug) {
      this.projectorDebugBricks = createProjectorDebugBricks();
    }
    this.ballSpeedMultiplierActiveGameCap = normalizeBallSpeedMultiplierActiveGameCap(
      options.ballSpeedMultiplierActiveGameCap
    );
    this.instanceOptions = {
      autopilot: this.autopilot,
      sandbox: options.sandbox ?? false,
      specialBrickKinds: options.specialBrickKinds
    };
    this.gameStarted = this.autopilot || this.projectorDebug;
    this.shell = document.createElement('div');
    this.shell.className = 'game-shell';
    root.replaceChildren(this.shell);

    this.renderer.domElement.className = 'three-layer';
    this.renderer.domElement.tabIndex = -1;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x07080b, 0);
    this.shell.appendChild(this.renderer.domElement);
    this.pauseButton = this.createPauseButton();
    this.shell.appendChild(this.pauseButton);
    // this.stats.showPanel(0);
    // this.shell.appendChild(this.stats.dom);
    this.scene.add(this.camera);

    this.postProcessingUniforms = createPostProcessingUniforms(this.postProcessingSettings);
    this.retroScenePass = retroPass(this.scene, this.camera, {
      affineDistortion: this.postProcessingUniforms.affineDistortion
    });
    this.applyPostProcessingSettings();
    this.renderPipeline = new THREE.RenderPipeline(this.renderer, this.createRetroPipeline(this.retroScenePass));
    this.postProcessingPanel = new PostProcessingPanel(this.shell, {
      settings: this.postProcessingSettings,
      onChange: (key, value) => this.setPostProcessingSetting(key, value),
      onReset: () => this.resetPostProcessingSettings(),
      onExport: () => this.exportPostProcessingSettings()
    });
    if (this.projectorDebug) {
      this.projectorBeamPanel = new ProjectorBeamPanel(this.shell, {
        settings: this.projectorBeamSettings,
        onNumericChange: (key, value) => this.setProjectorBeamSetting(key, value),
        onColorChange: (color) => this.setProjectorBeamColor(color),
        onReset: () => this.resetProjectorBeamSettings(),
        onExport: () => this.exportProjectorBeamSettings(),
        onLaunchTest: () => this.launchProjectorDebugBall()
      });
    }

    // this.particleTexture = createParticleTexture();
    this.createLighting();
    this.mainMenu = new MainMenuView();
    this.mainMenu.setVisible(!this.gameStarted);
    this.pauseMenu = new PauseMenuView();
    this.pauseMenu.setVisible(false);
    this.scene.add(this.mainMenu.group);
    this.scene.add(this.pauseMenu.group);
    this.scene.add(this.splitTutorial.mesh);
    this.attachInput();
    this.resize();
    void this.refreshLeaderboard();
  }

  private createRetroPipeline(scenePass: ReturnType<typeof retroPass>): THREE.Node {
    const colorLevels = this.postProcessingUniforms.colorLevels;
    const scanlineStrength = this.postProcessingUniforms.scanlineStrength;
    const scanlineDensity = this.postProcessingUniforms.scanlineDensity;
    const scanlineSpeed = this.postProcessingUniforms.scanlineSpeed;
    const vignetteStrength = this.postProcessingUniforms.vignetteStrength;
    const vignetteSmoothness = this.postProcessingUniforms.vignetteSmoothness;
    const colorBleedingAmount = this.postProcessingUniforms.colorBleeding;
    const curvature = this.postProcessingUniforms.barrelCurvature;
    const distortedUv = barrelUV(curvature);
    const distortedDelta = circle(curvature.add(0.1).mul(10), 1).mul(curvature).mul(0.05);
    const warpedPass = replaceDefaultUV(distortedUv, scenePass);
    const bled = colorBleeding(warpedPass, colorBleedingAmount.add(distortedDelta));
    const dithered = bayerDither(bled, colorLevels);
    const quantized = posterize(dithered, colorLevels);
    const vignetted = vignette(quantized, vignetteStrength, vignetteSmoothness, distortedUv);

    return scanlines(
      vignetted,
      scanlineStrength,
      screenSize.y.mul(scanlineDensity),
      scanlineSpeed,
      distortedUv
    );
  }

  private setPostProcessingSetting(key: PostProcessingSettingKey, value: number): void {
    const nextValue = normalizePostProcessingValue(key, value);
    if (this.postProcessingSettings[key] === nextValue) {
      this.postProcessingPanel.setValue(key, nextValue);
      return;
    }

    this.postProcessingSettings[key] = nextValue;
    this.applyPostProcessingSettings();
    this.postProcessingPanel.setValue(key, nextValue);
  }

  private resetPostProcessingSettings(): void {
    for (const control of POST_PROCESSING_CONTROLS) {
      this.postProcessingSettings[control.key] = POST_PROCESSING_DEFAULTS[control.key];
    }

    this.applyPostProcessingSettings();
    this.postProcessingPanel.setSettings(this.postProcessingSettings);
  }

  private applyPostProcessingSettings(): void {
    const settings = this.postProcessingSettings;
    const screenScale = this.postProcessingScreenScale;
    const pixelSize = Math.max(1, settings.pixelSize * screenScale);

    this.retroScenePass.setResolutionScale(1 / pixelSize);
    this.postProcessingUniforms.colorLevels.value = settings.colorLevels;
    this.postProcessingUniforms.scanlineStrength.value = settings.scanlineStrength * screenScale;
    this.postProcessingUniforms.scanlineDensity.value = settings.scanlineDensity;
    this.postProcessingUniforms.scanlineSpeed.value = settings.scanlineSpeed;
    this.postProcessingUniforms.vignetteStrength.value = settings.vignetteStrength * screenScale;
    this.postProcessingUniforms.vignetteSmoothness.value = settings.vignetteSmoothness;
    this.postProcessingUniforms.colorBleeding.value = settings.colorBleeding * this.postProcessingColorBleedScale;
    this.postProcessingUniforms.barrelCurvature.value = settings.barrelCurvature * screenScale;
    this.postProcessingUniforms.affineDistortion.value = settings.affineDistortion * screenScale;
  }

  private exportPostProcessingSettings(): string {
    return `const POST_PROCESSING_DEFAULTS: PostProcessingSettings = ${formatPostProcessingSettings(
      this.postProcessingSettings
    )};`;
  }

  private setProjectorBeamSetting(key: ProjectorBeamNumericSettingKey, value: number): void {
    const nextValue = normalizeProjectorBeamValue(key, value);
    if (this.projectorBeamSettings[key] === nextValue) {
      this.projectorBeamPanel?.setValue(key, nextValue);
      return;
    }

    this.projectorBeamSettings[key] = nextValue;
    this.invalidateTrajectoryProjectionCaches();
    this.projectorBeamPanel?.setValue(key, nextValue);
  }

  private setProjectorBeamColor(color: number): void {
    const nextColor = normalizeProjectorBeamColor(color);
    if (this.projectorBeamSettings.color === nextColor) {
      this.projectorBeamPanel?.setColor(nextColor);
      return;
    }

    this.projectorBeamSettings.color = nextColor;
    this.projectorBeamPanel?.setColor(nextColor);
  }

  private resetProjectorBeamSettings(): void {
    Object.assign(this.projectorBeamSettings, PROJECTOR_BEAM_DEFAULTS);
    this.invalidateTrajectoryProjectionCaches();
    this.projectorBeamPanel?.setSettings(this.projectorBeamSettings);
  }

  private exportProjectorBeamSettings(): string {
    return `const PROJECTOR_BEAM_DEFAULTS: ProjectorBeamSettings = ${formatProjectorBeamSettings(
      this.projectorBeamSettings
    )};`;
  }

  private invalidateTrajectoryProjectionCaches(): void {
    for (const view of this.views) {
      view.trajectoryProjectionCache = null;
      view.trajectoryProjection.resetPhase();
    }
  }

  private invalidateTrajectoryProjectionCacheForInstance(instance: BreakoutoutoutInstance): void {
    for (const view of this.views) {
      if (view.instance !== instance) {
        continue;
      }

      view.trajectoryProjectionCache = null;
      view.trajectoryProjection.resetPhase();
      return;
    }
  }

  static async create(root: HTMLElement, options: BreakoutGameOptions = {}): Promise<BreakoutGame> {
    const game = new BreakoutGame(root, options);
    await game.renderer.init();
    game.createNebulaSystem();
    game.populateInitialInstances();
    requestAnimationFrame(game.tick);
    return game;
  }

  private populateInitialInstances(): void {
    if (this.isMainMenuActive) {
      this.populateInstances(MAIN_MENU_DEMO_INSTANCE_COUNT, this.createMainMenuDemoOptions(), true);
      return;
    }

    this.populateInstances(this.initialInstanceCount, this.instanceOptions);
  }

  private populateInstances(
    count: number,
    options: BreakoutoutoutOptions,
    launchImmediately = false
  ): void {
    for (let index = 0; index < count; index += 1) {
      const snapshot = this.projectorDebug ? this.createProjectorDebugSnapshot() : undefined;
      const instance = new BreakoutoutoutInstance(this.nextInstanceId, snapshot, options);
      if (launchImmediately && !this.projectorDebug) {
        instance.launchOrAdvance();
      }
      this.addInstance(instance);
      this.nextInstanceId += 1;
    }
  }

  private createMainMenuDemoOptions(): BreakoutoutoutOptions {
    return {
      ...this.instanceOptions,
      autopilot: true
    };
  }

  private createNebulaSystem(): void {
    const particleSystem = new System();
    const spriteRenderer = new SpriteRenderer(this.scene, THREE);
    spriteRenderer.logRendererType = () => undefined;
    particleSystem.addRenderer(spriteRenderer);
    this.nebula = {
      system: particleSystem,
      api: {
        Alpha,
        Body,
        Color,
        Emitter,
        Life,
        Mass,
        PointZone,
        Position,
        RadialVelocity,
        Radius,
        Rate,
        Scale,
        Span,
        Vector3D
      }
    };
  }

  private createLighting(): void {
    const ambient = new THREE.AmbientLight(0xb9d6d1, 0.72);
    const key = new THREE.DirectionalLight(0xffffff, 0.86);
    key.position.set(-3, 4, 10);
    const rim = new THREE.DirectionalLight(0x66e1ca, 0.42);
    rim.position.set(5, -6, 7);
    this.scene.add(ambient, key, rim);
  }

  private addInstance(instance: BreakoutoutoutInstance, insertIndex = this.instances.length): InstanceView {
    const previousInstanceCount = this.instances.length;
    const nextIndex = clamp(Math.floor(insertIndex), 0, previousInstanceCount);
    this.instances.splice(nextIndex, 0, instance);
    if (previousInstanceCount > 0 && nextIndex <= this.selectedIndex) {
      this.selectedIndex += 1;
    }

    instance.setGameSpeed(this.gameSpeed);
    this.syncBallSpeedForAll();
    this.reconcilePlaneViews();

    const view = this.viewForInstanceNearestTrack(instance, this.selectedTrackIndex);
    if (!view) {
      throw new Error(`Unable to create a view for instance ${instance.id}.`);
    }

    return view;
  }

  private createInstanceView(instance: BreakoutoutoutInstance, trackIndex: number): InstanceView {
    const state = instance.getRenderState();
    const group = new THREE.Group();
    const paddleMesh = this.createPaddleMesh();
    const ballMesh = this.createBallMesh();
    const trajectoryProjection = new TrajectoryProjection();
    const scoreText = this.createPlaneScoreText();
    const hearts = new HudHeartsPlane({ renderOrder: PLANE_HUD_RENDER_ORDER });
    const statusText = this.createPlaneStatusText();
    const restartButtonText = this.createPlaneRestartButtonText();
    const leaderboardPanel = new LeaderboardPanelPlane(PLANE_HUD_RENDER_ORDER + 2);
    const bricks = new Map<string, THREE.Mesh>();
    const activeBrickIds = new Set<string>();
    const splitGlowMeshes: SplitGlowMesh[] = [];

    const wallMeshes = this.createWalls(group, splitGlowMeshes);
    splitGlowMeshes.push(this.attachSplitGlow(paddleMesh, PADDLE_EMISSIVE, { baseScale: 1.18, pulseScale: 0.42 }));
    splitGlowMeshes.push(this.attachSplitGlow(ballMesh, 0xffe5a8, { baseScale: 1.75, pulseScale: 0.86 }));
    group.add(
      trajectoryProjection.mesh,
      paddleMesh,
      ballMesh,
      scoreText.mesh,
      hearts.mesh,
      statusText.mesh,
      restartButtonText.mesh,
      leaderboardPanel.mesh
    );

    const view: InstanceView = {
      instance,
      group,
      trackIndex,
      paddleMesh,
      ballMesh,
      trajectoryProjection,
      wallMeshes,
      bricks,
      activeBrickIds,
      splitGlowMeshes,
      scoreText,
      hearts,
      statusText,
      restartButtonText,
      leaderboardPanel,
      renderState: state,
      trajectoryProjectionCache: null,
      appliedOpacity: Number.NaN,
      targetOpacity: Number.NaN,
      terminalVisualsApplied: false,
      dangerVisualsApplied: false,
      fatalGreyscaleApplied: false
    };
    group.position.set(0, 0, this.targetPlaneZForTrack(trackIndex));
    this.syncInstanceView(view, state, 0);
    return view;
  }

  private createPlaneScoreText(): HudTextPlane {
    return new HudTextPlane({
      fontSize: 28,
      fill: '#f4f9f8',
      paddingX: 0,
      paddingY: 0,
      renderOrder: PLANE_HUD_RENDER_ORDER
    });
  }

  private createPlaneStatusText(): HudTextPlane {
    return new HudTextPlane({
      fontSize: 44,
      fill: '#ffffff',
      weight: 'bold',
      paddingX: 28,
      paddingY: 14,
      minWidth: 190,
      minHeight: 78,
      // background: 'rgba(7, 8, 11, 0.68)',
      // border: 'rgba(240, 201, 93, 0.86)',
      borderWidth: 1,
      radius: 8,
      renderOrder: PLANE_HUD_RENDER_ORDER
    });
  }

  private createPlaneRestartButtonText(): HudTextPlane {
    return new HudTextPlane({
      fontSize: 36,
      fill: '#08090d',
      weight: 'bold',
      paddingX: 42,
      paddingY: 18,
      minWidth: 240,
      minHeight: 84,
      background: 'rgba(240, 201, 93, 0.92)',
      border: 'rgba(255, 243, 190, 0.96)',
      borderWidth: 2,
      radius: 6,
      renderOrder: PLANE_HUD_RENDER_ORDER + 1
    });
  }

  createBackboard(group: THREE.Group): void {
    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_WIDTH + 0.75, BOARD_HEIGHT + 0.55, RENDER_MESH_DEPTHS.backboard),
      makeFadeableMaterial(new THREE.MeshStandardMaterial({
        color: 0x101116,
        roughness: 0.74,
        metalness: 0.08
      }))
    );
    backing.position.set(0, 0.1, -0.54);
    group.add(backing);

    const laneMaterial = makeFadeableMaterial(new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      transparent: true,
      opacity: 0.16
    }));

    for (let index = 0; index < 7; index += 1) {
      const lane = new THREE.Mesh(
        new THREE.BoxGeometry(0.024, BOARD_HEIGHT - 1.25, RENDER_MESH_DEPTHS.boardMarker),
        laneMaterial.clone()
      );
      lane.position.set(-4.5 + index * 1.5, -0.08, -0.36);
      group.add(lane);
    }

    const warning = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_WIDTH - 1.1, 0.04, RENDER_MESH_DEPTHS.boardMarker),
      makeFadeableMaterial(new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.72 }))
    );
    warning.position.set(0, -7.35, -0.28);
    group.add(warning);
  }

  private createWalls(group: THREE.Group, splitGlowMeshes: SplitGlowMesh[]): THREE.Mesh[] {
    const wallMaterial = makeFadeableMaterial(new THREE.MeshBasicMaterial({
      color: 0x4d8f99
    }));
    const wallMeshes: THREE.Mesh[] = [];
    const walls = [
      { x: -HALF_WIDTH - WALL_THICKNESS / 2, y: 0, width: WALL_THICKNESS, height: BOARD_HEIGHT + 0.6 },
      { x: HALF_WIDTH + WALL_THICKNESS / 2, y: 0, width: WALL_THICKNESS, height: BOARD_HEIGHT + 0.6 },
      { x: 0, y: HALF_HEIGHT + WALL_THICKNESS / 2, width: BOARD_WIDTH + WALL_THICKNESS * 2, height: WALL_THICKNESS },
      { x: 0, y: -HALF_HEIGHT - WALL_THICKNESS / 2, width: BOARD_WIDTH + WALL_THICKNESS * 2, height: WALL_THICKNESS }
    ];

    for (const wall of walls) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(wall.width, wall.height, RENDER_MESH_DEPTHS.playfield),
        wallMaterial.clone()
      );
      mesh.position.set(wall.x, wall.y, -0.04);
      splitGlowMeshes.push(this.attachSplitGlow(mesh, 0x8ce9df, { baseScale: 1.02, pulseScale: 0.08 }));
      wallMeshes.push(mesh);
      group.add(mesh);
    }

    return wallMeshes;
  }

  private createPaddleMesh(): THREE.Mesh {
    return new THREE.Mesh(
      new THREE.BoxGeometry(PADDLE_WIDTH, PADDLE_HEIGHT, RENDER_MESH_DEPTHS.playfield),
      makeFadeableMaterial(new THREE.MeshStandardMaterial({
        color: PADDLE_COLOR,
        emissive: PADDLE_EMISSIVE,
        emissiveIntensity: PADDLE_BASE_EMISSIVE_INTENSITY,
        roughness: 0.32,
        metalness: 0.18
      }))
    );
  }

  private createBallMesh(): THREE.Mesh {
    return new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 32, 18),
      makeFadeableMaterial(new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffe5a8,
        emissiveIntensity: 0.4,
        roughness: 0.22,
        metalness: 0.08
      }))
    );
  }

  private createBrickMesh(brick: BrickSnapshot): THREE.Mesh {
    const isSplitter = brick.kind === 'splitter';
    const isAutopilot = brick.kind === 'autopilot';
    const isLife = brick.kind === 'life';
    const isProjector = brick.kind === 'projector';
    const material = makeFadeableMaterial(new THREE.MeshStandardMaterial({
      color: brick.color,
      emissive: brick.color,
      emissiveIntensity: isSplitter ? 0.7 : isAutopilot ? 0.62 : isLife ? 0.66 : isProjector ? 0.72 : 0.18 + brick.row * 0.018,
      roughness: isSplitter ? 0.24 : isAutopilot ? 0.3 : isLife ? 0.28 : isProjector ? 0.22 : 0.46,
      metalness: isSplitter ? 0.34 : isAutopilot ? 0.22 : isLife ? 0.24 : isProjector ? 0.28 : 0.12
    }));
    return new THREE.Mesh(new THREE.BoxGeometry(brick.width, brick.height, RENDER_MESH_DEPTHS.playfield), material);
  }

  private attachSplitGlow(
    source: THREE.Mesh,
    color: number,
    options: { baseScale: number; pulseScale: number }
  ): SplitGlowMesh {
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false
    });
    const mesh = new THREE.Mesh(source.geometry.clone(), material);
    mesh.frustumCulled = false;
    mesh.visible = false;
    mesh.renderOrder = 4;
    mesh.userData.splitGlow = true;
    mesh.scale.setScalar(options.baseScale);
    source.add(mesh);

    return {
      mesh,
      material,
      baseScale: options.baseScale,
      pulseScale: options.pulseScale
    };
  }

  private attachInput(): void {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('resize', this.resize);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.addEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.addEventListener('pointercancel', this.handlePointerCancel);
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.isLeaderboardEntryActive()) {
      event.preventDefault();
      this.handleLeaderboardEntryKeyDown(event);
      return;
    }

    if (event.code === 'KeyP') {
      event.preventDefault();
      if (!event.repeat) {
        this.setPaused(!this.paused);
      }
      return;
    }

    if (this.isPauseButtonEventTarget(event.target) && (event.code === 'Space' || event.code === 'Enter')) {
      return;
    }

    if (this.paused) {
      if (isGameControlKey(event.code)) {
        event.preventDefault();
      }
      return;
    }

    if (this.splitTutorialActive) {
      if (isGameControlKey(event.code)) {
        event.preventDefault();
      }
      return;
    }

    if (this.isMainMenuActive) {
      if (event.code === 'Space' || event.code === 'Enter') {
        event.preventDefault();
        if (!event.repeat) {
          this.startGameFromMenu();
        }
        return;
      }

      if (isGameControlKey(event.code)) {
        event.preventDefault();
      }
      return;
    }

    if (this.projectorDebug && (event.code === 'ArrowLeft' || event.code === 'ArrowRight')) {
      event.preventDefault();
      this.keys.add(event.code);
      this.adjustProjectorDebugAngle(
        (event.code === 'ArrowRight' ? 1 : -1) * PROJECTOR_DEBUG_ANGLE_STEP
      );
      return;
    }

    if (this.projectorDebug && event.code === 'KeyR') {
      event.preventDefault();
      this.resetProjectorDebug();
      return;
    }

    const isOneShotKey = event.code === 'ArrowUp'
      || event.code === 'ArrowDown'
      || event.code === 'Space'
      || event.code === 'Enter'
      || event.code === 'KeyR';

    if (event.repeat && isOneShotKey) {
      event.preventDefault();
      return;
    }

    if (event.code === 'ArrowUp') {
      event.preventDefault();
      this.navigateInstances(1);
      return;
    }

    if (event.code === 'ArrowDown') {
      event.preventDefault();
      this.navigateInstances(-1);
      return;
    }

    this.keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault();
      this.launchOrAdvanceSelected();
    }

    if (event.code === 'KeyR') {
      event.preventDefault();
      if (this.isGameFinished()) {
        this.restartGame();
      } else {
        this.restartSelected();
      }
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
    if (this.paused) {
      event.preventDefault();
      const action = this.pauseMenuActionAtPointer(event.clientX, event.clientY);
      this.setHoveredPauseMenuAction(action);
      this.setPressedPauseMenuAction(action);
      this.renderer.domElement.style.cursor = action ? 'pointer' : '';
      return;
    }

    if (this.splitTutorialActive) {
      event.preventDefault();
      this.completeSplitTutorial();
      return;
    }

    if (this.isMainMenuActive) {
      event.preventDefault();
      const action = this.menuActionAtPointer(event.clientX, event.clientY);
      this.setHoveredMenuAction(action);
      this.setPressedMenuAction(action);
      this.renderer.domElement.style.cursor = action ? 'pointer' : '';
      return;
    }

    if (this.isGameFinished()) {
      if (this.isRestartButtonHit(event.clientX, event.clientY)) {
        event.preventDefault();
      }
      return;
    }

    if (!this.isTouchPointer(event) || this.activeTouchPointerId !== null) {
      return;
    }

    event.preventDefault();
    this.activeTouchPointerId = event.pointerId;
    this.touchStartX = event.clientX;
    this.touchStartY = event.clientY;
    this.touchLastX = event.clientX;
    this.touchLastY = event.clientY;
    this.renderer.domElement.setPointerCapture(event.pointerId);
    this.updateTouchPaddle(event.clientX, event.clientY);
  };

  private readonly handlePointerMove = (event: PointerEvent): void => {
    if (this.paused) {
      event.preventDefault();
      const action = this.pauseMenuActionAtPointer(event.clientX, event.clientY);
      this.setHoveredPauseMenuAction(action);
      this.renderer.domElement.style.cursor = action ? 'pointer' : '';
      return;
    }

    if (this.isMainMenuActive) {
      this.updateMainMenuCursor(event.clientX, event.clientY);
      return;
    }

    if (this.isGameFinished()) {
      this.updateRestartButtonCursor(event.clientX, event.clientY);
      return;
    }

    if (event.pointerId !== this.activeTouchPointerId) {
      return;
    }

    event.preventDefault();
    this.touchLastX = event.clientX;
    this.touchLastY = event.clientY;
    this.updateTouchPaddle(event.clientX, event.clientY);
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
    if (this.paused) {
      event.preventDefault();
      const action = this.pauseMenuActionAtPointer(event.clientX, event.clientY);
      const pressedAction = this.pressedPauseMenuAction;
      this.setHoveredPauseMenuAction(action);
      this.setPressedPauseMenuAction(null);
      this.renderer.domElement.style.cursor = action ? 'pointer' : '';
      if (action && action === pressedAction) {
        this.handlePauseMenuAction(action);
      }
      return;
    }

    if (this.isMainMenuActive) {
      event.preventDefault();
      const action = this.menuActionAtPointer(event.clientX, event.clientY);
      const pressedAction = this.pressedMenuAction;
      this.setHoveredMenuAction(action);
      this.setPressedMenuAction(null);
      this.renderer.domElement.style.cursor = action ? 'pointer' : '';
      if (action && action === pressedAction) {
        this.handleMainMenuAction(action);
      }
      return;
    }

    if (this.isGameFinished()) {
      if (this.isRestartButtonHit(event.clientX, event.clientY)) {
        event.preventDefault();
        this.restartGame();
      }
      return;
    }

    if (event.pointerId !== this.activeTouchPointerId) {
      return;
    }

    event.preventDefault();
    this.touchLastX = event.clientX;
    this.touchLastY = event.clientY;
    this.updateTouchPaddle(event.clientX, event.clientY);
    this.releaseTouchPointer(event.pointerId);
    this.handleTouchGestureEnd();
    this.clearTouchInput();
  };

  private readonly handlePointerCancel = (event: PointerEvent): void => {
    if (this.paused) {
      event.preventDefault();
      this.setPressedPauseMenuAction(null);
      return;
    }

    if (this.isMainMenuActive) {
      event.preventDefault();
      this.setPressedMenuAction(null);
      return;
    }

    if (event.pointerId !== this.activeTouchPointerId) {
      return;
    }

    event.preventDefault();
    this.releaseTouchPointer(event.pointerId);
    this.clearTouchInput();
  };

  private handleMainMenuAction(action: MainMenuAction): void {
    if (action === 'start') {
      this.startGameFromMenu();
    }
  }

  private startGameFromMenu(): void {
    if (this.gameStarted) {
      return;
    }

    this.gameStarted = true;
    this.setHoveredMenuAction(null);
    this.setPressedMenuAction(null);
    this.mainMenu.setVisible(false);
    this.resetGame(this.initialInstanceCount, this.instanceOptions);
  }

  private updateMainMenuCursor(clientX: number, clientY: number): void {
    const action = this.menuActionAtPointer(clientX, clientY);
    this.setHoveredMenuAction(action);
    this.renderer.domElement.style.cursor = action ? 'pointer' : '';
  }

  private menuActionAtPointer(clientX: number, clientY: number): MainMenuAction | null {
    if (!this.isMainMenuActive || !this.updatePointerRay(clientX, clientY)) {
      return null;
    }

    const hit = this.pointerRaycaster.intersectObjects(this.mainMenu.buttonMeshes, false)[0];
    const action = hit?.object.userData.menuAction;
    return isMainMenuAction(action) ? action : null;
  }

  private setHoveredMenuAction(action: MainMenuAction | null): void {
    if (this.hoveredMenuAction === action) {
      return;
    }

    this.hoveredMenuAction = action;
    this.mainMenu.setHoveredAction(action);
  }

  private setPressedMenuAction(action: MainMenuAction | null): void {
    if (this.pressedMenuAction === action) {
      return;
    }

    this.pressedMenuAction = action;
    this.mainMenu.setPressedAction(action);
  }

  private isTouchPointer(event: PointerEvent): boolean {
    return event.pointerType === 'touch' || event.pointerType === 'pen';
  }

  private updateTouchPaddle(clientX: number, clientY: number): void {
    if (!this.gameStarted || this.autopilot || this.isGameFinished() || this.isFatalMissSequenceActive()) {
      return;
    }

    const paddleX = this.pointerToSelectedBoardX(clientX, clientY);
    if (paddleX === null) {
      return;
    }

    this.touchPaddleX = paddleX;
    this.selectedInstance?.placePaddleAt(paddleX);
  }

  private pointerToSelectedBoardX(clientX: number, clientY: number): number | null {
    const view = this.selectedView;
    if (!view) {
      return null;
    }

    if (!this.updatePointerRay(clientX, clientY)) {
      return null;
    }

    view.group.getWorldPosition(this.pointerBoardPoint);
    view.group.getWorldQuaternion(this.pointerBoardQuaternion);
    this.pointerBoardNormal.set(0, 0, 1).applyQuaternion(this.pointerBoardQuaternion).normalize();
    this.pointerBoardPlane.setFromNormalAndCoplanarPoint(this.pointerBoardNormal, this.pointerBoardPoint);

    const hit = this.pointerRaycaster.ray.intersectPlane(this.pointerBoardPlane, this.pointerBoardHit);
    if (!hit) {
      return null;
    }

    this.pointerLocalHit.copy(hit);
    view.group.worldToLocal(this.pointerLocalHit);
    return this.pointerLocalHit.x;
  }

  private updatePointerRay(clientX: number, clientY: number): boolean {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return false;
    }

    this.pointerNdc.set(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -(((clientY - bounds.top) / bounds.height) * 2 - 1)
    );
    this.pointerRaycaster.setFromCamera(this.pointerNdc, this.camera);
    return true;
  }

  private isRestartButtonHit(clientX: number, clientY: number): boolean {
    const view = this.selectedView;
    if (!view || !view.restartButtonText.mesh.visible || !this.updatePointerRay(clientX, clientY)) {
      return false;
    }

    return this.pointerRaycaster.intersectObject(view.restartButtonText.mesh, false).length > 0;
  }

  private updateRestartButtonCursor(clientX: number, clientY: number): void {
    this.renderer.domElement.style.cursor = this.isRestartButtonHit(clientX, clientY) ? 'pointer' : '';
  }

  private handleTouchGestureEnd(): void {
    if (!this.gameStarted || this.isGameFinished() || this.isFatalMissSequenceActive()) {
      return;
    }

    const deltaX = this.touchLastX - this.touchStartX;
    const deltaY = this.touchLastY - this.touchStartY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const isVerticalSwipe = absY >= TOUCH_SWIPE_MIN_DISTANCE && absY > absX * TOUCH_SWIPE_AXIS_RATIO;

    if (isVerticalSwipe) {
      this.navigateInstances(deltaY < 0 ? 1 : -1);
      return;
    }

    this.launchOrAdvanceSelected();
  }

  private releaseTouchPointer(pointerId: number): void {
    try {
      if (this.renderer.domElement.hasPointerCapture(pointerId)) {
        this.renderer.domElement.releasePointerCapture(pointerId);
      }
    } catch {
      // The browser may release capture before pointercancel reaches the app.
    }
  }

  private clearTouchInput(): void {
    this.activeTouchPointerId = null;
    this.touchPaddleX = null;
  }

  private readonly handleVisibilityChange = (): void => {
    if (!document.hidden) {
      this.lastTime = performance.now();
    }
  };

  private readonly resize = (): void => {
    const width = Math.max(1, this.shell.clientWidth);
    const height = Math.max(1, this.shell.clientHeight);
    const nextPostProcessingScreenScale = postProcessingScreenScaleForSize(width, height);
    const nextPostProcessingColorBleedScale = postProcessingColorBleedScaleForSize(
      width,
      nextPostProcessingScreenScale
    );
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    const aspect = width / height;
    const fovRadians = THREE.MathUtils.degToRad(CAMERA_FOV);
    const visualHeight = BOARD_HEIGHT + 2.1;
    const visualWidth = BOARD_WIDTH + 1.8;

    this.camera.aspect = aspect;
    this.cameraBaseDistance = Math.max(
      visualHeight / (2 * Math.tan(fovRadians / 2)),
      visualWidth / (2 * Math.tan(fovRadians / 2) * aspect)
    ) * CAMERA_DISTANCE_PADDING;
    this.camera.updateProjectionMatrix();
    this.updateCamera(1);

    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);

    if (
      this.postProcessingScreenScale !== nextPostProcessingScreenScale ||
      this.postProcessingColorBleedScale !== nextPostProcessingColorBleedScale
    ) {
      this.postProcessingScreenScale = nextPostProcessingScreenScale;
      this.postProcessingColorBleedScale = nextPostProcessingColorBleedScale;
      this.applyPostProcessingSettings();
    }
  };

  private readonly tick = (time: number): void => {
    const frameTime = Math.max(0, (time - this.lastTime) / 1000);
    const delta = Math.min(frameTime, MAX_DT);
    this.lastTime = time;
    this.stats.begin();

    if (this.paused) {
      this.accumulator = 0;
      this.pauseMenu.update(time / 1000, this.camera, PAUSE_MENU_CAMERA_DISTANCE);
      this.renderPipeline.render();
      this.stats.end();
      requestAnimationFrame(this.tick);
      return;
    }

    this.updateGameSpeedTween(delta);
    this.updatePlaneZTransitions(delta);
    this.updateInstanceOpacityTweens(delta);
    this.updateBallSpeedMultiplierTweens(delta);
    this.updateSplitBloom(delta);
    this.updateSplitTutorial(delta);

    if (this.projectorDebug) {
      this.updateProjectorDebug(delta);
      this.accumulator = 0;
    } else {
      this.accumulator += delta;

      while (this.accumulator >= FIXED_STEP) {
        for (let index = 0; index < this.instances.length; index += 1) {
          const instance = this.instances[index];
          const fatalSequenceInstance = this.isFatalMissSequenceActive() ? this.fatalMissInstance : null;
          if (fatalSequenceInstance && instance !== fatalSequenceInstance) {
            continue;
          }

          const allowPaddleInput = this.gameStarted && !this.isGameFinished() && !fatalSequenceInstance;
          const input = allowPaddleInput && !this.autopilot && index === this.selectedIndex && instance.isActive()
            ? this.currentInput
            : IDLE_INPUT;
          this.handleInstanceEvents(instance, instance.step(FIXED_STEP, input));
        }
        this.accumulator -= FIXED_STEP;
      }

      if (this.gameStarted) {
        this.maybeSelectAutopilotPaddleThreat(time / 1000);
      } else if (this.shouldRestartMainMenuDemo()) {
        this.restartMainMenuDemo();
      }
    }

    this.syncViews(time / 1000);
    this.updateCamera(delta);
    this.mainMenu.update(time / 1000, this.camera, MAIN_MENU_CAMERA_DISTANCE);
    this.updatePlaneHudBillboards();
    this.updateSplitTutorialBillboard();
    this.nebula?.system.update(delta);
    this.renderPipeline.render();
    this.stats.end();
    requestAnimationFrame(this.tick);
  };

  private createPauseButton(): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pause-toggle';
    button.textContent = 'Pause';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-keyshortcuts', 'P');
    button.addEventListener('click', () => this.setPaused(!this.paused));
    return button;
  }

  private setPaused(paused: boolean): void {
    if (this.paused === paused) {
      return;
    }

    this.paused = paused;
    this.shell.classList.toggle('is-paused', paused);
    this.pauseMenu.setVisible(paused);
    this.pauseButton.textContent = paused ? 'Resume' : 'Pause';
    this.pauseButton.setAttribute('aria-expanded', String(paused));
    this.pauseButton.setAttribute('aria-pressed', String(paused));
    this.setHoveredPauseMenuAction(null);
    this.setPressedPauseMenuAction(null);

    this.keys.clear();
    if (this.activeTouchPointerId !== null) {
      this.releaseTouchPointer(this.activeTouchPointerId);
    }
    this.clearTouchInput();
    this.accumulator = 0;
    this.lastTime = performance.now();

    if (paused) {
      this.renderer.domElement.style.cursor = '';
      this.renderer.domElement.focus({ preventScroll: true });
      return;
    }

    this.renderer.domElement.style.cursor = '';
    this.renderer.domElement.focus({ preventScroll: true });
  }

  private handlePauseMenuAction(action: PauseMenuAction): void {
    if (action === 'resume') {
      this.setPaused(false);
    }
  }

  private pauseMenuActionAtPointer(clientX: number, clientY: number): PauseMenuAction | null {
    if (!this.paused || !this.updatePointerRay(clientX, clientY)) {
      return null;
    }

    const hit = this.pointerRaycaster.intersectObjects(this.pauseMenu.buttonMeshes, false)[0];
    const action = hit?.object.userData.pauseMenuAction;
    return isPauseMenuAction(action) ? action : null;
  }

  private setHoveredPauseMenuAction(action: PauseMenuAction | null): void {
    if (this.hoveredPauseMenuAction === action) {
      return;
    }

    this.hoveredPauseMenuAction = action;
    this.pauseMenu.setHoveredAction(action);
  }

  private setPressedPauseMenuAction(action: PauseMenuAction | null): void {
    if (this.pressedPauseMenuAction === action) {
      return;
    }

    this.pressedPauseMenuAction = action;
    this.pauseMenu.setPressedAction(action);
  }

  private isPauseButtonEventTarget(target: EventTarget | null): boolean {
    return target instanceof Node && this.pauseButton.contains(target);
  }

  private launchOrAdvanceSelected(): void {
    if (!this.gameStarted || this.splitSequenceActive || this.isGameFinished() || this.isFatalMissSequenceActive()) {
      return;
    }

    const selected = this.selectedInstance;
    if (!selected || !selected.isActive()) {
      return;
    }

    this.handleInstanceEvents(selected, selected.launchOrAdvance());
  }

  private restartSelected(): void {
    if (!this.gameStarted || this.isGameFinished() || this.isFatalMissSequenceActive()) {
      return;
    }

    const selected = this.selectedInstance;
    if (selected?.isActive()) {
      this.handleInstanceEvents(selected, selected.restart());
    }
  }

  private restartGame(): void {
    this.resetGame(this.initialInstanceCount, this.instanceOptions);
  }

  private restartMainMenuDemo(): void {
    if (!this.isMainMenuActive) {
      return;
    }

    this.resetGame(0, this.createMainMenuDemoOptions());
    this.populateInstances(MAIN_MENU_DEMO_INSTANCE_COUNT, this.createMainMenuDemoOptions(), true);
    this.mainMenu.setVisible(true);
  }

  private shouldRestartMainMenuDemo(): boolean {
    if (!this.isMainMenuActive) {
      return false;
    }

    if (this.instances.length === 0 || this.isGameFinished()) {
      return true;
    }

    return this.instances.some((instance) => isTerminalPhase(instance.getRenderState().phase));
  }

  private resetGame(instanceCount: number, options: BreakoutoutoutOptions): void {
    this.clearTouchInput();
    this.keys.clear();
    this.pendingSplits.length = 0;
    this.splitBloomPulses.length = 0;
    this.splitGlowActiveInstances.clear();
    this.ballSpeedMultiplierTargets.clear();
    this.ballSpeedMultiplierTweens.clear();

    for (const view of this.views) {
      this.disposePlaneView(view);
    }
    this.views.clear();

    for (const instance of this.instances) {
      instance.dispose();
    }
    this.instances.length = 0;

    this.accumulator = 0;
    this.lastTime = performance.now();
    this.nextInstanceId = 1;
    this.selectedIndex = 0;
    this.selectedTrackIndex = 0;
    this.lastAutopilotSelectionChangeTime = Number.NEGATIVE_INFINITY;
    this.hasNavigatedInstances = false;
    this.globalScore = 0;
    this.leaderboardSubmission = null;
    this.gameSpeed = 1;
    this.gameSpeedTween = null;
    this.splitSequenceActive = false;
    this.fatalMissInstance = null;
    this.totalGameOver = false;
    this.totalGameCleared = false;
    this.splitTutorialActive = false;
    this.splitTutorialElapsed = 0;
    this.splitTutorial.setVisible(false);
    this.renderer.domElement.style.cursor = '';
    this.cameraFocusX = 0;
    this.cameraFocusY = CAMERA_ELEVATION;
    this.cameraFocusZ = 0;
    this.cameraPlaneTransition = null;

    if (instanceCount > 0) {
      this.populateInstances(instanceCount, options);
    }
  }

  private updateProjectorDebug(delta: number): void {
    const direction = Number(this.keys.has('ArrowRight')) - Number(this.keys.has('ArrowLeft'));
    if (direction !== 0) {
      this.adjustProjectorDebugAngle(direction * PROJECTOR_DEBUG_ANGLE_SPEED * Math.max(delta, 0));
    }

    this.updateProjectorDebugTestBall(delta);
  }

  private adjustProjectorDebugAngle(delta: number): void {
    if (delta === 0) {
      return;
    }

    const previousAngle = this.projectorDebugAngle;
    this.projectorDebugAngle = clamp(
      this.projectorDebugAngle + delta,
      -PROJECTOR_DEBUG_MAX_ANGLE,
      PROJECTOR_DEBUG_MAX_ANGLE
    );

    if (this.projectorDebugAngle !== previousAngle) {
      this.projectorDebugTestBall = null;
      this.invalidateTrajectoryProjectionCaches();
    }
  }

  private resetProjectorDebug(): void {
    this.projectorDebugAngle = 0;
    this.projectorDebugTestBall = null;
    this.projectorDebugBricks = createProjectorDebugBricks();
    this.invalidateTrajectoryProjectionCaches();
    for (const view of this.views) {
      for (const [id, mesh] of [...view.bricks]) {
        this.removeBrickMesh(view, id, mesh);
      }
    }
  }

  private launchProjectorDebugBall(): void {
    this.projectorDebugTestBall = this.createProjectorDebugBall(PROJECTOR_DEBUG_TEST_BALL_SPEED);
    this.invalidateTrajectoryProjectionCaches();
  }

  private updateProjectorDebugTestBall(delta: number): void {
    const ball = this.projectorDebugTestBall;
    if (!ball) {
      return;
    }

    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed <= this.projectorBeamSettings.epsilon) {
      this.projectorDebugTestBall = null;
      return;
    }

    let remainingDistance = Math.max(delta, 0) * speed;
    let x = ball.x;
    let y = ball.y;
    let directionX = ball.vx / speed;
    let directionY = ball.vy / speed;
    const activeBricks = this.projectorDebugBricks.filter((brick) => !brick.hit);
    const obstacles = activeBricks.map((brick) => ({
      x: brick.x,
      y: brick.y,
      width: brick.width,
      height: brick.height
    }));

    for (
      let collisionCount = 0;
      remainingDistance > this.projectorBeamSettings.epsilon
        && collisionCount < PROJECTOR_DEBUG_TEST_MAX_COLLISIONS_PER_FRAME;
      collisionCount += 1
    ) {
      const paddleDistance = distanceToPaddleY(y, directionY, this.projectorBeamSettings);
      const hit = nearestTrajectoryHit(
        x,
        y,
        directionX,
        directionY,
        obstacles,
        this.projectorBeamSettings
      );
      const hitDistance = hit?.distance ?? Number.POSITIVE_INFINITY;
      const finishDistance = paddleDistance ?? Number.POSITIVE_INFINITY;

      if (
        finishDistance <= hitDistance + this.projectorBeamSettings.cornerTolerance
        && finishDistance <= remainingDistance
      ) {
        this.projectorDebugTestBall = null;
        this.invalidateTrajectoryProjectionCaches();
        return;
      }

      if (!hit || hitDistance > remainingDistance) {
        x += directionX * remainingDistance;
        y += directionY * remainingDistance;
        remainingDistance = 0;
        break;
      }

      x += directionX * hitDistance;
      y += directionY * hitDistance;
      remainingDistance -= hitDistance;

      if (typeof hit.brickIndex === 'number') {
        const brick = activeBricks[hit.brickIndex];
        if (brick) {
          brick.hit = true;
          activeBricks.splice(hit.brickIndex, 1);
          obstacles.splice(hit.brickIndex, 1);
          this.invalidateTrajectoryProjectionCaches();
        }
      }

      if (hit.normalX !== 0) {
        directionX *= -1;
      }
      if (hit.normalY !== 0) {
        directionY *= -1;
      }

      const advancedPoint = clampTrajectoryPointToPlayfield(
        x + hit.normalX * this.projectorBeamSettings.surfaceClearance,
        y + hit.normalY * this.projectorBeamSettings.surfaceClearance,
        this.projectorBeamSettings
      );
      x = advancedPoint.x;
      y = advancedPoint.y;
    }

    this.projectorDebugTestBall = {
      x,
      y,
      vx: directionX * speed,
      vy: directionY * speed
    };
  }

  private createProjectorDebugSnapshot(): BreakoutoutoutSnapshot {
    return {
      score: 0,
      lives: 3,
      phase: 'playing',
      readyRemaining: 0,
      fatalMissPending: false,
      paddleX: 0,
      targetPaddleX: 0,
      autoPilotRemaining: 0,
      autoPilotActive: false,
      persistentAutoPilotActive: false,
      pathProjectionRemaining: 1,
      pathProjectionActive: true,
      ballSpeedMultiplier: 1,
      ball: this.projectorDebugTestBall ?? this.createProjectorDebugBall(),
      bricks: this.projectorDebugBricks.map((brick) => ({ ...brick }))
    };
  }

  private createProjectorDebugRenderState(instance: BreakoutoutoutInstance): BreakoutoutoutRenderState {
    return {
      ...this.createProjectorDebugSnapshot(),
      id: instance.id,
      bricks: this.projectorDebugBricks
    };
  }

  private createProjectorDebugBall(speed = PROJECTOR_DEBUG_BEAM_SPEED): BreakoutoutoutSnapshot['ball'] {
    return {
      x: 0,
      y: PADDLE_Y,
      vx: Math.sin(this.projectorDebugAngle) * speed,
      vy: Math.cos(this.projectorDebugAngle) * speed
    };
  }

  private handleInstanceEvents(instance: BreakoutoutoutInstance, events: BreakoutoutoutEvent[]): void {
    if (events.length === 0) {
      return;
    }

    let shouldSyncBallSpeed = false;
    let shouldInvalidateTrajectoryProjection = false;
    const volume = this.volumeForInstance(instance);

    for (const event of events) {
      if (event.type === 'sound') {
        this.sound.play(event.name, volume);
        shouldInvalidateTrajectoryProjection ||= event.name === 'paddle' || event.name === 'wall';
      }

      // if (event.type === 'brick-hit') {
      //   this.burst(instance, event.x, event.y, event.color, event.kind);
      // }
      if (event.type === 'brick-hit') {
        this.globalScore += event.points;
        shouldInvalidateTrajectoryProjection = true;
      }

      if (event.type === 'split') {
        this.queueSplitReality(instance, event.snapshot);
      }

      if (event.type === 'fatal-miss') {
        this.startFatalMissSequence(instance);
      }

      if (event.type === 'state-changed') {
        shouldSyncBallSpeed = true;
      }
    }

    if (shouldInvalidateTrajectoryProjection) {
      this.invalidateTrajectoryProjectionCacheForInstance(instance);
    }

    if (instance.getRenderState().phase === 'game-over') {
      if (this.isFatalMissSequenceActive() && instance !== this.fatalMissInstance) {
        return;
      }

      this.triggerTotalGameOver(instance);
      return;
    }

    if (this.areAllGamesCleared()) {
      this.triggerAllGamesCleared(instance);
      return;
    }

    if (shouldSyncBallSpeed) {
      this.syncBallSpeedForAll();
    }
  }

  private startFatalMissSequence(instance: BreakoutoutoutInstance): void {
    if (this.isGameFinished() || this.fatalMissInstance === instance) {
      return;
    }

    this.fatalMissInstance = instance;
    this.clearTouchInput();
    this.focusInstance(instance);
    this.syncBallSpeedForAll();
  }

  private triggerTotalGameOver(source: BreakoutoutoutInstance): void {
    if (this.isGameFinished()) {
      return;
    }

    this.totalGameOver = true;
    this.fatalMissInstance = source;
    this.clearTouchInput();
    this.focusInstance(source);

    for (const instance of this.instances) {
      instance.forceGameOver();
    }

    this.syncBallSpeedForAll();
  }

  private triggerAllGamesCleared(source: BreakoutoutoutInstance): void {
    if (this.isGameFinished()) {
      return;
    }

    this.totalGameCleared = true;
    this.fatalMissInstance = null;
    this.clearTouchInput();
    this.focusInstance(source);
    this.syncBallSpeedForAll();
    this.prepareLeaderboardAfterAllGamesCleared(this.globalScore);
  }

  private areAllGamesCleared(): boolean {
    return this.instances.length > 0
      && !this.splitSequenceActive
      && this.pendingSplits.length === 0
      && this.instances.every((instance) => instance.isCleared());
  }

  private async refreshLeaderboard(): Promise<void> {
    const refreshId = this.leaderboardRefreshId + 1;
    this.leaderboardRefreshId = refreshId;
    this.leaderboardLoadState = 'loading';

    try {
      const leaderboard = await this.scoreboard.load();
      if (refreshId !== this.leaderboardRefreshId) {
        return;
      }

      this.leaderboardEntries = leaderboard.entries;
      this.leaderboardLoadState = 'ready';
    } catch (error) {
      if (refreshId !== this.leaderboardRefreshId) {
        return;
      }

      console.warn('Leaderboard unavailable.', error);
      this.leaderboardEntries = [];
      this.leaderboardLoadState = 'unavailable';
    }
  }

  private prepareLeaderboardAfterAllGamesCleared(score: number): void {
    if (!this.gameStarted || !this.isLeaderboardEligibleMode() || score <= 0) {
      return;
    }

    void this.prepareLeaderboardSubmission(score);
  }

  private isLeaderboardEligibleMode(): boolean {
    return !this.autopilot
      && !this.projectorDebug
      && !this.pathProjectionDebug
      && this.instanceOptions.sandbox !== true
      && this.instanceOptions.specialBrickKinds === undefined
      && this.initialInstanceCount === DEFAULT_INITIAL_INSTANCE_COUNT
      && this.ballSpeedMultiplierActiveGameCap === DEFAULT_BALL_SPEED_MULTIPLIER_ACTIVE_GAME_CAP;
  }

  private async prepareLeaderboardSubmission(score: number): Promise<void> {
    if (this.leaderboardLoadState !== 'ready') {
      await this.refreshLeaderboard();
    }

    if (!this.totalGameCleared || this.globalScore !== score || this.leaderboardLoadState !== 'ready') {
      return;
    }

    if (!this.scoreboard.isScoreQualified(score, this.leaderboardEntries)) {
      return;
    }

    this.leaderboardSubmission = {
      score,
      name: '',
      state: 'entry'
    };
  }

  private handleLeaderboardEntryKeyDown(event: KeyboardEvent): void {
    const submission = this.leaderboardSubmission;
    if (!submission || (submission.state !== 'entry' && submission.state !== 'error')) {
      return;
    }

    if (event.code === 'Backspace') {
      submission.name = submission.name.slice(0, -1);
      submission.state = 'entry';
      submission.message = undefined;
      return;
    }

    if (event.code === 'Escape') {
      this.leaderboardSubmission = null;
      return;
    }

    if (event.code === 'Enter') {
      this.submitLeaderboardEntry();
      return;
    }

    if (event.key.length !== 1 || submission.name.length >= LEADERBOARD_NAME_MAX_LENGTH) {
      return;
    }

    const character = event.key.toUpperCase();
    if (!/^[A-Z0-9]$/.test(character)) {
      return;
    }

    submission.name += character;
    submission.state = 'entry';
    submission.message = undefined;
  }

  private submitLeaderboardEntry(): void {
    const submission = this.leaderboardSubmission;
    if (!submission || submission.state === 'submitting' || submission.state === 'submitted') {
      return;
    }

    if (submission.name.length === 0) {
      submission.state = 'error';
      submission.message = 'ENTER NAME';
      return;
    }

    submission.state = 'submitting';
    submission.message = 'VERIFYING';
    void this.submitLeaderboardEntryAsync(submission);
  }

  private async submitLeaderboardEntryAsync(submission: LeaderboardSubmission): Promise<void> {
    try {
      const response = await this.scoreboard.submit(submission.name, submission.score);
      if (this.leaderboardSubmission !== submission) {
        return;
      }

      this.leaderboardEntries = response.entries;
      this.leaderboardLoadState = 'ready';
      submission.state = 'submitted';
      submission.message = response.accepted ? 'SAVED' : 'TOP 10 CHANGED';
    } catch (error) {
      if (this.leaderboardSubmission !== submission) {
        return;
      }

      console.warn('Leaderboard submission failed.', error);
      submission.state = 'error';
      submission.message = 'SAVE FAILED';
    }
  }

  private isLeaderboardEntryActive(): boolean {
    const state = this.leaderboardSubmission?.state;
    return state === 'entry' || state === 'error' || state === 'submitting';
  }

  private leaderboardPanelState(): LeaderboardPanelState {
    const submission = this.leaderboardSubmission;
    if (submission) {
      return {
        mode: submission.state,
        entries: this.leaderboardEntries,
        score: submission.score,
        name: submission.name,
        message: submission.message ?? ''
      };
    }

    return {
      mode: this.leaderboardLoadState === 'ready' ? 'view' : this.leaderboardLoadState,
      entries: this.leaderboardEntries,
      score: this.globalScore,
      name: '',
      message: ''
    };
  }

  private volumeForInstance(instance: BreakoutoutoutInstance): number {
    const view = this.viewForInstanceNearestTrack(instance, this.selectedTrackIndex);
    if (!view) {
      return 1;
    }

    view.group.getWorldPosition(this.instanceSoundPosition);
    const distanceToCamera = this.camera.position.distanceTo(this.instanceSoundPosition);
    const excessDistance = Math.max(0, distanceToCamera - this.cameraBaseDistance);
    return clamp(Math.exp(-excessDistance / SOUND_ATTENUATION_DISTANCE), SOUND_MIN_VOLUME, 1);
  }

  private queueSplitReality(source: BreakoutoutoutInstance, snapshot: BreakoutoutoutSnapshot): void {
    this.pendingSplits.push({
      source,
      snapshot,
      selectCloneOnComplete: source === this.selectedInstance
    });

    if (!this.splitSequenceActive) {
      this.startNextSplitSequence();
    }
  }

  private startNextSplitSequence(): void {
    const pending = this.pendingSplits.shift();
    if (!pending) {
      return;
    }

    this.splitSequenceActive = true;
    this.setGameSpeed(0);
    this.tweenGameSpeed(0, SPLIT_GAME_SPEED_TWEEN_DURATION, () => {
      this.spawnSplitReality(pending);
    });
  }

  private spawnSplitReality(pending: PendingSplit): void {
    const sourceView = this.viewForInstanceNearestTrack(pending.source, this.selectedTrackIndex);
    const sourceIndex = this.instances.indexOf(pending.source);
    const sourceZ = sourceView?.group.position.z ?? this.targetPlaneZForTrack(Math.max(0, sourceIndex));
    const sourceTrackIndex = sourceView?.trackIndex ?? this.trackIndexForInstanceIndex(Math.max(0, sourceIndex));
    const insertIndex = this.insertIndexAfterSourceTrack(pending.source, sourceTrackIndex);
    const cloneOptions = this.createSplitRealityOptions(pending.source);
    const clone = new BreakoutoutoutInstance(
      this.nextInstanceId,
      createSplitRealitySnapshot(pending.snapshot, { specialBrickKinds: cloneOptions.specialBrickKinds }),
      cloneOptions
    );
    this.nextInstanceId += 1;
    if (sourceTrackIndex < this.selectedTrackIndex) {
      this.selectedTrackIndex += 1;
    }
    const view = this.addInstance(clone, insertIndex);
    const targetZ = this.targetPlaneZForTrack(view.trackIndex);
    const startZ = sourceZ - SPLIT_PLANE_SPAWN_Z_OFFSET;
    view.group.position.z = startZ;
    this.triggerSplitBloom(clone, 1);
    view.zTransition = {
      from: startZ,
      to: targetZ,
      elapsed: 0,
      duration: SPLIT_PLANE_TRAVEL_DURATION,
      selectOnComplete: pending.selectCloneOnComplete,
      resumeSplitOnComplete: true
    };
  }

  private tweenGameSpeed(to: number, duration: number, onComplete?: () => void): void {
    this.gameSpeedTween = {
      from: this.gameSpeed,
      to: clamp(to, 0, 1),
      elapsed: 0,
      duration,
      onComplete
    };
  }

  private createSplitRealityOptions(source: BreakoutoutoutInstance): BreakoutoutoutOptions {
    return {
      ...this.instanceOptions,
      autopilot: source.hasPersistentAutopilot()
    };
  }

  private updateGameSpeedTween(delta: number): void {
    if (!this.gameSpeedTween) {
      return;
    }

    const tween = this.gameSpeedTween;
    tween.elapsed += delta;
    const progress = clamp(tween.elapsed / Math.max(tween.duration, 0.001), 0, 1);
    this.setGameSpeed(lerp(tween.from, tween.to, easeInOutCubic(progress)));

    if (progress < 1) {
      return;
    }

    this.gameSpeedTween = null;
    this.setGameSpeed(tween.to);
    tween.onComplete?.();
  }

  private updatePlaneZTransitions(delta: number): void {
    let shouldResumeAfterSplit = false;
    let instanceToSelect: BreakoutoutoutInstance | null = null;

    for (const view of this.views) {
      const transition = view.zTransition;
      if (!transition) {
        continue;
      }

      transition.elapsed += delta;
      const progress = clamp(transition.elapsed / Math.max(transition.duration, 0.001), 0, 1);
      view.group.position.z = lerp(transition.from, transition.to, easeOutCubic(progress));

      if (progress < 1) {
        continue;
      }

      view.group.position.z = transition.to;
      view.zTransition = undefined;
      shouldResumeAfterSplit = shouldResumeAfterSplit
        || transition.selectOnComplete
        || transition.resumeSplitOnComplete === true;

      if (transition.selectOnComplete) {
        instanceToSelect = view.instance;
      }
    }

    if (shouldResumeAfterSplit) {
      if (instanceToSelect) {
        this.selectInstance(this.instances.indexOf(instanceToSelect));
      }

      this.resumeAfterSplitTravel();
    }
  }

  private resumeAfterSplitTravel(): void {
    if (this.shouldShowSplitTutorial()) {
      this.showSplitTutorial();
      return;
    }

    this.resumeSplitSequence();
  }

  private shouldShowSplitTutorial(): boolean {
    if (!this.gameStarted || this.splitTutorialActive) {
      return false;
    }

    if (this.splitTutorialSeen || getSplitTutorialSeenFlag()) {
      this.splitTutorialSeen = true;
      return false;
    }

    return true;
  }

  private showSplitTutorial(): void {
    this.splitTutorialActive = true;
    this.splitTutorialElapsed = 0;
    this.gameSpeedTween = null;
    this.setGameSpeed(0);
    this.clearTouchInput();
    this.keys.clear();
    this.splitTutorial.setMode(isTouchTutorialDevice() ? 'touch' : 'keyboard');
    this.splitTutorial.setVisible(true);
  }

  private updateSplitTutorial(delta: number): void {
    if (!this.splitTutorialActive) {
      return;
    }

    this.splitTutorialElapsed += Math.max(delta, 0);
    if (this.splitTutorialElapsed >= SPLIT_TUTORIAL_DURATION) {
      this.completeSplitTutorial();
    }
  }

  private completeSplitTutorial(): void {
    if (!this.splitTutorialActive) {
      return;
    }

    this.splitTutorialActive = false;
    this.splitTutorialElapsed = 0;
    this.splitTutorial.setVisible(false);
    this.splitTutorialSeen = true;
    setSplitTutorialSeenFlag();
    this.resumeSplitSequence();
  }

  private resumeSplitSequence(): void {
    this.tweenGameSpeed(1, SPLIT_GAME_SPEED_TWEEN_DURATION, () => {
      this.splitSequenceActive = false;
      this.startNextSplitSequence();
    });
  }

  private triggerSplitBloom(instance: BreakoutoutoutInstance, strength: number): void {
    this.splitGlowActiveInstances.add(instance);
    this.splitBloomPulses.push({
      instance,
      elapsed: 0,
      duration: SPLIT_BLOOM_DURATION,
      strength
    });
  }

  private updateSplitBloom(delta: number): void {
    if (this.splitBloomPulses.length === 0) {
      if (this.splitGlowActiveInstances.size > 0) {
        for (const instance of this.splitGlowActiveInstances) {
          for (const view of this.viewsForInstance(instance)) {
            this.updateSplitGlowIntensity(view, 0);
          }
        }
        this.splitGlowActiveInstances.clear();
      }
      return;
    }

    const intensityByInstance = new Map<BreakoutoutoutInstance, number>();

    for (let index = this.splitBloomPulses.length - 1; index >= 0; index -= 1) {
      const pulse = this.splitBloomPulses[index];
      pulse.elapsed += delta;
      const progress = pulse.elapsed / pulse.duration;

      if (progress >= 1) {
        this.splitBloomPulses.splice(index, 1);
        continue;
      }

      const currentIntensity = intensityByInstance.get(pulse.instance) ?? 0;
      intensityByInstance.set(
        pulse.instance,
        currentIntensity + pulse.strength * splitBloomCurve(progress)
      );
    }

    const completedInstances: BreakoutoutoutInstance[] = [];
    for (const instance of this.splitGlowActiveInstances) {
      const views = this.viewsForInstance(instance);
      const hasActivePulse = intensityByInstance.has(instance);
      for (const view of views) {
        this.updateSplitGlowIntensity(view, clamp(intensityByInstance.get(instance) ?? 0, 0, 1));
      }

      if (!hasActivePulse) {
        completedInstances.push(instance);
      }
    }

    for (const instance of completedInstances) {
      this.splitGlowActiveInstances.delete(instance);
    }
  }

  private updateSplitGlowIntensity(view: InstanceView, intensity: number): void {
    const visibleIntensity = isTerminalPhase(view.renderState.phase) ? 0 : intensity;

    for (const glow of view.splitGlowMeshes) {
      const opacity = visibleIntensity * SPLIT_GLOW_BASE_OPACITY;
      glow.material.opacity = opacity;
      glow.mesh.visible = opacity > 0.002;
      glow.mesh.scale.setScalar(glow.baseScale + glow.pulseScale * visibleIntensity);
    }
  }

  private setGameSpeed(speed: number): void {
    this.gameSpeed = clamp(speed, 0, 1);
    for (const instance of this.instances) {
      instance.setGameSpeed(this.gameSpeed);
    }
  }

  private syncBallSpeedForAll(): void {
    if (this.isGameFinished()) {
      for (const instance of this.instances) {
        this.setBallSpeedMultiplierTarget(instance, 0, false);
      }
      return;
    }

    if (this.isFatalMissSequenceActive()) {
      for (const instance of this.instances) {
        if (instance === this.fatalMissInstance) {
          this.setBallSpeedMultiplierTarget(
            instance,
            FATAL_MISS_BALL_SPEED_MULTIPLIER,
            true,
            FATAL_MISS_BALL_SPEED_TWEEN_DURATION
          );
        } else {
          this.setBallSpeedMultiplierTarget(instance, 0, false);
        }
      }
      return;
    }

    this.ensureSelectedInstanceIsActive(1);

    const selectedInstance = this.selectedInstance;
    const backgroundBallSpeedMultiplier = this.ballSpeedMultiplierForActiveGames(this.activeGameCount);
    for (const instance of this.instances) {
      const nextBallSpeedMultiplier = instance === selectedInstance ? 1 : backgroundBallSpeedMultiplier;
      this.setBallSpeedMultiplierTarget(instance, nextBallSpeedMultiplier, instance === selectedInstance);
    }
  }

  private setBallSpeedMultiplierTarget(
    instance: BreakoutoutoutInstance,
    multiplier: number,
    smooth: boolean,
    duration = BALL_SPEED_MULTIPLIER_TWEEN_DURATION
  ): void {
    if (this.ballSpeedMultiplierTargets.get(instance) === multiplier) {
      return;
    }

    this.ballSpeedMultiplierTargets.set(instance, multiplier);
    const currentMultiplier = instance.getBallSpeedMultiplier();
    if (Math.abs(currentMultiplier - multiplier) <= BALL_SPEED_MULTIPLIER_EPSILON) {
      this.ballSpeedMultiplierTweens.delete(instance);
      instance.setBallSpeedMultiplier(multiplier);
      return;
    }

    if (smooth) {
      this.ballSpeedMultiplierTweens.set(instance, {
        from: currentMultiplier,
        to: multiplier,
        elapsed: 0,
        duration
      });
      return;
    }

    this.ballSpeedMultiplierTweens.delete(instance);
    instance.setBallSpeedMultiplier(multiplier);
  }

  private updateBallSpeedMultiplierTweens(delta: number): void {
    for (const [instance, tween] of this.ballSpeedMultiplierTweens) {
      tween.elapsed += delta;
      const progress = clamp(tween.elapsed / Math.max(tween.duration, 0.001), 0, 1);
      const nextMultiplier = lerp(tween.from, tween.to, easeInOutCubic(progress));
      instance.setBallSpeedMultiplier(nextMultiplier);

      if (progress >= 1) {
        instance.setBallSpeedMultiplier(tween.to);
        this.ballSpeedMultiplierTweens.delete(instance);
      }
    }
  }

  private ballSpeedMultiplierForActiveGames(activeGameCount: number): number {
    const effectiveActiveGameCount = Math.min(activeGameCount, this.ballSpeedMultiplierActiveGameCap);
    return BALL_SPEED_ACTIVE_GAME_SCALE ** (effectiveActiveGameCount - 1);
  }

  private get activeGameCount(): number {
    let activeCount = 0;
    for (const instance of this.instances) {
      if (instance.isActive()) {
        activeCount += 1;
      }
    }

    return Math.max(1, activeCount);
  }

  private syncViews(time: number): void {
    for (const view of this.views) {
      const state = this.projectorDebug
        ? this.createProjectorDebugRenderState(view.instance)
        : this.renderStateForInstance(view.instance);
      view.renderState = state;
      this.syncInstanceView(view, state, time);
    }
  }

  private renderStateForInstance(instance: BreakoutoutoutInstance): BreakoutoutoutRenderState {
    const state: BreakoutoutoutRenderState = {
      ...instance.getRenderState(),
      score: this.globalScore
    };

    if (!this.pathProjectionDebug || state.phase !== 'playing') {
      return state;
    }

    return {
      ...state,
      pathProjectionActive: true
    };
  }

  private syncInstanceView(view: InstanceView, state: BreakoutoutoutRenderState, time: number): void {
    const terminal = isTerminalPhase(state.phase);

    view.paddleMesh.position.set(state.paddleX, PADDLE_Y, 0.06);
    this.updatePaddleAutopilotEffect(
      view.paddleMesh,
      state.autoPilotActive || state.persistentAutoPilotActive,
      time
    );
    view.ballMesh.position.set(state.ball.x, state.ball.y, 0.18);
    view.ballMesh.rotation.x += 0.05 * this.gameSpeed;
    view.ballMesh.rotation.y += 0.075 * this.gameSpeed;
    view.group.rotation.x = Math.sin(time * 0.32 + state.id * 0.2) * 0.018;
    view.trajectoryProjection.update(
      this.trajectoryProjectionPathForView(view, state, terminal),
      time,
      this.projectorBeamSettings
    );
    this.applyMeshOpacity(view, view.trajectoryProjection.mesh);
    this.updatePlaneCornerHud(view, state);
    this.updatePlaneStatusHud(view, state);

    view.activeBrickIds.clear();
    for (const brick of state.bricks) {
      if (!brick.hit) {
        view.activeBrickIds.add(brick.id);
      }
    }

    for (const [id, mesh] of view.bricks) {
      if (!view.activeBrickIds.has(id)) {
        this.removeBrickMesh(view, id, mesh);
      }
    }

    for (const brick of state.bricks) {
      if (brick.hit) {
        continue;
      }

      let mesh = view.bricks.get(brick.id);
      if (!mesh) {
        mesh = this.createBrickMesh(brick);
        view.bricks.set(brick.id, mesh);
        view.splitGlowMeshes.push(this.attachSplitGlow(mesh, brick.color, {
          baseScale: brick.kind === 'splitter' || brick.kind === 'projector' ? 1.18 : 1.12,
          pulseScale: brick.kind === 'splitter' || brick.kind === 'projector' ? 0.62 : 0.38
        }));
        view.group.add(mesh);
        this.applyMeshOpacity(view, mesh);
        setMaterialGreyscale(mesh.material, terminal);
      }

      mesh.position.set(brick.x, brick.y, Math.sin(time * 1.5 + brick.x * 0.7) * 0.035);
    }

    this.applyInstancePlayStateVisuals(view, terminal);
    this.updateFatalMissGreyscaleVisuals(view, this.shouldGreyscaleForFatalMiss(view), terminal, time);
    this.updateDangerVisuals(view, state.fatalMissPending && !terminal, terminal, time);
  }

  private trajectoryProjectionPathForView(
    view: InstanceView,
    state: BreakoutoutoutRenderState,
    terminal: boolean
  ): readonly TrajectoryPoint[] {
    if (terminal || state.phase !== 'playing' || !state.pathProjectionActive) {
      view.trajectoryProjectionCache = null;
      view.trajectoryProjection.resetPhase();
      return [];
    }

    const input = this.trajectoryProjectionInputForView(view);
    const key = this.trajectoryProjectionCacheKey(state, input);
    if (view.trajectoryProjectionCache?.key !== key) {
      view.trajectoryProjectionCache = {
        key,
        points: this.createTrajectoryProjectionPathForView(view, state, input),
        visibleStartDistance: 0
      };
      view.trajectoryProjection.resetPhase();
    }

    const cache = view.trajectoryProjectionCache;
    const visiblePath = trimTrajectoryProjectionPath(
      cache.points,
      state.ball,
      cache.visibleStartDistance,
      this.projectorBeamSettings
    );

    if (visiblePath.driftSquared > TRAJECTORY_PROJECTION_CACHE_MAX_BALL_DRIFT ** 2) {
      view.trajectoryProjectionCache = {
        key,
        points: this.createTrajectoryProjectionPathForView(view, state, input),
        visibleStartDistance: 0
      };
      view.trajectoryProjection.resetPhase();
      const refreshedPath = trimTrajectoryProjectionPath(
        view.trajectoryProjectionCache.points,
        state.ball,
        view.trajectoryProjectionCache.visibleStartDistance,
        this.projectorBeamSettings
      );
      view.trajectoryProjectionCache.visibleStartDistance = refreshedPath.distance;
      return refreshedPath.points;
    }

    cache.visibleStartDistance = visiblePath.distance;
    return visiblePath.points;
  }

  private createTrajectoryProjectionPathForView(
    view: InstanceView,
    state: BreakoutoutoutRenderState,
    input: BreakoutInput
  ): TrajectoryPoint[] {
    if (this.projectorDebug) {
      return createTrajectoryProjectionPath(state, this.projectorBeamSettings);
    }

    return view.instance.projectBallPath(this.trajectoryProjectionOptions(input));
  }

  private trajectoryProjectionOptions(input: BreakoutInput): BallPathProjectionOptions {
    return {
      input,
      maxBounces: this.projectorBeamSettings.maxBounces,
      maxDistance: this.projectorBeamSettings.maxDistance,
      maxSeconds: TRAJECTORY_PROJECTION_SIMULATION_SECONDS,
      sampleSpacing: TRAJECTORY_PROJECTION_SIMULATION_SAMPLE_SPACING
    };
  }

  private trajectoryProjectionInputForView(view: InstanceView): BreakoutInput {
    const fatalSequenceInstance = this.isFatalMissSequenceActive() ? this.fatalMissInstance : null;
    const allowPaddleInput = this.gameStarted && !this.isGameFinished() && !fatalSequenceInstance;
    return allowPaddleInput
      && !this.autopilot
      && this.isSelectedView(view)
      && view.instance.isActive()
      ? this.currentInput
      : IDLE_INPUT;
  }

  private trajectoryProjectionCacheKey(state: BreakoutoutoutRenderState, input: BreakoutInput): string {
    return [
      this.projectorDebug
        ? `debug:${this.projectorDebugAngle.toFixed(5)}`
        : this.pathProjectionDebug
          ? 'path-debug'
          : 'game',
      trajectoryProjectionPathSettingsSignature(this.projectorBeamSettings),
      trajectoryProjectionInputSignature(input),
      trajectoryProjectionBrickSignature(state.bricks)
    ].join('|');
  }

  private removeBrickMesh(view: InstanceView, id: string, mesh: THREE.Mesh): void {
    view.bricks.delete(id);
    view.group.remove(mesh);
    view.splitGlowMeshes = view.splitGlowMeshes.filter((entry) => entry.mesh.parent !== mesh);
    disposeObject(mesh);
  }

  private updatePlaneCornerHud(view: InstanceView, state: BreakoutoutoutRenderState): void {
    const topEdge = HALF_HEIGHT + WALL_THICKNESS;
    const leftEdge = -HALF_WIDTH - WALL_THICKNESS;
    const rightEdge = HALF_WIDTH + WALL_THICKNESS;
    const visible = this.gameStarted;

    view.scoreText.setText(state.score.toString().padStart(5, '0'));
    view.scoreText.mesh.visible = visible;
    this.scalePlaneHudText(view.scoreText, PLANE_SCORE_WORLD_HEIGHT, PLANE_SCORE_MAX_WIDTH);
    view.scoreText.mesh.position.set(
      leftEdge + view.scoreText.mesh.scale.x / 2,
      topEdge + PLANE_CORNER_HUD_GAP + view.scoreText.mesh.scale.y / 2,
      PLANE_CORNER_HUD_Z
    );

    view.hearts.setCount(state.lives);
    this.scalePlaneHudPlane(view.hearts, PLANE_HEART_WORLD_HEIGHT, PLANE_HEART_MAX_WIDTH);
    view.hearts.mesh.visible = visible && state.lives > 0;
    view.hearts.mesh.position.set(
      rightEdge - view.hearts.mesh.scale.x / 2,
      topEdge + PLANE_CORNER_HUD_GAP + view.hearts.mesh.scale.y / 2,
      PLANE_CORNER_HUD_Z
    );
  }

  private updatePlaneStatusHud(view: InstanceView, state: BreakoutoutoutRenderState): void {
    const selected = this.gameStarted && this.isSelectedView(view);
    const statusLabel = selected ? this.planeStatusLabel(state) : '';
    view.statusText.setText(statusLabel, 360);
    view.statusText.mesh.position.set(0, PLANE_STATUS_Y, PLANE_STATUS_Z);
    const showEndGameHud = selected && this.isEndGameHudVisible(state);
    this.updatePlaneRestartButtonHud(view, showEndGameHud);
    this.updateLeaderboardPanelHud(view, showEndGameHud);

    if (statusLabel.length === 0) {
      return;
    }

    this.scalePlaneHudText(view.statusText, PLANE_STATUS_WORLD_HEIGHT, PLANE_STATUS_MAX_WIDTH);
  }

  private updatePlaneRestartButtonHud(view: InstanceView, visible: boolean): void {
    view.restartButtonText.setText(visible ? 'RESTART' : '', 220);
    view.restartButtonText.mesh.position.set(0, PLANE_RESTART_Y, PLANE_RESTART_Z);

    if (!visible) {
      return;
    }

    this.scalePlaneHudText(view.restartButtonText, PLANE_RESTART_WORLD_HEIGHT, PLANE_RESTART_MAX_WIDTH);
  }

  private updateLeaderboardPanelHud(view: InstanceView, visible: boolean): void {
    view.leaderboardPanel.setState(this.leaderboardPanelState());
    view.leaderboardPanel.mesh.visible = visible;
    view.leaderboardPanel.mesh.position.set(0, LEADERBOARD_PANEL_Y, LEADERBOARD_PANEL_Z);

    if (!visible) {
      return;
    }

    this.scalePlaneHudPlane(view.leaderboardPanel, LEADERBOARD_PANEL_WORLD_HEIGHT, LEADERBOARD_PANEL_MAX_WIDTH);
  }

  private isEndGameHudVisible(state: BreakoutoutoutRenderState): boolean {
    return this.isGameFinished() && isTerminalPhase(state.phase);
  }

  private planeStatusLabel(state: BreakoutoutoutRenderState): string {
    if (this.projectorDebug) {
      return `ANGLE ${Math.round(this.projectorDebugAngle * 180 / Math.PI)} DEG`;
    }

    if (state.phase === 'ready') {
      return `READY ${Math.max(1, Math.ceil(state.readyRemaining))}s`;
    }

    if (state.persistentAutoPilotActive) {
      return 'AUTO';
    }

    if (state.pathProjectionActive) {
      return state.pathProjectionRemaining > 0
        ? `PATH ${Math.ceil(state.pathProjectionRemaining)}s`
        : 'PATH';
    }

    if (state.autoPilotActive) {
      return state.autoPilotRemaining > 0
        ? `AUTO ${Math.ceil(state.autoPilotRemaining)}s`
        : 'AUTO';
    }

    return PHASE_STATUS_LABEL[state.phase];
  }

  private scalePlaneHudText(text: HudTextPlane, preferredHeight: number, maxWidth: number): void {
    const aspect = text.cssHeight > 0 ? text.cssWidth / text.cssHeight : 1;
    const height = Math.min(preferredHeight, maxWidth / Math.max(aspect, 0.001));
    text.mesh.scale.set(height * aspect, height, 1);
  }

  private scalePlaneHudPlane(
    plane: { cssWidth: number; cssHeight: number; mesh: THREE.Mesh },
    preferredHeight: number,
    maxWidth: number
  ): void {
    const aspect = plane.cssHeight > 0 ? plane.cssWidth / plane.cssHeight : 1;
    const height = Math.min(preferredHeight, maxWidth / Math.max(aspect, 0.001));
    plane.mesh.scale.set(height * aspect, height, 1);
  }

  private applyInstancePlayStateVisuals(view: InstanceView, terminal: boolean): void {
    view.paddleMesh.visible = !terminal;
    view.ballMesh.visible = !terminal;

    if (view.terminalVisualsApplied === terminal) {
      return;
    }

    view.terminalVisualsApplied = terminal;
    for (const wall of view.wallMeshes) {
      setMaterialGreyscale(wall.material, terminal);
    }

    for (const mesh of view.bricks.values()) {
      setMaterialGreyscale(mesh.material, terminal);
    }

    if (terminal) {
      this.updateSplitGlowIntensity(view, 0);
    }
  }

  private updateFatalMissGreyscaleVisuals(
    view: InstanceView,
    active: boolean,
    terminal: boolean,
    time: number
  ): void {
    if (!active) {
      if (view.fatalGreyscaleApplied) {
        view.fatalGreyscaleApplied = false;
        this.restoreFatalMissGreyscaleVisuals(view, terminal, time);
      }
      return;
    }

    view.fatalGreyscaleApplied = true;
    view.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        setMaterialGreyscale(object.material, true);
      }
    });
  }

  private updateDangerVisuals(view: InstanceView, active: boolean, terminal: boolean, time: number): void {
    if (!active) {
      if (view.dangerVisualsApplied) {
        view.dangerVisualsApplied = false;
        this.restoreFatalMissGreyscaleVisuals(view, terminal, time);
      }
      return;
    }

    const pulse = (Math.sin((time / FATAL_MISS_DANGER_PERIOD) * Math.PI * 2) + 1) / 2;
    const intensity = 0.48 + pulse * 0.52;
    view.dangerVisualsApplied = true;
    view.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        setMaterialDanger(object.material, intensity);
      }
    });
  }

  private restoreFatalMissGreyscaleVisuals(view: InstanceView, terminal: boolean, time: number): void {
    const greyscale = terminal || this.shouldGreyscaleForFatalMiss(view);
    view.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        setMaterialGreyscale(object.material, greyscale);
      }
    });

    if (!greyscale && !terminal) {
      this.updatePaddleAutopilotEffect(
        view.paddleMesh,
        view.renderState.autoPilotActive || view.renderState.persistentAutoPilotActive,
        time
      );
    }
  }

  private updatePaddleAutopilotEffect(mesh: THREE.Mesh, engaged: boolean, time: number): void {
    if (!(mesh.material instanceof THREE.MeshStandardMaterial)) {
      return;
    }

    if (!engaged) {
      mesh.material.color.setHex(PADDLE_COLOR);
      mesh.material.emissive.setHex(PADDLE_EMISSIVE);
      mesh.material.emissiveIntensity = PADDLE_BASE_EMISSIVE_INTENSITY;
      mesh.scale.set(1, 1, 1);
      return;
    }

    const pulse = (Math.sin(time * 14) + 1) / 2;
    mesh.material.color.setHex(PADDLE_AUTOPILOT_COLOR);
    mesh.material.emissive.setHex(PADDLE_AUTOPILOT_EMISSIVE);
    mesh.material.emissiveIntensity = 0.42 + pulse * 1.2;
    mesh.scale.set(1, 1 + pulse * 0.2, 1 + pulse * 0.1);
  }

  private reconcilePlaneViews(): void {
    if (this.instances.length === 0) {
      return;
    }

    this.selectedIndex = positiveModulo(this.selectedIndex, this.instances.length);
    const desiredViews = this.desiredPlaneViews();
    const retainedViews = new Set<InstanceView>();

    for (const desired of desiredViews) {
      const view = this.reusableViewForDesiredPlane(desired, retainedViews)
        ?? this.createVisiblePlaneView(desired);
      retainedViews.add(view);
      this.moveViewToTrack(view, desired.trackIndex);
    }

    for (const view of this.views) {
      if (!retainedViews.has(view)) {
        this.disposePlaneView(view);
      }
    }

    this.views.clear();
    for (const view of retainedViews) {
      this.views.add(view);
    }

    this.updateInstanceOpacity();
  }

  private desiredPlaneViews(): DesiredPlaneView[] {
    const desiredViews: DesiredPlaneView[] = [];
    const instanceCount = this.instances.length;
    const startOffset = this.hasNavigatedInstances ? -1 : 0;

    for (let offset = startOffset; offset <= instanceCount - 1; offset += 1) {
      desiredViews.push({
        instance: this.instances[positiveModulo(this.selectedIndex + offset, instanceCount)],
        trackIndex: this.selectedTrackIndex + offset
      });
    }

    return desiredViews;
  }

  private reusableViewForDesiredPlane(
    desired: DesiredPlaneView,
    retainedViews: ReadonlySet<InstanceView>
  ): InstanceView | null {
    let nearestAdjacentView: InstanceView | null = null;
    let nearestAdjacentDistance = Number.POSITIVE_INFINITY;

    for (const view of this.views) {
      if (retainedViews.has(view) || view.instance !== desired.instance) {
        continue;
      }

      if (view.trackIndex === desired.trackIndex) {
        return view;
      }

      const trackDistance = Math.abs(view.trackIndex - desired.trackIndex);
      if (trackDistance <= 1 && trackDistance < nearestAdjacentDistance) {
        nearestAdjacentView = view;
        nearestAdjacentDistance = trackDistance;
      }
    }

    return nearestAdjacentView;
  }

  private createVisiblePlaneView(desired: DesiredPlaneView): InstanceView {
    const view = this.createInstanceView(desired.instance, desired.trackIndex);
    this.scene.add(view.group);
    return view;
  }

  private moveViewToTrack(view: InstanceView, trackIndex: number): void {
    const targetZ = this.targetPlaneZForTrack(trackIndex);
    view.trackIndex = trackIndex;

    if (Math.abs(view.group.position.z - targetZ) <= 0.001) {
      view.group.position.z = targetZ;
      return;
    }

    view.zTransition = {
      from: view.group.position.z,
      to: targetZ,
      elapsed: 0,
      duration: SPLIT_PLANE_TRAVEL_DURATION,
      selectOnComplete: false
    };
  }

  private disposePlaneView(view: InstanceView): void {
    this.scene.remove(view.group);
    disposeObject(view.group);
  }

  private targetPlaneZForTrack(trackIndex: number): number {
    return -trackIndex * PLANE_Z_GAP;
  }

  private insertIndexAfterSourceTrack(source: BreakoutoutoutInstance, sourceTrackIndex: number): number {
    const sourceIndex = this.instances.indexOf(source);
    if (sourceIndex < 0) {
      return this.instances.length;
    }

    if (sourceTrackIndex < this.selectedTrackIndex) {
      return this.selectedIndex;
    }

    return sourceIndex + 1;
  }

  private trackIndexForInstanceIndex(instanceIndex: number): number {
    if (this.instances.length === 0) {
      return this.selectedTrackIndex;
    }

    return this.selectedTrackIndex
      + positiveModulo(instanceIndex - this.selectedIndex, this.instances.length);
  }

  private maybeSelectAutopilotPaddleThreat(time: number): void {
    if (
      !this.autopilot
      || this.instances.length <= 1
      || this.splitSequenceActive
      || this.isGameFinished()
      || this.isFatalMissSequenceActive()
      || time - this.lastAutopilotSelectionChangeTime < AUTOPILOT_SELECTION_COOLDOWN
    ) {
      return;
    }

    const selected = this.selectedInstance;
    if (selected && autopilotPaddleApproachTime(selected.getRenderState()) !== null) {
      return;
    }

    let nextInstance: BreakoutoutoutInstance | null = null;
    let nextApproachTime = Number.POSITIVE_INFINITY;

    for (const instance of this.instances) {
      if (instance === selected || !instance.isActive()) {
        continue;
      }

      const approachTime = autopilotPaddleApproachTime(instance.getRenderState());
      if (approachTime === null || approachTime >= nextApproachTime) {
        continue;
      }

      nextInstance = instance;
      nextApproachTime = approachTime;
    }

    if (!nextInstance) {
      return;
    }

    const previousIndex = this.selectedIndex;
    this.focusInstance(nextInstance);
    if (this.selectedIndex !== previousIndex) {
      this.lastAutopilotSelectionChangeTime = time;
    }
  }

  private navigateInstances(direction: number): void {
    if (
      !this.gameStarted
      || this.instances.length <= 1
      || direction === 0
      || this.splitSequenceActive
      || this.isGameFinished()
      || this.isFatalMissSequenceActive()
    ) {
      return;
    }

    const step = Math.sign(direction);
    const hasActiveInstance = this.hasActiveInstance();
    const activeSelection = hasActiveInstance
      ? this.findActiveInstanceSelection(this.selectedIndex, step, false)
      : null;
    if (hasActiveInstance && !activeSelection) {
      return;
    }

    const trackOffset = activeSelection?.trackOffset ?? step;
    const nextIndex = activeSelection?.index ?? positiveModulo(this.selectedIndex + step, this.instances.length);
    if (nextIndex === this.selectedIndex) {
      return;
    }

    this.hasNavigatedInstances = true;
    this.selectedIndex = nextIndex;
    this.selectedTrackIndex += trackOffset;
    this.reconcilePlaneViews();
    this.syncBallSpeedForAll();
  }

  private focusInstance(instance: BreakoutoutoutInstance): void {
    const nextIndex = this.instances.indexOf(instance);
    if (nextIndex < 0) {
      return;
    }

    const nearestView = this.viewForInstanceNearestTrack(instance, this.selectedTrackIndex);
    const trackOffset = nearestView
      ? nearestView.trackIndex - this.selectedTrackIndex
      : nextIndex - this.selectedIndex;

    if (nextIndex === this.selectedIndex && trackOffset === 0) {
      return;
    }

    this.hasNavigatedInstances = true;
    this.clearTouchInput();
    this.selectedTrackIndex += trackOffset;
    this.selectedIndex = nextIndex;
    this.reconcilePlaneViews();
    this.syncBallSpeedForAll();
  }

  private selectInstance(index: number): void {
    if (this.instances.length === 0) {
      return;
    }

    const requestedIndex = positiveModulo(index, this.instances.length);
    let nextIndex = requestedIndex;
    let trackOffset = nextIndex - this.selectedIndex;

    if (!this.instances[nextIndex]?.isActive() && this.hasActiveInstance()) {
      const direction = Math.sign(trackOffset) || 1;
      const activeSelection = this.findActiveInstanceSelection(requestedIndex, direction, true)
        ?? this.findActiveInstanceSelection(requestedIndex, -direction, true);
      if (!activeSelection) {
        return;
      }

      nextIndex = activeSelection.index;
      trackOffset += activeSelection.trackOffset;
    }

    if (nextIndex === this.selectedIndex) {
      return;
    }

    this.hasNavigatedInstances = true;
    this.selectedTrackIndex += trackOffset;
    this.selectedIndex = nextIndex;
    this.reconcilePlaneViews();
    this.syncBallSpeedForAll();
  }

  private ensureSelectedInstanceIsActive(preferredDirection: number): void {
    if (this.instances.length === 0 || this.selectedInstance?.isActive() || !this.hasActiveInstance()) {
      return;
    }

    const direction = Math.sign(preferredDirection) || 1;
    const activeSelection = this.findActiveInstanceSelection(this.selectedIndex, direction, false)
      ?? this.findActiveInstanceSelection(this.selectedIndex, -direction, false);
    if (!activeSelection) {
      return;
    }

    this.hasNavigatedInstances = true;
    this.clearTouchInput();
    this.selectedTrackIndex += activeSelection.trackOffset;
    this.selectedIndex = activeSelection.index;
    this.reconcilePlaneViews();
  }

  private hasActiveInstance(): boolean {
    return this.instances.some((instance) => instance.isActive());
  }

  private findActiveInstanceSelection(
    startIndex: number,
    direction: number,
    includeStart: boolean
  ): InstanceSelection | null {
    if (this.instances.length === 0) {
      return null;
    }

    const step = Math.sign(direction) || 1;
    const firstDistance = includeStart ? 0 : 1;
    for (let distance = firstDistance; distance < this.instances.length; distance += 1) {
      const trackOffset = distance * step;
      const index = positiveModulo(startIndex + trackOffset, this.instances.length);
      if (this.instances[index]?.isActive()) {
        return { index, trackOffset };
      }
    }

    return null;
  }

  private updateInstanceOpacity(): void {
    for (const view of this.views) {
      this.setInstanceOpacityTarget(view, this.targetOpacityForView(view));
    }
  }

  private setInstanceOpacityTarget(view: InstanceView, opacity: number): void {
    const targetOpacity = clamp(opacity, 0, 1);
    if (
      Number.isFinite(view.targetOpacity)
      && Math.abs(view.targetOpacity - targetOpacity) <= INSTANCE_OPACITY_EPSILON
    ) {
      return;
    }

    const currentOpacity = Number.isFinite(view.appliedOpacity) ? view.appliedOpacity : targetOpacity;
    view.targetOpacity = targetOpacity;
    if (Math.abs(currentOpacity - targetOpacity) <= INSTANCE_OPACITY_EPSILON) {
      view.opacityTween = undefined;
      this.applyInstanceOpacity(view, targetOpacity);
      return;
    }

    view.opacityTween = {
      from: currentOpacity,
      to: targetOpacity,
      elapsed: 0,
      duration: INSTANCE_OPACITY_TWEEN_DURATION
    };
  }

  private updateInstanceOpacityTweens(delta: number): void {
    for (const view of this.views) {
      const tween = view.opacityTween;
      if (!tween) {
        continue;
      }

      tween.elapsed += Math.max(delta, 0);
      const progress = clamp(tween.elapsed / Math.max(tween.duration, 0.001), 0, 1);
      const opacity = lerp(tween.from, tween.to, easeInOutCubic(progress));
      this.applyInstanceOpacity(view, opacity);

      if (progress >= 1) {
        view.opacityTween = undefined;
        this.applyInstanceOpacity(view, tween.to);
      }
    }
  }

  private applyInstanceOpacity(view: InstanceView, opacity: number): void {
    const nextOpacity = clamp(opacity, 0, 1);
    if (
      Number.isFinite(view.appliedOpacity)
      && Math.abs(view.appliedOpacity - nextOpacity) <= INSTANCE_OPACITY_EPSILON
    ) {
      return;
    }

    view.appliedOpacity = nextOpacity;
    view.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        this.applyMeshOpacity(view, object);
      }
    });
  }

  private applyMeshOpacity(view: InstanceView, mesh: THREE.Mesh): void {
    if (mesh.userData.splitGlow === true) {
      return;
    }

    const opacity = Number.isFinite(view.appliedOpacity) ? view.appliedOpacity : this.targetOpacityForView(view);
    setMaterialOpacity(mesh.material, opacity);
  }

  private targetOpacityForView(view: InstanceView): number {
    if (this.isSelectedView(view)) {
      return SELECTED_OPACITY;
    }

    return this.isSlotAView(view) ? SLOT_A_OPACITY : BACKGROUND_OPACITY;
  }

  private updateCameraPlaneTransition(delta: number): number {
    const targetZ = this.selectedPlaneZ;
    const activeTargetZ = this.cameraPlaneTransition?.to ?? this.cameraFocusZ;

    if (Math.abs(targetZ - activeTargetZ) > CAMERA_PLANE_TRANSITION_EPSILON) {
      if (Math.abs(targetZ - this.cameraFocusZ) <= CAMERA_PLANE_TRANSITION_EPSILON) {
        this.cameraPlaneTransition = null;
        return targetZ;
      }

      this.cameraPlaneTransition = {
        from: this.cameraFocusZ,
        to: targetZ,
        elapsed: 0,
        duration: CAMERA_PLANE_TRANSITION_DURATION
      };
    }

    const transition = this.cameraPlaneTransition;
    if (!transition) {
      return this.cameraFocusZ;
    }

    transition.elapsed += Math.max(delta, 0);
    const progress = clamp(transition.elapsed / Math.max(transition.duration, 0.001), 0, 1);
    const focusZ = lerp(transition.from, transition.to, easeInOutCubic(progress));

    if (progress >= 1) {
      this.cameraPlaneTransition = null;
      return transition.to;
    }

    return focusZ;
  }

  private updateCamera(delta: number): void {
    const selectedInstance = this.selectedInstance;
    const selectedState = selectedInstance?.getRenderState();
    const gameOverCameraActive = this.isGameOverCameraSequenceActive();
    const trackedState = gameOverCameraActive
      ? this.fatalMissInstance?.getRenderState() ?? selectedState
      : selectedState;
    const ballX = trackedState ? clamp(trackedState.ball.x / HALF_WIDTH, -1, 1) : 0;
    const ballY = trackedState ? clamp(trackedState.ball.y / HALF_HEIGHT, -1, 1) : 0;
    const targetLookAtX = gameOverCameraActive && trackedState
      ? clamp(trackedState.ball.x * GAME_OVER_CAMERA_TRACK_X, -HALF_WIDTH * 0.72, HALF_WIDTH * 0.72)
      : 0;
    const targetLookAtY = gameOverCameraActive && trackedState
      ? clamp(trackedState.ball.y * GAME_OVER_CAMERA_TRACK_Y, -HALF_HEIGHT * 0.62, HALF_HEIGHT * 0.62)
      : 0;
    const targetX = gameOverCameraActive
      ? targetLookAtX + ballX * CAMERA_PARALLAX_X * 0.24
      : ballX * CAMERA_PARALLAX_X;
    const targetY = gameOverCameraActive
      ? CAMERA_ELEVATION + targetLookAtY + ballY * CAMERA_PARALLAX_Y * 0.18
      : CAMERA_ELEVATION + ballY * CAMERA_PARALLAX_Y;
    const targetDistance = this.cameraBaseDistance * (gameOverCameraActive ? GAME_OVER_CAMERA_ZOOM : 1);
    const focusZ = this.updateCameraPlaneTransition(delta);
    const normalizedDelta = Math.max(delta, 0.001);
    const blend = gameOverCameraActive
      ? 1 - Math.pow(GAME_OVER_CAMERA_PAN_REMAINING_PER_SECOND, normalizedDelta)
      : 1 - Math.pow(0.0006, normalizedDelta);
    const zoomBlend = gameOverCameraActive
      ? 1 - Math.pow(GAME_OVER_CAMERA_ZOOM_REMAINING_PER_SECOND, normalizedDelta)
      : blend;
    this.cameraFocusX += (targetX - this.cameraFocusX) * blend;
    this.cameraFocusY += (targetY - this.cameraFocusY) * blend;
    this.cameraLookAtX += (targetLookAtX - this.cameraLookAtX) * blend;
    this.cameraLookAtY += (targetLookAtY - this.cameraLookAtY) * blend;
    this.cameraDistance += (targetDistance - this.cameraDistance) * zoomBlend;
    this.cameraFocusZ = focusZ;

    if (gameOverCameraActive) {
      this.gameOverCameraElapsed += Math.max(delta, 0);
    } else {
      this.gameOverCameraElapsed = 0;
    }

    const shake = this.gameOverCameraShake();
    this.camera.position.set(
      this.cameraFocusX + shake.x,
      this.cameraFocusY + shake.y,
      this.cameraFocusZ + this.cameraDistance
    );
    this.camera.lookAt(this.cameraLookAtX, this.cameraLookAtY, this.cameraFocusZ);
    if (shake.roll !== 0) {
      this.camera.rotateZ(shake.roll);
    }
  }

  private gameOverCameraShake(): { x: number; y: number; roll: number } {
    if (!this.isGameOverCameraSequenceActive()) {
      return { x: 0, y: 0, roll: 0 };
    }

    const strength = clamp(this.gameOverCameraElapsed / GAME_OVER_CAMERA_SHAKE_RAMP_DURATION, 0, 1);
    const time = this.gameOverCameraElapsed;
    return {
      x: (Math.sin(time * 29.7) + Math.sin(time * 43.1 + 0.9) * 0.45) * GAME_OVER_CAMERA_SHAKE_X * strength,
      y: (Math.sin(time * 31.4 + 1.7) + Math.sin(time * 19.8) * 0.5) * GAME_OVER_CAMERA_SHAKE_Y * strength,
      roll: Math.sin(time * 37.5 + 0.4) * GAME_OVER_CAMERA_SHAKE_ROLL * strength
    };
  }

  private updatePlaneHudBillboards(): void {
    this.camera.getWorldQuaternion(this.planeHudCameraQuaternion);

    for (const view of this.views) {
      view.group.getWorldQuaternion(this.planeHudParentQuaternion).invert();
      view.scoreText.mesh.quaternion
        .copy(this.planeHudParentQuaternion)
        .multiply(this.planeHudCameraQuaternion);
      view.hearts.mesh.quaternion
        .copy(this.planeHudParentQuaternion)
        .multiply(this.planeHudCameraQuaternion);
      view.statusText.mesh.quaternion
        .copy(this.planeHudParentQuaternion)
        .multiply(this.planeHudCameraQuaternion);
      view.restartButtonText.mesh.quaternion
        .copy(this.planeHudParentQuaternion)
        .multiply(this.planeHudCameraQuaternion);
      view.leaderboardPanel.mesh.quaternion
        .copy(this.planeHudParentQuaternion)
        .multiply(this.planeHudCameraQuaternion);
    }
  }

  private updateSplitTutorialBillboard(): void {
    if (!this.splitTutorial.visible) {
      return;
    }

    this.splitTutorial.mesh.position.set(
      this.cameraLookAtX,
      this.cameraLookAtY,
      this.cameraFocusZ + SPLIT_TUTORIAL_Z_OFFSET
    );
    this.splitTutorial.mesh.quaternion.copy(this.camera.quaternion);
  }

  // private burst(instance: BreakoutoutoutInstance, x: number, y: number, color: number, kind: BrickKind): void {
  //   if (!this.nebula) {
  //     return;
  //   }

  //   const view = this.views.get(instance);
  //   if (!view) {
  //     return;
  //   }

  //   const worldPosition = view.group.localToWorld(new THREE.Vector3(x, y, 0.42));
  //   const { api, system } = this.nebula;
  //   const sprite = new THREE.Sprite(
  //     new THREE.SpriteMaterial({
  //       map: this.particleTexture,
  //       color,
  //       blending: THREE.AdditiveBlending,
  //       transparent: true,
  //       depthWrite: false
  //     })
  //   );

  //   const emitter = new api.Emitter();
  //   const isSplitter = kind === 'splitter';
  //   const isAutopilot = kind === 'autopilot';
  //   const isLife = kind === 'life';
  //   const particleMin = isSplitter ? 46 : isAutopilot ? 36 : isLife ? 40 : 26;
  //   const particleMax = isSplitter ? 64 : isAutopilot ? 52 : isLife ? 56 : 36;
  //   const radiusMax = isSplitter ? 0.28 : isAutopilot ? 0.24 : isLife ? 0.25 : 0.18;
  //   const lifeMax = isSplitter ? 1.0 : isAutopilot ? 0.86 : isLife ? 0.92 : 0.7;
  //   const velocityMin = isSplitter ? 3.8 : isAutopilot ? 3.2 : isLife ? 3.4 : 2.8;
  //   const velocityMax = isSplitter ? 7.2 : isAutopilot ? 6.4 : isLife ? 6.8 : 5.2;
  //   const startScale = isSplitter ? 1.4 : isAutopilot ? 1.22 : isLife ? 1.3 : 1.05;

  //   emitter
  //     .setRate(new api.Rate(new api.Span(particleMin, particleMax), new api.Span(0.015, 0.028)))
  //     .setInitializers([
  //       new api.Body(sprite),
  //       new api.Position(new api.PointZone(worldPosition.x, worldPosition.y, worldPosition.z)),
  //       new api.Mass(1),
  //       new api.Radius(0.08, radiusMax),
  //       new api.Life(0.34, lifeMax),
  //       new api.RadialVelocity(new api.Span(velocityMin, velocityMax), new api.Vector3D(0, 1, 0), 180)
  //     ])
  //     .setBehaviours([
  //       new api.Alpha(0.95, 0),
  //       new api.Scale(startScale, 0.22),
  //       new api.Color(new THREE.Color(color), new THREE.Color(0xffffff))
  //     ]);

  //   system.addEmitter(emitter);
  //   emitter.emit(0.08);
  //   window.setTimeout(() => {
  //     emitter.stopEmit();
  //     system.removeEmitter(emitter);
  //   }, 1_100);
  // }

  private get currentInput(): BreakoutInput {
    const input: BreakoutInput = {
      left: this.keys.has('ArrowLeft'),
      right: this.keys.has('ArrowRight')
    };

    if (this.touchPaddleX !== null) {
      input.paddleX = this.touchPaddleX;
    }

    return input;
  }

  private get selectedPlaneZ(): number {
    return this.targetPlaneZForTrack(this.selectedTrackIndex);
  }

  private get selectedInstance(): BreakoutoutoutInstance | undefined {
    return this.instances[this.selectedIndex];
  }

  private get selectedView(): InstanceView | null {
    return this.viewForInstanceAtTrack(this.selectedInstance, this.selectedTrackIndex);
  }

  private get isMainMenuActive(): boolean {
    return !this.gameStarted && !this.projectorDebug;
  }

  private isFatalMissSequenceActive(): boolean {
    return !this.isGameFinished()
      && this.fatalMissInstance?.getRenderState().fatalMissPending === true;
  }

  private isGameFinished(): boolean {
    return this.totalGameOver || this.totalGameCleared;
  }

  private isGameOverCameraSequenceActive(): boolean {
    return this.isFatalMissSequenceActive();
  }

  private shouldGreyscaleForFatalMiss(view: InstanceView): boolean {
    return this.isFatalMissSequenceActive() && view.instance !== this.fatalMissInstance;
  }

  private isSelectedView(view: InstanceView): boolean {
    return view.instance === this.selectedInstance && view.trackIndex === this.selectedTrackIndex;
  }

  private isSlotAView(view: InstanceView): boolean {
    return view.trackIndex === this.selectedTrackIndex - 1;
  }

  private viewForInstanceAtTrack(
    instance: BreakoutoutoutInstance | undefined,
    trackIndex: number
  ): InstanceView | null {
    if (!instance) {
      return null;
    }

    for (const view of this.views) {
      if (view.instance === instance && view.trackIndex === trackIndex) {
        return view;
      }
    }

    return null;
  }

  private viewForInstanceNearestTrack(
    instance: BreakoutoutoutInstance,
    trackIndex: number
  ): InstanceView | null {
    let nearestView: InstanceView | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const view of this.views) {
      if (view.instance !== instance) {
        continue;
      }

      const distance = Math.abs(view.trackIndex - trackIndex);
      if (distance < nearestDistance) {
        nearestView = view;
        nearestDistance = distance;
      }
    }

    return nearestView;
  }

  private viewsForInstance(instance: BreakoutoutoutInstance): InstanceView[] {
    const views: InstanceView[] = [];
    for (const view of this.views) {
      if (view.instance === instance) {
        views.push(view);
      }
    }

    return views;
  }
}

// function createParticleTexture(): THREE.CanvasTexture {
//   const canvas = document.createElement('canvas');
//   canvas.width = 64;
//   canvas.height = 64;
//   const context = canvas.getContext('2d');
//   if (!context) {
//     throw new Error('Unable to create particle texture.');
//   }

//   const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 31);
//   gradient.addColorStop(0, 'rgba(255,255,255,1)');
//   gradient.addColorStop(0.36, 'rgba(255,255,255,0.72)');
//   gradient.addColorStop(1, 'rgba(255,255,255,0)');
//   context.fillStyle = gradient;
//   context.fillRect(0, 0, canvas.width, canvas.height);

//   const texture = new THREE.CanvasTexture(canvas);
//   texture.needsUpdate = true;
//   return texture;
// }

function createProjectorDebugBricks(): BrickSnapshot[] {
  const bricks: BrickSnapshot[] = [];
  let attempts = 0;

  while (bricks.length < PROJECTOR_DEBUG_BRICK_COUNT && attempts < PROJECTOR_DEBUG_BRICK_COUNT * 90) {
    attempts += 1;
    const width = lerp(PROJECTOR_DEBUG_BRICK_MIN_WIDTH, PROJECTOR_DEBUG_BRICK_MAX_WIDTH, Math.random());
    const height = lerp(PROJECTOR_DEBUG_BRICK_MIN_HEIGHT, PROJECTOR_DEBUG_BRICK_MAX_HEIGHT, Math.random());
    const minX = -HALF_WIDTH + WALL_THICKNESS + width / 2 + PROJECTOR_DEBUG_BRICK_GAP;
    const maxX = HALF_WIDTH - WALL_THICKNESS - width / 2 - PROJECTOR_DEBUG_BRICK_GAP;
    const x = lerp(minX, maxX, Math.random());
    const y = lerp(PROJECTOR_DEBUG_MIN_Y, PROJECTOR_DEBUG_MAX_Y, Math.random());
    const candidate: BrickSnapshot = {
      id: `projector-debug-${bricks.length}`,
      row: -1,
      col: bricks.length,
      x,
      y,
      width,
      height,
      color: PROJECTOR_DEBUG_COLORS[Math.floor(Math.random() * PROJECTOR_DEBUG_COLORS.length)],
      points: 0,
      kind: 'normal',
      hit: false
    };

    if (!overlapsProjectorDebugBrick(candidate, bricks)) {
      bricks.push(candidate);
    }
  }

  return bricks;
}

function overlapsProjectorDebugBrick(candidate: BrickSnapshot, bricks: readonly BrickSnapshot[]): boolean {
  return bricks.some((brick) => {
    const xOverlap = Math.abs(candidate.x - brick.x)
      < (candidate.width + brick.width) / 2 + PROJECTOR_DEBUG_BRICK_GAP;
    const yOverlap = Math.abs(candidate.y - brick.y)
      < (candidate.height + brick.height) / 2 + PROJECTOR_DEBUG_BRICK_GAP;
    return xOverlap && yOverlap;
  });
}

class TrajectoryProjection {
  readonly mesh: THREE.InstancedMesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;

  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3(1, 1, 1);
  private phaseDistance = 0;
  private lastUpdateTime: number | null = null;
  private lastOrigin: TrajectoryPoint | null = null;

  constructor() {
    const geometry = new THREE.CircleGeometry(1, 14);
    const material = makeFadeableMaterial(new THREE.MeshBasicMaterial({
      color: PROJECTOR_BEAM_DEFAULTS.color,
      transparent: true,
      opacity: PROJECTOR_BEAM_DEFAULTS.opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      toneMapped: false
    }));
    this.mesh = new THREE.InstancedMesh(geometry, material, TRAJECTORY_PROJECTION_MAX_DOTS_LIMIT);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = PROJECTOR_BEAM_DEFAULTS.renderOrder;
    this.mesh.visible = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }

  update(points: readonly TrajectoryPoint[], time: number, settings: ProjectorBeamSettings): void {
    this.applySettings(settings);
    const segments = createTrajectorySegments(points, settings);
    const lastSegment = segments[segments.length - 1];
    const totalLength = lastSegment ? lastSegment.distanceStart + lastSegment.length : 0;

    if (totalLength <= settings.epsilon) {
      this.resetPhase();
      this.mesh.count = 0;
      this.mesh.visible = false;
      return;
    }

    const firstSegment = segments[0];
    this.updatePhase(time, firstSegment, settings);

    let dotIndex = 0;
    const dotLimit = Math.min(Math.floor(settings.maxDots), TRAJECTORY_PROJECTION_MAX_DOTS_LIMIT);
    let distance = positiveModulo(this.phaseDistance, settings.dotSpacing);

    while (distance <= totalLength && dotIndex < dotLimit) {
      const point = sampleTrajectorySegments(segments, distance);
      this.position.set(point.x, point.y, settings.z);
      this.scale.setScalar(Math.max(0.001, settings.dotRadius));
      this.matrix.compose(this.position, this.rotation, this.scale);
      this.mesh.setMatrixAt(dotIndex, this.matrix);

      dotIndex += 1;
      distance += settings.dotSpacing;
    }

    this.mesh.count = dotIndex;
    this.mesh.visible = dotIndex > 0;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  private updatePhase(time: number, firstSegment: TrajectorySegment, settings: ProjectorBeamSettings): void {
    const directionX = (firstSegment.end.x - firstSegment.start.x) / firstSegment.length;
    const directionY = (firstSegment.end.y - firstSegment.start.y) / firstSegment.length;
    const lastTime = this.lastUpdateTime;
    const lastOrigin = this.lastOrigin;
    const hasLastPhase = lastTime !== null && lastOrigin !== null;
    const delta = hasLastPhase ? time - lastTime : 0;

    if (!hasLastPhase || !Number.isFinite(delta) || delta < 0) {
      this.phaseDistance = 0;
    } else {
      const originTravel = (firstSegment.start.x - lastOrigin.x) * directionX
        + (firstSegment.start.y - lastOrigin.y) * directionY;
      this.phaseDistance += delta * settings.marchSpeed - originTravel;
      this.phaseDistance = positiveModulo(this.phaseDistance, settings.dotSpacing);
    }

    this.lastUpdateTime = time;
    this.lastOrigin = { ...firstSegment.start };
  }

  resetPhase(): void {
    this.phaseDistance = 0;
    this.lastUpdateTime = null;
    this.lastOrigin = null;
  }

  private applySettings(settings: ProjectorBeamSettings): void {
    this.mesh.renderOrder = Math.floor(settings.renderOrder);
    this.mesh.material.color.setHex(settings.color);
    this.mesh.material.opacity = settings.opacity;
    this.mesh.material.userData.baseOpacity = settings.opacity;
  }
}

function createTrajectoryProjectionPath(
  state: BreakoutoutoutRenderState,
  settings: ProjectorBeamSettings
): TrajectoryPoint[] {
  const speed = Math.hypot(state.ball.vx, state.ball.vy);
  if (speed <= settings.epsilon) {
    return [];
  }

  const startPoint = clampTrajectoryPointToPlayfield(state.ball.x, state.ball.y, settings);
  let x = startPoint.x;
  let y = startPoint.y;
  let directionX = state.ball.vx / speed;
  let directionY = state.ball.vy / speed;
  let traveled = 0;
  const points: TrajectoryPoint[] = [{ x, y }];
  const obstacles: TrajectoryObstacle[] = state.bricks
    .filter((brick) => !brick.hit)
    .map((brick) => ({
      x: brick.x,
      y: brick.y,
      width: brick.width,
      height: brick.height
    }));

  for (let bounce = 0; bounce < settings.maxBounces; bounce += 1) {
    const paddleDistance = distanceToPaddleY(y, directionY, settings);
    const hit = nearestTrajectoryHit(x, y, directionX, directionY, obstacles, settings);

    if (
      paddleDistance !== null
      && paddleDistance <= (hit?.distance ?? Number.POSITIVE_INFINITY)
      && traveled + paddleDistance <= settings.maxDistance
    ) {
      points.push({
        x: x + directionX * paddleDistance,
        y: PADDLE_Y
      });
      return points;
    }

    if (!hit) {
      return points.length > 1 ? points : [];
    }

    const remainingDistance = settings.maxDistance - traveled;
    const segmentDistance = Math.min(hit.distance, remainingDistance);
    if (segmentDistance <= settings.epsilon) {
      return points.length > 1 ? points : [];
    }

    const nextPoint = {
      x: x + directionX * segmentDistance,
      y: y + directionY * segmentDistance
    };
    points.push(nextPoint);
    traveled += segmentDistance;

    if (segmentDistance < hit.distance || traveled >= settings.maxDistance) {
      return points;
    }

    if (typeof hit.brickIndex === 'number') {
      obstacles.splice(hit.brickIndex, 1);
    }

    if (hit.normalX !== 0) {
      directionX *= -1;
    }
    if (hit.normalY !== 0) {
      directionY *= -1;
    }

    const advancedPoint = clampTrajectoryPointToPlayfield(
      nextPoint.x + hit.normalX * settings.surfaceClearance,
      nextPoint.y + hit.normalY * settings.surfaceClearance,
      settings
    );
    x = advancedPoint.x;
    y = advancedPoint.y;
  }

  return points.length > 1 ? points : [];
}

function clampTrajectoryPointToPlayfield(x: number, y: number, settings: ProjectorBeamSettings): TrajectoryPoint {
  const bounds = trajectoryProjectionWallBounds(settings);
  return {
    x: clamp(x, bounds.left, bounds.right),
    y: Math.min(y, bounds.top)
  };
}

function distanceToPaddleY(y: number, directionY: number, settings: ProjectorBeamSettings): number | null {
  if (directionY >= -settings.epsilon) {
    return null;
  }

  const distance = (PADDLE_Y - y) / directionY;
  return distance > settings.epsilon ? distance : null;
}

function nearestTrajectoryHit(
  x: number,
  y: number,
  directionX: number,
  directionY: number,
  obstacles: readonly TrajectoryObstacle[],
  settings: ProjectorBeamSettings
): TrajectoryHit | null {
  let nearest = wallTrajectoryHit(x, y, directionX, directionY, settings);

  for (let index = 0; index < obstacles.length; index += 1) {
    const hit = rayAabbTrajectoryHit(x, y, directionX, directionY, obstacles[index], settings);
    if (!hit || (nearest && hit.distance >= nearest.distance - settings.cornerTolerance)) {
      continue;
    }

    nearest = {
      ...hit,
      brickIndex: index
    };
  }

  return nearest;
}

function wallTrajectoryHit(
  x: number,
  y: number,
  directionX: number,
  directionY: number,
  settings: ProjectorBeamSettings
): TrajectoryHit | null {
  let nearest: TrajectoryHit | null = null;
  const bounds = trajectoryProjectionWallBounds(settings);

  if (directionX < -settings.epsilon) {
    nearest = mergeTrajectoryHit(nearest, {
      distance: (bounds.left - x) / directionX,
      normalX: 1,
      normalY: 0
    }, settings);
  } else if (directionX > settings.epsilon) {
    nearest = mergeTrajectoryHit(nearest, {
      distance: (bounds.right - x) / directionX,
      normalX: -1,
      normalY: 0
    }, settings);
  }

  if (directionY > settings.epsilon) {
    nearest = mergeTrajectoryHit(nearest, {
      distance: (bounds.top - y) / directionY,
      normalX: 0,
      normalY: -1
    }, settings);
  }

  return nearest;
}

function trajectoryProjectionWallBounds(settings: ProjectorBeamSettings): { left: number; right: number; top: number } {
  return {
    left: -HALF_WIDTH + BALL_RADIUS + settings.wallGuard,
    right: HALF_WIDTH - BALL_RADIUS - settings.wallGuard,
    top: HALF_HEIGHT - BALL_RADIUS - settings.wallGuard
  };
}

function mergeTrajectoryHit(
  current: TrajectoryHit | null,
  candidate: TrajectoryHit,
  settings: ProjectorBeamSettings
): TrajectoryHit | null {
  if (candidate.distance <= settings.epsilon) {
    return current;
  }

  if (!current || candidate.distance < current.distance - settings.cornerTolerance) {
    return candidate;
  }

  if (Math.abs(candidate.distance - current.distance) <= settings.cornerTolerance) {
    return {
      distance: Math.min(current.distance, candidate.distance),
      normalX: current.normalX || candidate.normalX,
      normalY: current.normalY || candidate.normalY,
      brickIndex: current.brickIndex ?? candidate.brickIndex
    };
  }

  return current;
}

function rayAabbTrajectoryHit(
  x: number,
  y: number,
  directionX: number,
  directionY: number,
  obstacle: TrajectoryObstacle,
  settings: ProjectorBeamSettings
): TrajectoryHit | null {
  const minX = obstacle.x - obstacle.width / 2 - BALL_RADIUS;
  const maxX = obstacle.x + obstacle.width / 2 + BALL_RADIUS;
  const minY = obstacle.y - obstacle.height / 2 - BALL_RADIUS;
  const maxY = obstacle.y + obstacle.height / 2 + BALL_RADIUS;
  let entryDistance = Number.NEGATIVE_INFINITY;
  let exitDistance = Number.POSITIVE_INFINITY;
  let normalX = 0;
  let normalY = 0;

  if (Math.abs(directionX) <= settings.epsilon) {
    if (x < minX || x > maxX) {
      return null;
    }
  } else {
    const nearX = (minX - x) / directionX;
    const farX = (maxX - x) / directionX;
    const xEntry = Math.min(nearX, farX);
    const xExit = Math.max(nearX, farX);
    if (xEntry > entryDistance + settings.cornerTolerance) {
      entryDistance = xEntry;
      normalX = nearX > farX ? 1 : -1;
      normalY = 0;
    } else if (Math.abs(xEntry - entryDistance) <= settings.cornerTolerance) {
      normalX = nearX > farX ? 1 : -1;
    }
    exitDistance = Math.min(exitDistance, xExit);
  }

  if (Math.abs(directionY) <= settings.epsilon) {
    if (y < minY || y > maxY) {
      return null;
    }
  } else {
    const nearY = (minY - y) / directionY;
    const farY = (maxY - y) / directionY;
    const yEntry = Math.min(nearY, farY);
    const yExit = Math.max(nearY, farY);
    if (yEntry > entryDistance + settings.cornerTolerance) {
      entryDistance = yEntry;
      normalX = 0;
      normalY = nearY > farY ? 1 : -1;
    } else if (Math.abs(yEntry - entryDistance) <= settings.cornerTolerance) {
      normalY = nearY > farY ? 1 : -1;
    }
    exitDistance = Math.min(exitDistance, yExit);
  }

  if (entryDistance > exitDistance || exitDistance <= settings.epsilon) {
    return null;
  }

  if (entryDistance <= settings.epsilon) {
    return null;
  }

  return {
    distance: entryDistance,
    normalX,
    normalY
  };
}

function createTrajectorySegments(
  points: readonly TrajectoryPoint[],
  settings: ProjectorBeamSettings
): TrajectorySegment[] {
  const segments: TrajectorySegment[] = [];
  let distanceStart = 0;

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    if (length <= settings.epsilon) {
      continue;
    }

    segments.push({ start, end, length, distanceStart });
    distanceStart += length;
  }

  return segments;
}

function sampleTrajectorySegments(segments: readonly TrajectorySegment[], distance: number): TrajectoryPoint {
  for (const segment of segments) {
    if (distance > segment.distanceStart + segment.length) {
      continue;
    }

    const amount = clamp((distance - segment.distanceStart) / segment.length, 0, 1);
    return {
      x: lerp(segment.start.x, segment.end.x, amount),
      y: lerp(segment.start.y, segment.end.y, amount)
    };
  }

  const fallback = segments[segments.length - 1]?.end;
  return fallback ? { ...fallback } : { x: 0, y: 0 };
}

function trimTrajectoryProjectionPath(
  points: readonly TrajectoryPoint[],
  ball: BreakoutoutoutRenderState['ball'],
  previousDistance: number,
  settings: ProjectorBeamSettings
): { points: TrajectoryPoint[]; distance: number; driftSquared: number } {
  const segments = createTrajectorySegments(points, settings);
  const lastSegment = segments[segments.length - 1];
  const totalLength = lastSegment ? lastSegment.distanceStart + lastSegment.length : 0;
  if (totalLength <= settings.epsilon) {
    return { points: [], distance: 0, driftSquared: 0 };
  }

  const progress = nearestTrajectoryProgress(segments, ball, previousDistance, settings);
  const distance = progress.distance;
  if (totalLength - distance <= settings.epsilon) {
    return { points: [], distance, driftSquared: progress.driftSquared };
  }

  const visiblePoints: TrajectoryPoint[] = [sampleTrajectorySegments(segments, distance)];
  for (const segment of segments) {
    if (segment.distanceStart + segment.length <= distance + settings.epsilon) {
      continue;
    }

    visiblePoints.push({ ...segment.end });
  }

  return {
    points: visiblePoints.length > 1 ? visiblePoints : [],
    distance,
    driftSquared: progress.driftSquared
  };
}

function nearestTrajectoryProgress(
  segments: readonly TrajectorySegment[],
  ball: BreakoutoutoutRenderState['ball'],
  previousDistance: number,
  settings: ProjectorBeamSettings
): { distance: number; driftSquared: number } {
  const lastSegment = segments[segments.length - 1];
  const totalLength = lastSegment ? lastSegment.distanceStart + lastSegment.length : 0;
  const searchStart = clamp(previousDistance - settings.dotSpacing * 1.5, 0, totalLength);
  const velocityLength = Math.hypot(ball.vx, ball.vy);
  const velocityX = velocityLength > settings.epsilon ? ball.vx / velocityLength : 0;
  const velocityY = velocityLength > settings.epsilon ? ball.vy / velocityLength : 0;
  let bestDistance = clamp(previousDistance, 0, totalLength);
  let bestDistanceSquared = Number.POSITIVE_INFINITY;
  let bestAlignment = Number.NEGATIVE_INFINITY;

  for (const segment of segments) {
    const segmentEndDistance = segment.distanceStart + segment.length;
    if (segmentEndDistance < searchStart) {
      continue;
    }

    const dx = segment.end.x - segment.start.x;
    const dy = segment.end.y - segment.start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= settings.epsilon * settings.epsilon) {
      continue;
    }

    const minAmount = clamp((searchStart - segment.distanceStart) / segment.length, 0, 1);
    const projectedAmount = clamp(
      ((ball.x - segment.start.x) * dx + (ball.y - segment.start.y) * dy) / lengthSquared,
      minAmount,
      1
    );
    const projectedX = segment.start.x + dx * projectedAmount;
    const projectedY = segment.start.y + dy * projectedAmount;
    const distanceX = ball.x - projectedX;
    const distanceY = ball.y - projectedY;
    const distanceSquared = distanceX * distanceX + distanceY * distanceY;
    const alignment = velocityLength > settings.epsilon
      ? (dx / segment.length) * velocityX + (dy / segment.length) * velocityY
      : 0;

    if (
      distanceSquared < bestDistanceSquared - settings.epsilon
      || (
        Math.abs(distanceSquared - bestDistanceSquared) <= settings.epsilon
        && alignment > bestAlignment
      )
    ) {
      bestDistanceSquared = distanceSquared;
      bestAlignment = alignment;
      bestDistance = segment.distanceStart + segment.length * projectedAmount;
    }
  }

  return {
    distance: clamp(bestDistance, 0, totalLength),
    driftSquared: Number.isFinite(bestDistanceSquared) ? bestDistanceSquared : 0
  };
}

function trajectoryProjectionPathSettingsSignature(settings: ProjectorBeamSettings): string {
  return [
    settings.maxBounces,
    settings.maxDistance,
    settings.epsilon,
    settings.wallGuard,
    settings.cornerTolerance,
    settings.surfaceClearance
  ].map(formatTrajectorySignatureNumber).join(',');
}

function trajectoryProjectionInputSignature(input: BreakoutInput): string {
  return [
    Number(input.left),
    Number(input.right),
    typeof input.paddleX === 'number' ? formatTrajectorySignatureNumber(input.paddleX) : ''
  ].join(':');
}

function trajectoryProjectionBrickSignature(bricks: readonly BrickSnapshot[]): string {
  return bricks
    .filter((brick) => !brick.hit)
    .map((brick) => [
      brick.id,
      formatTrajectorySignatureNumber(brick.x),
      formatTrajectorySignatureNumber(brick.y),
      formatTrajectorySignatureNumber(brick.width),
      formatTrajectorySignatureNumber(brick.height)
    ].join(':'))
    .join('|');
}

function formatTrajectorySignatureNumber(value: number): string {
  return Number.isFinite(value) ? value.toFixed(5) : String(value);
}

type ProjectorBeamPanelOptions = {
  settings: ProjectorBeamSettings;
  onNumericChange: (key: ProjectorBeamNumericSettingKey, value: number) => void;
  onColorChange: (color: number) => void;
  onReset: () => void;
  onExport: () => string;
  onLaunchTest?: () => void;
};

type ProjectorBeamControlElements = {
  range: HTMLInputElement;
  numeric: HTMLInputElement;
  value: HTMLSpanElement;
};

class ProjectorBeamPanel {
  readonly element: HTMLDivElement;

  private readonly body: HTMLDivElement;
  private readonly toggleButton: HTMLButtonElement;
  private readonly colorInput: HTMLInputElement;
  private readonly colorValue: HTMLSpanElement;
  private readonly outputWrap: HTMLDivElement;
  private readonly output: HTMLTextAreaElement;
  private readonly status: HTMLSpanElement;
  private readonly controls = new Map<ProjectorBeamNumericSettingKey, ProjectorBeamControlElements>();
  private readonly options: ProjectorBeamPanelOptions;
  private expanded = false;

  constructor(root: HTMLElement, options: ProjectorBeamPanelOptions) {
    this.options = options;
    this.element = document.createElement('div');
    this.element.className = 'post-processing-panel projector-beam-panel is-collapsed';
    this.element.addEventListener('keydown', stopEventPropagation);
    this.element.addEventListener('keyup', stopEventPropagation);
    this.element.addEventListener('pointerdown', stopEventPropagation);
    this.element.addEventListener('pointermove', stopEventPropagation);
    this.element.addEventListener('pointerup', stopEventPropagation);
    this.element.addEventListener('pointercancel', stopEventPropagation);

    this.toggleButton = document.createElement('button');
    this.toggleButton.type = 'button';
    this.toggleButton.className = 'post-processing-panel__toggle';
    this.toggleButton.textContent = 'Beam';
    this.toggleButton.setAttribute('aria-expanded', 'false');
    this.toggleButton.addEventListener('click', () => this.setExpanded(!this.expanded));
    this.toggleButton.setAttribute('hidden', 'true');

    this.body = document.createElement('div');
    this.body.className = 'post-processing-panel__body';
    this.body.hidden = true;

    const header = document.createElement('div');
    header.className = 'post-processing-panel__header';
    const title = document.createElement('h2');
    title.textContent = 'Projector Beam';
    const actions = document.createElement('div');
    actions.className = 'post-processing-panel__actions';
    const resetButton = this.createActionButton('Reset');
    resetButton.addEventListener('click', () => {
      this.options.onReset();
      this.status.textContent = 'Reset';
    });
    const buttons: HTMLButtonElement[] = [resetButton];
    if (this.options.onLaunchTest) {
      const launchButton = this.createActionButton('Launch');
      launchButton.addEventListener('click', () => {
        this.options.onLaunchTest?.();
        this.status.textContent = 'Launched';
      });
      buttons.push(launchButton);
    }
    const exportButton = this.createActionButton('Export');
    exportButton.addEventListener('click', () => this.exportSettings());
    const copyButton = this.createActionButton('Copy');
    copyButton.addEventListener('click', () => this.copyExport());
    buttons.push(exportButton, copyButton);
    actions.append(...buttons);
    header.append(title, actions);
    this.body.append(header);

    const form = document.createElement('div');
    form.className = 'post-processing-panel__controls';
    const colorControl = this.createColorControl(options.settings.color);
    this.colorInput = colorControl.input;
    this.colorValue = colorControl.value;
    form.append(colorControl.field);
    for (const control of PROJECTOR_BEAM_CONTROLS) {
      form.append(this.createNumericControl(control, options.settings[control.key]));
    }
    this.status = document.createElement('span');
    this.status.className = 'post-processing-panel__status';
    this.body.append(form);

    this.outputWrap = document.createElement('div');
    this.outputWrap.className = 'post-processing-panel__output';
    this.outputWrap.hidden = true;
    this.output = document.createElement('textarea');
    this.output.readOnly = true;
    this.output.spellcheck = false;
    this.output.rows = 8;
    this.output.setAttribute('aria-label', 'Exported projector beam settings');
    this.outputWrap.append(this.output, this.status);
    this.body.append(this.outputWrap);

    this.element.append(this.toggleButton, this.body);
    root.appendChild(this.element);
  }

  setSettings(settings: ProjectorBeamSettings): void {
    this.setColor(settings.color);
    for (const control of PROJECTOR_BEAM_CONTROLS) {
      this.setValue(control.key, settings[control.key]);
    }
  }

  setColor(color: number): void {
    const formattedColor = formatHexColor(color);
    this.colorInput.value = formattedColor;
    this.colorValue.textContent = formattedColor.toUpperCase();
    this.refreshExportIfVisible();
  }

  setValue(key: ProjectorBeamNumericSettingKey, value: number): void {
    const elements = this.controls.get(key);
    const control = projectorBeamControlDefinitionForKey(key);
    if (!elements || !control) {
      return;
    }

    const formattedValue = formatControlValue(value, control.decimals);
    elements.range.value = String(value);
    elements.numeric.value = formattedValue;
    elements.value.textContent = formattedValue;
    this.refreshExportIfVisible();
  }

  private createColorControl(color: number): {
    field: HTMLLabelElement;
    input: HTMLInputElement;
    value: HTMLSpanElement;
  } {
    const field = document.createElement('label');
    field.className = 'post-processing-panel__control projector-beam-panel__color-control';

    const labelRow = document.createElement('span');
    labelRow.className = 'post-processing-panel__label-row';
    const label = document.createElement('span');
    label.textContent = 'Color';
    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'post-processing-panel__value';
    valueDisplay.textContent = formatHexColor(color).toUpperCase();
    labelRow.append(label, valueDisplay);

    const input = document.createElement('input');
    input.type = 'color';
    input.value = formatHexColor(color);
    input.setAttribute('aria-label', 'Projector beam color');
    input.addEventListener('input', () => {
      const parsedColor = parseHexColor(input.value);
      if (parsedColor === null) {
        return;
      }

      this.options.onColorChange(parsedColor);
      this.refreshExportIfVisible();
      this.status.textContent = '';
    });

    field.append(labelRow, input);
    return { field, input, value: valueDisplay };
  }

  private createNumericControl(control: ProjectorBeamControlDefinition, value: number): HTMLLabelElement {
    const field = document.createElement('label');
    field.className = 'post-processing-panel__control';

    const labelRow = document.createElement('span');
    labelRow.className = 'post-processing-panel__label-row';
    const label = document.createElement('span');
    label.textContent = control.label;
    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'post-processing-panel__value';
    valueDisplay.textContent = formatControlValue(value, control.decimals);
    labelRow.append(label, valueDisplay);

    const range = document.createElement('input');
    range.type = 'range';
    range.min = String(control.min);
    range.max = String(control.max);
    range.step = String(control.step);
    range.value = String(value);
    range.setAttribute('aria-label', `${control.label} slider`);
    range.addEventListener('input', () => this.changeValue(control, range.valueAsNumber));

    const numeric = document.createElement('input');
    numeric.type = 'number';
    numeric.min = String(control.min);
    numeric.max = String(control.max);
    numeric.step = String(control.step);
    numeric.value = formatControlValue(value, control.decimals);
    numeric.setAttribute('aria-label', `${control.label} value`);
    numeric.addEventListener('input', () => this.changeValue(control, numeric.valueAsNumber));
    numeric.addEventListener('blur', () => {
      const current = normalizeProjectorBeamValue(control.key, this.options.settings[control.key]);
      this.setValue(control.key, current);
    });

    this.controls.set(control.key, {
      range,
      numeric,
      value: valueDisplay
    });

    field.append(labelRow, range, numeric);
    return field;
  }

  private changeValue(control: ProjectorBeamControlDefinition, value: number): void {
    if (!Number.isFinite(value)) {
      return;
    }

    this.options.onNumericChange(control.key, value);
    this.status.textContent = '';
  }

  private createActionButton(label: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    return button;
  }

  private setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.body.hidden = !expanded;
    this.element.classList.toggle('is-collapsed', !expanded);
    this.toggleButton.textContent = expanded ? 'Hide Beam' : 'Beam';
    this.toggleButton.setAttribute('aria-expanded', String(expanded));
  }

  private exportSettings(): void {
    this.output.value = this.options.onExport();
    this.outputWrap.hidden = false;
    this.output.focus();
    this.output.select();
    this.status.textContent = 'Exported';
  }

  private copyExport(): void {
    if (this.output.value.length === 0) {
      this.exportSettings();
    }

    if (navigator.clipboard) {
      void navigator.clipboard.writeText(this.output.value)
        .then(() => {
          this.status.textContent = 'Copied';
        })
        .catch(() => {
          this.output.focus();
          this.output.select();
          this.status.textContent = 'Select text';
        });
      return;
    }

    this.output.focus();
    this.output.select();
    this.status.textContent = 'Select text';
  }

  private refreshExportIfVisible(): void {
    if (!this.outputWrap.hidden) {
      this.output.value = this.options.onExport();
    }
  }
}

type PostProcessingPanelOptions = {
  settings: PostProcessingSettings;
  onChange: (key: PostProcessingSettingKey, value: number) => void;
  onReset: () => void;
  onExport: () => string;
};

type PostProcessingControlElements = {
  range: HTMLInputElement;
  numeric: HTMLInputElement;
  value: HTMLSpanElement;
};

class PostProcessingPanel {
  readonly element: HTMLDivElement;

  private readonly body: HTMLDivElement;
  private readonly toggleButton: HTMLButtonElement;
  private readonly outputWrap: HTMLDivElement;
  private readonly output: HTMLTextAreaElement;
  private readonly status: HTMLSpanElement;
  private readonly controls = new Map<PostProcessingSettingKey, PostProcessingControlElements>();
  private readonly options: PostProcessingPanelOptions;
  private expanded = false;

  constructor(root: HTMLElement, options: PostProcessingPanelOptions) {
    this.options = options;
    this.element = document.createElement('div');
    this.element.className = 'post-processing-panel is-collapsed';
    this.element.addEventListener('keydown', stopEventPropagation);
    this.element.addEventListener('keyup', stopEventPropagation);
    this.element.addEventListener('pointerdown', stopEventPropagation);
    this.element.addEventListener('pointermove', stopEventPropagation);
    this.element.addEventListener('pointerup', stopEventPropagation);
    this.element.addEventListener('pointercancel', stopEventPropagation);

    this.toggleButton = document.createElement('button');
    this.toggleButton.type = 'button';
    this.toggleButton.className = 'post-processing-panel__toggle';
    this.toggleButton.textContent = 'Post FX';
    this.toggleButton.setAttribute('aria-expanded', 'false');
    this.toggleButton.addEventListener('click', () => this.setExpanded(!this.expanded));
    this.toggleButton.setAttribute('hidden', 'true');

    this.body = document.createElement('div');
    this.body.className = 'post-processing-panel__body';
    this.body.hidden = true;

    const header = document.createElement('div');
    header.className = 'post-processing-panel__header';
    const title = document.createElement('h2');
    title.textContent = 'Post FX';

    const actions = document.createElement('div');
    actions.className = 'post-processing-panel__actions';
    const resetButton = this.createActionButton('Reset');
    resetButton.addEventListener('click', () => {
      this.options.onReset();
      this.status.textContent = 'Reset';
    });
    const exportButton = this.createActionButton('Export');
    exportButton.addEventListener('click', () => this.exportSettings());
    const copyButton = this.createActionButton('Copy');
    copyButton.addEventListener('click', () => this.copyExport());
    actions.append(resetButton, exportButton, copyButton);

    header.append(title, actions);
    this.body.append(header);

    const form = document.createElement('div');
    form.className = 'post-processing-panel__controls';
    for (const control of POST_PROCESSING_CONTROLS) {
      form.append(this.createControl(control, options.settings[control.key]));
    }
    this.body.append(form);

    this.outputWrap = document.createElement('div');
    this.outputWrap.className = 'post-processing-panel__output';
    this.outputWrap.hidden = true;
    this.output = document.createElement('textarea');
    this.output.readOnly = true;
    this.output.spellcheck = false;
    this.output.rows = 8;
    this.output.setAttribute('aria-label', 'Exported post processing settings');
    this.status = document.createElement('span');
    this.status.className = 'post-processing-panel__status';
    this.outputWrap.append(this.output, this.status);
    this.body.append(this.outputWrap);

    this.element.append(this.toggleButton, this.body);
    root.appendChild(this.element);
  }

  setSettings(settings: PostProcessingSettings): void {
    for (const control of POST_PROCESSING_CONTROLS) {
      this.setValue(control.key, settings[control.key]);
    }
  }

  setValue(key: PostProcessingSettingKey, value: number): void {
    const elements = this.controls.get(key);
    const control = controlDefinitionForKey(key);
    if (!elements || !control) {
      return;
    }

    const formattedValue = formatControlValue(value, control.decimals);
    elements.range.value = String(value);
    elements.numeric.value = formattedValue;
    elements.value.textContent = formattedValue;
    this.refreshExportIfVisible();
  }

  private createControl(control: PostProcessingControlDefinition, value: number): HTMLLabelElement {
    const field = document.createElement('label');
    field.className = 'post-processing-panel__control';

    const labelRow = document.createElement('span');
    labelRow.className = 'post-processing-panel__label-row';
    const label = document.createElement('span');
    label.textContent = control.label;
    const valueDisplay = document.createElement('span');
    valueDisplay.className = 'post-processing-panel__value';
    valueDisplay.textContent = formatControlValue(value, control.decimals);
    labelRow.append(label, valueDisplay);

    const range = document.createElement('input');
    range.type = 'range';
    range.min = String(control.min);
    range.max = String(control.max);
    range.step = String(control.step);
    range.value = String(value);
    range.setAttribute('aria-label', `${control.label} slider`);
    range.addEventListener('input', () => this.changeValue(control, range.valueAsNumber));

    const numeric = document.createElement('input');
    numeric.type = 'number';
    numeric.min = String(control.min);
    numeric.max = String(control.max);
    numeric.step = String(control.step);
    numeric.value = formatControlValue(value, control.decimals);
    numeric.setAttribute('aria-label', `${control.label} value`);
    numeric.addEventListener('input', () => this.changeValue(control, numeric.valueAsNumber));
    numeric.addEventListener('blur', () => {
      const current = normalizePostProcessingValue(control.key, this.options.settings[control.key]);
      this.setValue(control.key, current);
    });

    this.controls.set(control.key, {
      range,
      numeric,
      value: valueDisplay
    });

    field.append(labelRow, range, numeric);
    return field;
  }

  private changeValue(control: PostProcessingControlDefinition, value: number): void {
    if (!Number.isFinite(value)) {
      return;
    }

    this.options.onChange(control.key, value);
    this.status.textContent = '';
  }

  private createActionButton(label: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    return button;
  }

  private setExpanded(expanded: boolean): void {
    this.expanded = expanded;
    this.body.hidden = !expanded;
    this.element.classList.toggle('is-collapsed', !expanded);
    this.toggleButton.textContent = expanded ? 'Hide FX' : 'Post FX';
    this.toggleButton.setAttribute('aria-expanded', String(expanded));
  }

  private exportSettings(): void {
    this.output.value = this.options.onExport();
    this.outputWrap.hidden = false;
    this.output.focus();
    this.output.select();
    this.status.textContent = 'Exported';
  }

  private copyExport(): void {
    if (this.output.value.length === 0) {
      this.exportSettings();
    }

    if (navigator.clipboard) {
      void navigator.clipboard.writeText(this.output.value)
        .then(() => {
          this.status.textContent = 'Copied';
        })
        .catch(() => {
          this.output.focus();
          this.output.select();
          this.status.textContent = 'Select text';
        });
      return;
    }

    this.output.focus();
    this.output.select();
    this.status.textContent = 'Select text';
  }

  private refreshExportIfVisible(): void {
    if (!this.outputWrap.hidden) {
      this.output.value = this.options.onExport();
    }
  }
}

type HudTextPlaneOptions = {
  fontSize: number;
  fill: string;
  weight?: 'normal' | 'bold';
  paddingX?: number;
  paddingY?: number;
  minWidth?: number;
  minHeight?: number;
  background?: string;
  border?: string;
  borderWidth?: number;
  radius?: number;
  renderOrder: number;
  opacity?: number;
};

class HudTextPlane {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

  private readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly options: HudTextPlaneOptions;
  private texture: THREE.CanvasTexture;
  private lastText = '';
  private lastMaxCssWidth = -1;

  cssWidth = 1;
  cssHeight = 1;

  constructor(options: HudTextPlaneOptions) {
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to create HUD text canvas.');
    }

    this.context = context;
    this.options = options;
    this.texture = createHudCanvasTexture(this.canvas);

    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      opacity: options.opacity ?? 1,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.material.userData.baseOpacity = this.material.opacity;
    this.material.userData.forceTransparent = true;

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = options.renderOrder;
    this.mesh.visible = false;
  }

  setText(text: string, maxCssWidth = Number.POSITIVE_INFINITY): void {
    const nextMaxCssWidth = Number.isFinite(maxCssWidth) ? Math.max(1, Math.floor(maxCssWidth)) : -1;
    if (text === this.lastText && nextMaxCssWidth === this.lastMaxCssWidth) {
      return;
    }

    this.lastText = text;
    this.lastMaxCssWidth = nextMaxCssWidth;

    const paddingX = this.options.paddingX ?? 0;
    const paddingY = this.options.paddingY ?? 0;
    const minWidth = this.options.minWidth ?? 1;
    const minHeight = this.options.minHeight ?? 1;
    const maxWidth = nextMaxCssWidth > 0 ? nextMaxCssWidth : Number.POSITIVE_INFINITY;
    const visibleText = text.length > 0 ? text : ' ';
    const fontSize = this.fittedFontSize(visibleText, maxWidth, paddingX);
    const font = this.font(fontSize);

    this.context.font = font;
    const metrics = this.context.measureText(visibleText);
    const width = Math.max(1, Math.ceil(Math.max(minWidth, metrics.width + paddingX * 2)));
    const height = Math.max(1, Math.ceil(Math.max(minHeight, fontSize * 1.28 + paddingY * 2)));

    this.cssWidth = Math.min(width, maxWidth);
    this.cssHeight = height;
    this.resizeCanvas(Math.ceil(this.cssWidth * HUD_TEXTURE_SCALE), Math.ceil(this.cssHeight * HUD_TEXTURE_SCALE));

    this.context.setTransform(HUD_TEXTURE_SCALE, 0, 0, HUD_TEXTURE_SCALE, 0, 0);
    this.context.clearRect(0, 0, this.cssWidth, this.cssHeight);

    if (this.options.background) {
      roundedRectPath(this.context, 0, 0, this.cssWidth, this.cssHeight, this.options.radius ?? 0);
      this.context.fillStyle = this.options.background;
      this.context.fill();
    }

    if (this.options.border && (this.options.borderWidth ?? 0) > 0) {
      const borderWidth = this.options.borderWidth ?? 1;
      const inset = borderWidth / 2;
      roundedRectPath(
        this.context,
        inset,
        inset,
        this.cssWidth - borderWidth,
        this.cssHeight - borderWidth,
        this.options.radius ?? 0
      );
      this.context.strokeStyle = this.options.border;
      this.context.lineWidth = borderWidth;
      this.context.stroke();
    }

    this.context.font = font;
    this.context.fillStyle = this.options.fill;
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    this.context.fillText(visibleText, this.cssWidth / 2, this.cssHeight / 2, Math.max(1, this.cssWidth - paddingX * 2));

    this.texture.needsUpdate = true;
    this.mesh.visible = text.length > 0;
  }

  private resizeCanvas(width: number, height: number): void {
    if (this.canvas.width === width && this.canvas.height === height) {
      return;
    }

    this.canvas.width = width;
    this.canvas.height = height;
    const oldTexture = this.texture;
    this.texture = createHudCanvasTexture(this.canvas);
    this.material.map = this.texture;
    this.material.needsUpdate = true;
    oldTexture.dispose();
  }

  private fittedFontSize(text: string, maxWidth: number, paddingX: number): number {
    const baseFontSize = this.options.fontSize;
    if (!Number.isFinite(maxWidth)) {
      return baseFontSize;
    }

    this.context.font = this.font(baseFontSize);
    const measuredWidth = Math.max(1, this.context.measureText(text).width);
    const availableWidth = Math.max(1, maxWidth - paddingX * 2);
    if (measuredWidth <= availableWidth) {
      return baseFontSize;
    }

    return Math.max(10, Math.floor(baseFontSize * (availableWidth / measuredWidth)));
  }

  private font(fontSize: number): string {
    return `${this.options.weight ?? 'bold'} ${fontSize}px ${HUD_FONT_FAMILY}`;
  }
}

type HudHeartsPlaneOptions = {
  renderOrder: number;
};

class HudHeartsPlane {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

  private readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private readonly material: THREE.MeshBasicMaterial;
  private texture: THREE.CanvasTexture;
  private lastCount = -1;

  cssWidth = 1;
  cssHeight = 1;

  constructor(options: HudHeartsPlaneOptions) {
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to create HUD hearts canvas.');
    }

    this.context = context;
    this.texture = createHudCanvasTexture(this.canvas);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.material.userData.baseOpacity = this.material.opacity;
    this.material.userData.forceTransparent = true;

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = options.renderOrder;
    this.mesh.visible = false;
  }

  setCount(count: number): void {
    const safeCount = Math.max(0, Math.floor(count));
    if (safeCount === this.lastCount) {
      return;
    }

    this.lastCount = safeCount;

    const heartSize = 22;
    const gap = 6;
    const padding = 2;
    const width = safeCount > 0 ? padding * 2 + safeCount * heartSize + (safeCount - 1) * gap : 1;
    const height = safeCount > 0 ? padding * 2 + heartSize : 1;

    this.cssWidth = width;
    this.cssHeight = height;
    this.resizeCanvas(Math.ceil(width * HUD_TEXTURE_SCALE), Math.ceil(height * HUD_TEXTURE_SCALE));

    this.context.setTransform(HUD_TEXTURE_SCALE, 0, 0, HUD_TEXTURE_SCALE, 0, 0);
    this.context.clearRect(0, 0, width, height);

    for (let index = 0; index < safeCount; index += 1) {
      const x = padding + heartSize / 2 + index * (heartSize + gap);
      drawHudHeart(this.context, x, padding + heartSize / 2, heartSize);
    }

    this.texture.needsUpdate = true;
    this.mesh.visible = safeCount > 0;
  }

  private resizeCanvas(width: number, height: number): void {
    if (this.canvas.width === width && this.canvas.height === height) {
      return;
    }

    this.canvas.width = width;
    this.canvas.height = height;
    const oldTexture = this.texture;
    this.texture = createHudCanvasTexture(this.canvas);
    this.material.map = this.texture;
    this.material.needsUpdate = true;
    oldTexture.dispose();
  }
}

class LeaderboardPanelPlane {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  readonly cssWidth = 720;
  readonly cssHeight = 520;

  private readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private readonly material: THREE.MeshBasicMaterial;
  private texture: THREE.CanvasTexture;
  private lastSignature = '';

  constructor(renderOrder: number) {
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to create leaderboard canvas.');
    }

    this.context = context;
    this.texture = createHudCanvasTexture(this.canvas);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.material.userData.baseOpacity = this.material.opacity;
    this.material.userData.forceTransparent = true;

    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    this.mesh.visible = false;
    this.resizeCanvas(
      Math.ceil(this.cssWidth * HUD_TEXTURE_SCALE),
      Math.ceil(this.cssHeight * HUD_TEXTURE_SCALE)
    );
    this.setState({
      mode: 'loading',
      entries: [],
      score: 0,
      name: '',
      message: ''
    });
  }

  setState(state: LeaderboardPanelState): void {
    const signature = JSON.stringify({
      mode: state.mode,
      entries: state.entries,
      score: state.score,
      name: state.name,
      message: state.message
    });
    if (signature === this.lastSignature) {
      return;
    }

    this.lastSignature = signature;
    this.draw(state);
  }

  private draw(state: LeaderboardPanelState): void {
    const context = this.context;
    context.setTransform(HUD_TEXTURE_SCALE, 0, 0, HUD_TEXTURE_SCALE, 0, 0);
    context.clearRect(0, 0, this.cssWidth, this.cssHeight);

    context.shadowColor = 'rgba(45, 212, 191, 0.28)';
    context.shadowBlur = 24;
    roundedRectPath(context, 10, 10, this.cssWidth - 20, this.cssHeight - 20, 10);
    context.fillStyle = 'rgba(7, 10, 15, 0.9)';
    context.fill();
    context.shadowBlur = 0;
    context.lineWidth = 3;
    context.strokeStyle = 'rgba(167, 243, 208, 0.64)';
    context.stroke();

    context.lineWidth = 1;
    context.strokeStyle = 'rgba(240, 201, 93, 0.24)';
    roundedRectPath(context, 28, 28, this.cssWidth - 56, this.cssHeight - 56, 6);
    context.stroke();

    this.drawHeader(state.score);
    this.drawEntries(state.entries);
    this.drawFooter(state);

    this.texture.needsUpdate = true;
  }

  private drawHeader(score: number): void {
    this.context.textBaseline = 'middle';
    this.context.textAlign = 'left';
    this.context.font = `900 32px ${HUD_FONT_FAMILY}`;
    this.context.fillStyle = '#f8fafc';
    this.context.fillText('TOP 10', 52, 58);

    this.context.textAlign = 'right';
    this.context.font = `800 22px ${HUD_FONT_FAMILY}`;
    this.context.fillStyle = '#f0c95d';
    this.context.fillText(`SCORE ${formatLeaderboardScore(score)}`, this.cssWidth - 52, 58);

    this.context.globalAlpha = 0.22;
    this.context.strokeStyle = '#a7f3d0';
    this.context.beginPath();
    this.context.moveTo(52, 92);
    this.context.lineTo(this.cssWidth - 52, 92);
    this.context.stroke();
    this.context.globalAlpha = 1;
  }

  private drawEntries(entries: readonly LeaderboardEntry[]): void {
    const rowTop = 110;
    const rowHeight = 28;

    if (entries.length === 0) {
      this.context.textAlign = 'center';
      this.context.textBaseline = 'middle';
      this.context.font = `800 24px ${HUD_FONT_FAMILY}`;
      this.context.fillStyle = 'rgba(244, 249, 248, 0.62)';
      this.context.fillText('NO SCORES YET', this.cssWidth / 2, rowTop + rowHeight * 4.7);
      return;
    }

    this.context.textBaseline = 'middle';
    for (let index = 0; index < 10; index += 1) {
      const y = rowTop + index * rowHeight;
      const entry = entries[index];
      this.context.globalAlpha = index % 2 === 0 ? 0.08 : 0.035;
      this.context.fillStyle = '#a7f3d0';
      roundedRectPath(this.context, 50, y - 12, this.cssWidth - 100, 24, 4);
      this.context.fill();
      this.context.globalAlpha = entry ? 1 : 0.35;

      this.context.textAlign = 'right';
      this.context.font = `800 18px ${HUD_FONT_FAMILY}`;
      this.context.fillStyle = '#7dd3fc';
      this.context.fillText(String(index + 1).padStart(2, '0'), 86, y);

      this.context.textAlign = 'left';
      this.context.font = `900 20px ${HUD_FONT_FAMILY}`;
      this.context.fillStyle = '#f8fafc';
      this.context.fillText(entry?.name ?? '------', 112, y);

      this.context.textAlign = 'right';
      this.context.font = `800 20px ${HUD_FONT_FAMILY}`;
      this.context.fillStyle = '#f0c95d';
      this.context.fillText(entry ? formatLeaderboardScore(entry.score) : '-----', this.cssWidth - 58, y);
    }

    this.context.globalAlpha = 1;
  }

  private drawFooter(state: LeaderboardPanelState): void {
    const footerTop = 405;
    this.context.globalAlpha = 0.22;
    this.context.strokeStyle = '#a7f3d0';
    this.context.beginPath();
    this.context.moveTo(52, footerTop - 20);
    this.context.lineTo(this.cssWidth - 52, footerTop - 20);
    this.context.stroke();
    this.context.globalAlpha = 1;

    if (state.mode === 'loading') {
      this.drawFooterMessage('LOADING SCORES', '#a7f3d0');
      return;
    }

    if (state.mode === 'unavailable') {
      this.drawFooterMessage('LEADERBOARD OFFLINE', '#fb7185');
      return;
    }

    if (state.mode === 'entry' || state.mode === 'error' || state.mode === 'submitting') {
      this.drawNameEntry(state);
      return;
    }

    if (state.mode === 'submitted') {
      this.drawFooterMessage(state.message || 'SAVED', '#a7f3d0');
    }
  }

  private drawNameEntry(state: LeaderboardPanelState): void {
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    this.context.font = `900 26px ${HUD_FONT_FAMILY}`;
    this.context.fillStyle = state.mode === 'error' ? '#fb7185' : '#f8fafc';
    this.context.fillText(state.message || 'NEW TOP SCORE', this.cssWidth / 2, 410);

    const boxSize = 42;
    const gap = 9;
    const totalWidth = LEADERBOARD_NAME_MAX_LENGTH * boxSize + (LEADERBOARD_NAME_MAX_LENGTH - 1) * gap;
    const startX = (this.cssWidth - totalWidth) / 2;
    for (let index = 0; index < LEADERBOARD_NAME_MAX_LENGTH; index += 1) {
      const x = startX + index * (boxSize + gap);
      const character = state.name[index] ?? '';
      roundedRectPath(this.context, x, 438, boxSize, boxSize, 6);
      this.context.fillStyle = character ? 'rgba(240, 201, 93, 0.92)' : 'rgba(244, 249, 248, 0.08)';
      this.context.fill();
      this.context.lineWidth = 2;
      this.context.strokeStyle = character ? '#fff3be' : 'rgba(167, 243, 208, 0.38)';
      this.context.stroke();

      if (character) {
        this.context.font = `900 24px ${HUD_FONT_FAMILY}`;
        this.context.fillStyle = '#08090d';
        this.context.fillText(character, x + boxSize / 2, 438 + boxSize / 2 + 1);
      }
    }

    this.context.font = `800 15px ${HUD_FONT_FAMILY}`;
    this.context.fillStyle = state.mode === 'submitting' ? '#a7f3d0' : 'rgba(244, 249, 248, 0.58)';
    this.context.fillText(state.mode === 'submitting' ? 'VERIFYING' : 'ENTER SAVE   ESC SKIP', this.cssWidth / 2, 500);
  }

  private drawFooterMessage(message: string, fill: string): void {
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    this.context.font = `900 26px ${HUD_FONT_FAMILY}`;
    this.context.fillStyle = fill;
    this.context.fillText(message, this.cssWidth / 2, 450);
  }

  private resizeCanvas(width: number, height: number): void {
    if (this.canvas.width === width && this.canvas.height === height) {
      return;
    }

    this.canvas.width = width;
    this.canvas.height = height;
    const oldTexture = this.texture;
    this.texture = createHudCanvasTexture(this.canvas);
    this.material.map = this.texture;
    this.material.needsUpdate = true;
    oldTexture.dispose();
  }
}

class MainMenuView {
  readonly group = new THREE.Group();
  readonly buttonMeshes: THREE.Mesh[];

  private readonly cameraForward = new THREE.Vector3();
  private readonly title = new MainMenuTitlePlane(MAIN_MENU_RENDER_ORDER + 3);
  private readonly subtitle = new HudTextPlane({
    fontSize: 34,
    fill: '#a7f3d0',
    weight: 'bold',
    paddingX: 0,
    paddingY: 0,
    renderOrder: MAIN_MENU_RENDER_ORDER + 3
  });
  private readonly buttons = new Map<MainMenuAction, MenuButtonPlane>();
  private hoveredAction: MainMenuAction | null = null;
  private pressedAction: MainMenuAction | null = null;

  constructor() {
    this.title.mesh.position.set(0, MAIN_MENU_TITLE_Y, MAIN_MENU_BUTTON_Z + 0.08);
    scaleMenuCanvasPlane(
      this.title.mesh,
      this.title.cssWidth,
      this.title.cssHeight,
      MAIN_MENU_TITLE_WORLD_HEIGHT,
      MAIN_MENU_TITLE_MAX_WIDTH
    );
    this.group.add(this.title.mesh);

    this.subtitle.setText('multidimensional breakout', 520);
    this.subtitle.mesh.position.set(0, MAIN_MENU_SUBTITLE_Y, MAIN_MENU_BUTTON_Z + 0.06);
    scaleMenuCanvasPlane(
      this.subtitle.mesh,
      this.subtitle.cssWidth,
      this.subtitle.cssHeight,
      MAIN_MENU_SUBTITLE_WORLD_HEIGHT,
      MAIN_MENU_SUBTITLE_MAX_WIDTH
    );
    this.group.add(this.subtitle.mesh);

    const startButton = new MenuButtonPlane('start', 'start game', MAIN_MENU_RENDER_ORDER + 4);
    startButton.mesh.position.set(0, MAIN_MENU_START_BUTTON_Y, MAIN_MENU_BUTTON_Z + 0.1);
    scaleMenuCanvasPlane(
      startButton.mesh,
      startButton.cssWidth,
      startButton.cssHeight,
      MAIN_MENU_BUTTON_WORLD_HEIGHT,
      MAIN_MENU_BUTTON_MAX_WIDTH
    );
    this.buttons.set('start', startButton);

    this.buttonMeshes = [startButton.mesh];
    this.group.add(startButton.mesh);
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
    if (!visible) {
      this.setHoveredAction(null);
      this.setPressedAction(null);
    }
  }

  setHoveredAction(action: MainMenuAction | null): void {
    this.hoveredAction = action;
    this.refreshButtonStates();
  }

  setPressedAction(action: MainMenuAction | null): void {
    this.pressedAction = action;
    this.refreshButtonStates();
  }

  update(time: number, camera: THREE.Camera, distance: number): void {
    if (!this.group.visible) {
      return;
    }

    camera.getWorldDirection(this.cameraForward);
    this.group.position
      .copy(camera.position)
      .addScaledVector(this.cameraForward, distance);
    this.group.quaternion.copy(camera.quaternion);
    this.group.translateY(Math.sin(time * 0.9) * 0.035);
    this.group.rotateZ(Math.sin(time * 0.42) * 0.004);
  }

  private refreshButtonStates(): void {
    for (const [action, button] of this.buttons) {
      const hovered = action === this.hoveredAction;
      button.setState(hovered, hovered && action === this.pressedAction);
    }
  }
}

class PauseMenuView {
  readonly group = new THREE.Group();
  readonly buttonMeshes: THREE.Mesh[];

  private readonly cameraForward = new THREE.Vector3();
  private readonly panel = new PauseMenuPanelPlane(PAUSE_MENU_RENDER_ORDER);
  private readonly title = new HudTextPlane({
    fontSize: 54,
    fill: '#f8fafc',
    weight: 'bold',
    paddingX: 0,
    paddingY: 0,
    renderOrder: PAUSE_MENU_RENDER_ORDER + 1
  });
  private readonly buttons = new Map<PauseMenuAction, MenuButtonPlane>();
  private hoveredAction: PauseMenuAction | null = null;
  private pressedAction: PauseMenuAction | null = null;

  constructor() {
    this.panel.mesh.position.set(0, 0, PAUSE_MENU_Z);
    scaleMenuCanvasPlane(
      this.panel.mesh,
      this.panel.cssWidth,
      this.panel.cssHeight,
      PAUSE_MENU_PANEL_WORLD_HEIGHT,
      PAUSE_MENU_PANEL_MAX_WIDTH
    );
    this.group.add(this.panel.mesh);

    this.title.setText('Paused', 360);
    this.title.mesh.position.set(0, PAUSE_MENU_TITLE_Y, PAUSE_MENU_Z + 0.04);
    scaleMenuCanvasPlane(
      this.title.mesh,
      this.title.cssWidth,
      this.title.cssHeight,
      PAUSE_MENU_TITLE_WORLD_HEIGHT,
      PAUSE_MENU_TITLE_MAX_WIDTH
    );
    this.group.add(this.title.mesh);

    const resumeButton = new MenuButtonPlane('resume', 'resume', PAUSE_MENU_RENDER_ORDER + 2, 'pauseMenuAction');
    resumeButton.mesh.position.set(0, PAUSE_MENU_BUTTON_Y, PAUSE_MENU_Z + 0.06);
    scaleMenuCanvasPlane(
      resumeButton.mesh,
      resumeButton.cssWidth,
      resumeButton.cssHeight,
      PAUSE_MENU_BUTTON_WORLD_HEIGHT,
      PAUSE_MENU_BUTTON_MAX_WIDTH
    );
    this.buttons.set('resume', resumeButton);

    this.buttonMeshes = [resumeButton.mesh];
    this.group.add(resumeButton.mesh);
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
    if (!visible) {
      this.setHoveredAction(null);
      this.setPressedAction(null);
    }
  }

  setHoveredAction(action: PauseMenuAction | null): void {
    this.hoveredAction = action;
    this.refreshButtonStates();
  }

  setPressedAction(action: PauseMenuAction | null): void {
    this.pressedAction = action;
    this.refreshButtonStates();
  }

  update(time: number, camera: THREE.Camera, distance: number): void {
    if (!this.group.visible) {
      return;
    }

    camera.getWorldDirection(this.cameraForward);
    this.group.position
      .copy(camera.position)
      .addScaledVector(this.cameraForward, distance);
    this.group.quaternion.copy(camera.quaternion);
    this.group.translateY(Math.sin(time * 0.76) * 0.028);
    this.group.rotateZ(Math.sin(time * 0.38) * 0.0035);
  }

  private refreshButtonStates(): void {
    for (const [action, button] of this.buttons) {
      const hovered = action === this.hoveredAction;
      button.setState(hovered, hovered && action === this.pressedAction);
    }
  }
}

class MainMenuTitlePlane {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

  private readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private readonly material: THREE.MeshBasicMaterial;
  private texture: THREE.CanvasTexture;

  cssWidth = 1;
  cssHeight = 1;

  constructor(renderOrder: number) {
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to create main menu title canvas.');
    }

    this.context = context;
    this.texture = createHudCanvasTexture(this.canvas);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.material.userData.forceTransparent = true;
    this.material.userData.baseOpacity = this.material.opacity;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    this.draw();
  }

  private draw(): void {
    const segments = [
      { text: 'Break', size: 96, fill: '#f8fafc' },
      { text: 'out', size: 96, fill: '#f8fafc' },
      { text: 'out', size: 82, fill: '#7dd3fc' },
      { text: 'out', size: 70, fill: '#f0c95d' }
    ] as const;
    const paddingX = 22;
    const paddingY = 18;
    const baseline = 104;
    let textWidth = 0;

    for (const segment of segments) {
      this.context.font = titleFont(segment.size);
      textWidth += this.context.measureText(segment.text).width;
    }

    this.cssWidth = Math.ceil(textWidth + paddingX * 2);
    this.cssHeight = 142;
    this.resizeCanvas(
      Math.ceil(this.cssWidth * HUD_TEXTURE_SCALE),
      Math.ceil(this.cssHeight * HUD_TEXTURE_SCALE)
    );

    this.context.setTransform(HUD_TEXTURE_SCALE, 0, 0, HUD_TEXTURE_SCALE, 0, 0);
    this.context.clearRect(0, 0, this.cssWidth, this.cssHeight);
    this.context.textBaseline = 'alphabetic';
    this.context.textAlign = 'left';
    this.context.shadowColor = 'rgba(45, 212, 191, 0.42)';
    this.context.shadowBlur = 18;

    let x = (this.cssWidth - textWidth) / 2;
    for (const segment of segments) {
      this.context.font = titleFont(segment.size);
      this.context.fillStyle = segment.fill;
      this.context.fillText(segment.text, x, baseline + paddingY * 0.08);
      x += this.context.measureText(segment.text).width;
    }

    this.context.shadowBlur = 0;
    this.texture.needsUpdate = true;
  }

  private resizeCanvas(width: number, height: number): void {
    if (this.canvas.width === width && this.canvas.height === height) {
      return;
    }

    this.canvas.width = width;
    this.canvas.height = height;
    const oldTexture = this.texture;
    this.texture = createHudCanvasTexture(this.canvas);
    this.material.map = this.texture;
    this.material.needsUpdate = true;
    oldTexture.dispose();
  }
}

class PauseMenuPanelPlane {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  readonly cssWidth = 620;
  readonly cssHeight = 300;

  private readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private readonly material: THREE.MeshBasicMaterial;
  private texture: THREE.CanvasTexture;

  constructor(renderOrder: number) {
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to create pause menu panel canvas.');
    }

    this.context = context;
    this.texture = createHudCanvasTexture(this.canvas);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.material.userData.forceTransparent = true;
    this.material.userData.baseOpacity = this.material.opacity;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    this.resizeCanvas(
      Math.ceil(this.cssWidth * HUD_TEXTURE_SCALE),
      Math.ceil(this.cssHeight * HUD_TEXTURE_SCALE)
    );
    this.draw();
  }

  private draw(): void {
    this.context.setTransform(HUD_TEXTURE_SCALE, 0, 0, HUD_TEXTURE_SCALE, 0, 0);
    this.context.clearRect(0, 0, this.cssWidth, this.cssHeight);

    this.context.shadowColor = 'rgba(45, 212, 191, 0.26)';
    this.context.shadowBlur = 22;
    roundedRectPath(this.context, 10, 10, this.cssWidth - 20, this.cssHeight - 20, 10);
    this.context.fillStyle = 'rgba(7, 10, 15, 0.88)';
    this.context.fill();

    this.context.shadowBlur = 0;
    this.context.lineWidth = 3;
    this.context.strokeStyle = 'rgba(167, 243, 208, 0.6)';
    this.context.stroke();

    this.context.lineWidth = 1;
    this.context.strokeStyle = 'rgba(240, 201, 93, 0.26)';
    roundedRectPath(this.context, 24, 24, this.cssWidth - 48, this.cssHeight - 48, 6);
    this.context.stroke();

    this.context.globalAlpha = 0.16;
    this.context.strokeStyle = '#a7f3d0';
    for (let y = 40; y < this.cssHeight - 36; y += 16) {
      this.context.beginPath();
      this.context.moveTo(44, y);
      this.context.lineTo(this.cssWidth - 44, y);
      this.context.stroke();
    }
    this.context.globalAlpha = 1;

    this.texture.needsUpdate = true;
  }

  private resizeCanvas(width: number, height: number): void {
    if (this.canvas.width === width && this.canvas.height === height) {
      return;
    }

    this.canvas.width = width;
    this.canvas.height = height;
    const oldTexture = this.texture;
    this.texture = createHudCanvasTexture(this.canvas);
    this.material.map = this.texture;
    this.material.needsUpdate = true;
    oldTexture.dispose();
  }
}

class MenuButtonPlane {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  readonly cssWidth = 430;
  readonly cssHeight = 102;

  private readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private readonly material: THREE.MeshBasicMaterial;
  private readonly label: string;
  private texture: THREE.CanvasTexture;
  private hovered = false;
  private pressed = false;

  constructor(
    action: MenuButtonAction,
    label: string,
    renderOrder: number,
    userDataKey: 'menuAction' | 'pauseMenuAction' = 'menuAction'
  ) {
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to create main menu button canvas.');
    }

    this.context = context;
    this.label = label;
    this.texture = createHudCanvasTexture(this.canvas);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.material.userData.forceTransparent = true;
    this.material.userData.baseOpacity = this.material.opacity;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    this.mesh.userData[userDataKey] = action;
    this.resizeCanvas(
      Math.ceil(this.cssWidth * HUD_TEXTURE_SCALE),
      Math.ceil(this.cssHeight * HUD_TEXTURE_SCALE)
    );
    this.draw();
  }

  setState(hovered: boolean, pressed: boolean): void {
    if (this.hovered === hovered && this.pressed === pressed) {
      return;
    }

    this.hovered = hovered;
    this.pressed = pressed;
    this.draw();
  }

  private draw(): void {
    const radius = 8;
    const borderWidth = this.hovered ? 3 : 2;
    const fill = this.pressed
      ? '#f0c95d'
      : this.hovered
        ? '#1f2937'
        : 'rgba(8, 13, 18, 0.86)';
    const border = this.pressed
      ? '#fff3be'
      : this.hovered
        ? '#f0c95d'
        : 'rgba(167, 243, 208, 0.66)';
    const textFill = this.pressed ? '#08090d' : '#f8fafc';

    this.context.setTransform(HUD_TEXTURE_SCALE, 0, 0, HUD_TEXTURE_SCALE, 0, 0);
    this.context.clearRect(0, 0, this.cssWidth, this.cssHeight);
    this.context.shadowColor = this.hovered ? 'rgba(240, 201, 93, 0.35)' : 'rgba(45, 212, 191, 0.22)';
    this.context.shadowBlur = this.hovered ? 16 : 10;
    roundedRectPath(this.context, 3, 3, this.cssWidth - 6, this.cssHeight - 6, radius);
    this.context.fillStyle = fill;
    this.context.fill();
    this.context.shadowBlur = 0;
    this.context.lineWidth = borderWidth;
    this.context.strokeStyle = border;
    this.context.stroke();

    this.context.font = `800 38px ${HUD_FONT_FAMILY}`;
    this.context.fillStyle = textFill;
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    this.context.fillText(this.label, this.cssWidth / 2, this.cssHeight / 2 + (this.pressed ? 1 : 0));
    this.texture.needsUpdate = true;
  }

  private resizeCanvas(width: number, height: number): void {
    if (this.canvas.width === width && this.canvas.height === height) {
      return;
    }

    this.canvas.width = width;
    this.canvas.height = height;
    const oldTexture = this.texture;
    this.texture = createHudCanvasTexture(this.canvas);
    this.material.map = this.texture;
    this.material.needsUpdate = true;
    oldTexture.dispose();
  }
}

class SplitTutorialView {
  readonly mesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;

  private readonly canvas = document.createElement('canvas');
  private readonly context: CanvasRenderingContext2D;
  private readonly material: THREE.MeshBasicMaterial;
  private texture: THREE.CanvasTexture;
  private mode: SplitTutorialMode | null = null;

  cssWidth = 760;
  cssHeight = 150;

  constructor(renderOrder: number) {
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('Unable to create split tutorial canvas.');
    }

    this.context = context;
    this.texture = createHudCanvasTexture(this.canvas);
    this.material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    this.material.userData.baseOpacity = this.material.opacity;
    this.material.userData.forceTransparent = true;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), this.material);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = renderOrder;
    this.mesh.visible = false;
    this.resizeCanvas(
      Math.ceil(this.cssWidth * HUD_TEXTURE_SCALE),
      Math.ceil(this.cssHeight * HUD_TEXTURE_SCALE)
    );
    this.setMode('keyboard');
  }

  get visible(): boolean {
    return this.mesh.visible;
  }

  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }

  setMode(mode: SplitTutorialMode): void {
    if (this.mode === mode) {
      return;
    }

    this.mode = mode;
    this.draw();
    scaleMenuCanvasPlane(
      this.mesh,
      this.cssWidth,
      this.cssHeight,
      SPLIT_TUTORIAL_WORLD_HEIGHT,
      SPLIT_TUTORIAL_MAX_WIDTH
    );
  }

  private draw(): void {
    this.context.setTransform(HUD_TEXTURE_SCALE, 0, 0, HUD_TEXTURE_SCALE, 0, 0);
    this.context.clearRect(0, 0, this.cssWidth, this.cssHeight);
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    this.context.shadowColor = 'rgba(0, 0, 0, 0.92)';
    this.context.shadowBlur = 12;
    this.context.lineWidth = 5;
    this.context.strokeStyle = 'rgba(0, 0, 0, 0.72)';
    this.context.font = `900 32px ${HUD_FONT_FAMILY}`;

    if (this.mode === 'touch') {
      this.drawMobileTutorial();
    } else {
      this.drawKeyboardTutorial();
    }

    this.context.shadowBlur = 0;
    this.texture.needsUpdate = true;
  }

  private drawKeyboardTutorial(): void {
    const text = 'change dimension with';
    const textX = 300;
    const centerY = 76;
    this.context.strokeText(text, textX, centerY);
    this.context.fillStyle = '#f8fafc';
    this.context.fillText(text, textX, centerY);
    this.context.shadowBlur = 6;
    this.drawKeycap(565, 76, '↑');
    this.drawKeycap(632, 76, '↓');
  }

  private drawMobileTutorial(): void {
    const text = 'change dimension with swipe up/down';
    this.context.strokeText(text, 352, 76);
    this.context.fillStyle = '#f8fafc';
    this.context.fillText(text, 352, 76);
    this.drawSwipeGlyph(662, 76);
  }

  private drawKeycap(centerX: number, centerY: number, label: string): void {
    const width = 54;
    const height = 54;
    const x = centerX - width / 2;
    const y = centerY - height / 2;

    this.context.save();
    this.context.shadowColor = 'rgba(125, 211, 252, 0.38)';
    this.context.shadowBlur = 16;
    roundedRectPath(this.context, x, y, width, height, 8);
    this.context.fillStyle = '#e0f2fe';
    this.context.fill();
    this.context.shadowBlur = 0;
    this.context.lineWidth = 3;
    this.context.strokeStyle = '#38bdf8';
    this.context.stroke();
    this.context.font = `900 30px ${HUD_FONT_FAMILY}`;
    this.context.fillStyle = '#07111a';
    this.context.textAlign = 'center';
    this.context.textBaseline = 'middle';
    this.context.fillText(label, centerX, centerY - 1);
    this.context.restore();
  }

  private drawSwipeGlyph(centerX: number, centerY: number): void {
    this.context.save();
    this.context.strokeStyle = '#7dd3fc';
    this.context.fillStyle = '#7dd3fc';
    this.context.lineWidth = 5;
    this.context.lineCap = 'round';
    this.context.beginPath();
    this.context.moveTo(centerX, centerY + 32);
    this.context.lineTo(centerX, centerY - 32);
    this.context.stroke();
    this.drawTriangle(centerX, centerY - 43, 0);
    this.drawTriangle(centerX, centerY + 43, Math.PI);
    this.context.restore();
  }

  private drawTriangle(centerX: number, centerY: number, rotation: number): void {
    const radius = 10;
    this.context.save();
    this.context.translate(centerX, centerY);
    this.context.rotate(rotation);
    this.context.beginPath();
    this.context.moveTo(0, -radius);
    this.context.lineTo(radius * 0.9, radius * 0.7);
    this.context.lineTo(-radius * 0.9, radius * 0.7);
    this.context.closePath();
    this.context.fill();
    this.context.restore();
  }

  private resizeCanvas(width: number, height: number): void {
    if (this.canvas.width === width && this.canvas.height === height) {
      return;
    }

    this.canvas.width = width;
    this.canvas.height = height;
    const oldTexture = this.texture;
    this.texture = createHudCanvasTexture(this.canvas);
    this.material.map = this.texture;
    this.material.needsUpdate = true;
    oldTexture.dispose();
  }
}

function createHudCanvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function drawHudHeart(context: CanvasRenderingContext2D, centerX: number, centerY: number, size: number): void {
  const top = centerY - size * 0.28;
  const bottom = centerY + size * 0.38;
  const left = centerX - size * 0.42;
  const right = centerX + size * 0.42;

  context.save();
  context.shadowColor = 'rgba(239, 68, 68, 0.55)';
  context.shadowBlur = size * 0.16;
  context.beginPath();
  context.moveTo(centerX, bottom);
  context.bezierCurveTo(left - size * 0.34, centerY + size * 0.02, left, top - size * 0.24, centerX, top + size * 0.1);
  context.bezierCurveTo(right, top - size * 0.24, right + size * 0.34, centerY + size * 0.02, centerX, bottom);
  context.closePath();
  context.fillStyle = '#ef4444';
  context.fill();

  context.shadowBlur = 0;
  context.globalAlpha = 0.42;
  context.beginPath();
  context.ellipse(centerX - size * 0.16, centerY - size * 0.16, size * 0.1, size * 0.06, -0.6, 0, Math.PI * 2);
  context.fillStyle = '#fff1f2';
  context.fill();
  context.restore();
}

function roundedRectPath(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

function titleFont(fontSize: number): string {
  return `900 ${fontSize}px ${HUD_FONT_FAMILY}`;
}

function formatLeaderboardScore(score: number): string {
  return Math.max(0, Math.floor(score)).toString().padStart(5, '0');
}

function scaleMenuCanvasPlane(
  mesh: THREE.Mesh,
  cssWidth: number,
  cssHeight: number,
  preferredHeight: number,
  maxWidth: number
): void {
  const aspect = cssHeight > 0 ? cssWidth / cssHeight : 1;
  const height = Math.min(preferredHeight, maxWidth / Math.max(aspect, 0.001));
  mesh.scale.set(height * aspect, height, 1);
}

function createPostProcessingUniforms(settings: PostProcessingSettings): PostProcessingUniforms {
  return {
    colorLevels: uniform(settings.colorLevels),
    scanlineStrength: uniform(settings.scanlineStrength),
    scanlineDensity: uniform(settings.scanlineDensity),
    scanlineSpeed: uniform(settings.scanlineSpeed),
    vignetteStrength: uniform(settings.vignetteStrength),
    vignetteSmoothness: uniform(settings.vignetteSmoothness),
    colorBleeding: uniform(settings.colorBleeding),
    barrelCurvature: uniform(settings.barrelCurvature),
    affineDistortion: uniform(settings.affineDistortion)
  };
}

function postProcessingScreenScaleForSize(width: number, height: number): number {
  const shortSide = Math.max(1, Math.min(width, height));
  const scale = shortSide / POST_PROCESSING_REFERENCE_SHORT_SIDE;

  return clamp(scale, POST_PROCESSING_MIN_SCREEN_SCALE, 1);
}

function postProcessingColorBleedScaleForSize(width: number, screenScale: number): number {
  return screenScale * (POST_PROCESSING_REFERENCE_WIDTH / Math.max(1, width));
}

function stopEventPropagation(event: Event): void {
  event.stopPropagation();
}

function getSplitTutorialSeenFlag(): boolean {
  try {
    return window.localStorage.getItem(SPLIT_TUTORIAL_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function setSplitTutorialSeenFlag(): void {
  try {
    window.localStorage.setItem(SPLIT_TUTORIAL_STORAGE_KEY, '1');
  } catch {
    // Local storage can be unavailable in strict privacy or embedded contexts.
  }
}

function isTouchTutorialDevice(): boolean {
  return navigator.maxTouchPoints > 0
    || window.matchMedia('(pointer: coarse)').matches
    || window.matchMedia('(hover: none)').matches;
}

function isMainMenuAction(value: unknown): value is MainMenuAction {
  return value === 'start';
}

function isPauseMenuAction(value: unknown): value is PauseMenuAction {
  return value === 'resume';
}

function isGameControlKey(code: string): boolean {
  return code === 'ArrowLeft'
    || code === 'ArrowRight'
    || code === 'ArrowUp'
    || code === 'ArrowDown'
    || code === 'Space'
    || code === 'Enter'
    || code === 'KeyR';
}

function controlDefinitionForKey(key: PostProcessingSettingKey): PostProcessingControlDefinition | undefined {
  return POST_PROCESSING_CONTROLS.find((control) => control.key === key);
}

function normalizePostProcessingValue(key: PostProcessingSettingKey, value: number): number {
  const control = controlDefinitionForKey(key);
  const min = control?.min ?? Number.NEGATIVE_INFINITY;
  const max = control?.max ?? Number.POSITIVE_INFINITY;
  const decimals = control?.decimals ?? 6;
  const clamped = clamp(Number.isFinite(value) ? value : POST_PROCESSING_DEFAULTS[key], min, max);

  if (decimals === 0) {
    return Math.round(clamped);
  }

  return Number(clamped.toFixed(Math.min(decimals + 2, 8)));
}

function projectorBeamControlDefinitionForKey(
  key: ProjectorBeamNumericSettingKey
): ProjectorBeamControlDefinition | undefined {
  return PROJECTOR_BEAM_CONTROLS.find((control) => control.key === key);
}

function normalizeProjectorBeamValue(key: ProjectorBeamNumericSettingKey, value: number): number {
  const control = projectorBeamControlDefinitionForKey(key);
  const min = control?.min ?? Number.NEGATIVE_INFINITY;
  const max = control?.max ?? Number.POSITIVE_INFINITY;
  const decimals = control?.decimals ?? 6;
  const fallback = PROJECTOR_BEAM_DEFAULTS[key];
  const clamped = clamp(Number.isFinite(value) ? value : fallback, min, max);

  if (decimals === 0) {
    return Math.round(clamped);
  }

  return Number(clamped.toFixed(Math.min(decimals + 2, 8)));
}

function normalizeProjectorBeamColor(color: number): number {
  if (!Number.isFinite(color)) {
    return PROJECTOR_BEAM_DEFAULTS.color;
  }

  return clamp(Math.round(color), 0x000000, 0xffffff);
}

function formatHexColor(color: number): string {
  return `#${normalizeProjectorBeamColor(color).toString(16).padStart(6, '0')}`;
}

function parseHexColor(value: string): number | null {
  const normalizedValue = value.trim();
  if (!/^#[\da-f]{6}$/i.test(normalizedValue)) {
    return null;
  }

  return Number.parseInt(normalizedValue.slice(1), 16);
}

function formatProjectorBeamSettings(settings: ProjectorBeamSettings): string {
  const lines = [
    `  color: ${formatHexNumber(settings.color)}`,
    ...PROJECTOR_BEAM_CONTROLS.map((control) => {
      return `  ${control.key}: ${formatExportNumber(settings[control.key])}`;
    })
  ];

  return `{\n${lines.join(',\n')}\n}`;
}

function formatHexNumber(value: number): string {
  return `0x${normalizeProjectorBeamColor(value).toString(16).padStart(6, '0')}`;
}

function formatPostProcessingSettings(settings: PostProcessingSettings): string {
  const lines = POST_PROCESSING_CONTROLS.map((control) => {
    return `  ${control.key}: ${formatExportNumber(settings[control.key])}`;
  });

  return `{\n${lines.join(',\n')}\n}`;
}

function formatExportNumber(value: number): string {
  if (Number.isInteger(value)) {
    return String(value);
  }

  return Number(value.toFixed(6)).toString();
}

function formatControlValue(value: number, decimals: number): string {
  if (decimals === 0) {
    return String(Math.round(value));
  }

  return value.toFixed(decimals);
}

function setMaterialOpacity(material: THREE.Material | THREE.Material[], opacity: number): void {
  if (Array.isArray(material)) {
    for (const entry of material) {
      setSingleMaterialOpacity(entry, opacity);
    }
    return;
  }

  setSingleMaterialOpacity(material, opacity);
}

function setMaterialGreyscale(material: THREE.Material | THREE.Material[], greyscale: boolean): void {
  if (Array.isArray(material)) {
    for (const entry of material) {
      setSingleMaterialGreyscale(entry, greyscale);
    }
    return;
  }

  setSingleMaterialGreyscale(material, greyscale);
}

function setMaterialDanger(material: THREE.Material | THREE.Material[], intensity: number): void {
  if (Array.isArray(material)) {
    for (const entry of material) {
      setSingleMaterialDanger(entry, intensity);
    }
    return;
  }

  setSingleMaterialDanger(material, intensity);
}

function makeFadeableMaterial<T extends THREE.Material>(material: T): T {
  material.userData.baseOpacity = typeof material.userData.baseOpacity === 'number'
    ? material.userData.baseOpacity
    : material.opacity;
  if (material instanceof THREE.MeshBasicMaterial || material instanceof THREE.MeshStandardMaterial) {
    material.userData.baseColor = material.color.getHex();
  }
  if (material instanceof THREE.MeshStandardMaterial) {
    material.userData.baseEmissive = material.emissive.getHex();
    material.userData.baseEmissiveIntensity = material.emissiveIntensity;
  }
  material.transparent = true;
  material.depthWrite = false;
  return material;
}

function setSingleMaterialOpacity(material: THREE.Material, opacity: number): void {
  const baseOpacity = typeof material.userData.baseOpacity === 'number' ? material.userData.baseOpacity : material.opacity;
  const renderStateChanged = !material.transparent || material.depthWrite;

  material.userData.baseOpacity = baseOpacity;
  material.opacity = baseOpacity * opacity;
  material.transparent = true;
  material.depthWrite = false;

  if (renderStateChanged) {
    material.needsUpdate = true;
  }
}

function setSingleMaterialGreyscale(material: THREE.Material, greyscale: boolean): void {
  if (material instanceof THREE.MeshBasicMaterial || material instanceof THREE.MeshStandardMaterial) {
    const baseColor = materialBaseColor(material);
    material.color.setHex(greyscale ? greyscaleHex(baseColor) : baseColor);
  }

  if (material instanceof THREE.MeshStandardMaterial) {
    const baseEmissive = materialBaseEmissive(material);
    const baseEmissiveIntensity = materialBaseEmissiveIntensity(material);
    material.emissive.setHex(greyscale ? greyscaleHex(baseEmissive) : baseEmissive);
    material.emissiveIntensity = greyscale ? baseEmissiveIntensity * 0.16 : baseEmissiveIntensity;
  }
}

function setSingleMaterialDanger(material: THREE.Material, intensity: number): void {
  const clampedIntensity = clamp(intensity, 0, 1);

  if (material instanceof THREE.MeshBasicMaterial || material instanceof THREE.MeshStandardMaterial) {
    const color = new THREE.Color(materialBaseColor(material));
    color.lerp(new THREE.Color(FATAL_MISS_DANGER_COLOR), 0.62 + clampedIntensity * 0.34);
    material.color.copy(color);
  }

  if (material instanceof THREE.MeshStandardMaterial) {
    const baseEmissiveIntensity = materialBaseEmissiveIntensity(material);
    material.emissive.setHex(FATAL_MISS_DANGER_EMISSIVE);
    material.emissiveIntensity = baseEmissiveIntensity * 0.35 + 0.75 + clampedIntensity * 1.75;
  }
}

function materialBaseColor(material: THREE.MeshBasicMaterial | THREE.MeshStandardMaterial): number {
  const storedColor = material.userData.baseColor;
  if (typeof storedColor === 'number') {
    return storedColor;
  }

  const baseColor = material.color.getHex();
  material.userData.baseColor = baseColor;
  return baseColor;
}

function materialBaseEmissive(material: THREE.MeshStandardMaterial): number {
  const storedEmissive = material.userData.baseEmissive;
  if (typeof storedEmissive === 'number') {
    return storedEmissive;
  }

  const baseEmissive = material.emissive.getHex();
  material.userData.baseEmissive = baseEmissive;
  return baseEmissive;
}

function materialBaseEmissiveIntensity(material: THREE.MeshStandardMaterial): number {
  const storedIntensity = material.userData.baseEmissiveIntensity;
  if (typeof storedIntensity === 'number') {
    return storedIntensity;
  }

  const baseIntensity = material.emissiveIntensity;
  material.userData.baseEmissiveIntensity = baseIntensity;
  return baseIntensity;
}

function greyscaleHex(hex: number): number {
  const color = new THREE.Color(hex);
  const level = Math.round(clamp(color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722, 0.18, 0.74) * 255);
  return (level << 16) | (level << 8) | level;
}

function isTerminalPhase(phase: BreakoutoutoutRenderState['phase']): boolean {
  return phase === 'game-over' || phase === 'cleared';
}

function autopilotPaddleApproachTime(state: BreakoutoutoutRenderState): number | null {
  const approachSpeed = -state.ball.vy;
  if (
    state.phase !== 'playing'
    || state.fatalMissPending
    || approachSpeed <= AUTOPILOT_SELECTION_MIN_APPROACH_SPEED
  ) {
    return null;
  }

  const paddleContactY = PADDLE_Y + PADDLE_HEIGHT / 2 + BALL_RADIUS;
  const distanceToPaddle = state.ball.y - paddleContactY;
  if (distanceToPaddle < 0 || distanceToPaddle > AUTOPILOT_SELECTION_PADDLE_APPROACH_DISTANCE) {
    return null;
  }

  return distanceToPaddle / approachSpeed;
}

function disposeObject(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      disposeMaterial(child.material);
    }
  });
}

function disposeMaterial(material: THREE.Material | THREE.Material[]): void {
  if (Array.isArray(material)) {
    for (const entry of material) {
      entry.dispose();
    }
    return;
  }

  material.dispose();
}

function lerp(from: number, to: number, amount: number): number {
  return from + (to - from) * amount;
}

function easeInOutCubic(value: number): number {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

function splitBloomCurve(progress: number): number {
  if (progress < 0.18) {
    return easeOutCubic(progress / 0.18);
  }

  return Math.pow(1 - (progress - 0.18) / 0.82, 1.7);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function normalizeInitialInstanceCount(count: number | undefined): number {
  if (typeof count !== 'number' || !Number.isFinite(count)) {
    return DEFAULT_INITIAL_INSTANCE_COUNT;
  }

  return clamp(Math.floor(count), DEFAULT_INITIAL_INSTANCE_COUNT, MAX_INITIAL_INSTANCE_COUNT);
}

function normalizeBallSpeedMultiplierActiveGameCap(count: number | undefined): number {
  if (typeof count !== 'number' || !Number.isFinite(count)) {
    return DEFAULT_BALL_SPEED_MULTIPLIER_ACTIVE_GAME_CAP;
  }

  return Math.max(1, Math.floor(count));
}
