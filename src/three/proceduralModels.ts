import * as THREE from 'three';
import { CharacterId, MissionLocation } from '../types/game';
import { CHARACTERS } from '../data/locations';

export type CharacterAnimState = 'idle' | 'walk' | 'run' | 'jump' | 'celebrate';

export interface ChibiCharacterRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup: THREE.Group;
  leftArmPivot: THREE.Group;
  rightArmPivot: THREE.Group;
  leftLegPivot: THREE.Group;
  rightLegPivot: THREE.Group;
  backpackGroup: THREE.Group;
}

/**
 * Creates a procedural CanvasTexture sign / floating badge with SRGBColorSpace and max anisotropy.
 */
export function createLocationSignTexture(
  loc: MissionLocation,
  maxAnisotropy: number,
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 0, 192);
  grad.addColorStop(0, 'rgba(7, 89, 133, 0.95)');
  grad.addColorStop(1, 'rgba(8, 47, 73, 0.96)');

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(10, 10, 492, 172, 34);
  ctx.fill();

  ctx.lineWidth = 7;
  ctx.strokeStyle = loc.accentColor;
  ctx.stroke();

  // Inner subtle highlight border
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.roundRect(18, 18, 476, 156, 26);
  ctx.stroke();

  // Level & Location Number header
  ctx.fillStyle = '#fde047';
  ctx.font = 'bold 25px "Fredoka", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`POS ${loc.id} · LEVEL ${loc.levelId}`, 256, 54);

  // Location Name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 34px "Fredoka", sans-serif';
  ctx.fillText(loc.name.toUpperCase(), 256, 102);

  // Topic subtitle
  ctx.fillStyle = '#67e8f9';
  ctx.font = '700 23px "Plus Jakarta Sans", sans-serif';
  ctx.fillText(loc.topic, 256, 146);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = maxAnisotropy;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Creates a procedural tileable bump/roughness texture for ground/stone/water relief.
 */
export function createProceduralStoneBumpTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 256, 256);

  let seed = 101;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 650; i++) {
    const x = Math.floor(rand() * 256);
    const y = Math.floor(rand() * 256);
    const r = 2 + Math.floor(rand() * 5);
    const v = Math.floor(110 + rand() * 55);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(20, 20);
  tex.anisotropy = maxAnisotropy;
  return tex;
}

/**
 * Creates an animated waterfall stripe texture with SRGBColorSpace.
 */
export function createWaterfallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, 128, 0);
  grad.addColorStop(0, '#0284c7');
  grad.addColorStop(0.25, '#38bdf8');
  grad.addColorStop(0.5, '#bae6fd');
  grad.addColorStop(0.75, '#38bdf8');
  grad.addColorStop(1, '#0284c7');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 256);

  // White foam streaks
  ctx.fillStyle = 'rgba(255, 255, 255, 0.72)';
  for (let i = 0; i < 24; i++) {
    const x = (i * 19) % 116;
    const y = (i * 37) % 220;
    const w = 6 + (i % 5) * 2;
    const h = 28 + (i % 4) * 14;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 2);
  return tex;
}

const faceTextureCache: Partial<Record<CharacterId, THREE.CanvasTexture>> = {};

/**
 * Generates a high-resolution stylized 3D cartoon facial texture (warm brown iris gradients,
 * eyelashes, sculpted eyebrows, rosy cheeks, and cheerful open smile) mapped onto the 3D head.
 */
function getChibiFaceTexture(characterId: CharacterId): THREE.CanvasTexture {
  if (faceTextureCache[characterId]) {
    return faceTextureCache[characterId]!;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  // Warm soft skin base across the equirectangular UV map (front of sphere is u = 0.5, x = 512)
  const skinGrad = ctx.createLinearGradient(0, 0, 0, 512);
  skinGrad.addColorStop(0, '#ffd8b5');
  skinGrad.addColorStop(0.55, '#ffcca0');
  skinGrad.addColorStop(1, '#f5b889');
  ctx.fillStyle = skinGrad;
  ctx.fillRect(0, 0, 1024, 512);

  // Soft rosy cheek blush on left (x=428) and right (x=596), y=296
  const drawBlush = (cx: number, cy: number) => {
    const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 38);
    g.addColorStop(0, 'rgba(251, 113, 133, 0.58)');
    g.addColorStop(1, 'rgba(251, 113, 133, 0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(cx, cy, 38, 24, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  drawBlush(426, 304);
  drawBlush(598, 304);

  // Large expressive warm-brown chibi eyes at x=454 and x=570, y=248
  const isGirl = characterId !== 'bima';
  const drawExpressiveEye = (cx: number, cy: number, side: -1 | 1) => {
    ctx.save();
    ctx.translate(cx, cy);

    // Expressive dark-brown eyebrow
    ctx.strokeStyle = '#3b1d0a';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, -34, 34, Math.PI * 1.18, Math.PI * 1.82);
    ctx.stroke();

    // White sclera
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.ellipse(0, 0, 31, 35, 0, 0, Math.PI * 2);
    ctx.fill();

    // Warm golden-chestnut brown iris gradient
    const irisGrad = ctx.createRadialGradient(0, 6, 4, 0, 0, 26);
    irisGrad.addColorStop(0, '#d97706');
    irisGrad.addColorStop(0.55, '#78350f');
    irisGrad.addColorStop(1, '#271003');
    ctx.fillStyle = irisGrad;
    ctx.beginPath();
    ctx.ellipse(0, 1, 23, 27, 0, 0, Math.PI * 2);
    ctx.fill();

    // Deep dark pupil
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.ellipse(0, 1, 12, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Thick upper lash line
    ctx.strokeStyle = '#1e1008';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(0, 2, 31, Math.PI * 1.08, Math.PI * 1.92);
    ctx.stroke();

    if (isGirl) {
      // Delicate outer eyelash flick for Sinta & Kirana
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(side * 28, -10);
      ctx.lineTo(side * 37, -18);
      ctx.stroke();
    }

    // Dual glossy white catchlights
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(8, -9, 7.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(-8, 10, 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  drawExpressiveEye(454, 248, -1);
  drawExpressiveEye(570, 248, 1);

  // Cheerful open cartoon smile at (512, 316)
  ctx.save();
  ctx.translate(512, 314);
  ctx.fillStyle = '#9f1239';
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0.08 * Math.PI, 0.92 * Math.PI, false);
  ctx.closePath();
  ctx.fill();

  // Upper white teeth strip
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(-26, -2, 52, 10);
  // Warm pink tongue
  ctx.fillStyle = '#fb7185';
  ctx.beginPath();
  ctx.ellipse(0, 24, 18, 12, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Lip outline
  ctx.strokeStyle = '#881337';
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(0, 0, 28, 0.08 * Math.PI, 0.92 * Math.PI, false);
  ctx.stroke();
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  faceTextureCache[characterId] = tex;
  return tex;
}

/**
 * Builds a high-craft, stylized 3D Chibi Character (Bima, Sinta with White Hijab, or Kirana)
 * matching the official reference character designs with balanced chibi proportions (1:2.6),
 * canvas-mapped facial expressions, yellow-framed helmet goggles, water-drop pendant,
 * cargo pockets, backpack with water bottle, and laced high-top adventure sneakers.
 */
export function createChibiCharacterMesh(characterId: CharacterId): ChibiCharacterRig {
  const charMeta = CHARACTERS.find((c) => c.id === characterId) || CHARACTERS[0];
  const root = new THREE.Group();
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  // 1. Soft radial contact shadow on ground
  const shadowGeo = new THREE.CircleGeometry(0.82, 32);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMat = new THREE.MeshBasicMaterial({
    color: 0x032238,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const shadowDisc = new THREE.Mesh(shadowGeo, shadowMat);
  shadowDisc.position.y = 0.02;
  root.add(shadowDisc);

  // Shared High-Craft Materials
  const skinMat = new THREE.MeshStandardMaterial({
    color: 0xffcca0,
    roughness: 0.52,
    metalness: 0.02,
  });
  const faceMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: getChibiFaceTexture(characterId),
    roughness: 0.48,
    metalness: 0.02,
  });
  const blueJacketMat = new THREE.MeshStandardMaterial({
    color: 0x1d4ed8,
    roughness: 0.36,
    metalness: 0.14,
  });
  const royalBluePantsMat = new THREE.MeshStandardMaterial({
    color: 0x1e40af,
    roughness: 0.58,
    metalness: 0.08,
  });
  const cyanGlowMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.45,
    roughness: 0.18,
    metalness: 0.25,
  });
  const whiteFabricMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.38,
    metalness: 0.05,
  });
  const goldYellowMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.24,
    metalness: 0.35,
  });
  const darkStrapMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.65,
    metalness: 0.15,
  });

  // ============================================================================
  // 2. ARTICULATED LEGS, CARGO POCKETS & HIGH-TOP LACED ADVENTURE SNEAKERS (y = 0.68)
  // ============================================================================
  const buildLeg = (side: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.2, 0.68, 0);

    // Sculpted cargo pants leg
    const thigh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.135, 0.26, 12, 16),
      royalBluePantsMat,
    );
    thigh.position.y = -0.2;
    thigh.castShadow = true;
    pivot.add(thigh);

    // Side cargo pocket with golden-yellow flap (matching reference images)
    const pocketBox = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.15, 0.16),
      royalBluePantsMat,
    );
    pocketBox.position.set(side * 0.13, -0.14, 0.02);
    const pocketFlap = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.06, 0.17),
      goldYellowMat,
    );
    pocketFlap.position.set(side * 0.135, -0.08, 0.02);
    pivot.add(pocketBox, pocketFlap);

    // High-top sneaker ankle collar (yellow & white tongue)
    const ankleCollar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.155, 0.15, 0.11, 18),
      goldYellowMat,
    );
    ankleCollar.position.y = -0.39;
    const whiteTongue = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.08),
      whiteFabricMat,
    );
    whiteTongue.position.set(0, -0.37, 0.13);
    pivot.add(ankleCollar, whiteTongue);

    // Blue sneaker body + rounded toe cap
    const bootUpper = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.18, 0.4),
      blueJacketMat,
    );
    bootUpper.position.set(0, -0.5, 0.06);
    bootUpper.castShadow = true;
    const bootToe = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 12),
      whiteFabricMat,
    );
    bootToe.scale.set(1.0, 0.72, 1.05);
    bootToe.position.set(0, -0.52, 0.23);
    pivot.add(bootUpper, bootToe);

    // White shoelace bars across top of sneaker
    const lace1 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.04), whiteFabricMat);
    lace1.position.set(0, -0.42, 0.18);
    const lace2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.025, 0.04), whiteFabricMat);
    lace2.position.set(0, -0.45, 0.22);
    pivot.add(lace1, lace2);

    // Chunky white adventure sneaker sole
    const sole = new THREE.Mesh(new THREE.BoxGeometry(0.31, 0.08, 0.47), whiteFabricMat);
    sole.position.set(0, -0.61, 0.07);
    pivot.add(sole);

    return pivot;
  };

  const leftLegPivot = buildLeg(-1);
  const rightLegPivot = buildLeg(1);
  bodyGroup.add(leftLegPivot, rightLegPivot);

  // ============================================================================
  // 3. CHIBI TORSO, BLUE-WHITE ADVENTURER JACKET & WATER-DROP PENDANT (y = 1.0)
  // ============================================================================
  const torsoGroup = new THREE.Group();
  torsoGroup.position.set(0, 1.0, 0);
  bodyGroup.add(torsoGroup);

  // Main blue adventurer jacket
  const jacketMesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.31, 0.37, 0.66, 24),
    blueJacketMat,
  );
  jacketMesh.castShadow = true;
  torsoGroup.add(jacketMesh);

  // Crisp white ribbed bottom jacket hem
  const jacketHem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.375, 0.38, 0.1, 24),
    whiteFabricMat,
  );
  jacketHem.position.y = -0.26;
  torsoGroup.add(jacketHem);

  // White inner shirt & center zipper strip
  const shirtInsert = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.58, 0.14), whiteFabricMat);
  shirtInsert.position.set(0, 0.03, 0.28);
  torsoGroup.add(shirtInsert);

  // Angled white pocket trims on front of blue jacket (matching reference images)
  const leftPocketTrim = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.035, 0.04), whiteFabricMat);
  leftPocketTrim.position.set(-0.17, -0.08, 0.34);
  leftPocketTrim.rotation.z = 0.45;
  const rightPocketTrim = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.035, 0.04), whiteFabricMat);
  rightPocketTrim.position.set(0.17, -0.08, 0.34);
  rightPocketTrim.rotation.z = -0.45;
  torsoGroup.add(leftPocketTrim, rightPocketTrim);

  // Glowing Cyan Water-Drop Pendant Necklace on Chest
  const pendantDrop = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.12, 14), cyanGlowMat);
  pendantDrop.position.set(0, 0.11, 0.36);
  const pendantBase = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), cyanGlowMat);
  pendantBase.position.set(0, 0.06, 0.36);
  torsoGroup.add(pendantDrop, pendantBase);

  // Yellow backpack shoulder straps curving over the front chest
  [-1, 1].forEach((side) => {
    const strap = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.52, 0.12), goldYellowMat);
    strap.position.set(side * 0.22, 0.08, 0.29);
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.07, 0.14), darkStrapMat);
    buckle.position.set(side * 0.22, 0.12, 0.3);
    torsoGroup.add(strap, buckle);
  });

  // Dark belt with yellow buckle (visible on Bima)
  if (!charMeta.hijab) {
    const beltRing = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.04, 10, 24), darkStrapMat);
    beltRing.rotation.x = Math.PI / 2;
    beltRing.position.y = -0.31;
    const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.1, 0.08), goldYellowMat);
    buckle.position.set(0, -0.31, 0.37);
    torsoGroup.add(beltRing, buckle);
  }

  // White hoodie collar for Bima
  const collarRing = new THREE.Mesh(new THREE.TorusGeometry(0.29, 0.055, 12, 24), whiteFabricMat);
  collarRing.rotation.x = Math.PI / 2;
  collarRing.position.y = 0.32;
  torsoGroup.add(collarRing);

  // ============================================================================
  // 4. ARTICULATED ARMS, HANDS, WRISTWATCH & SINTA'S WATER-THEMED TABLET
  // ============================================================================
  const buildArm = (side: -1 | 1): THREE.Group => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.37, 1.24, 0);

    // Blue Shoulder & Sleeve
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 14), blueJacketMat);
    pivot.add(shoulder);

    const sleeve = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.105, 0.24, 12, 16),
      blueJacketMat,
    );
    sleeve.position.set(side * 0.05, -0.16, 0);
    sleeve.rotation.z = side * -0.18;
    sleeve.castShadow = true;
    pivot.add(sleeve);

    // Crisp white rolled cuff
    const wristCuff = new THREE.Mesh(
      new THREE.CylinderGeometry(0.118, 0.118, 0.075, 16),
      whiteFabricMat,
    );
    wristCuff.position.set(side * 0.085, -0.3, 0);
    wristCuff.rotation.z = side * -0.18;
    pivot.add(wristCuff);

    // BIMA: Blue smart-wristwatch on left wrist
    if (charMeta.id === 'bima' && side === -1) {
      const watchBand = new THREE.Mesh(
        new THREE.CylinderGeometry(0.105, 0.105, 0.05, 14),
        blueJacketMat,
      );
      watchBand.position.set(-0.095, -0.36, 0.01);
      const watchScreen = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.08, 0.04),
        cyanGlowMat,
      );
      watchScreen.position.set(-0.13, -0.36, 0.05);
      pivot.add(watchBand, watchScreen);
    }

    // Sculpted Chibi Hand + Thumb
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.11, 16, 14), skinMat);
    hand.position.set(side * 0.1, -0.4, 0.03);
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.06, 8, 8), skinMat);
    thumb.position.set(side * 0.06, -0.36, 0.1);
    thumb.rotation.x = -0.4;
    pivot.add(hand, thumb);

    // SINTA: Holds a sleek white-framed glowing Water-Themed Tablet in her left hand
    if (charMeta.id === 'sinta' && side === -1) {
      const tabletGroup = new THREE.Group();
      tabletGroup.position.set(-0.16, -0.38, 0.24);
      tabletGroup.rotation.x = -0.42;
      tabletGroup.rotation.y = 0.28;
      tabletGroup.rotation.z = 0.14;

      const tabletBody = new THREE.Mesh(
        new THREE.BoxGeometry(0.34, 0.46, 0.04),
        whiteFabricMat,
      );
      const tabletScreen = new THREE.Mesh(
        new THREE.BoxGeometry(0.29, 0.39, 0.046),
        cyanGlowMat,
      );
      const screenDropCone = new THREE.Mesh(
        new THREE.ConeGeometry(0.06, 0.13, 14),
        whiteFabricMat,
      );
      screenDropCone.position.set(0, 0.03, 0.028);
      const screenDropSphere = new THREE.Mesh(
        new THREE.SphereGeometry(0.06, 14, 12),
        whiteFabricMat,
      );
      screenDropSphere.position.set(0, -0.025, 0.028);

      tabletGroup.add(tabletBody, tabletScreen, screenDropCone, screenDropSphere);
      pivot.add(tabletGroup);
    }

    return pivot;
  };

  const leftArmPivot = buildArm(-1);
  const rightArmPivot = buildArm(1);
  bodyGroup.add(leftArmPivot, rightArmPivot);

  // ============================================================================
  // 5. ADVENTURER BACKPACK WITH TRANSPARENT SIDE WATER BOTTLE (Tas Punggung)
  // ============================================================================
  const backpackGroup = new THREE.Group();
  backpackGroup.position.set(0, 1.02, -0.31);

  const packMain = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.54, 0.26), blueJacketMat);
  packMain.castShadow = true;
  const packYellowTrim = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.14, 0.28),
    goldYellowMat,
  );
  packYellowTrim.position.set(0, 0.16, 0);

  // Side transparent blue water bottle with yellow cap (matching both reference images!)
  const bottleBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.085, 0.085, 0.32, 16),
    cyanGlowMat,
  );
  bottleBody.position.set(0.28, -0.05, 0.02);
  const bottleCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.085, 0.07, 16),
    goldYellowMat,
  );
  bottleCap.position.set(0.28, 0.14, 0.02);
  const bottleStrap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.092, 0.092, 0.08, 16),
    darkStrapMat,
  );
  bottleStrap.position.set(0.28, -0.14, 0.02);

  backpackGroup.add(packMain, packYellowTrim, bottleBody, bottleCap, bottleStrap);
  bodyGroup.add(backpackGroup);

  // ============================================================================
  // 6. PROPORTIONAL CHIBI HEAD, CANVAS FACE, HAIR/HIJAB & HELMET WITH GOGGLES (y = 1.68)
  // ============================================================================
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.68, 0);
  bodyGroup.add(headGroup);

  // Smooth Chibi Head Sphere mapped with high-resolution expressive face texture
  // Rotate -Math.PI / 2 on Y so UV u=0.5 (x=512 on canvas) faces straight forward (+Z)
  const headSphere = new THREE.Mesh(new THREE.SphereGeometry(0.43, 36, 32), faceMat);
  headSphere.scale.set(1.04, 0.98, 1.0);
  headSphere.rotation.y = -Math.PI / 2;
  headSphere.castShadow = true;
  headGroup.add(headSphere);

  // Cute 3D Button Nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.036, 12, 12), skinMat);
  nose.position.set(0, -0.03, 0.43);
  headGroup.add(nose);

  // Sculpted Ears (visible on Bima & Kirana)
  if (!charMeta.hijab) {
    const earGeo = new THREE.SphereGeometry(0.095, 14, 12);
    const leftEar = new THREE.Mesh(earGeo, skinMat);
    leftEar.scale.set(0.65, 1.05, 0.8);
    leftEar.position.set(-0.43, -0.02, 0.02);
    const rightEar = new THREE.Mesh(earGeo, skinMat);
    rightEar.scale.set(0.65, 1.05, 0.8);
    rightEar.position.set(0.43, -0.02, 0.02);
    headGroup.add(leftEar, rightEar);
  }

  // Helper: Blue Brimmed Adventurer Helmet + Yellow-Framed Cyan Goggles + Water-Drop Side Badge
  // (Worn by BOTH Bima and Sinta in the official reference images!)
  const buildAdventurerHelmetWithGoggles = () => {
    const helmetGroup = new THREE.Group();
    const helmetMat = new THREE.MeshPhysicalMaterial({
      color: 0x1d4ed8,
      roughness: 0.22,
      metalness: 0.2,
      clearcoat: 0.85,
    });

    // Main rounded helmet dome tilted slightly back so the entire face & eyebrows are clear from the front
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.485, 32, 24, 0, Math.PI * 2, 0, Math.PI * 0.45),
      helmetMat,
    );
    dome.scale.set(1.06, 0.98, 1.08);
    dome.position.set(0, 0.12, -0.02);
    dome.rotation.x = -0.36;
    dome.castShadow = true;
    helmetGroup.add(dome);

    // Flared wide adventurer helmet brim resting high above the eyebrows
    const brim = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.046, 12, 32),
      helmetMat,
    );
    brim.scale.set(1.06, 1.12, 0.75);
    brim.rotation.x = Math.PI / 2 - 0.34;
    brim.position.set(0, 0.21, 0.01);
    helmetGroup.add(brim);

    // Black goggle strap around helmet
    const strap = new THREE.Mesh(
      new THREE.TorusGeometry(0.485, 0.032, 10, 28),
      darkStrapMat,
    );
    strap.rotation.x = Math.PI / 2 - 0.34;
    strap.position.set(0, 0.28, -0.01);
    helmetGroup.add(strap);

    // Side glowing water-drop badge on right side of helmet
    const sideBadge = new THREE.Mesh(new THREE.OctahedronGeometry(0.065, 0), cyanGlowMat);
    sideBadge.position.set(0.49, 0.26, 0.06);
    helmetGroup.add(sideBadge);

    // Yellow-Framed Blue-Lens Adventure Goggles on front brow of helmet
    const gogglesGroup = new THREE.Group();
    gogglesGroup.position.set(0, 0.33, 0.01);
    gogglesGroup.rotation.x = -0.28;

    const lensMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.35,
      roughness: 0.1,
      metalness: 0.2,
      clearcoat: 1.0,
    });

    [-1, 1].forEach((side) => {
      const frame = new THREE.Mesh(
        new THREE.TorusGeometry(0.135, 0.036, 12, 24),
        goldYellowMat,
      );
      frame.position.set(side * 0.165, 0.02, 0.44);
      frame.rotation.y = side * 0.22;

      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.125, 0.125, 0.04, 20),
        lensMat,
      );
      lens.rotation.x = Math.PI / 2;
      lens.position.set(side * 0.165, 0.02, 0.44);
      lens.rotation.z = side * -0.22;

      gogglesGroup.add(frame, lens);
    });

    // Yellow bridge between goggle lenses
    const goggleBridge = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.045, 0.05),
      goldYellowMat,
    );
    goggleBridge.position.set(0, 0.03, 0.47);
    gogglesGroup.add(goggleBridge);

    helmetGroup.add(gogglesGroup);
    return helmetGroup;
  };

  if (charMeta.hijab) {
    // SINTA: Smooth Sculpted White Hijab Framing Face + Blue Helmet with Yellow Goggles
    const whiteHijabMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.34,
      metalness: 0.04,
    });

    // Main white hijab hood wrapping top, sides, and back of head in one seamless piece
    const hijabDome = new THREE.Mesh(
      new THREE.SphereGeometry(0.456, 36, 28, 0, Math.PI * 2, 0, Math.PI * 0.72),
      whiteHijabMat,
    );
    hijabDome.scale.set(1.03, 1.02, 1.04);
    hijabDome.position.set(0, 0.01, -0.04);
    hijabDome.rotation.x = -0.58;
    hijabDome.castShadow = true;
    headGroup.add(hijabDome);

    // Smooth circular hijab face-rim framing forehead, cheeks, and under-chin cleanly
    const faceRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.355, 0.042, 16, 36),
      whiteHijabMat,
    );
    faceRim.scale.set(1.0, 1.04, 0.65);
    faceRim.position.set(0, -0.02, 0.255);
    faceRim.rotation.x = 0.05;
    headGroup.add(faceRim);

    // Layered white hijab neck & shoulder shawl folds
    const shoulderShawl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.27, 0.4, 0.24, 28),
      whiteHijabMat,
    );
    shoulderShawl.position.set(0, 1.29, 0.01);
    const neckFold1 = new THREE.Mesh(
      new THREE.TorusGeometry(0.305, 0.068, 14, 28),
      whiteHijabMat,
    );
    neckFold1.rotation.x = Math.PI / 2 + 0.08;
    neckFold1.position.set(0, 1.35, 0.03);
    const neckFold2 = new THREE.Mesh(
      new THREE.TorusGeometry(0.355, 0.058, 14, 28),
      whiteHijabMat,
    );
    neckFold2.rotation.x = Math.PI / 2 + 0.12;
    neckFold2.position.set(0, 1.24, 0.04);
    bodyGroup.add(shoulderShawl, neckFold1, neckFold2);

    // Sinta's Blue Helmet with Yellow Goggles worn over her White Hijab
    const sintaHelmet = buildAdventurerHelmetWithGoggles();
    sintaHelmet.position.y = 0.02;
    headGroup.add(sintaHelmet);
  } else if (charMeta.id === 'bima') {
    // BIMA: Layered Sculpted Warm-Brown Hair + Blue Helmet with Yellow Goggles
    const brownHairMat = new THREE.MeshStandardMaterial({
      color: 0x4a2511,
      roughness: 0.54,
      metalness: 0.08,
    });

    const hairBack = new THREE.Mesh(
      new THREE.SphereGeometry(0.455, 28, 24, 0, Math.PI * 2, 0, Math.PI * 0.48),
      brownHairMat,
    );
    hairBack.scale.set(1.04, 1.0, 1.04);
    hairBack.position.set(0, 0.04, -0.05);
    hairBack.rotation.x = -0.52;
    hairBack.castShadow = true;
    headGroup.add(hairBack);

    // Layered sculpted hair bangs across upper forehead and temples (above eyebrows)
    const bangStrands = [
      { x: -0.22, y: 0.22, z: 0.35, rz: 0.34, scale: 0.82 },
      { x: -0.08, y: 0.24, z: 0.38, rz: 0.14, scale: 0.88 },
      { x: 0.07, y: 0.24, z: 0.38, rz: -0.15, scale: 0.9 },
      { x: 0.22, y: 0.22, z: 0.35, rz: -0.34, scale: 0.82 },
      { x: -0.37, y: 0.08, z: 0.2, rz: 0.22, scale: 0.78 },
      { x: 0.37, y: 0.08, z: 0.2, rz: -0.22, scale: 0.78 },
    ];
    bangStrands.forEach((b) => {
      const strand = new THREE.Mesh(
        new THREE.ConeGeometry(0.095 * b.scale, 0.19 * b.scale, 12),
        brownHairMat,
      );
      strand.position.set(b.x, b.y, b.z);
      strand.rotation.x = Math.PI * 0.84;
      strand.rotation.z = b.rz;
      headGroup.add(strand);
    });

    const bimaHelmet = buildAdventurerHelmetWithGoggles();
    headGroup.add(bimaHelmet);
  } else {
    // KIRANA: Chestnut Pigtails + Golden Headband
    const hairMat = new THREE.MeshStandardMaterial({ color: 0x4a2511, roughness: 0.56 });
    const hairTop = new THREE.Mesh(
      new THREE.SphereGeometry(0.46, 24, 20, 0, Math.PI * 2, 0, Math.PI * 0.48),
      hairMat,
    );
    hairTop.position.set(0, 0.05, -0.05);
    hairTop.rotation.x = -0.52;
    const leftTail = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 16), hairMat);
    leftTail.position.set(-0.46, 0.08, -0.06);
    const rightTail = new THREE.Mesh(new THREE.SphereGeometry(0.19, 16, 16), hairMat);
    rightTail.position.set(0.46, 0.08, -0.06);
    const headband = new THREE.Mesh(
      new THREE.TorusGeometry(0.44, 0.04, 10, 24, Math.PI),
      goldYellowMat,
    );
    headband.position.set(0, 0.12, 0.05);
    headGroup.add(hairTop, leftTail, rightTail, headband);
  }

  return {
    root,
    bodyGroup,
    headGroup,
    leftArmPivot,
    rightArmPivot,
    leftLegPivot,
    rightLegPivot,
    backpackGroup,
  };
}

/**
 * Animates a ChibiCharacterRig across 5 states: 'idle', 'walk', 'run', 'jump', 'celebrate'.
 */
export function animateChibiCharacter(
  rig: ChibiCharacterRig,
  state: CharacterAnimState,
  elapsed: number,
  walkPhase: number,
): void {
  if (state === 'jump') {
    rig.leftArmPivot.rotation.x = -2.3;
    rig.rightArmPivot.rotation.x = -2.3;
    rig.leftArmPivot.rotation.z = -0.25;
    rig.rightArmPivot.rotation.z = 0.25;
    rig.leftLegPivot.rotation.x = 0.45;
    rig.rightLegPivot.rotation.x = -0.35;
    rig.headGroup.rotation.x = -0.15;
    rig.bodyGroup.rotation.x = 0.08;
    return;
  }

  if (state === 'celebrate') {
    const wave = Math.sin(elapsed * 6.5);
    const bounce = Math.abs(Math.sin(elapsed * 4.5));
    rig.bodyGroup.position.y = bounce * 0.22;
    rig.bodyGroup.rotation.y = Math.sin(elapsed * 2.2) * 0.22;
    rig.bodyGroup.rotation.x = 0;

    // Right arm waving enthusiastically overhead, left arm on hip / cheering
    rig.rightArmPivot.rotation.x = -2.5 + wave * 0.35;
    rig.rightArmPivot.rotation.z = 0.35 + wave * 0.25;
    rig.leftArmPivot.rotation.x = -0.6 - wave * 0.25;
    rig.leftArmPivot.rotation.z = -0.3;

    rig.leftLegPivot.rotation.x = Math.sin(elapsed * 4.5) * 0.25;
    rig.rightLegPivot.rotation.x = -Math.sin(elapsed * 4.5) * 0.25;
    rig.headGroup.rotation.z = Math.sin(elapsed * 3.2) * 0.12;
    rig.headGroup.rotation.y = Math.sin(elapsed * 2.0) * 0.18;
    return;
  }

  if (state === 'walk' || state === 'run') {
    const amp = state === 'run' ? 0.82 : 0.55;
    const swing = Math.sin(walkPhase) * amp;
    const bounce = Math.abs(Math.cos(walkPhase)) * (state === 'run' ? 0.18 : 0.1);

    rig.bodyGroup.position.y = bounce;
    rig.bodyGroup.rotation.x = state === 'run' ? 0.18 : 0.06;
    rig.bodyGroup.rotation.y = Math.sin(walkPhase) * 0.08;

    rig.leftLegPivot.rotation.x = swing;
    rig.rightLegPivot.rotation.x = -swing;
    rig.leftArmPivot.rotation.x = -swing * 0.9;
    rig.rightArmPivot.rotation.x = swing * 0.9;
    rig.leftArmPivot.rotation.z = -0.12;
    rig.rightArmPivot.rotation.z = 0.12;

    rig.headGroup.rotation.z = Math.sin(walkPhase * 0.5) * 0.05;
    rig.headGroup.rotation.x = 0;
    return;
  }

  // IDLE ANIMATION: Gentle breathing, arm sway, cheerful head tilt
  const breath = Math.sin(elapsed * 2.6);
  rig.bodyGroup.position.y = (breath + 1) * 0.035;
  rig.bodyGroup.rotation.x = 0;
  rig.bodyGroup.rotation.y = Math.sin(elapsed * 1.1) * 0.08;

  rig.leftLegPivot.rotation.x = 0;
  rig.rightLegPivot.rotation.x = 0;
  rig.leftArmPivot.rotation.x = Math.sin(elapsed * 2.2) * 0.12;
  rig.rightArmPivot.rotation.x = -Math.sin(elapsed * 2.2) * 0.12;
  rig.leftArmPivot.rotation.z = -0.15;
  rig.rightArmPivot.rotation.z = 0.15;

  rig.headGroup.rotation.z = Math.sin(elapsed * 1.8) * 0.06;
  rig.headGroup.rotation.y = Math.sin(elapsed * 1.3) * 0.12;
}

/**
 * Builds a composite 6-12 part 3D architectural landmark for each of the 10 Aqua City Mission Locations.
 */
export function createMissionLocationStructure(
  loc: MissionLocation,
  maxAnisotropy: number,
  isSoftwareGl: boolean,
): {
  group: THREE.Group;
  beaconRing: THREE.Mesh;
  animatedParts: THREE.Object3D[];
} {
  const group = new THREE.Group();
  group.position.set(loc.position.x, 0, loc.position.z);
  const animatedParts: THREE.Object3D[] = [];

  const mainColor = new THREE.Color(loc.color);
  const accentColor = new THREE.Color(loc.accentColor);

  const matteBodyMat = new THREE.MeshStandardMaterial({
    color: mainColor,
    roughness: 0.42,
    metalness: 0.18,
  });
  const whiteWallMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.45,
    metalness: 0.1,
  });
  const metallicTrimMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    roughness: 0.2,
    metalness: 0.78,
  });
  const waterCrystalMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8,
    roughness: 0.1,
    metalness: 0.12,
    transmission: isSoftwareGl ? 0 : 0.78,
    transparent: true,
    opacity: isSoftwareGl ? 0.82 : 0.95,
    clearcoat: 1.0,
  });
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    roughness: 0.22,
    metalness: 0.85,
  });

  // 1. Soft Radial Contact Shadow under structure
  const shadowGeo = new THREE.CircleGeometry(5.8, 32);
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMesh = new THREE.Mesh(
    shadowGeo,
    new THREE.MeshBasicMaterial({
      color: 0x041e30,
      transparent: true,
      opacity: 0.38,
      depthWrite: false,
    }),
  );
  shadowMesh.position.y = 0.02;
  group.add(shadowMesh);

  // 2. Stepped Futuristic Foundation Plinth
  const plinthBottom = new THREE.Mesh(new THREE.CylinderGeometry(5.0, 5.4, 0.48, 32), whiteWallMat);
  plinthBottom.position.y = 0.24;
  plinthBottom.receiveShadow = true;
  const plinthTop = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.6, 0.32, 32), metallicTrimMat);
  plinthTop.position.y = 0.64;
  plinthTop.receiveShadow = true;
  group.add(plinthBottom, plinthTop);

  // 3. Interactive Mission Pad & Beacon Ring in front of the building (z + 5.8)
  const padGroup = new THREE.Group();
  padGroup.position.set(0, 0.04, 5.8);
  const padBase = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.95, 0.14, 28), goldMat);
  padBase.position.y = 0.07;
  const beaconRingGeo = new THREE.TorusGeometry(1.6, 0.12, 12, 36);
  beaconRingGeo.rotateX(Math.PI / 2);
  const beaconRingMat = new THREE.MeshStandardMaterial({
    color: accentColor,
    emissive: accentColor,
    emissiveIntensity: 0.65,
    roughness: 0.2,
    metalness: 0.5,
  });
  const beaconRing = new THREE.Mesh(beaconRingGeo, beaconRingMat);
  beaconRing.position.y = 0.22;
  padGroup.add(padBase, beaconRing);
  group.add(padGroup);

  // 4. Distinct Architecture per Building Type
  switch (loc.buildingType) {
    case 'water_tank_station': {
      for (let i = 0; i < 4; i++) {
        const angle = (i * Math.PI) / 2 + Math.PI / 4;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.42, 5.2, 16), whiteWallMat);
        leg.position.set(Math.cos(angle) * 2.2, 3.0, Math.sin(angle) * 2.2);
        leg.castShadow = true;
        group.add(leg);
      }
      const centerPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 5.5, 20), metallicTrimMat);
      centerPipe.position.y = 3.2;
      const mainTank = new THREE.Mesh(new THREE.CylinderGeometry(2.9, 2.7, 3.4, 32), matteBodyMat);
      mainTank.position.y = 6.5;
      mainTank.castShadow = true;
      const tankBand = new THREE.Mesh(new THREE.TorusGeometry(2.85, 0.18, 12, 32), goldMat);
      tankBand.rotation.x = Math.PI / 2;
      tankBand.position.y = 6.5;
      const roofDome = new THREE.Mesh(
        new THREE.SphereGeometry(2.9, 28, 20, 0, Math.PI * 2, 0, Math.PI / 2),
        whiteWallMat,
      );
      roofDome.position.y = 8.2;
      const rotor = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.15, 12, 24), goldMat);
      rotor.position.y = 10.2;
      animatedParts.push(rotor);
      group.add(centerPipe, mainTank, tankBand, roofDome, rotor);
      break;
    }

    case 'fresh_water_pond': {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.48, 16, 32), whiteWallMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.y = 0.92;
      const waterSurface = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 0.55, 32), waterCrystalMat);
      waterSurface.position.y = 0.88;
      const fountainPillar = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.85, 3.0, 20), whiteWallMat);
      fountainPillar.position.y = 2.1;
      const bowl1 = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 0.9, 0.5, 24), metallicTrimMat);
      bowl1.position.y = 2.7;
      const bowl2 = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 0.55, 0.45, 24), goldMat);
      bowl2.position.y = 3.8;
      const waterCrown = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 1), waterCrystalMat);
      waterCrown.position.y = 4.7;
      animatedParts.push(waterCrown);
      group.add(rim, waterSurface, fountainPillar, bowl1, bowl2, waterCrown);
      break;
    }

    case 'pipeline_center': {
      const hubCore = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 3.8, 24), whiteWallMat);
      hubCore.position.y = 2.6;
      hubCore.castShadow = true;
      const roof = new THREE.Mesh(
        new THREE.SphereGeometry(2.45, 24, 18, 0, Math.PI * 2, 0, Math.PI / 2),
        matteBodyMat,
      );
      roof.position.y = 4.5;
      for (let i = -1; i <= 1; i++) {
        const pipeArch = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.38, 16, 28, Math.PI), metallicTrimMat);
        pipeArch.position.set(i * 1.1, 4.2, 0);
        group.add(pipeArch);
      }
      const valveWheel = new THREE.Mesh(new THREE.TorusGeometry(0.95, 0.16, 12, 24), goldMat);
      valveWheel.position.set(0, 2.7, 2.55);
      animatedParts.push(valveWheel);
      group.add(hubCore, roof, valveWheel);
      break;
    }

    case 'pumping_station': {
      const leftChamber = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 4.4, 24), matteBodyMat);
      leftChamber.position.set(-1.65, 2.9, 0);
      leftChamber.castShadow = true;
      const rightChamber = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.45, 4.4, 24), matteBodyMat);
      rightChamber.position.set(1.65, 2.9, 0);
      rightChamber.castShadow = true;
      const centerGlass = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.15, 5.0, 24), waterCrystalMat);
      centerGlass.position.set(0, 3.2, 0.6);
      const topBridge = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.65, 2.5), whiteWallMat);
      topBridge.position.set(0, 5.4, 0);
      const flywheel = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.2, 14, 28), goldMat);
      flywheel.position.set(0, 6.6, 0);
      animatedParts.push(flywheel);
      group.add(leftChamber, rightChamber, centerGlass, topBridge, flywheel);
      break;
    }

    case 'storage_tank': {
      const mainSilo = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 4.8, 28), matteBodyMat);
      mainSilo.position.set(0, 3.1, -0.4);
      mainSilo.castShadow = true;
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(2.3, 28, 18, 0, Math.PI * 2, 0, Math.PI / 2),
        whiteWallMat,
      );
      dome.position.set(0, 5.5, -0.4);
      const sideSiloL = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 3.6, 20), metallicTrimMat);
      sideSiloL.position.set(-2.4, 2.5, 0.8);
      const sideSiloR = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 3.6, 20), metallicTrimMat);
      sideSiloR.position.set(2.4, 2.5, 0.8);
      const topCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.8, 0), goldMat);
      topCrystal.position.set(0, 7.6, -0.4);
      animatedParts.push(topCrystal);
      group.add(mainSilo, dome, sideSiloL, sideSiloR, topCrystal);
      break;
    }

    case 'aqua_garden': {
      const gazeboBase = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.7, 0.55, 24), whiteWallMat);
      gazeboBase.position.y = 0.92;
      for (let i = 0; i < 6; i++) {
        const a = (i * Math.PI) / 3;
        const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 3.5, 12), whiteWallMat);
        col.position.set(Math.cos(a) * 2.9, 2.65, Math.sin(a) * 2.9);
        group.add(col);
      }
      const canopy = new THREE.Mesh(
        new THREE.SphereGeometry(3.3, 24, 18, 0, Math.PI * 2, 0, Math.PI / 2),
        waterCrystalMat,
      );
      canopy.position.y = 4.3;
      const treeTrunk = new THREE.Mesh(
        new THREE.CylinderGeometry(0.36, 0.52, 2.1, 12),
        new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.85 }),
      );
      treeTrunk.position.y = 1.85;
      const foliage = new THREE.Mesh(new THREE.SphereGeometry(1.45, 20, 18), matteBodyMat);
      foliage.position.y = 3.3;
      const sunStar = new THREE.Mesh(new THREE.OctahedronGeometry(0.65, 0), goldMat);
      sunStar.position.y = 7.1;
      animatedParts.push(sunStar);
      group.add(gazeboBase, canopy, treeTrunk, foliage, sunStar);
      break;
    }

    case 'school_zone': {
      const mainHall = new THREE.Mesh(new THREE.BoxGeometry(5.6, 3.4, 3.5), whiteWallMat);
      mainHall.position.y = 2.4;
      mainHall.castShadow = true;
      const pitchedRoof = new THREE.Mesh(new THREE.ConeGeometry(4.4, 1.9, 4), matteBodyMat);
      pitchedRoof.rotation.y = Math.PI / 4;
      pitchedRoof.position.y = 5.0;
      const clockTower = new THREE.Mesh(new THREE.BoxGeometry(1.9, 5.4, 1.9), whiteWallMat);
      clockTower.position.set(0, 3.4, 0.65);
      const clockFace = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.16, 24), goldMat);
      clockFace.rotation.x = Math.PI / 2;
      clockFace.position.set(0, 5.0, 1.62);
      const towerRoof = new THREE.Mesh(new THREE.ConeGeometry(1.6, 1.6, 4), metallicTrimMat);
      towerRoof.rotation.y = Math.PI / 4;
      towerRoof.position.set(0, 6.9, 0.65);
      group.add(mainHall, pitchedRoof, clockTower, clockFace, towerRoof);
      break;
    }

    case 'hospital_zone': {
      const mainWing = new THREE.Mesh(new THREE.BoxGeometry(5.2, 4.4, 3.7), whiteWallMat);
      mainWing.position.y = 2.9;
      mainWing.castShadow = true;
      const aquaTrim = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.55, 3.9), matteBodyMat);
      aquaTrim.position.y = 5.2;
      const redCrossMat = new THREE.MeshStandardMaterial({
        color: 0xf43f5e,
        emissive: 0xe11d48,
        emissiveIntensity: 0.4,
        roughness: 0.3,
      });
      const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.58, 1.8, 0.26), redCrossMat);
      crossV.position.set(0, 3.6, 1.9);
      const crossH = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.58, 0.26), redCrossMat);
      crossH.position.set(0, 3.6, 1.9);
      const roofTank = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 1.9, 24), waterCrystalMat);
      roofTank.position.set(0, 6.3, 0);
      group.add(mainWing, aquaTrim, crossV, crossH, roofTank);
      break;
    }

    case 'city_reservoir': {
      const damWall = new THREE.Mesh(new THREE.BoxGeometry(6.4, 5.0, 2.3), whiteWallMat);
      damWall.position.set(0, 3.2, -0.6);
      damWall.castShadow = true;
      const spillway = new THREE.Mesh(new THREE.BoxGeometry(3.4, 4.4, 2.6), waterCrystalMat);
      spillway.position.set(0, 2.9, -0.4);
      const leftTower = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 6.2, 20), matteBodyMat);
      leftTower.position.set(-2.7, 3.8, 0);
      const rightTower = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 6.2, 20), matteBodyMat);
      rightTower.position.set(2.7, 3.8, 0);
      const turbine = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.22, 12, 24), goldMat);
      turbine.position.set(0, 6.0, 0.45);
      animatedParts.push(turbine);
      group.add(damWall, spillway, leftTower, rightTower, turbine);
      break;
    }

    case 'aqua_control_center': {
      const baseHex = new THREE.Mesh(new THREE.CylinderGeometry(3.3, 3.9, 3.0, 16), whiteWallMat);
      baseHex.position.y = 2.2;
      baseHex.castShadow = true;
      const midSpire = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.9, 4.4, 16), matteBodyMat);
      midSpire.position.y = 5.8;
      midSpire.castShadow = true;
      const crystalCore = new THREE.Mesh(new THREE.SphereGeometry(1.75, 28, 24), waterCrystalMat);
      crystalCore.position.y = 9.2;
      const orbitRing1 = new THREE.Mesh(new THREE.TorusGeometry(2.5, 0.16, 12, 36), goldMat);
      orbitRing1.position.y = 9.2;
      orbitRing1.rotation.x = Math.PI / 3;
      const orbitRing2 = new THREE.Mesh(new THREE.TorusGeometry(2.9, 0.14, 12, 36), metallicTrimMat);
      orbitRing2.position.y = 9.2;
      orbitRing2.rotation.y = Math.PI / 4;
      animatedParts.push(orbitRing1, orbitRing2);
      group.add(baseHex, midSpire, crystalCore, orbitRing1, orbitRing2);
      break;
    }
  }

  // 5. Floating Location Sign Sprite above the structure
  const signTex = createLocationSignTexture(loc, maxAnisotropy);
  const spriteMat = new THREE.SpriteMaterial({ map: signTex, transparent: true, depthWrite: false });
  const signSprite = new THREE.Sprite(spriteMat);
  signSprite.scale.set(4.8, 1.75, 1);
  signSprite.position.set(0, loc.buildingType === 'aqua_control_center' ? 11.8 : 9.2, 0);
  group.add(signSprite);

  return { group, beaconRing, animatedParts };
}

/**
 * Builds the complete living Aqua City environment:
 * - Northern Mountain Cliffs & Animated Twin Waterfalls
 * - Reflective River & Central Canal
 * - 4 Futuristic Bridges
 * - Metallic Distribution Pipelines connecting buildings
 * - Stylized Rounded Multi-Sphere Trees, Colorful Flower Beds, Street Lamps, and Fluffy 3D Clouds
 * - Pooled InstancedMesh Water Splash & Fountain Particles (Zero-GC in animation loop)
 */
export function createLivingAquaCityWorld(
  scene: THREE.Scene,
  isSoftwareGl: boolean,
): {
  waterfallTexture: THREE.CanvasTexture;
  cloudsGroup: THREE.Group;
  waterParticlesMesh: THREE.InstancedMesh;
  particleData: Array<{
    originX: number;
    originY: number;
    originZ: number;
    vx: number;
    vy: number;
    vz: number;
    phase: number;
    speed: number;
  }>;
} {
  // 1. NORTHERN MOUNTAIN CLIFFS & ANIMATED TWIN WATERFALLS (z = -52)
  const cliffGroup = new THREE.Group();
  cliffGroup.position.set(0, 0, -52);

  const rockMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.78,
    metalness: 0.1,
  });
  const grassCapMat = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    roughness: 0.65,
    metalness: 0.05,
  });

  const cliffSpecs = [
    { x: -16, w: 14, h: 16, d: 10 },
    { x: -6, w: 10, h: 19, d: 11 },
    { x: 6, w: 10, h: 19, d: 11 },
    { x: 16, w: 14, h: 16, d: 10 },
    { x: 0, w: 12, h: 15, d: 9 },
  ];
  cliffSpecs.forEach((c) => {
    const rock = new THREE.Mesh(new THREE.CylinderGeometry(c.w * 0.45, c.w * 0.6, c.h, 12), rockMat);
    rock.position.set(c.x, c.h * 0.5 - 0.5, 0);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(c.w * 0.46, c.w * 0.46, 1.2, 12),
      grassCapMat,
    );
    cap.position.set(c.x, c.h - 0.3, 0);
    cliffGroup.add(rock, cap);
  });

  // Animated Waterfall Streams
  const waterfallTexture = createWaterfallTexture();
  const waterfallMat = new THREE.MeshStandardMaterial({
    map: waterfallTexture,
    emissive: 0x0284c7,
    emissiveIntensity: 0.25,
    roughness: 0.15,
    metalness: 0.1,
    transparent: true,
    opacity: 0.92,
  });

  [-5.5, 5.5].forEach((wx) => {
    const fallPlane = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 16.5), waterfallMat);
    fallPlane.position.set(wx, 7.8, 4.9);
    fallPlane.rotation.x = -0.14;
    cliffGroup.add(fallPlane);

    // Foaming plunge pool ring at waterfall base
    const foamRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.8, 0.45, 12, 24),
      new THREE.MeshBasicMaterial({ color: 0xe0f2fe, transparent: true, opacity: 0.8 }),
    );
    foamRing.rotation.x = Math.PI / 2;
    foamRing.position.set(wx, 0.12, 6.2);
    cliffGroup.add(foamRing);
  });

  scene.add(cliffGroup);

  // 2. REFLECTIVE RIVER CANAL RUNNING THROUGH AQUA CITY
  const riverMat = new THREE.MeshPhysicalMaterial({
    color: 0x0ea5e9,
    emissive: 0x0369a1,
    emissiveIntensity: 0.18,
    roughness: 0.08,
    metalness: 0.25,
    clearcoat: 1.0,
    clearcoatRoughness: 0.1,
  });

  // North-South River Stream from Waterfall to Central Lagoon
  const riverNS = new THREE.Mesh(new THREE.PlaneGeometry(7.2, 62), riverMat);
  riverNS.rotation.x = -Math.PI / 2;
  riverNS.position.set(0, 0.025, -18);
  scene.add(riverNS);

  // East-West Canal Stream across Aqua City
  const riverEW = new THREE.Mesh(new THREE.PlaneGeometry(108, 6.4), riverMat);
  riverEW.rotation.x = -Math.PI / 2;
  riverEW.position.set(0, 0.026, 8);
  scene.add(riverEW);

  // 3. ARCHED FUTURISTIC BRIDGES (Jembatan)
  const bridgeWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.4,
    metalness: 0.15,
  });
  const bridgeCyanMat = new THREE.MeshStandardMaterial({
    color: 0x06b6d4,
    roughness: 0.25,
    metalness: 0.5,
  });
  const lampGlowMat = new THREE.MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xfacc15,
    emissiveIntensity: 0.9,
  });

  const buildBridge = (bx: number, bz: number, rotY: number) => {
    const bGroup = new THREE.Group();
    bGroup.position.set(bx, 0, bz);
    bGroup.rotation.y = rotY;

    const deck = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.28, 8.6), bridgeWhiteMat);
    deck.position.y = 0.22;
    bGroup.add(deck);

    [-2.1, 2.1].forEach((rx) => {
      const railArch = new THREE.Mesh(
        new THREE.TorusGeometry(3.8, 0.14, 10, 24, Math.PI),
        bridgeCyanMat,
      );
      railArch.rotation.y = Math.PI / 2;
      railArch.position.set(rx, 0.2, 0);
      bGroup.add(railArch);

      [-3.8, 3.8].forEach((rz) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.3, 12), bridgeWhiteMat);
        post.position.set(rx, 0.75, rz);
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.22, 14, 12), lampGlowMat);
        orb.position.set(rx, 1.5, rz);
        bGroup.add(post, orb);
      });
    });

    scene.add(bGroup);
  };

  buildBridge(-22, 8, 0);
  buildBridge(22, 8, 0);
  buildBridge(0, 22, Math.PI / 2);
  buildBridge(0, -18, Math.PI / 2);

  // 4. METALLIC DISTRIBUTION PIPELINES CONNECTING ZONES
  const pipeMetalMat = new THREE.MeshStandardMaterial({
    color: 0x38bdf8,
    roughness: 0.22,
    metalness: 0.78,
  });
  const pipeLinks: Array<[number, number, number, number]> = [
    [-32, 26, -12, 32],
    [16, 30, 36, 18],
    [36, 18, 34, -8],
    [-20, -34, 14, -34],
  ];
  pipeLinks.forEach(([x1, z1, x2, z2]) => {
    const start = new THREE.Vector3(x1, 1.2, z1);
    const end = new THREE.Vector3(x2, 1.2, z2);
    const len = start.distanceTo(end);
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, len, 14), pipeMetalMat);
    pipe.position.copy(start).lerp(end, 0.5);
    pipe.lookAt(end);
    pipe.rotateX(Math.PI / 2);
    scene.add(pipe);
  });

  // 5. STYLIZED ROUNDED MULTI-SPHERE TREES, FLOWER BEDS & STREET LAMPS
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.8 });
  const leafPalette = [0x10b981, 0x059669, 0x34d399, 0x14b8a6];
  const flowerPalette = [0xf43f5e, 0xfacc15, 0xa855f7, 0x38bdf8];

  const treeCoords = [
    [-24, 18], [24, 18], [-25, -20], [25, -20],
    [-8, 18], [8, 18], [-44, 12], [44, 12],
    [-44, -16], [44, -16], [-6, -24], [6, -24],
  ];

  treeCoords.forEach(([tx, tz], idx) => {
    const tGroup = new THREE.Group();
    tGroup.position.set(tx, 0, tz);

    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.44, 2.2, 12), trunkMat);
    trunk.position.y = 1.1;
    trunk.castShadow = !isSoftwareGl;
    tGroup.add(trunk);

    const leafMat = new THREE.MeshStandardMaterial({
      color: leafPalette[idx % leafPalette.length],
      roughness: 0.55,
      metalness: 0.05,
    });

    // 3 clustered smooth spheres for a lush cartoon tree canopy
    const s1 = new THREE.Mesh(new THREE.SphereGeometry(1.35, 18, 16), leafMat);
    s1.position.set(0, 2.9, 0);
    const s2 = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 14), leafMat);
    s2.position.set(-0.75, 2.4, 0.3);
    const s3 = new THREE.Mesh(new THREE.SphereGeometry(0.95, 16, 14), leafMat);
    s3.position.set(0.75, 2.45, -0.25);
    tGroup.add(s1, s2, s3);

    // Colorful flowers around the tree base
    for (let f = 0; f < 4; f++) {
      const fa = (f * Math.PI) / 2 + idx;
      const flower = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 10, 10),
        new THREE.MeshStandardMaterial({
          color: flowerPalette[(idx + f) % flowerPalette.length],
          roughness: 0.4,
        }),
      );
      flower.position.set(Math.cos(fa) * 1.15, 0.2, Math.sin(fa) * 1.15);
      tGroup.add(flower);
    }

    scene.add(tGroup);
  });

  // Perimeter Instanced Lush Trees (48 instances around the outer rim)
  const count = 48;
  const iTrunkGeo = new THREE.CylinderGeometry(0.32, 0.48, 2.2, 10);
  iTrunkGeo.translate(0, 1.1, 0);
  const iCrownGeo = new THREE.SphereGeometry(1.75, 16, 14);
  iCrownGeo.translate(0, 3.2, 0);
  const iCrownMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55 });

  const trunkInst = new THREE.InstancedMesh(iTrunkGeo, trunkMat, count);
  const crownInst = new THREE.InstancedMesh(iCrownGeo, iCrownMat, count);
  const dummy = new THREE.Object3D();
  const col = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    const radius = 53 + (i % 3) * 4.5;
    dummy.position.set(Math.cos(angle) * radius, 0, Math.sin(angle) * radius);
    const s = 0.85 + ((i * 7) % 30) / 100;
    dummy.scale.set(s, s * 1.15, s);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);
    crownInst.setMatrixAt(i, dummy.matrix);
    col.setHex(leafPalette[i % leafPalette.length]);
    crownInst.setColorAt(i, col);
  }
  trunkInst.instanceMatrix.needsUpdate = true;
  crownInst.instanceMatrix.needsUpdate = true;
  if (crownInst.instanceColor) crownInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  crownInst.computeBoundingSphere();
  scene.add(trunkInst, crownInst);

  // 6. FLUFFY 3D CARTOON CLOUDS IN THE SKY
  const cloudsGroup = new THREE.Group();
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xe0f2fe,
    emissiveIntensity: 0.25,
    roughness: 0.85,
  });

  for (let c = 0; c < 12; c++) {
    const cCluster = new THREE.Group();
    const angle = (c / 12) * Math.PI * 2;
    const dist = 42 + (c % 3) * 16;
    cCluster.position.set(Math.cos(angle) * dist, 24 + (c % 4) * 3.5, Math.sin(angle) * dist);

    const puff1 = new THREE.Mesh(new THREE.SphereGeometry(2.8, 16, 14), cloudMat);
    const puff2 = new THREE.Mesh(new THREE.SphereGeometry(2.1, 14, 12), cloudMat);
    puff2.position.set(-2.2, -0.4, 0.3);
    const puff3 = new THREE.Mesh(new THREE.SphereGeometry(2.2, 14, 12), cloudMat);
    puff3.position.set(2.2, -0.3, -0.2);

    cCluster.add(puff1, puff2, puff3);
    cCluster.lookAt(0, 24, 0);
    cloudsGroup.add(cCluster);
  }
  scene.add(cloudsGroup);

  // 7. POOLED 3D WATER DROPLET & SPLASH PARTICLES (Zero-GC InstancedMesh)
  const particleCount = 140;
  const dropGeo = new THREE.SphereGeometry(0.16, 8, 8);
  const dropMat = new THREE.MeshBasicMaterial({
    color: 0xe0f2fe,
    transparent: true,
    opacity: 0.85,
  });
  const waterParticlesMesh = new THREE.InstancedMesh(dropGeo, dropMat, particleCount);
  waterParticlesMesh.frustumCulled = false;

  const particleData: Array<{
    originX: number;
    originY: number;
    originZ: number;
    vx: number;
    vy: number;
    vz: number;
    phase: number;
    speed: number;
  }> = [];

  for (let i = 0; i < particleCount; i++) {
    const a = (i / particleCount) * Math.PI * 2 * 5;
    if (i < 60) {
      // Central Plaza Fountain spray at (0, 2.5, 8)
      particleData.push({
        originX: 0,
        originY: 2.2,
        originZ: 8,
        vx: Math.cos(a) * (1.2 + (i % 4) * 0.45),
        vy: 4.8 + (i % 5) * 0.6,
        vz: Math.sin(a) * (1.2 + (i % 4) * 0.45),
        phase: (i / 60) * Math.PI * 2,
        speed: 1.4,
      });
    } else if (i < 110) {
      // Twin Waterfall base splash mist at (±5.5, 0.5, -45.8)
      const sideX = i % 2 === 0 ? -5.5 : 5.5;
      particleData.push({
        originX: sideX + Math.cos(a) * 1.5,
        originY: 0.4,
        originZ: -45.8 + Math.sin(a) * 1.0,
        vx: Math.cos(a) * 1.8,
        vy: 3.6 + (i % 4) * 0.5,
        vz: 1.2 + Math.abs(Math.sin(a)) * 1.5,
        phase: (i / 50) * Math.PI * 2,
        speed: 1.6,
      });
    } else {
      // Fresh Water Pond fountain spray at (-12, 3.8, 32)
      particleData.push({
        originX: -12,
        originY: 3.8,
        originZ: 32,
        vx: Math.cos(a) * 1.4,
        vy: 3.5,
        vz: Math.sin(a) * 1.4,
        phase: (i / 30) * Math.PI * 2,
        speed: 1.3,
      });
    }
  }

  scene.add(waterParticlesMesh);

  return {
    waterfallTexture,
    cloudsGroup,
    waterParticlesMesh,
    particleData,
  };
}
