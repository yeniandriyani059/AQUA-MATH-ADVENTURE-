import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { MISSION_LOCATIONS } from '../data/locations';
import { CharacterId, MissionLocation } from '../types/game';
import {
  animateChibiCharacter,
  CharacterAnimState,
  ChibiCharacterRig,
  createChibiCharacterMesh,
  createLivingAquaCityWorld,
  createMissionLocationStructure,
  createProceduralStoneBumpTexture,
} from '../three/proceduralModels';
import { soundManager } from '../utils/sound';

// Pre-allocated module-scope math objects (Zero GC inside tick loop)
const _desiredCamPos = new THREE.Vector3();
const _desiredLookAt = new THREE.Vector3();
const _camDir = new THREE.Vector3();
const _moveVec = new THREE.Vector3();
const _dummyObj = new THREE.Object3D();
const _camRaycaster = new THREE.Raycaster();

export interface JoystickVector {
  x: number; // -1 to 1
  y: number; // -1 to 1
}

export type CameraViewDistancePreset = 'close' | 'normal' | 'wide';
export type CameraAnglePreset = 'back' | 'front' | 'left' | 'right';

export interface CameraControlActions {
  zoomIn: () => void;
  zoomOut: () => void;
  resetCamera: () => void;
  setViewPreset: (preset: CameraViewDistancePreset) => void;
  setAnglePreset: (angle: CameraAnglePreset) => void;
  orbitBy: (deltaYaw: number, deltaPitch: number) => void;
  getState: () => {
    yaw: number;
    pitch: number;
    distance: number;
    effectiveDistance: number;
    preset: CameraViewDistancePreset;
    playerRotY: number;
  };
}

const MIN_ORBIT_PITCH = 0.06; // ~3.4 deg (Eye-level view, never penetrates ground)
const MAX_ORBIT_PITCH = 1.05; // ~60 deg (Elevated overview, never flips upside down)
const MIN_ORBIT_DISTANCE = 3.0; // Never penetrates character body
const MAX_ORBIT_DISTANCE = 17.5; // Wide city overview

export const CAMERA_PRESET_CONFIG: Record<
  CameraViewDistancePreset,
  { distance: number; pitch: number; label: string }
> = {
  close: { distance: 4.1, pitch: 0.15, label: 'Close' },
  normal: { distance: 7.4, pitch: 0.24, label: 'Normal' },
  wide: { distance: 12.2, pitch: 0.32, label: 'Wide' },
};

function classifyDistancePreset(dist: number): CameraViewDistancePreset {
  if (dist < 5.6) return 'close';
  if (dist <= 9.8) return 'normal';
  return 'wide';
}

function shortestAngleDelta(fromAngle: number, toAngle: number): number {
  return Math.atan2(Math.sin(toAngle - fromAngle), Math.cos(toAngle - fromAngle));
}

interface AquaCityCanvasProps {
  sceneMode: 'tour' | 'playing';
  characterId: CharacterId;
  unlockedLevel: number;
  completedLocationIds: number[];
  joystickRef: React.MutableRefObject<JoystickVector>;
  isSprinting: boolean;
  jumpSignal: number;
  celebrateSignal?: number;
  teleportTarget: { locationId: number; timestamp: number } | null;
  onNearbyLocationChange: (loc: MissionLocation | null, distance: number) => void;
  onTriggerInteract: (loc: MissionLocation) => void;
  playerCoordsRef?: React.MutableRefObject<{ x: number; z: number; rotationY: number }>;
  cameraControlRef?: React.MutableRefObject<CameraControlActions | null>;
  onCameraPresetChange?: (preset: CameraViewDistancePreset) => void;
}

const isSoftwareGl = (() => {
  if (typeof document === 'undefined') return true;
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return true;
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
  const gpu = String(gl.getParameter(param));
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
})();

export const AquaCityCanvas: React.FC<AquaCityCanvasProps> = ({
  sceneMode,
  characterId,
  unlockedLevel,
  completedLocationIds,
  joystickRef,
  isSprinting,
  jumpSignal,
  celebrateSignal = 0,
  teleportTarget,
  onNearbyLocationChange,
  onTriggerInteract,
  playerCoordsRef,
  cameraControlRef,
  onCameraPresetChange,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);

  // Store latest props/callbacks in refs so WebGL scene never unmounts on HUD updates
  const sceneModeRef = useRef(sceneMode);
  sceneModeRef.current = sceneMode;

  const isSprintingRef = useRef(isSprinting);
  isSprintingRef.current = isSprinting;

  const unlockedLevelRef = useRef(unlockedLevel);
  unlockedLevelRef.current = unlockedLevel;

  const completedIdsRef = useRef<Set<number>>(new Set(completedLocationIds));
  completedIdsRef.current = new Set(completedLocationIds);

  const onNearbyRef = useRef(onNearbyLocationChange);
  onNearbyRef.current = onNearbyLocationChange;

  const onInteractRef = useRef(onTriggerInteract);
  onInteractRef.current = onTriggerInteract;

  const onPresetChangeRef = useRef(onCameraPresetChange);
  onPresetChangeRef.current = onCameraPresetChange;

  // Player state refs
  const playerPosRef = useRef(new THREE.Vector3(-32, 0, 35)); // Spawn facing Location 1 (Water Tank Station)
  const playerRotYRef = useRef(Math.PI); // Facing -Z toward Water Tank Station
  const playerVelYRef = useRef(0);
  const isGroundedRef = useRef(true);
  const walkCycleRef = useRef(0);
  const celebrateUntilRef = useRef(0);
  const elapsedRef = useRef(0);
  const currentNearbyIdRef = useRef<number | null>(null);

  // 360-Degree Third-Person Free Orbit Camera State Refs
  // When playerRotY = Math.PI (facing -Z), behind the character is yaw = playerRotY + Math.PI = 2*Math.PI (or 0, +Z offset)
  const targetYawRef = useRef<number>(0);
  const currentYawRef = useRef<number>(0);
  const targetPitchRef = useRef<number>(CAMERA_PRESET_CONFIG.normal.pitch);
  const currentPitchRef = useRef<number>(CAMERA_PRESET_CONFIG.normal.pitch);
  const targetDistRef = useRef<number>(CAMERA_PRESET_CONFIG.normal.distance);
  const currentDistRef = useRef<number>(CAMERA_PRESET_CONFIG.normal.distance);
  const effectiveDistRef = useRef<number>(CAMERA_PRESET_CONFIG.normal.distance);
  const activePresetRef = useRef<CameraViewDistancePreset>('normal');

  // Rebuild character mesh when characterId changes
  const characterSlotRef = useRef<THREE.Group | null>(null);
  const characterPartsRef = useRef<ChibiCharacterRig | null>(null);
  const syncCameraNowRef = useRef<(() => void) | null>(null);

  // Sync preset state helper
  const updatePresetFromDistance = (dist: number) => {
    const nextPreset = classifyDistancePreset(dist);
    if (nextPreset !== activePresetRef.current) {
      activePresetRef.current = nextPreset;
      onPresetChangeRef.current?.(nextPreset);
    }
  };

  // Expose imperative Camera Control API to parent HUD & automated verification
  useEffect(() => {
    const api: CameraControlActions = {
      zoomIn: () => {
        const nextDist = THREE.MathUtils.clamp(
          targetDistRef.current - 1.8,
          MIN_ORBIT_DISTANCE,
          MAX_ORBIT_DISTANCE,
        );
        targetDistRef.current = nextDist;
        currentDistRef.current = nextDist;
        effectiveDistRef.current = nextDist;
        updatePresetFromDistance(nextDist);
        syncCameraNowRef.current?.();
      },
      zoomOut: () => {
        const nextDist = THREE.MathUtils.clamp(
          targetDistRef.current + 1.8,
          MIN_ORBIT_DISTANCE,
          MAX_ORBIT_DISTANCE,
        );
        targetDistRef.current = nextDist;
        currentDistRef.current = nextDist;
        effectiveDistRef.current = nextDist;
        updatePresetFromDistance(nextDist);
        syncCameraNowRef.current?.();
      },
      resetCamera: () => {
        // Standard third-person behind character
        const desiredBehindYaw = playerRotYRef.current + Math.PI;
        targetYawRef.current += shortestAngleDelta(targetYawRef.current, desiredBehindYaw);
        currentYawRef.current = targetYawRef.current;
        targetPitchRef.current = CAMERA_PRESET_CONFIG.normal.pitch;
        currentPitchRef.current = targetPitchRef.current;
        targetDistRef.current = CAMERA_PRESET_CONFIG.normal.distance;
        currentDistRef.current = targetDistRef.current;
        effectiveDistRef.current = targetDistRef.current;
        updatePresetFromDistance(CAMERA_PRESET_CONFIG.normal.distance);
        syncCameraNowRef.current?.();
      },
      setViewPreset: (preset: CameraViewDistancePreset) => {
        const cfg = CAMERA_PRESET_CONFIG[preset];
        targetDistRef.current = cfg.distance;
        currentDistRef.current = cfg.distance;
        effectiveDistRef.current = cfg.distance;
        targetPitchRef.current = cfg.pitch;
        currentPitchRef.current = cfg.pitch;
        activePresetRef.current = preset;
        onPresetChangeRef.current?.(preset);
        syncCameraNowRef.current?.();
      },
      setAnglePreset: (angle: CameraAnglePreset) => {
        let desiredYaw = playerRotYRef.current + Math.PI; // back
        if (angle === 'front') {
          desiredYaw = playerRotYRef.current; // Looking straight at character's front face
        } else if (angle === 'right') {
          desiredYaw = playerRotYRef.current + Math.PI / 2; // Looking at character's right side
        } else if (angle === 'left') {
          desiredYaw = playerRotYRef.current - Math.PI / 2; // Looking at character's left side
        }
        targetYawRef.current += shortestAngleDelta(targetYawRef.current, desiredYaw);
        currentYawRef.current = targetYawRef.current;
        syncCameraNowRef.current?.();
      },
      orbitBy: (deltaYaw: number, deltaPitch: number) => {
        targetYawRef.current += deltaYaw;
        currentYawRef.current = targetYawRef.current;
        targetPitchRef.current = THREE.MathUtils.clamp(
          targetPitchRef.current + deltaPitch,
          MIN_ORBIT_PITCH,
          MAX_ORBIT_PITCH,
        );
        currentPitchRef.current = targetPitchRef.current;
        syncCameraNowRef.current?.();
      },
      getState: () => ({
        yaw: currentYawRef.current,
        pitch: currentPitchRef.current,
        distance: currentDistRef.current,
        effectiveDistance: effectiveDistRef.current,
        preset: activePresetRef.current,
        playerRotY: playerRotYRef.current,
      }),
    };

    if (cameraControlRef) {
      cameraControlRef.current = api;
    }
    (window as unknown as { __aquaCamera?: CameraControlActions }).__aquaCamera = api;

    return () => {
      if (cameraControlRef) {
        cameraControlRef.current = null;
      }
    };
  }, [cameraControlRef]);

  // Handle jump trigger from button
  const prevJumpSignalRef = useRef(jumpSignal);
  useEffect(() => {
    if (jumpSignal !== prevJumpSignalRef.current) {
      prevJumpSignalRef.current = jumpSignal;
      if (isGroundedRef.current && sceneModeRef.current === 'playing') {
        playerVelYRef.current = 8.8;
        isGroundedRef.current = false;
        soundManager.playJump();
      }
    }
  }, [jumpSignal]);

  // Handle happy celebration trigger from button
  const prevCelebrateSignalRef = useRef(celebrateSignal);
  useEffect(() => {
    if (celebrateSignal !== prevCelebrateSignalRef.current) {
      prevCelebrateSignalRef.current = celebrateSignal;
      celebrateUntilRef.current = elapsedRef.current + 2.8;
      soundManager.playBeaconNear();
    }
  }, [celebrateSignal]);

  // Handle teleport / quick-navigate to a location
  useEffect(() => {
    if (!teleportTarget) return;
    const loc = MISSION_LOCATIONS.find((l) => l.id === teleportTarget.locationId);
    if (!loc) return;
    // Place player right on the interactive mission pad in front of the structure
    playerPosRef.current.set(loc.position.x, 0, loc.position.z + 5.8);
    playerRotYRef.current = Math.PI; // Face the building (-Z)
    // Align camera behind player on teleport
    const desiredBehindYaw = Math.PI + Math.PI;
    targetYawRef.current += shortestAngleDelta(targetYawRef.current, desiredBehindYaw);
    celebrateUntilRef.current = elapsedRef.current + 1.8;
    soundManager.playBeaconNear();
  }, [teleportTarget]);

  // Swap character model dynamically when characterId prop changes
  useEffect(() => {
    if (!characterSlotRef.current) return;
    while (characterSlotRef.current.children.length > 0) {
      characterSlotRef.current.remove(characterSlotRef.current.children[0]);
    }
    const built = createChibiCharacterMesh(characterId);
    characterSlotRef.current.add(built.root);
    characterPartsRef.current = built;
  }, [characterId]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    // Prevent browser default touch scrolling/zooming on the 3D canvas
    renderer.domElement.style.touchAction = 'none';

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const skyHorizonColor = new THREE.Color(0x67e8f9);
    scene.background = skyHorizonColor;
    scene.fog = new THREE.FogExp2(0x7dd3fc, 0.0046);

    // Studio PBR Environment Map (RoomEnvironment + PMREMGenerator)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.4, 240);
    if (sceneModeRef.current === 'tour') {
      camera.position.set(0, 5.4, 26.5);
    } else {
      camera.position.set(-32, 3.2, 42.4);
    }

    // Vibrant Cinematic Daylight Rig
    const hemiLight = new THREE.HemisphereLight(0xe0f2fe, 0x10b981, 1.05);
    hemiLight.position.set(0, 55, 0);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.9);
    sunLight.position.set(36, 62, 35);
    if (!isSoftwareGl) {
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.width = 1024;
      sunLight.shadow.mapSize.height = 1024;
      const d = 58;
      sunLight.shadow.camera.left = -d;
      sunLight.shadow.camera.right = d;
      sunLight.shadow.camera.top = d;
      sunLight.shadow.camera.bottom = -d;
      sunLight.shadow.camera.near = 5;
      sunLight.shadow.camera.far = 150;
      sunLight.shadow.bias = -0.0005;
      sunLight.shadow.normalBias = 0.02;
    }
    scene.add(sunLight);

    // Soft rim/fill directional light for cartoon chibi vibrancy (illuminates front & back equally well)
    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.72);
    fillLight.position.set(-30, 28, -28);
    scene.add(fillLight);

    const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
    const bumpTex = createProceduralStoneBumpTexture(maxAnisotropy);

    // 1. Sparkling Outer Aqua Ocean Basin (y = -0.35)
    const oceanGeo = new THREE.CircleGeometry(170, 48);
    oceanGeo.rotateX(-Math.PI / 2);
    const oceanMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7,
      roughness: 0.14,
      metalness: 0.25,
      clearcoat: 0.9,
      clearcoatRoughness: 0.1,
    });
    const oceanMesh = new THREE.Mesh(oceanGeo, oceanMat);
    oceanMesh.position.y = -0.35;
    scene.add(oceanMesh);

    // 2. Main Aqua City Island Terrain (y = 0)
    const islandGeo = new THREE.CylinderGeometry(58, 62, 1.2, 48);
    const islandMat = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      roughness: 0.8,
      metalness: 0.04,
      bumpMap: bumpTex,
      bumpScale: 0.035,
    });
    const islandMesh = new THREE.Mesh(islandGeo, islandMat);
    islandMesh.position.y = -0.6;
    islandMesh.receiveShadow = true;
    scene.add(islandMesh);

    // 3. Central Aqua Plaza & Connecting Road Network
    const plazaGeo = new THREE.CircleGeometry(14.5, 36);
    plazaGeo.rotateX(-Math.PI / 2);
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.6,
      metalness: 0.1,
      bumpMap: bumpTex,
      bumpScale: 0.025,
    });
    const plazaMesh = new THREE.Mesh(plazaGeo, roadMat);
    plazaMesh.position.y = 0.03;
    plazaMesh.receiveShadow = true;
    scene.add(plazaMesh);

    // Decorative cyan ring around Central Plaza
    const plazaTrim = new THREE.Mesh(
      new THREE.RingGeometry(13.8, 14.5, 48),
      new THREE.MeshStandardMaterial({ color: 0x22d3ee, roughness: 0.25, metalness: 0.4 }),
    );
    plazaTrim.rotation.x = -Math.PI / 2;
    plazaTrim.position.y = 0.038;
    scene.add(plazaTrim);

    // Collect solid building meshes for Camera Collision Detection
    const cameraColliderMeshes: THREE.Object3D[] = [];

    // Central Aqua City Monument Fountain at (0, 0, 8)
    const centralFountain = new THREE.Group();
    centralFountain.position.set(0, 0, 8);
    const fBasin = new THREE.Mesh(
      new THREE.CylinderGeometry(4.0, 4.4, 0.75, 28),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }),
    );
    fBasin.position.y = 0.37;
    const fRim = new THREE.Mesh(
      new THREE.TorusGeometry(4.1, 0.18, 12, 32),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.25, metalness: 0.5 }),
    );
    fRim.rotation.x = Math.PI / 2;
    fRim.position.y = 0.75;
    const fWater = new THREE.Mesh(
      new THREE.CylinderGeometry(3.8, 3.8, 0.6, 28),
      new THREE.MeshPhysicalMaterial({
        color: 0x22d3ee,
        roughness: 0.1,
        metalness: 0.15,
        clearcoat: 1.0,
      }),
    );
    fWater.position.y = 0.55;
    const fTier2 = new THREE.Mesh(
      new THREE.CylinderGeometry(2.1, 2.5, 0.45, 24),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3 }),
    );
    fTier2.position.y = 1.6;
    const fSpire = new THREE.Mesh(
      new THREE.ConeGeometry(1.15, 4.6, 20),
      new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2, metalness: 0.6 }),
    );
    fSpire.position.y = 2.8;
    const fDrop = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.95, 1),
      new THREE.MeshStandardMaterial({
        color: 0xfacc15,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.35,
        roughness: 0.18,
        metalness: 0.85,
      }),
    );
    fDrop.position.y = 5.6;
    centralFountain.add(fBasin, fRim, fWater, fTier2, fSpire, fDrop);
    scene.add(centralFountain);
    cameraColliderMeshes.push(fSpire, fTier2);

    // Build stone pathways connecting each location to the central ring
    MISSION_LOCATIONS.forEach((loc) => {
      const start = new THREE.Vector3(0, 0.04, 8);
      const end = new THREE.Vector3(loc.position.x, 0.04, loc.position.z + 5.8);
      const dist = start.distanceTo(end);
      const pathGeo = new THREE.PlaneGeometry(2.8, dist);
      pathGeo.rotateX(-Math.PI / 2);
      const pathMesh = new THREE.Mesh(pathGeo, roadMat);
      pathMesh.position.copy(start).lerp(end, 0.5);
      pathMesh.position.y = 0.035;
      pathMesh.lookAt(end.x, 0.035, end.z);
      scene.add(pathMesh);
    });

    // 4. Build all 10 Mission Location Landmarks & register solid meshes for camera collision
    const locationAnimatedObjects: THREE.Object3D[] = [fDrop];
    const beaconMeshes: Map<number, THREE.Mesh> = new Map();

    MISSION_LOCATIONS.forEach((loc) => {
      const built = createMissionLocationStructure(loc, maxAnisotropy, isSoftwareGl);
      scene.add(built.group);
      beaconMeshes.set(loc.id, built.beaconRing);
      locationAnimatedObjects.push(...built.animatedParts);

      // Register tall building meshes (> 1.2m height) as camera colliders so the camera never clips inside buildings
      built.group.traverse((child) => {
        if (child instanceof THREE.Mesh && child !== built.beaconRing) {
          if (child.position.y > 0.6) {
            cameraColliderMeshes.push(child);
          }
        }
      });
    });

    // 5. Build Living Aqua City Environment (Waterfalls, Rivers, Bridges, Pipes, Parks, Clouds, Water Particles)
    const worldEnv = createLivingAquaCityWorld(scene, isSoftwareGl);

    // 6. Controllable Player Character Container (For 'playing' mode)
    const charSlot = new THREE.Group();
    charSlot.position.copy(playerPosRef.current);
    charSlot.rotation.y = playerRotYRef.current;
    scene.add(charSlot);
    characterSlotRef.current = charSlot;

    const initialChar = createChibiCharacterMesh(characterId);
    charSlot.add(initialChar.root);
    characterPartsRef.current = initialChar;

    // Pre-compile shaders on hardware GPUs
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // =========================================================================
    // DESKTOP MOUSE + WHEEL & SMARTPHONE TOUCH + PINCH CAMERA CONTROLS
    // =========================================================================
    let isMouseDragging = false;
    let lastMouseX = 0;
    let lastMouseY = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (sceneModeRef.current !== 'playing') return;
      if (e.button !== 0) return; // Only left click
      isMouseDragging = true;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isMouseDragging || sceneModeRef.current !== 'playing') return;
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      // Full 360-degree horizontal rotation + clamped vertical pitch
      targetYawRef.current -= dx * 0.0075;
      targetPitchRef.current = THREE.MathUtils.clamp(
        targetPitchRef.current + dy * 0.006,
        MIN_ORBIT_PITCH,
        MAX_ORBIT_PITCH,
      );
    };

    const onMouseUp = () => {
      isMouseDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      if (sceneModeRef.current !== 'playing') return;
      e.preventDefault();
      const nextDist = THREE.MathUtils.clamp(
        targetDistRef.current + e.deltaY * 0.0065,
        MIN_ORBIT_DISTANCE,
        MAX_ORBIT_DISTANCE,
      );
      targetDistRef.current = nextDist;
      updatePresetFromDistance(nextDist);
    };

    // Smartphone Multi-Touch Orbit & Pinch-to-Zoom on 3D Canvas
    let activeOrbitTouchId: number | null = null;
    let lastTouchX = 0;
    let lastTouchY = 0;
    let isPinching = false;
    let pinchStartSpread = 0;
    let pinchStartCameraDist = CAMERA_PRESET_CONFIG.normal.distance;

    const getCanvasTouchSpread = (t1: Touch, t2: Touch) =>
      Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);

    const onTouchStart = (e: TouchEvent) => {
      if (sceneModeRef.current !== 'playing') return;
      const touches = e.touches;

      if (touches.length >= 2) {
        isPinching = true;
        activeOrbitTouchId = null;
        pinchStartSpread = Math.max(10, getCanvasTouchSpread(touches[0], touches[1]));
        pinchStartCameraDist = targetDistRef.current;
      } else if (touches.length === 1) {
        isPinching = false;
        const t = e.changedTouches[0];
        activeOrbitTouchId = t.identifier;
        lastTouchX = t.clientX;
        lastTouchY = t.clientY;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (sceneModeRef.current !== 'playing') return;
      const touches = e.touches;

      if (isPinching && touches.length >= 2) {
        e.preventDefault();
        const spread = Math.max(10, getCanvasTouchSpread(touches[0], touches[1]));
        const scale = pinchStartSpread / spread;
        const nextDist = THREE.MathUtils.clamp(
          pinchStartCameraDist * scale,
          MIN_ORBIT_DISTANCE,
          MAX_ORBIT_DISTANCE,
        );
        targetDistRef.current = nextDist;
        updatePresetFromDistance(nextDist);
        return;
      }

      if (activeOrbitTouchId !== null) {
        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (t.identifier === activeOrbitTouchId) {
            e.preventDefault();
            const dx = t.clientX - lastTouchX;
            const dy = t.clientY - lastTouchY;
            lastTouchX = t.clientX;
            lastTouchY = t.clientY;

            targetYawRef.current -= dx * 0.0085;
            targetPitchRef.current = THREE.MathUtils.clamp(
              targetPitchRef.current + dy * 0.0065,
              MIN_ORBIT_PITCH,
              MAX_ORBIT_PITCH,
            );
            break;
          }
        }
      }
    };

    const onTouchEndOrCancel = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        isPinching = false;
      }
      if (e.touches.length === 1) {
        activeOrbitTouchId = e.touches[0].identifier;
        lastTouchX = e.touches[0].clientX;
        lastTouchY = e.touches[0].clientY;
      } else if (e.touches.length === 0) {
        activeOrbitTouchId = null;
      }
    };

    // Keyboard Input Listeners
    const keysPressed = new Set<string>();
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const code = e.code;
      keysPressed.add(code);

      if (sceneModeRef.current === 'playing') {
        if (code === 'Space' && isGroundedRef.current) {
          e.preventDefault();
          playerVelYRef.current = 8.8;
          isGroundedRef.current = false;
          soundManager.playJump();
        } else if (code === 'KeyC') {
          e.preventDefault();
          celebrateUntilRef.current = elapsedRef.current + 2.8;
          soundManager.playBeaconNear();
        } else if (code === 'KeyR') {
          // Keyboard shortcut [R] for Reset Camera
          e.preventDefault();
          const desiredBehindYaw = playerRotYRef.current + Math.PI;
          targetYawRef.current += shortestAngleDelta(targetYawRef.current, desiredBehindYaw);
          targetPitchRef.current = CAMERA_PRESET_CONFIG.normal.pitch;
          targetDistRef.current = CAMERA_PRESET_CONFIG.normal.distance;
          updatePresetFromDistance(CAMERA_PRESET_CONFIG.normal.distance);
        } else if (code === 'KeyE' || code === 'Enter') {
          const nearId = currentNearbyIdRef.current;
          if (nearId !== null) {
            const loc = MISSION_LOCATIONS.find((l) => l.id === nearId);
            if (loc) {
              e.preventDefault();
              onInteractRef.current(loc);
            }
          }
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysPressed.delete(e.code);
    };

    const onWindowBlur = () => {
      keysPressed.clear();
      isMouseDragging = false;
      activeOrbitTouchId = null;
      isPinching = false;
    };

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.render(scene, camera);
    };

    const domElem = renderer.domElement;
    domElem.addEventListener('mousedown', onMouseDown);
    domElem.addEventListener('wheel', onWheel, { passive: false });
    domElem.addEventListener('touchstart', onTouchStart, { passive: false });
    domElem.addEventListener('touchmove', onTouchMove, { passive: false });
    domElem.addEventListener('touchend', onTouchEndOrCancel);
    domElem.addEventListener('touchcancel', onTouchEndOrCancel);

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('resize', onResize);

    // Software-WebGL compatible loop
    let frameId = 0;
    let isDisposed = false;
    let lastMode = sceneModeRef.current;
    const clock = new THREE.Clock();
    const cameraTarget = new THREE.Vector3(
      playerPosRef.current.x,
      playerPosRef.current.y + 1.42,
      playerPosRef.current.z,
    );

    if (lastMode === 'playing') {
      const initYaw = currentYawRef.current;
      const initPitch = currentPitchRef.current;
      const initDist = currentDistRef.current;
      const horizDist = Math.cos(initPitch) * initDist;
      camera.position.set(
        playerPosRef.current.x + Math.sin(initYaw) * horizDist,
        playerPosRef.current.y + 1.42 + Math.sin(initPitch) * initDist,
        playerPosRef.current.z + Math.cos(initYaw) * horizDist,
      );
      camera.lookAt(cameraTarget);
    }

    // Immediate synchronous camera transform + WebGL render for instant button/preset response
    syncCameraNowRef.current = () => {
      if (isDisposed || sceneModeRef.current !== 'playing') return;
      const focusHeight = THREE.MathUtils.lerp(
        1.54,
        1.38,
        THREE.MathUtils.clamp((currentDistRef.current - 3.0) / 9.0, 0, 1),
      );
      cameraTarget.set(
        playerPosRef.current.x,
        playerPosRef.current.y + focusHeight,
        playerPosRef.current.z,
      );
      const cosPitch = Math.cos(currentPitchRef.current);
      const sinPitch = Math.sin(currentPitchRef.current);
      _camDir
        .set(
          Math.sin(currentYawRef.current) * cosPitch,
          sinPitch,
          Math.cos(currentYawRef.current) * cosPitch,
        )
        .normalize();

      let safeDist = currentDistRef.current;
      _camRaycaster.set(cameraTarget, _camDir);
      _camRaycaster.near = 0.4;
      _camRaycaster.far = currentDistRef.current;
      const hits = _camRaycaster.intersectObjects(cameraColliderMeshes, false);
      if (hits.length > 0 && hits[0].distance < currentDistRef.current) {
        safeDist = Math.max(2.3, hits[0].distance - 0.55);
      }
      effectiveDistRef.current = safeDist;
      _desiredCamPos.copy(cameraTarget).addScaledVector(_camDir, safeDist);
      if (_desiredCamPos.y < 0.55) _desiredCamPos.y = 0.55;
      camera.position.copy(_desiredCamPos);
      camera.lookAt(cameraTarget);
      renderer.render(scene, camera);
    };

    function afterDraw(cb: () => void) {
      if (isDisposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        if (isDisposed) return;
        const state = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 24);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      if (isDisposed) return;
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = clock.getElapsedTime();
      elapsedRef.current = elapsed;

      if (sceneModeRef.current !== lastMode) {
        lastMode = sceneModeRef.current;
        if (lastMode === 'tour') {
          camera.position.set(0, 5.4, 26.5);
          cameraTarget.set(0, 2.1, 0.0);
        } else {
          // Initialize third-person orbit camera smoothly behind character
          const behindYaw = playerRotYRef.current + Math.PI;
          targetYawRef.current = behindYaw;
          currentYawRef.current = behindYaw;
          const horiz = Math.cos(currentPitchRef.current) * currentDistRef.current;
          cameraTarget.set(
            playerPosRef.current.x,
            playerPosRef.current.y + 1.42,
            playerPosRef.current.z,
          );
          camera.position.set(
            cameraTarget.x + Math.sin(behindYaw) * horiz,
            cameraTarget.y + Math.sin(currentPitchRef.current) * currentDistRef.current,
            cameraTarget.z + Math.cos(behindYaw) * horiz,
          );
          camera.lookAt(cameraTarget);
        }
      }

      // 1. Animate waterfall UV scrolling & sky clouds
      worldEnv.waterfallTexture.offset.y += dt * 1.35;
      worldEnv.cloudsGroup.rotation.y += dt * 0.018;

      // 2. Animate 140 water splash & fountain droplets (Zero GC)
      const pList = worldEnv.particleData;
      for (let i = 0; i < pList.length; i++) {
        const p = pList[i];
        const t = (elapsed * p.speed + p.phase) % 1.0;
        const px = p.originX + p.vx * t * 1.4;
        const py = p.originY + p.vy * t - 0.5 * 9.2 * t * t;
        const pz = p.originZ + p.vz * t * 1.4;
        const scale = Math.max(0.2, Math.sin(t * Math.PI) * 1.15);
        _dummyObj.position.set(px, Math.max(0.05, py), pz);
        _dummyObj.scale.setScalar(scale);
        _dummyObj.updateMatrix();
        worldEnv.waterParticlesMesh.setMatrixAt(i, _dummyObj.matrix);
      }
      worldEnv.waterParticlesMesh.instanceMatrix.needsUpdate = true;

      // 3. Rotate animated parts on buildings
      for (let i = 0; i < locationAnimatedObjects.length; i++) {
        const obj = locationAnimatedObjects[i];
        obj.rotation.y += dt * 1.25;
      }

      // 4. Update beacon ring colors based on completed / unlocked status
      beaconMeshes.forEach((ringMesh, locId) => {
        const locMeta = MISSION_LOCATIONS.find((l) => l.id === locId)!;
        const mat = ringMesh.material as THREE.MeshStandardMaterial;
        const isDone = completedIdsRef.current.has(locId);
        const isUnlocked = locMeta.levelId <= unlockedLevelRef.current;
        if (isDone) {
          mat.color.setHex(0x10b981);
          mat.emissive.setHex(0x10b981);
        } else if (isUnlocked) {
          mat.color.setHex(0xfacc15);
          mat.emissive.setHex(0xfacc15);
        } else {
          mat.color.setHex(0x64748b);
          mat.emissive.setHex(0x334155);
        }
        ringMesh.position.y = 0.22 + Math.sin(elapsed * 3 + locId) * 0.08;
      });

      if (sceneModeRef.current === 'tour') {
        // TITLE SCREEN PANORAMA: Showcase live 3D Aqua City world
        charSlot.visible = false;

        _desiredCamPos.set(
          Math.sin(elapsed * 0.24) * 5.2,
          5.4 + Math.sin(elapsed * 0.42) * 0.35,
          26.5 + Math.cos(elapsed * 0.24) * 1.6,
        );
        _desiredLookAt.set(Math.sin(elapsed * 0.2) * 1.4, 2.1, -2.0);

        const damp = 1 - Math.exp(-4.5 * dt);
        camera.position.lerp(_desiredCamPos, damp);
        cameraTarget.lerp(_desiredLookAt, damp);
        camera.lookAt(cameraTarget);
      } else {
        // PLAYING MODE: Third-Person Free 360° Orbit Camera + Camera-Relative Character Locomotion
        charSlot.visible = true;

        // Smoothly interpolate orbit angles and distance using wall-clock camDt so even software WebGL converges rapidly
        const camDt = Math.min(rawDt, 0.25);
        const orbitDamp = 1 - Math.exp(-18.0 * camDt);
        currentYawRef.current += (targetYawRef.current - currentYawRef.current) * orbitDamp;
        currentPitchRef.current += (targetPitchRef.current - currentPitchRef.current) * orbitDamp;
        currentDistRef.current += (targetDistRef.current - currentDistRef.current) * orbitDamp;

        let inputX = joystickRef.current.x;
        let inputZ = joystickRef.current.y;

        if (keysPressed.has('KeyW') || keysPressed.has('ArrowUp')) inputZ -= 1;
        if (keysPressed.has('KeyS') || keysPressed.has('ArrowDown')) inputZ += 1;
        if (keysPressed.has('KeyA') || keysPressed.has('ArrowLeft')) inputX -= 1;
        if (keysPressed.has('KeyD') || keysPressed.has('ArrowRight')) inputX += 1;

        const sprinting =
          isSprintingRef.current || keysPressed.has('ShiftLeft') || keysPressed.has('ShiftRight');
        const moveSpeed = sprinting ? 14.5 : 9.2;

        const rawInputMag = Math.hypot(inputX, inputZ);

        if (rawInputMag > 0.05) {
          const normScale = rawInputMag > 1 ? 1 / rawInputMag : 1;
          const ix = inputX * normScale;
          const iz = inputZ * normScale;

          // Camera-relative horizontal basis vectors:
          // Camera is at offset (sin(yaw), cos(yaw)) from character, so camera looks along (-sin(yaw), -cos(yaw))
          const camForwardX = -Math.sin(currentYawRef.current);
          const camForwardZ = -Math.cos(currentYawRef.current);
          const camRightX = Math.cos(currentYawRef.current);
          const camRightZ = -Math.sin(currentYawRef.current);

          // Forward input is iz < 0 (-iz > 0); Right input is ix > 0
          const worldMoveX = -iz * camForwardX + ix * camRightX;
          const worldMoveZ = -iz * camForwardZ + ix * camRightZ;

          _moveVec.set(worldMoveX, 0, worldMoveZ);
          playerPosRef.current.x += _moveVec.x * moveSpeed * dt;
          playerPosRef.current.z += _moveVec.z * moveSpeed * dt;

          // Clamp within island playable radius (50m)
          const radialDist = Math.hypot(playerPosRef.current.x, playerPosRef.current.z);
          if (radialDist > 49) {
            const scale = 49 / radialDist;
            playerPosRef.current.x *= scale;
            playerPosRef.current.z *= scale;
          }

          // Smooth character facing angle toward movement direction (does NOT force camera yaw!)
          const targetAngle = Math.atan2(_moveVec.x, _moveVec.z);
          const angleDiff = shortestAngleDelta(playerRotYRef.current, targetAngle);
          playerRotYRef.current += angleDiff * (1 - Math.exp(-12 * dt));

          walkCycleRef.current += dt * (sprinting ? 13.5 : 8.8) * Math.min(1, rawInputMag);
        } else {
          walkCycleRef.current = 0;
        }

        // Jump & Gravity kinematics
        if (!isGroundedRef.current) {
          playerPosRef.current.y += playerVelYRef.current * dt;
          playerVelYRef.current -= 22.0 * dt;
          if (playerPosRef.current.y <= 0) {
            playerPosRef.current.y = 0;
            playerVelYRef.current = 0;
            isGroundedRef.current = true;
          }
        }

        // Apply position, rotation, and 5-state Chibi animation (idle, walk, run, jump, celebrate)
        if (characterSlotRef.current && characterPartsRef.current) {
          characterSlotRef.current.position.copy(playerPosRef.current);
          characterSlotRef.current.rotation.y = playerRotYRef.current;

          let animState: CharacterAnimState = 'idle';
          if (!isGroundedRef.current) {
            animState = 'jump';
          } else if (rawInputMag > 0.05) {
            animState = sprinting ? 'run' : 'walk';
          } else if (elapsed < celebrateUntilRef.current) {
            animState = 'celebrate';
          } else {
            animState = 'idle';
          }

          animateChibiCharacter(
            characterPartsRef.current,
            animState,
            elapsed,
            walkCycleRef.current,
          );
        }

        if (playerCoordsRef) {
          playerCoordsRef.current.x = playerPosRef.current.x;
          playerCoordsRef.current.z = playerPosRef.current.z;
          playerCoordsRef.current.rotationY = playerRotYRef.current;
        }

        // =====================================================================
        // 360° FREE ORBIT CAMERA TARGET, COLLISION DETECTION & SMOOTH FOLLOW
        // =====================================================================
        // Focus target height adjusts slightly: higher (face-level 1.54m) when zoomed in close, 1.38m when wide
        const focusHeight = THREE.MathUtils.lerp(
          1.54,
          1.38,
          THREE.MathUtils.clamp((currentDistRef.current - 3.0) / 9.0, 0, 1),
        );
        _desiredLookAt.set(
          playerPosRef.current.x,
          playerPosRef.current.y + focusHeight,
          playerPosRef.current.z,
        );

        const followDamp = 1 - Math.exp(-14.0 * dt);
        cameraTarget.lerp(_desiredLookAt, followDamp);

        // Unit direction vector from character focus target toward spherical orbit camera
        const cosPitch = Math.cos(currentPitchRef.current);
        const sinPitch = Math.sin(currentPitchRef.current);
        _camDir.set(
          Math.sin(currentYawRef.current) * cosPitch,
          sinPitch,
          Math.cos(currentYawRef.current) * cosPitch,
        ).normalize();

        // Raycast from character focus point toward camera to detect building/landmark obstructions
        let collisionSafeDist = currentDistRef.current;
        _camRaycaster.set(cameraTarget, _camDir);
        _camRaycaster.near = 0.4;
        _camRaycaster.far = currentDistRef.current;

        const hits = _camRaycaster.intersectObjects(cameraColliderMeshes, false);
        if (hits.length > 0 && hits[0].distance < currentDistRef.current) {
          collisionSafeDist = Math.max(2.3, hits[0].distance - 0.55);
        }

        // Fast pull-in on obstruction, smooth ease-out when clear
        const distDamp =
          collisionSafeDist < effectiveDistRef.current
            ? 1 - Math.exp(-20 * dt)
            : 1 - Math.exp(-9 * dt);
        effectiveDistRef.current +=
          (collisionSafeDist - effectiveDistRef.current) * distDamp;

        _desiredCamPos
          .copy(cameraTarget)
          .addScaledVector(_camDir, effectiveDistRef.current);

        // Enforce ground clearance so camera never penetrates terrain or water
        if (_desiredCamPos.y < 0.55) {
          _desiredCamPos.y = 0.55;
        }

        camera.position.copy(_desiredCamPos);
        camera.lookAt(cameraTarget);

        // Proximity detection to the 10 Mission Location pads
        let closestLoc: MissionLocation | null = null;
        let closestDist = Infinity;

        for (let i = 0; i < MISSION_LOCATIONS.length; i++) {
          const loc = MISSION_LOCATIONS[i];
          const padX = loc.position.x;
          const padZ = loc.position.z + 5.8;
          const dist = Math.hypot(
            playerPosRef.current.x - padX,
            playerPosRef.current.z - padZ,
          );
          if (dist < 6.2 && dist < closestDist) {
            closestDist = dist;
            closestLoc = loc;
          }
        }

        const nextNearId = closestLoc ? closestLoc.id : null;
        if (nextNearId !== currentNearbyIdRef.current) {
          currentNearbyIdRef.current = nextNearId;
          if (closestLoc) {
            soundManager.playBeaconNear();
          }
          onNearbyRef.current(closestLoc, closestDist);
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      isDisposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      domElem.removeEventListener('mousedown', onMouseDown);
      domElem.removeEventListener('wheel', onWheel);
      domElem.removeEventListener('touchstart', onTouchStart);
      domElem.removeEventListener('touchmove', onTouchMove);
      domElem.removeEventListener('touchend', onTouchEndOrCancel);
      domElem.removeEventListener('touchcancel', onTouchEndOrCancel);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      data-testid="aqua-city-3d-canvas"
      className="fixed inset-0 w-screen h-screen overflow-hidden select-none z-0 cursor-grab active:cursor-grabbing"
      aria-label="Dunia 3D Interaktif Aqua City"
    />
  );
};
