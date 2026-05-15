import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three/webgpu';
import { posterize, replaceDefaultUV, screenSize, uniform } from 'three/tsl';
import { barrelUV, colorBleeding, scanlines, vignette } from 'three/examples/jsm/tsl/display/CRT.js';
import { retroPass } from 'three/examples/jsm/tsl/display/RetroPassNode.js';
import { circle } from 'three/examples/jsm/tsl/display/Shape.js';
import { bayerDither } from 'three/examples/jsm/tsl/math/Bayer.js';
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
  BOARD_HEIGHT,
  BOARD_WIDTH,
  BRICK_DEPTH,
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
  PADDLE_DEPTH,
  PADDLE_HEIGHT,
  PADDLE_WIDTH,
  PADDLE_Y,
  WALL_THICKNESS
} from './BreakoutoutoutInstance';
import { SoundBank } from './sound';

const MAX_DT = 1 / 20;
const PLANE_Z_GAP = 5;
const BALL_SPEED_ACTIVE_GAME_EXPONENT = 0.5;
const CAMERA_FOV = 59;
const CAMERA_DISTANCE_PADDING = 1.24;
const CAMERA_ELEVATION = 0;
const CAMERA_PARALLAX_X = 1.64;
const CAMERA_PARALLAX_Y = 1.12;
const RETRO_PIXEL_SIZE = 3;
const RETRO_COLOR_LEVELS = 7;
const RETRO_SCANLINE_STRENGTH = 0.16;
const RETRO_SCANLINE_DENSITY = 1;
const RETRO_SCANLINE_SPEED = 0;
const RETRO_VIGNETTE_STRENGTH = 0.36;
const RETRO_COLOR_BLEEDING = 0.00115;
const RETRO_BARREL_CURVATURE = 0.02;
const RETRO_AFFINE_DISTORTION = 0;
const TOUCH_SWIPE_MIN_DISTANCE = 44;
const TOUCH_SWIPE_AXIS_RATIO = 1.15;
const SELECTED_OPACITY = 1;
const BACKGROUND_OPACITY = 0.22;
const SOUND_MIN_VOLUME = 0.12;
const SOUND_ATTENUATION_DISTANCE = PLANE_Z_GAP * 2.2;
const PADDLE_COLOR = 0xe8f8f6;
const PADDLE_EMISSIVE = 0x1fbfb1;
const PADDLE_AUTOPILOT_COLOR = 0xeafffb;
const PADDLE_AUTOPILOT_EMISSIVE = 0x34d399;
const PADDLE_BASE_EMISSIVE_INTENSITY = 0.28;
const HUD_CAMERA_DEPTH = 4;
const HUD_TEXTURE_SCALE = 2;
const HUD_FONT_FAMILY = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
const GLOBAL_HUD_RENDER_ORDER = 100;
const PLANE_HUD_RENDER_ORDER = 80;
const PLANE_STATUS_WORLD_HEIGHT = 1.35;
const PLANE_STATUS_MAX_WIDTH = BOARD_WIDTH - 1.2;
const PLANE_STATUS_Y = -1.05;
const PLANE_STATUS_Z = 0.88;
const IDLE_INPUT: BreakoutInput = { left: false, right: false };

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

type InstanceView = {
  instance: BreakoutoutoutInstance;
  group: THREE.Group;
  paddleMesh: THREE.Mesh;
  ballMesh: THREE.Mesh;
  bricks: Map<string, THREE.Mesh>;
  statusText: HudTextPlane;
};

export type BreakoutGameOptions = Pick<BreakoutoutoutOptions, 'autopilot'>;

export class BreakoutGame {
  private readonly shell: HTMLDivElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 180);
  private readonly renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true });
  private readonly renderPipeline: THREE.RenderPipeline;
  private readonly retroScenePass: ReturnType<typeof retroPass>;
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
  private readonly globalHudGroup = new THREE.Group();
  private readonly scoreText = new HudTextPlane({ fontSize: 22, fill: '#f4f9f8', renderOrder: GLOBAL_HUD_RENDER_ORDER });
  private readonly livesText = new HudTextPlane({ fontSize: 22, fill: '#f4f9f8', renderOrder: GLOBAL_HUD_RENDER_ORDER });
  private readonly levelText = new HudTextPlane({ fontSize: 18, fill: '#f0c95d', renderOrder: GLOBAL_HUD_RENDER_ORDER });
  private readonly realityText = new HudTextPlane({ fontSize: 16, fill: '#8ce9df', renderOrder: GLOBAL_HUD_RENDER_ORDER });
  // private readonly particleTexture: THREE.CanvasTexture;
  private readonly autopilot: boolean;
  private readonly instanceSoundPosition = new THREE.Vector3();
  private readonly instances: BreakoutoutoutInstance[] = [];
  private readonly views = new Map<BreakoutoutoutInstance, InstanceView>();

  private nebula: NebulaRuntime | null = null;
  private accumulator = 0;
  private lastTime = performance.now();
  private nextInstanceId = 1;
  private selectedIndex = 0;
  private ballSpeedMultiplier = 1;
  private cameraBaseDistance = 24;
  private cameraFocusX = 0;
  private cameraFocusY = CAMERA_ELEVATION;
  private cameraFocusZ = 0;
  private activeTouchPointerId: number | null = null;
  private touchStartX = 0;
  private touchStartY = 0;
  private touchLastX = 0;
  private touchLastY = 0;
  private touchPaddleX: number | null = null;

  private constructor(root: HTMLElement, options: BreakoutGameOptions = {}) {
    this.autopilot = options.autopilot ?? false;
    this.shell = document.createElement('div');
    this.shell.className = 'game-shell';
    root.replaceChildren(this.shell);

    this.renderer.domElement.className = 'three-layer';
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x07080b, 0);
    this.shell.appendChild(this.renderer.domElement);
    this.scene.add(this.camera);
    this.createThreeHud();

    this.retroScenePass = retroPass(this.scene, this.camera, {
      affineDistortion: uniform(RETRO_AFFINE_DISTORTION)
    });
    this.retroScenePass.setResolutionScale(1 / RETRO_PIXEL_SIZE);
    this.renderPipeline = new THREE.RenderPipeline(this.renderer, this.createRetroPipeline(this.retroScenePass));

    // this.particleTexture = createParticleTexture();
    this.createLighting();
    this.attachInput();
    this.resize();
  }

  private createRetroPipeline(scenePass: ReturnType<typeof retroPass>): THREE.Node {
    const colorLevels = uniform(RETRO_COLOR_LEVELS);
    const scanlineStrength = uniform(RETRO_SCANLINE_STRENGTH);
    const vignetteStrength = uniform(RETRO_VIGNETTE_STRENGTH);
    const colorBleed = uniform(RETRO_COLOR_BLEEDING);
    const curvature = uniform(RETRO_BARREL_CURVATURE);
    const distortedUv = barrelUV(curvature);
    const distortedDelta = circle(curvature.add(0.1).mul(10), 1).mul(curvature).mul(0.05);
    const warpedPass = replaceDefaultUV(distortedUv, scenePass);
    const bled = colorBleeding(warpedPass, colorBleed.add(distortedDelta));
    const dithered = bayerDither(bled, colorLevels);
    const quantized = posterize(dithered, colorLevels);
    const vignetted = vignette(quantized, vignetteStrength, 0.48, distortedUv);

    return scanlines(
      vignetted,
      scanlineStrength,
      screenSize.y.mul(RETRO_SCANLINE_DENSITY),
      uniform(RETRO_SCANLINE_SPEED),
      distortedUv
    );
  }

  static async create(root: HTMLElement, options: BreakoutGameOptions = {}): Promise<BreakoutGame> {
    await RAPIER.init();
    const game = new BreakoutGame(root, options);
    await game.renderer.init();
    game.createNebulaSystem();
    game.addInstance(new BreakoutoutoutInstance(game.nextInstanceId, undefined, { autopilot: game.autopilot }));
    game.nextInstanceId += 1;
    game.updateHud();
    requestAnimationFrame(game.tick);
    return game;
  }

  private createThreeHud(): void {
    this.globalHudGroup.name = 'Global HUD';
    this.globalHudGroup.position.z = -HUD_CAMERA_DEPTH;
    this.globalHudGroup.renderOrder = GLOBAL_HUD_RENDER_ORDER;
    this.globalHudGroup.add(
      this.scoreText.mesh,
      this.livesText.mesh,
      this.levelText.mesh,
      this.realityText.mesh
    );
    this.camera.add(this.globalHudGroup);
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

  private addInstance(instance: BreakoutoutoutInstance): void {
    this.instances.push(instance);
    this.syncBallSpeedForAll();
    const view = this.createInstanceView(instance);
    this.views.set(instance, view);
    this.scene.add(view.group);
    this.arrangePlanes();
    this.selectInstance(this.selectedIndex);
  }

  private createInstanceView(instance: BreakoutoutoutInstance): InstanceView {
    const state = instance.getRenderState();
    const group = new THREE.Group();
    const paddleMesh = this.createPaddleMesh();
    const ballMesh = this.createBallMesh();
    const statusText = this.createPlaneStatusText();
    const bricks = new Map<string, THREE.Mesh>();

    this.createWalls(group);
    group.add(paddleMesh, ballMesh, statusText.mesh);

    const view: InstanceView = { instance, group, paddleMesh, ballMesh, bricks, statusText };
    this.syncInstanceView(view, state, 0);
    return view;
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
      background: 'rgba(7, 8, 11, 0.68)',
      border: 'rgba(240, 201, 93, 0.86)',
      borderWidth: 1,
      radius: 8,
      renderOrder: PLANE_HUD_RENDER_ORDER
    });
  }

  createBackboard(group: THREE.Group): void {
    const backing = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_WIDTH + 0.75, BOARD_HEIGHT + 0.55, 0.2),
      new THREE.MeshStandardMaterial({
        color: 0x101116,
        roughness: 0.74,
        metalness: 0.08
      })
    );
    backing.position.set(0, 0.1, -0.54);
    group.add(backing);

    const laneMaterial = new THREE.MeshBasicMaterial({
      color: 0x2dd4bf,
      transparent: true,
      opacity: 0.16
    });

    for (let index = 0; index < 7; index += 1) {
      const lane = new THREE.Mesh(new THREE.BoxGeometry(0.024, BOARD_HEIGHT - 1.25, 0.04), laneMaterial.clone());
      lane.position.set(-4.5 + index * 1.5, -0.08, -0.36);
      group.add(lane);
    }

    const warning = new THREE.Mesh(
      new THREE.BoxGeometry(BOARD_WIDTH - 1.1, 0.04, 0.04),
      new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.72 })
    );
    warning.position.set(0, -7.35, -0.28);
    group.add(warning);
  }

  private createWalls(group: THREE.Group): void {
    const wallMaterial = new THREE.MeshBasicMaterial({
      color: 0x4d8f99
    });
    const walls = [
      { x: -HALF_WIDTH - WALL_THICKNESS / 2, y: 0, width: WALL_THICKNESS, height: BOARD_HEIGHT + 0.6 },
      { x: HALF_WIDTH + WALL_THICKNESS / 2, y: 0, width: WALL_THICKNESS, height: BOARD_HEIGHT + 0.6 },
      { x: 0, y: HALF_HEIGHT + WALL_THICKNESS / 2, width: BOARD_WIDTH + WALL_THICKNESS * 2, height: WALL_THICKNESS },
      { x: 0, y: -HALF_HEIGHT - WALL_THICKNESS / 2, width: BOARD_WIDTH + WALL_THICKNESS * 2, height: WALL_THICKNESS }
    ];

    for (const wall of walls) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(wall.width, wall.height, PADDLE_DEPTH), wallMaterial.clone());
      mesh.position.set(wall.x, wall.y, -0.04);
      group.add(mesh);
    }
  }

  private createPaddleMesh(): THREE.Mesh {
    return new THREE.Mesh(
      new THREE.BoxGeometry(PADDLE_WIDTH, PADDLE_HEIGHT, PADDLE_DEPTH),
      new THREE.MeshStandardMaterial({
        color: PADDLE_COLOR,
        emissive: PADDLE_EMISSIVE,
        emissiveIntensity: PADDLE_BASE_EMISSIVE_INTENSITY,
        roughness: 0.32,
        metalness: 0.18
      })
    );
  }

  private createBallMesh(): THREE.Mesh {
    return new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 32, 18),
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffe5a8,
        emissiveIntensity: 0.4,
        roughness: 0.22,
        metalness: 0.08
      })
    );
  }

  private createBrickMesh(brick: BrickSnapshot): THREE.Mesh {
    const isSplitter = brick.kind === 'splitter';
    const isAutopilot = brick.kind === 'autopilot';
    const isLife = brick.kind === 'life';
    const material = new THREE.MeshStandardMaterial({
      color: brick.color,
      emissive: brick.color,
      emissiveIntensity: isSplitter ? 0.7 : isAutopilot ? 0.62 : isLife ? 0.66 : 0.18 + brick.row * 0.018,
      roughness: isSplitter ? 0.24 : isAutopilot ? 0.3 : isLife ? 0.28 : 0.46,
      metalness: isSplitter ? 0.34 : isAutopilot ? 0.22 : isLife ? 0.24 : 0.12
    });
    return new THREE.Mesh(new THREE.BoxGeometry(brick.width, brick.height, BRICK_DEPTH), material);
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
      this.selectInstance(this.selectedIndex + 1);
      return;
    }

    if (event.code === 'ArrowDown') {
      event.preventDefault();
      this.selectInstance(this.selectedIndex - 1);
      return;
    }

    this.keys.add(event.code);
    if (event.code === 'Space' || event.code === 'Enter') {
      event.preventDefault();
      this.launchOrAdvanceSelected();
    }

    if (event.code === 'KeyR') {
      event.preventDefault();
      this.restartSelected();
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    this.keys.delete(event.code);
  };

  private readonly handlePointerDown = (event: PointerEvent): void => {
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
    if (event.pointerId !== this.activeTouchPointerId) {
      return;
    }

    event.preventDefault();
    this.touchLastX = event.clientX;
    this.touchLastY = event.clientY;
    this.updateTouchPaddle(event.clientX, event.clientY);
  };

  private readonly handlePointerUp = (event: PointerEvent): void => {
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
    if (event.pointerId !== this.activeTouchPointerId) {
      return;
    }

    event.preventDefault();
    this.releaseTouchPointer(event.pointerId);
    this.clearTouchInput();
  };

  private isTouchPointer(event: PointerEvent): boolean {
    return event.pointerType === 'touch' || event.pointerType === 'pen';
  }

  private updateTouchPaddle(clientX: number, clientY: number): void {
    if (this.autopilot) {
      return;
    }

    const paddleX = this.pointerToSelectedBoardX(clientX, clientY);
    if (paddleX === null) {
      return;
    }

    this.touchPaddleX = paddleX;
    this.instances[this.selectedIndex]?.placePaddleAt(paddleX);
  }

  private pointerToSelectedBoardX(clientX: number, clientY: number): number | null {
    const selected = this.instances[this.selectedIndex];
    const view = selected ? this.views.get(selected) : undefined;
    if (!view) {
      return null;
    }

    const bounds = this.renderer.domElement.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) {
      return null;
    }

    this.pointerNdc.set(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -(((clientY - bounds.top) / bounds.height) * 2 - 1)
    );
    this.pointerRaycaster.setFromCamera(this.pointerNdc, this.camera);

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

  private handleTouchGestureEnd(): void {
    const deltaX = this.touchLastX - this.touchStartX;
    const deltaY = this.touchLastY - this.touchStartY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const isVerticalSwipe = absY >= TOUCH_SWIPE_MIN_DISTANCE && absY > absX * TOUCH_SWIPE_AXIS_RATIO;

    if (isVerticalSwipe) {
      this.selectInstance(this.selectedIndex + (deltaY < 0 ? 1 : -1));
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
    const pixelRatio = Math.min(window.devicePixelRatio, 2);
    const aspect = width / height;
    const fovRadians = THREE.MathUtils.degToRad(CAMERA_FOV);
    const visualHeight = BOARD_HEIGHT + 1.2;
    const visualWidth = BOARD_WIDTH + 1.4;

    this.camera.aspect = aspect;
    this.cameraBaseDistance = Math.max(
      visualHeight / (2 * Math.tan(fovRadians / 2)),
      visualWidth / (2 * Math.tan(fovRadians / 2) * aspect)
    ) * CAMERA_DISTANCE_PADDING;
    this.camera.updateProjectionMatrix();
    this.updateCamera(1);

    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height, false);
    this.layoutGlobalHud();
  };

  private readonly tick = (time: number): void => {
    const frameTime = Math.max(0, (time - this.lastTime) / 1000);
    const delta = Math.min(frameTime, MAX_DT);
    this.lastTime = time;
    this.accumulator += delta;

    while (this.accumulator >= FIXED_STEP) {
      for (let index = 0; index < this.instances.length; index += 1) {
        const instance = this.instances[index];
        if (this.autopilot && instance.isActive()) {
          this.handleInstanceEvents(instance, instance.launchOrAdvance());
        }

        const input = !this.autopilot && index === this.selectedIndex && instance.isActive()
          ? this.currentInput
          : IDLE_INPUT;
        this.handleInstanceEvents(instance, instance.step(FIXED_STEP, input));
      }
      this.accumulator -= FIXED_STEP;
    }

    this.syncViews(time / 1000);
    this.updateCamera(delta);
    this.updateHud();
    this.updatePlaneHudBillboards();
    this.nebula?.system.update(delta);
    this.renderPipeline.render();
    requestAnimationFrame(this.tick);
  };

  private launchOrAdvanceSelected(): void {
    const selected = this.instances[this.selectedIndex];
    if (!selected || !selected.isActive()) {
      return;
    }

    this.handleInstanceEvents(selected, selected.launchOrAdvance());
  }

  private restartSelected(): void {
    const selected = this.instances[this.selectedIndex];
    if (selected?.isActive()) {
      this.handleInstanceEvents(selected, selected.restart());
    }
  }

  private handleInstanceEvents(instance: BreakoutoutoutInstance, events: BreakoutoutoutEvent[]): void {
    if (events.length === 0) {
      return;
    }

    let shouldSyncBallSpeed = false;
    const volume = this.volumeForInstance(instance);

    for (const event of events) {
      if (event.type === 'sound') {
        this.sound.play(event.name, volume);
      }

      // if (event.type === 'brick-hit') {
      //   this.burst(instance, event.x, event.y, event.color, event.kind);
      // }

      if (event.type === 'split') {
        this.splitReality(event.snapshot);
      }

      if (event.type === 'state-changed') {
        shouldSyncBallSpeed = true;
      }
    }

    if (shouldSyncBallSpeed) {
      this.syncBallSpeedForAll();
    }
  }

  private volumeForInstance(instance: BreakoutoutoutInstance): number {
    const view = this.views.get(instance);
    if (!view) {
      return 1;
    }

    view.group.getWorldPosition(this.instanceSoundPosition);
    const distanceToCamera = this.camera.position.distanceTo(this.instanceSoundPosition);
    const excessDistance = Math.max(0, distanceToCamera - this.cameraBaseDistance);
    return clamp(Math.exp(-excessDistance / SOUND_ATTENUATION_DISTANCE), SOUND_MIN_VOLUME, 1);
  }

  private splitReality(snapshot: BreakoutoutoutSnapshot): void {
    const clone = new BreakoutoutoutInstance(
      this.nextInstanceId,
      createSplitRealitySnapshot(snapshot),
      { autopilot: this.autopilot }
    );
    this.nextInstanceId += 1;
    this.addInstance(clone);
  }

  private syncBallSpeedForAll(): void {
    const nextBallSpeedMultiplier = this.ballSpeedMultiplierForActiveGames(this.activeGameCount);
    this.ballSpeedMultiplier = nextBallSpeedMultiplier;
    for (const instance of this.instances) {
      instance.setBallSpeedMultiplier(nextBallSpeedMultiplier);
    }
  }

  private ballSpeedMultiplierForActiveGames(activeGameCount: number): number {
    return 1 / activeGameCount ** BALL_SPEED_ACTIVE_GAME_EXPONENT;
  }

  private get activeGameCount(): number {
    const activeCount = this.instances.filter((instance) => instance.isActive()).length;
    return Math.max(1, activeCount);
  }

  private syncViews(time: number): void {
    for (const view of this.views.values()) {
      this.syncInstanceView(view, view.instance.getRenderState(), time);
    }
  }

  private syncInstanceView(view: InstanceView, state: BreakoutoutoutRenderState, time: number): void {
    view.paddleMesh.position.set(state.paddleX, PADDLE_Y, 0.06);
    this.updatePaddleAutopilotEffect(view.paddleMesh, state.autoPilotActive, time);
    view.ballMesh.position.set(state.ball.x, state.ball.y, 0.18);
    view.ballMesh.rotation.x += 0.05;
    view.ballMesh.rotation.y += 0.075;
    view.group.rotation.x = Math.sin(time * 0.32 + state.id * 0.2) * 0.018;
    this.updatePlaneStatusHud(view, state);

    const activeBrickIds = new Set(state.bricks.filter((brick) => !brick.hit).map((brick) => brick.id));
    for (const [id, mesh] of view.bricks) {
      if (!activeBrickIds.has(id)) {
        view.bricks.delete(id);
        view.group.remove(mesh);
        disposeObject(mesh);
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
        view.group.add(mesh);
        this.applyInstanceOpacity(view);
      }

      mesh.position.set(brick.x, brick.y, Math.sin(time * 1.5 + brick.x * 0.7) * 0.035);
    }
  }

  private updatePlaneStatusHud(view: InstanceView, state: BreakoutoutoutRenderState): void {
    const statusLabel = this.planeStatusLabel(state);
    view.statusText.setText(statusLabel, 360);
    view.statusText.mesh.position.set(0, PLANE_STATUS_Y, PLANE_STATUS_Z);

    if (statusLabel.length === 0) {
      return;
    }

    this.scalePlaneHudText(view.statusText, PLANE_STATUS_WORLD_HEIGHT, PLANE_STATUS_MAX_WIDTH);
  }

  private planeStatusLabel(state: BreakoutoutoutRenderState): string {
    if (state.autoPilotActive) {
      return state.autoPilotRemaining > 0
        ? `autopilot mode ${Math.ceil(state.autoPilotRemaining)}s`
        : 'autopilot mode';
    }

    const phaseLabel = {
      ready: 'READY',
      playing: '',
      'level-clear': 'CLEARED',
      'game-over': 'GAME OVER'
    } satisfies Record<typeof state.phase, string>;

    return phaseLabel[state.phase];
  }

  private scalePlaneHudText(text: HudTextPlane, preferredHeight: number, maxWidth: number): void {
    const aspect = text.cssHeight > 0 ? text.cssWidth / text.cssHeight : 1;
    const height = Math.min(preferredHeight, maxWidth / Math.max(aspect, 0.001));
    text.mesh.scale.set(height * aspect, height, 1);
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

  private arrangePlanes(): void {
    for (let index = 0; index < this.instances.length; index += 1) {
      const view = this.views.get(this.instances[index]);
      if (view) {
        view.group.position.set(0, 0, -index * PLANE_Z_GAP);
      }
    }

    this.selectedIndex = clamp(this.selectedIndex, 0, Math.max(0, this.instances.length - 1));
    this.updateInstanceOpacity();
    this.resize();
  }

  private selectInstance(index: number): void {
    if (this.instances.length === 0) {
      return;
    }

    const nextIndex = clamp(index, 0, this.instances.length - 1);
    if (nextIndex === this.selectedIndex) {
      return;
    }

    this.selectedIndex = nextIndex;
    this.updateInstanceOpacity();
  }

  private updateInstanceOpacity(): void {
    for (let index = 0; index < this.instances.length; index += 1) {
      const view = this.views.get(this.instances[index]);
      if (view) {
        this.applyInstanceOpacity(view);
      }
    }
  }

  private applyInstanceOpacity(view: InstanceView): void {
    const opacity = this.instances[this.selectedIndex] === view.instance ? SELECTED_OPACITY : BACKGROUND_OPACITY;
    view.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        setMaterialOpacity(object.material, opacity);
      }
    });
  }

  private updateCamera(delta: number): void {
    const selectedState = this.instances[this.selectedIndex]?.getRenderState();
    const ballX = selectedState ? clamp(selectedState.ball.x / HALF_WIDTH, -1, 1) : 0;
    const ballY = selectedState ? clamp(selectedState.ball.y / HALF_HEIGHT, -1, 1) : 0;
    const targetX = ballX * CAMERA_PARALLAX_X;
    const targetY = CAMERA_ELEVATION + ballY * CAMERA_PARALLAX_Y;
    const focusZ = this.selectedPlaneZ;
    const blend = 1 - Math.pow(0.0006, Math.max(delta, 0.001));
    this.cameraFocusX += (targetX - this.cameraFocusX) * blend;
    this.cameraFocusY += (targetY - this.cameraFocusY) * blend;
    this.cameraFocusZ += (focusZ - this.cameraFocusZ) * blend;
    this.camera.position.set(this.cameraFocusX, this.cameraFocusY, this.cameraFocusZ + this.cameraBaseDistance);
    this.camera.lookAt(0, 0, this.cameraFocusZ);
  }

  private updatePlaneHudBillboards(): void {
    this.camera.getWorldQuaternion(this.planeHudCameraQuaternion);

    for (const view of this.views.values()) {
      view.group.getWorldQuaternion(this.planeHudParentQuaternion).invert();
      view.statusText.mesh.quaternion
        .copy(this.planeHudParentQuaternion)
        .multiply(this.planeHudCameraQuaternion);
    }
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

  private updateHud(): void {
    if (this.instances.length === 0) {
      return;
    }

    const selected = this.instances[this.selectedIndex]?.getRenderState() ?? this.instances[0].getRenderState();
    const margin = this.hudMargin();
    this.scoreText.setText(`SCORE ${selected.score.toString().padStart(5, '0')}`);
    this.livesText.setText(`LIVES ${selected.lives}`);
    this.levelText.setText(`LEVEL ${selected.level}`);
    this.realityText.setText(
      `REALITY ${this.selectedIndex + 1}/${this.instances.length}  BALL ${Math.round(this.ballSpeedMultiplier * 100)}%`,
      this.shell.clientWidth - margin * 2
    );
    this.layoutGlobalHud();
  }

  private layoutGlobalHud(): void {
    const width = Math.max(1, this.shell.clientWidth);
    const margin = this.hudMargin();
    const stackedHud = width < 560;

    this.layoutCameraHudText(this.scoreText, margin, margin, 0, 0);
    this.layoutCameraHudText(this.livesText, width - margin, margin, 1, 0);
    this.layoutCameraHudText(this.levelText, width / 2, stackedHud ? margin + 32 : margin + 2, 0.5, 0);
    this.layoutCameraHudText(this.realityText, width / 2, stackedHud ? margin + 58 : margin + 30, 0.5, 0);
  }

  private layoutCameraHudText(text: HudTextPlane, x: number, y: number, anchorX: number, anchorY: number): void {
    const width = Math.max(1, this.shell.clientWidth);
    const height = Math.max(1, this.shell.clientHeight);
    const viewHeight = 2 * Math.tan(THREE.MathUtils.degToRad(CAMERA_FOV) / 2) * HUD_CAMERA_DEPTH;
    const viewWidth = viewHeight * this.camera.aspect;
    const centerX = x + (0.5 - anchorX) * text.cssWidth;
    const centerY = y + (0.5 - anchorY) * text.cssHeight;

    text.mesh.position.set(
      (centerX / width - 0.5) * viewWidth,
      (0.5 - centerY / height) * viewHeight,
      0
    );
    text.mesh.scale.set(
      (text.cssWidth / width) * viewWidth,
      (text.cssHeight / height) * viewHeight,
      1
    );
  }

  private hudMargin(): number {
    const width = Math.max(1, this.shell.clientWidth);
    const height = Math.max(1, this.shell.clientHeight);
    return Math.max(32, Math.min(width, height) * 0.045);
  }

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
    const selected = this.instances[this.selectedIndex];
    return this.views.get(selected)?.group.position.z ?? 0;
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

function createHudCanvasTexture(canvas: HTMLCanvasElement): THREE.CanvasTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
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

function setMaterialOpacity(material: THREE.Material | THREE.Material[], opacity: number): void {
  if (Array.isArray(material)) {
    for (const entry of material) {
      setSingleMaterialOpacity(entry, opacity);
    }
    return;
  }

  setSingleMaterialOpacity(material, opacity);
}

function setSingleMaterialOpacity(material: THREE.Material, opacity: number): void {
  const baseOpacity = typeof material.userData.baseOpacity === 'number' ? material.userData.baseOpacity : material.opacity;
  const nextOpacity = baseOpacity * opacity;
  const forceTransparent = material.userData.forceTransparent === true;
  const nextTransparent = forceTransparent || nextOpacity < 0.999;
  const nextDepthWrite = !forceTransparent && nextOpacity >= 0.999;
  const renderStateChanged = material.transparent !== nextTransparent || material.depthWrite !== nextDepthWrite;

  material.userData.baseOpacity = baseOpacity;
  material.opacity = nextOpacity;
  material.transparent = nextTransparent;
  material.depthWrite = nextDepthWrite;

  if (renderStateChanged) {
    material.needsUpdate = true;
  }
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
