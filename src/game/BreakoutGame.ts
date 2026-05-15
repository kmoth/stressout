import RAPIER from '@dimforge/rapier3d-compat';
import { Application, Container, Graphics, Text } from 'pixi.js';
import * as THREE from 'three';
// import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
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
// const DEPTH_OF_FIELD_APERTURE = 0.0022;
// const DEPTH_OF_FIELD_MAX_BLUR = 0.0045;
const RETRO_PIXEL_SIZE = 3;
const RETRO_COLOR_LEVELS = 7;
const RETRO_SCANLINE_STRENGTH = 0.16;
const RETRO_VIGNETTE_STRENGTH = 0.36;
const RETRO_NOISE_STRENGTH = 0.032;
const RETRO_CHROMA_OFFSET = 1.15;
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
};

// type BokehUniforms = {
//   focus: { value: number };
//   aspect: { value: number };
// };

type RetroUniforms = {
  resolution: { value: THREE.Vector2 };
  time: { value: number };
  pixelSize: { value: number };
};

export type BreakoutGameOptions = Pick<BreakoutoutoutOptions, 'autopilot'>;

const RETRO_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    resolution: { value: new THREE.Vector2(1, 1) },
    time: { value: 0 },
    pixelSize: { value: RETRO_PIXEL_SIZE },
    colorLevels: { value: RETRO_COLOR_LEVELS },
    scanlineStrength: { value: RETRO_SCANLINE_STRENGTH },
    vignetteStrength: { value: RETRO_VIGNETTE_STRENGTH },
    noiseStrength: { value: RETRO_NOISE_STRENGTH },
    chromaOffset: { value: RETRO_CHROMA_OFFSET }
  },
  vertexShader: `
    varying vec2 vUv;

    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform vec2 resolution;
    uniform float time;
    uniform float pixelSize;
    uniform float colorLevels;
    uniform float scanlineStrength;
    uniform float vignetteStrength;
    uniform float noiseStrength;
    uniform float chromaOffset;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec2 safeResolution = max(resolution, vec2(1.0));
      vec2 pixelUv = floor(vUv * safeResolution / pixelSize) * pixelSize / safeResolution;
      vec2 chroma = vec2(chromaOffset, 0.0) / safeResolution;

      float r = texture2D(tDiffuse, pixelUv + chroma).r;
      float g = texture2D(tDiffuse, pixelUv).g;
      float b = texture2D(tDiffuse, pixelUv - chroma).b;
      vec3 color = vec3(r, g, b);

      color = pow(color, vec3(0.92));
      color = floor(color * colorLevels) / colorLevels;
      color = mix(color, color * vec3(1.08, 0.96, 0.82), 0.18);

      float scanline = 0.5 + 0.5 * sin(vUv.y * safeResolution.y * 3.14159265);
      color *= 1.0 - scanlineStrength * scanline;

      float vignette = smoothstep(0.92, 0.48, distance(vUv, vec2(0.5)));
      color *= mix(1.0 - vignetteStrength, 1.0, vignette);

      float noise = hash(floor(vUv * safeResolution / pixelSize) + time * 60.0) - 0.5;
      color += noise * noiseStrength;

      gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
    }
  `
};

export class BreakoutGame {
  private readonly shell: HTMLDivElement;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 180);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  private readonly composer: EffectComposer;
  private readonly retroPass: ShaderPass;
  // private readonly bokehPass: BokehPass;
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
  // private readonly particleTexture: THREE.CanvasTexture;
  private readonly autopilot: boolean;
  // private readonly cameraFocusTarget = new THREE.Vector3();
  private readonly instanceSoundPosition = new THREE.Vector3();
  private readonly retroResolution = new THREE.Vector2(1, 1);
  private readonly instances: BreakoutoutoutInstance[] = [];
  private readonly views = new Map<BreakoutoutoutInstance, InstanceView>();

  private pixi!: Application;
  private hudLayer!: Container;
  private scoreText!: Text;
  private livesText!: Text;
  private levelText!: Text;
  private realityText!: Text;
  private phaseText!: Text;
  private badge!: Graphics;
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

    this.composer = new EffectComposer(this.renderer);
    this.retroPass = new ShaderPass(RETRO_SHADER);
    // this.bokehPass = new BokehPass(this.scene, this.camera, {
    //   focus: this.cameraBaseDistance,
    //   aspect: 1,
    //   aperture: DEPTH_OF_FIELD_APERTURE,
    //   maxblur: DEPTH_OF_FIELD_MAX_BLUR,
    //   width: 1,
    //   height: 1
    // });
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(this.retroPass);
    // this.composer.addPass(this.bokehPass);

    // this.particleTexture = createParticleTexture();
    this.createLighting();
    this.attachInput();
    this.resize();
  }

  static async create(root: HTMLElement, options: BreakoutGameOptions = {}): Promise<BreakoutGame> {
    await RAPIER.init();
    const game = new BreakoutGame(root, options);
    await game.createPixiHud();
    game.createNebulaSystem();
    game.addInstance(new BreakoutoutoutInstance(game.nextInstanceId, undefined, { autopilot: game.autopilot }));
    game.nextInstanceId += 1;
    game.updateHud();
    requestAnimationFrame(game.tick);
    return game;
  }

  private async createPixiHud(): Promise<void> {
    this.pixi = new Application();
    await this.pixi.init({
      resizeTo: this.shell,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio, 2),
      autoDensity: true
    });

    this.pixi.canvas.className = 'pixi-layer';
    this.shell.appendChild(this.pixi.canvas);

    this.hudLayer = new Container();
    this.pixi.stage.addChild(this.hudLayer);

    this.badge = new Graphics();
    this.hudLayer.addChild(this.badge);

    this.scoreText = this.makeHudText(22, 0xf4f9f8);
    this.livesText = this.makeHudText(22, 0xf4f9f8);
    this.levelText = this.makeHudText(18, 0xf0c95d);
    this.realityText = this.makeHudText(16, 0x8ce9df);
    this.phaseText = this.makeHudText(44, 0xffffff, 'bold');
    this.phaseText.anchor.set(0.5);

    this.hudLayer.addChild(
      this.scoreText,
      this.livesText,
      this.levelText,
      this.realityText,
      this.phaseText
    );
    this.layoutHud();
  }

  private makeHudText(size: number, fill: number, fontWeight: 'normal' | 'bold' = 'bold'): Text {
    return new Text({
      text: '',
      style: {
        fill,
        fontFamily: 'Inter, system-ui, sans-serif',
        fontSize: size,
        fontWeight,
        letterSpacing: 0
      }
    });
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
    const bricks = new Map<string, THREE.Mesh>();

    // this.createBackboard(group);
    this.createWalls(group);
    group.add(paddleMesh, ballMesh);

    const view: InstanceView = { instance, group, paddleMesh, ballMesh, bricks };
    this.syncInstanceView(view, state, 0);
    return view;
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
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0x22323a,
      emissive: 0x10292a,
      roughness: 0.5,
      metalness: 0.2
    });
    const walls = [
      { x: -HALF_WIDTH - WALL_THICKNESS / 2, y: 0, width: WALL_THICKNESS, height: BOARD_HEIGHT + 0.6 },
      { x: HALF_WIDTH + WALL_THICKNESS / 2, y: 0, width: WALL_THICKNESS, height: BOARD_HEIGHT + 0.6 },
      { x: 0, y: HALF_HEIGHT + WALL_THICKNESS / 2, width: BOARD_WIDTH + WALL_THICKNESS * 2, height: WALL_THICKNESS }
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
    this.composer.setPixelRatio(pixelRatio);
    this.composer.setSize(width, height);
    // this.resizeDepthOfField(width, height, pixelRatio);
    this.resizeRetroPass(width, height, pixelRatio);
    this.pixi?.renderer.resize(width, height);
    this.layoutHud();
  };

  private readonly tick = (time: number): void => {
    const delta = Math.min((time - this.lastTime) / 1000, MAX_DT);
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
    this.nebula?.system.update(delta);
    this.updateRetroPass(time / 1000);
    this.composer.render(delta);
    requestAnimationFrame(this.tick);
  };

  private launchOrAdvanceSelected(): void {
    const selected = this.instances[this.selectedIndex];
    if (!selected || !selected.isActive()) {
      this.updateHud();
      return;
    }

    this.handleInstanceEvents(selected, selected.launchOrAdvance());
    this.updateHud();
  }

  private restartSelected(): void {
    const selected = this.instances[this.selectedIndex];
    if (selected?.isActive()) {
      this.handleInstanceEvents(selected, selected.restart());
    }
    this.updateHud();
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

    this.updateHud();
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

  private get allActivePlanesCleared(): boolean {
    return this.instances.some((instance) => instance.isCleared())
      && this.instances.every((instance) => !instance.isActive());
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

    this.selectedIndex = clamp(index, 0, this.instances.length - 1);
    this.updateInstanceOpacity();
    this.updateHud();
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
    // this.updateDepthOfFieldFocus();
  }

  // private resizeDepthOfField(width: number, height: number, pixelRatio: number): void {
  //   this.bokehPass.renderTargetDepth.setSize(width * pixelRatio, height * pixelRatio);
  //   (this.bokehPass.uniforms as BokehUniforms).aspect.value = this.camera.aspect;
  // }

  // private updateDepthOfFieldFocus(): void {
  //   this.cameraFocusTarget.set(0, 0, this.cameraFocusZ);
  //   (this.bokehPass.uniforms as BokehUniforms).focus.value = this.camera.position.distanceTo(this.cameraFocusTarget);
  // }

  private resizeRetroPass(width: number, height: number, pixelRatio: number): void {
    const uniforms = this.retroPass.uniforms as unknown as RetroUniforms;
    this.retroResolution.set(width * pixelRatio, height * pixelRatio);
    uniforms.resolution.value.copy(this.retroResolution);
    uniforms.pixelSize.value = RETRO_PIXEL_SIZE * pixelRatio;
  }

  private updateRetroPass(time: number): void {
    (this.retroPass.uniforms as unknown as RetroUniforms).time.value = time;
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
    if (!this.scoreText || this.instances.length === 0) {
      return;
    }

    const selected = this.instances[this.selectedIndex]?.getRenderState() ?? this.instances[0].getRenderState();
    this.scoreText.text = `SCORE ${selected.score.toString().padStart(5, '0')}`;
    this.livesText.text = `LIVES ${selected.lives}`;
    this.levelText.text = `LEVEL ${selected.level}`;
    const autoPilotLabel = selected.autoPilotActive
      ? selected.autoPilotRemaining > 0
        ? `  AUTO ${Math.ceil(selected.autoPilotRemaining)}s`
        : '  AUTO'
      : '';
    this.realityText.text = `REALITY ${this.selectedIndex + 1}/${this.instances.length}  BALL ${Math.round(this.ballSpeedMultiplier * 100)}%${autoPilotLabel}`;

    const phaseLabel = {
      ready: 'READY',
      playing: '',
      'level-clear': this.allActivePlanesCleared ? 'ALL CLEAR' : 'PLANE CLEAR',
      'game-over': 'GAME OVER'
    } satisfies Record<typeof selected.phase, string>;
    this.phaseText.text = selected.autoPilotActive ? 'autopilot mode' : phaseLabel[selected.phase];
    this.phaseText.visible = this.phaseText.text.length > 0;
    this.badge.visible = this.phaseText.visible;
    this.layoutHud();
  }

  private layoutHud(): void {
    if (!this.scoreText || !this.pixi) {
      return;
    }

    const width = this.pixi.renderer.width;
    const height = this.pixi.renderer.height;
    const margin = Math.max(18, Math.min(width, height) * 0.035);
    const stackedHud = width < 560;

    this.scoreText.anchor.set(0, 0);
    this.scoreText.position.set(margin, margin);
    this.livesText.anchor.set(1, 0);
    this.livesText.position.set(width - margin, margin);
    this.levelText.anchor.set(0.5, 0);
    this.levelText.position.set(width / 2, stackedHud ? margin + 32 : margin + 2);
    this.realityText.anchor.set(0.5, 0);
    this.realityText.position.set(width / 2, stackedHud ? margin + 58 : margin + 30);
    this.phaseText.position.set(width / 2, height * 0.56);

    const badgeWidth = Math.min(360, width - margin * 2);
    this.badge.clear();
    if (this.badge.visible) {
      this.badge
        .roundRect(width / 2 - badgeWidth / 2, this.phaseText.y - 45, badgeWidth, 92, 8)
        .fill({ color: 0x07080b, alpha: 0.68 })
        .stroke({ color: 0xf0c95d, width: 1, alpha: 0.85 });
    }
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
  material.userData.baseOpacity = baseOpacity;
  material.opacity = baseOpacity * opacity;
  material.transparent = material.opacity < 0.999;
  material.depthWrite = material.opacity >= 0.999;
  material.needsUpdate = true;
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
