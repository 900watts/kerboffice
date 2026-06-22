import type { KerbalSoul } from '../SoulLoader';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SpriteState =
  | 'idle'
  | 'walking'
  | 'typing'
  | 'stretching'
  | 'drinking'
  | 'entering'
  | 'leaving'
  | 'sleeping'
  | 'sitting'
  | 'reacting';

export interface SpriteFrame {
  state: SpriteState;
  frameIndex: number;
}

// Internal movement state
interface MovementState {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  elapsed: number;
  duration: number;
}

// ---------------------------------------------------------------------------
// Suit colour by role
// ---------------------------------------------------------------------------

type SuitColor = 'orange' | 'white' | 'blue' | 'gray';

function getSuitColor(soul: KerbalSoul): SuitColor {
  const role = (soul.role ?? '').toLowerCase();
  if (role === 'pilot') return 'orange';
  if (role === 'scientist' || role === 'science') return 'white';
  if (role === 'engineer') return 'blue';
  return 'gray';
}

// ---------------------------------------------------------------------------
// Suit colour palette
// ---------------------------------------------------------------------------

const SUIT_FILLS: Record<SuitColor, string> = {
  orange: '#e88933',
  white: '#dde5ec',
  blue: '#4a7db5',
  gray: '#8c94a1',
};

const SUIT_DARKS: Record<SuitColor, string> = {
  orange: '#c07020',
  white: '#bcc4cc',
  blue: '#356090',
  gray: '#6e747f',
};

const SUIT_LIGHTS: Record<SuitColor, string> = {
  orange: '#f0a050',
  white: '#eef2f6',
  blue: '#5a90c8',
  gray: '#a0a8b2',
};

const SUIT_DETAIL: Record<SuitColor, string> = {
  orange: '#d47828',
  white: '#c8d2da',
  blue: '#4070a0',
  gray: '#7a808b',
};

// ---------------------------------------------------------------------------
// Procedural drawing helpers
// ---------------------------------------------------------------------------

interface RenderOpts {
  x: number;
  y: number;
  scale: number;
  frameIndex: number;
  state: SpriteState;
  suitColor: SuitColor;
  courage: number;   // 0..1
  stupidity: number; // 0..1
  /** When set, only renders the specified portion of the kerbal.
   *  'full' = everything (default when undefined).
   *  'lower' = shadow + legs (for sitting kerbals rendered behind desk).
   *  'upper' = body + arms + head + accessories (for sitting kerbals above desk). */
  renderPart?: 'full' | 'lower' | 'upper';
}

// ---------------------------------------------------------------------------
// Utility: rounded rectangle path
// ---------------------------------------------------------------------------

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

// ===========================================================================
//  ALL DRAWING FUNCTIONS BELOW HAVE BEEN COMPLETELY REDESIGNED
//  New visual style: cute green KSP alien with big eyes, stubby limbs,
//  helmet dome, antenna, expressive face, and animated poses.
// ===========================================================================

// ---------------------------------------------------------------------------
// Floor shadow
// ---------------------------------------------------------------------------

function drawShadow(ctx: CanvasRenderingContext2D, opts: RenderOpts): void {
  const s = opts.scale;
  const isSitting = opts.state === 'sitting';
  const shadowW = isSitting ? 14 * s : 10 * s;
  const shadowH = isSitting ? 4 * s : 3 * s;

  // Core shadow
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.beginPath();
  ctx.ellipse(opts.x, opts.y + 6 * s, shadowW, shadowH, 0, 0, Math.PI * 2);
  ctx.fill();

  // Softer outer shadow
  ctx.fillStyle = 'rgba(0,0,0,0.06)';
  ctx.beginPath();
  ctx.ellipse(opts.x, opts.y + 6 * s, shadowW * 1.3, shadowH * 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Backpack / life support (behind body)
// ---------------------------------------------------------------------------

function drawBackpack(ctx: CanvasRenderingContext2D, opts: RenderOpts): void {
  const s = opts.scale;
  const bx = opts.x;
  const by = opts.y - 24 * s;
  const bw = 11 * s;
  const bh = 12 * s;

  // Main pack (rounder, more compact — KSP style)
  ctx.fillStyle = '#7a7a7a';
  ctx.strokeStyle = '#5a5a5a';
  ctx.lineWidth = 0.6 * s;
  roundRect(ctx, bx - bw / 2, by, bw, bh, 3.5 * s);
  ctx.fill();
  ctx.stroke();

  // Center seam
  ctx.strokeStyle = '#6a6a6a';
  ctx.lineWidth = 0.4 * s;
  ctx.beginPath();
  ctx.moveTo(bx, by + 1.5 * s);
  ctx.lineTo(bx, by + bh - 1.5 * s);
  ctx.stroke();

  // Small indicator light
  ctx.fillStyle = '#44cc44';
  ctx.beginPath();
  ctx.arc(bx - 2 * s, by + 3 * s, 1 * s, 0, Math.PI * 2);
  ctx.fill();

  // Indicator glow
  ctx.fillStyle = 'rgba(68,204,68,0.25)';
  ctx.beginPath();
  ctx.arc(bx - 2 * s, by + 3 * s, 1.8 * s, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Legs — short, stubby, with chunky boots
// ---------------------------------------------------------------------------

function drawLegs(ctx: CanvasRenderingContext2D, opts: RenderOpts): void {
  const s = opts.scale;
  const x = opts.x;
  const hipY = opts.y - 8 * s;
  const legLen = 8 * s;
  const legW = 4 * s;
  const legGap = 2.5 * s;
  const legColor = '#5a5a5a';

  let leftShift = 0;
  let rightShift = 0;

  if (opts.state === 'walking') {
    const cycle = Math.sin(opts.frameIndex * 0.4);
    leftShift = cycle * 3.5 * s;
    rightShift = -cycle * 3.5 * s;
  }

  [-1, 1].forEach((side) => {
    const shift = side < 0 ? leftShift : rightShift;
    const legX = x + side * legGap - legW / 2 + shift;

    // Leg segment (short and round)
    ctx.fillStyle = legColor;
    roundRect(ctx, legX, hipY, legW, legLen, 2 * s);
    ctx.fill();

    // Boot (chunky rounded boot)
    const bootY = hipY + legLen - 1.5 * s;
    const bootW = legW + 2.5 * s;
    ctx.fillStyle = '#3a3a3a';
    roundRect(ctx, legX - 1 * s, bootY, bootW, 4 * s, 2 * s);
    ctx.fill();

    // Boot sole (darker strip at bottom)
    ctx.fillStyle = '#1a1a1a';
    roundRect(ctx, legX - 0.7 * s, bootY + 2.5 * s, bootW - 0.6 * s, 1.5 * s, 0.8 * s);
    ctx.fill();
  });
}

/** Bent-leg pose for sitting — thighs forward, shins down to floor. */
function drawSittingLegs(ctx: CanvasRenderingContext2D, opts: RenderOpts): void {
  const s = opts.scale;
  const x = opts.x;
  const hipY = opts.y - 3 * s;
  const legColor = '#5a5a5a';

  [-1, 1].forEach((side) => {
    const hipX = x + side * 2.5 * s;
    const kneeX = hipX + side * 4 * s;
    const kneeY = hipY + 4 * s;

    // Thigh (angled forward)
    ctx.fillStyle = legColor;
    ctx.beginPath();
    ctx.moveTo(hipX - 2 * s, hipY);
    ctx.lineTo(kneeX + side * 2 * s, kneeY);
    ctx.lineTo(kneeX - side * 2 * s, kneeY);
    ctx.lineTo(hipX + 2 * s, hipY);
    ctx.closePath();
    ctx.fill();

    // Shin (vertical down from knee)
    roundRect(ctx, kneeX - 2 * s, kneeY, 4 * s, 5 * s, 1.5 * s);
    ctx.fill();

    // Boot
    const bootY = kneeY + 5 * s - 1 * s;
    ctx.fillStyle = '#3a3a3a';
    roundRect(ctx, kneeX - 3 * s, bootY, 6 * s, 4 * s, 2 * s);
    ctx.fill();

    // Boot sole
    ctx.fillStyle = '#1a1a1a';
    roundRect(ctx, kneeX - 2.7 * s, bootY + 2.5 * s, 5.4 * s, 1.5 * s, 0.8 * s);
    ctx.fill();
  });
}

// ---------------------------------------------------------------------------
// Body — short, stubby torso with EVA suit details
// ---------------------------------------------------------------------------

function drawBody(ctx: CanvasRenderingContext2D, opts: RenderOpts): void {
  const s = opts.scale;
  const x = opts.x;
  const fill = SUIT_FILLS[opts.suitColor];
  const dark = SUIT_DARKS[opts.suitColor];
  const detail = SUIT_DETAIL[opts.suitColor];

  const stretchFactor = opts.state === 'stretching' ? 1.1 : 1;
  const bodyTopY = opts.y - 20 * s;
  const bodyW = 14 * s;
  const bodyH = 11 * s * stretchFactor;

  // Main stubby rounded torso
  ctx.fillStyle = fill;
  ctx.strokeStyle = dark;
  ctx.lineWidth = 0.6 * s;
  roundRect(ctx, x - bodyW / 2, bodyTopY, bodyW, bodyH, 4.5 * s);
  ctx.fill();
  ctx.stroke();

  // Nav badge / chest patch (small square)
  const badgeW = 4.5 * s;
  const badgeH = 3 * s;
  ctx.fillStyle = detail;
  ctx.globalAlpha = 0.55;
  roundRect(ctx, x - badgeW / 2, bodyTopY + 2 * s, badgeW, badgeH, 1.2 * s);
  ctx.fill();
  ctx.globalAlpha = 1;

  // Decorative buttons on badge
  const btnY = bodyTopY + 3.5 * s;
  ctx.fillStyle = '#44cc44';
  ctx.beginPath();
  ctx.arc(x - 1 * s, btnY, 0.5 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#cc4444';
  ctx.beginPath();
  ctx.arc(x + 1 * s, btnY, 0.5 * s, 0, Math.PI * 2);
  ctx.fill();

  // Belt at waist
  const beltY = bodyTopY + bodyH - 3 * s;
  ctx.fillStyle = '#555';
  roundRect(ctx, x - bodyW / 2 + 1.5 * s, beltY, bodyW - 3 * s, 2.5 * s, 1.2 * s);
  ctx.fill();

  // Belt buckle
  ctx.fillStyle = '#c0a060';
  roundRect(ctx, x - 1.5 * s, beltY + 0.3 * s, 3 * s, 1.9 * s, 0.6 * s);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Arms — short stumpy arms with 3-fingered hands
// ---------------------------------------------------------------------------

function drawArms(ctx: CanvasRenderingContext2D, opts: RenderOpts): void {
  const s = opts.scale;
  const x = opts.x;
  const shoulderY = opts.y - 18 * s;
  const fill = SUIT_FILLS[opts.suitColor];
  const dark = SUIT_DARKS[opts.suitColor];

  // Arm angles based on animation state
  let leftAngle = 0.15;
  let rightAngle = -0.15;

  switch (opts.state) {
    case 'typing': {
      const osc = Math.sin(opts.frameIndex * 1.5) * 0.4;
      leftAngle = 0.5 + osc;
      rightAngle = -0.5 - osc;
      break;
    }
    case 'drinking': {
      // Right arm up holding cup near mouth
      rightAngle = -1.6;
      leftAngle = 0.1;
      break;
    }
    case 'stretching': {
      // Both arms up (yawn stretch)
      leftAngle = -2.5;
      rightAngle = 2.5;
      break;
    }
    case 'sleeping': {
      // Arms relaxed at sides
      leftAngle = 0.2;
      rightAngle = -0.2;
      break;
    }
    case 'walking': {
      // Swing opposite to legs
      const swing = Math.sin(opts.frameIndex * 0.5) * 0.25;
      leftAngle = 0.15 + swing;
      rightAngle = -0.15 - swing;
      break;
    }
    case 'entering': {
      // Cheerful wave with right arm
      const wave = Math.sin(opts.frameIndex * 2) * 0.35;
      rightAngle = -1.0 + wave;
      leftAngle = 0.1;
      break;
    }
    case 'leaving': {
      rightAngle = 0.08;
      leftAngle = -0.12;
      break;
    }
    default:
      break;
  }

  [-1, 1].forEach((side) => {
    const angle = side < 0 ? leftAngle : rightAngle;
    const shoulderX = x + side * 7.5 * s;

    ctx.save();
    ctx.translate(shoulderX, shoulderY);
    ctx.rotate(angle);

    // Upper arm segment (short)
    const armLen = 5.5 * s;
    const armW = 3 * s;

    ctx.fillStyle = fill;
    ctx.strokeStyle = dark;
    ctx.lineWidth = 0.5 * s;
    roundRect(ctx, 0, -armW / 2, armLen, armW, 1.5 * s);
    ctx.fill();
    ctx.stroke();

    // 3-fingered hand (round, wider than arm)
    const handX = armLen - 0.5 * s;
    const handW = 2.5 * s;
    const handH = 4 * s;

    ctx.fillStyle = '#6a6a6a';
    roundRect(ctx, handX, -handH / 2, handW, handH, 1.8 * s);
    ctx.fill();

    // Finger division lines (three fingers)
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 0.25 * s;
    ctx.beginPath();
    ctx.moveTo(handX + 0.6 * s, -0.8 * s);
    ctx.lineTo(handX + handW - 0.4 * s, -0.8 * s);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(handX + 0.6 * s, 0.8 * s);
    ctx.lineTo(handX + handW - 0.4 * s, 0.8 * s);
    ctx.stroke();

    ctx.restore();
  });
}

// ---------------------------------------------------------------------------
// Collar / neck ring
// ---------------------------------------------------------------------------

function drawCollar(ctx: CanvasRenderingContext2D, opts: RenderOpts): void {
  const s = opts.scale;
  const x = opts.x;
  const collarY = opts.y - 20.5 * s;
  const collarW = 10 * s;
  const collarH = 2.5 * s;

  // Collar ring base
  ctx.fillStyle = '#8a8a8a';
  ctx.strokeStyle = '#5a5a5a';
  ctx.lineWidth = 0.5 * s;
  roundRect(ctx, x - collarW / 2, collarY, collarW, collarH, 1.5 * s);
  ctx.fill();
  ctx.stroke();

  // Collar highlight ring (top edge)
  ctx.fillStyle = '#b0b0b0';
  roundRect(ctx, x - collarW / 2 + 0.8 * s, collarY + 0.2 * s, collarW - 1.6 * s, 0.8 * s, 0.4 * s);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Head, helmet, face — the focal point of the character
// ---------------------------------------------------------------------------

function drawHead(ctx: CanvasRenderingContext2D, opts: RenderOpts): void {
  const s = opts.scale;

  // Head bob animation
  let headBobY = 0;
  if (opts.state === 'idle') {
    headBobY = Math.sin(opts.frameIndex * 0.25) * 1.0 * s;
  }
  if (opts.state === 'walking') {
    headBobY = Math.sin(opts.frameIndex * 0.5) * 0.8 * s;
  }

  // Head tilt
  let headTilt = 0;
  if (opts.state === 'drinking') headTilt = 0.15;
  if (opts.state === 'sleeping') headTilt = 0.3;

  const headCx = opts.x;
  const headCy = opts.y - 28 * s + headBobY;
  const headR = 7.5 * s;

  ctx.save();
  ctx.translate(headCx, headCy);
  ctx.rotate(headTilt);

  // ---- Head (big round green — classic Kerbal) ----
  ctx.fillStyle = '#7ec850';
  ctx.strokeStyle = '#5a9a30';
  ctx.lineWidth = 0.7 * s;
  ctx.beginPath();
  ctx.arc(0, 0, headR, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // ---- Subtle head highlight (makes it look 3D) ----
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.beginPath();
  ctx.ellipse(-2 * s, -2.5 * s, 4 * s, 3 * s, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // ---- Helmet dome ----
  drawHelmet(ctx, opts, headR, s);

  // ---- Facial features ----
  drawFace(ctx, opts, headR, s);

  // ---- Hair tuft ----
  drawHairTuft(ctx, s, headR);

  ctx.restore();
}

function drawHelmet(
  ctx: CanvasRenderingContext2D,
  _opts: RenderOpts,
  headR: number,
  s: number,
): void {
  const domeR = headR + 1.5 * s;

  // Outer helmet dome (translucent arc over top of head)
  ctx.strokeStyle = 'rgba(200,220,255,0.3)';
  ctx.lineWidth = 0.6 * s;
  ctx.beginPath();
  ctx.arc(0, 0, domeR, Math.PI, 0);
  ctx.stroke();

  // Helmet rim / seal where helmet meets collar area
  ctx.strokeStyle = 'rgba(200,200,200,0.35)';
  ctx.lineWidth = 0.4 * s;
  ctx.beginPath();
  ctx.arc(-headR + 1 * s, 0.5 * s, 1.5 * s, -0.5, 0.5);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(headR - 1 * s, 0.5 * s, 1.5 * s, Math.PI - 0.5, Math.PI + 0.5);
  ctx.stroke();

  // Visor — faint blue-tinted arc over upper face
  const visorRx = headR - 1.5 * s;
  const visorRy = headR - 3 * s;

  ctx.fillStyle = 'rgba(140,200,255,0.08)';
  ctx.beginPath();
  ctx.ellipse(0, -1 * s, visorRx, visorRy, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();

  // Visor gleam (white reflection)
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.ellipse(-3 * s, -6 * s, 2.5 * s, 1.2 * s, -0.2, 0, Math.PI * 2);
  ctx.fill();

  // Secondary smaller gleam
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath();
  ctx.ellipse(-5 * s, -4 * s, 1.2 * s, 0.7 * s, -0.3, 0, Math.PI * 2);
  ctx.fill();
}

/** Antenna on top of helmet: thin line with a small ball. */
function drawAntenna(
  ctx: CanvasRenderingContext2D,
  s: number,
  headR: number,
): void {
  // Antenna stalk (thin curved line)
  ctx.strokeStyle = '#999';
  ctx.lineWidth = 0.4 * s;
  ctx.beginPath();
  ctx.moveTo(0, -headR - 1 * s);
  ctx.quadraticCurveTo(2 * s, -headR - 5 * s, 1 * s, -headR - 7 * s);
  ctx.stroke();

  // Antenna tip ball
  ctx.fillStyle = '#cc4444';
  ctx.beginPath();
  ctx.arc(1 * s, -headR - 7 * s, 1.2 * s, 0, Math.PI * 2);
  ctx.fill();

  // Antenna ball highlight
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.arc(0.5 * s, -headR - 7.5 * s, 0.5 * s, 0, Math.PI * 2);
  ctx.fill();
}

function drawFace(
  ctx: CanvasRenderingContext2D,
  opts: RenderOpts,
  _headR: number,
  s: number,
): void {
  const { courage, stupidity } = opts;

  // ---- Eyes ----
  const eyeY = -1.5 * s;
  const eyeOffX = 3.2 * s;
  const eyeW = 2.8 * s;
  const eyeH = 3.2 * s;

  const isBlinking = opts.state === 'idle' && (opts.frameIndex % 60 >= 57);
  const isSleeping = opts.state === 'sleeping';
  const eyesClosed = isSleeping || isBlinking;
  const isReacting = opts.state === 'reacting';

  if (eyesClosed) {
    // Closed eyes — gentle curved slits
    ctx.strokeStyle = '#3a6a20';
    ctx.lineWidth = 0.8 * s;
    ctx.lineCap = 'round';
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.arc(side * eyeOffX, eyeY, eyeW * 0.7, 0.15, Math.PI - 0.15);
      ctx.stroke();
    });
  } else {
    // Open eyes — large white ovals (reacting = wider)
    const eyeScale = isReacting ? 1.2 : 1.0;

    [-1, 1].forEach((side) => {
      // Eye white
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#5a9a30';
      ctx.lineWidth = 0.3 * s;
      ctx.beginPath();
      ctx.ellipse(side * eyeOffX, eyeY, eyeW * eyeScale, eyeH * eyeScale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // Subtle shadow at top of eye
      ctx.fillStyle = 'rgba(200,200,220,0.25)';
      ctx.beginPath();
      ctx.ellipse(side * eyeOffX, eyeY - 1 * s, eyeW * 0.7 * eyeScale, eyeH * 0.35 * eyeScale, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Pupils — oscillate left/right based on frameIndex (cute look-around)
    const lookX = Math.sin(opts.frameIndex * 0.08) * 1.8 * s;
    // Stupidity affects pupil size: stupider = larger, more vacant eyes
    const pupilSize = 1.0 + (stupidity - 0.5) * 0.5;
    const pupilR = Math.min(Math.max(pupilSize, 0.7), 1.4) * s;

    [-1, 1].forEach((side) => {
      const px = side * eyeOffX + lookX;

      // Pupil
      ctx.fillStyle = '#111111';
      ctx.beginPath();
      ctx.arc(px, eyeY, pupilR, 0, Math.PI * 2);
      ctx.fill();

      // Pupil highlight (catch light)
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(px - 0.3 * s, eyeY - 0.4 * s, 0.3 * s, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  // ---- Eyebrows ----
  drawEyebrows(ctx, opts, s, eyesClosed);

  // ---- Mouth ----
  drawMouth(ctx, opts, s, isSleeping, isReacting);

  // ---- Optional blush for happy/excited kerbals ----
  if (courage > 0.65 && !isSleeping) {
    ctx.fillStyle = 'rgba(255, 150, 150, 0.1)';
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.ellipse(side * 5.5 * s, 1.5 * s, 1.8 * s, 1 * s, 0, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

function drawEyebrows(
  ctx: CanvasRenderingContext2D,
  opts: RenderOpts,
  s: number,
  eyesClosed: boolean,
): void {
  const { courage } = opts;
  const browY = -5.5 * s;
  const browOffX = 3.2 * s;
  const browLen = 2.5 * s;

  ctx.strokeStyle = '#3a6020';
  ctx.lineWidth = 0.6 * s;
  ctx.lineCap = 'round';

  [-1, 1].forEach((side) => {
    const bx = side * browOffX;
    ctx.beginPath();

    if (eyesClosed && courage > 0.5) {
      // Relaxed content brows
      ctx.moveTo(bx - browLen, browY);
      ctx.quadraticCurveTo(bx, browY - 0.5 * s, bx + browLen, browY);
    } else if (courage > 0.6) {
      // Raised happy brows
      ctx.moveTo(bx - browLen, browY);
      ctx.quadraticCurveTo(bx, browY - 1.5 * s, bx + browLen, browY);
    } else if (courage < 0.35) {
      // Angled inward — worried
      ctx.moveTo(bx - browLen, browY + 0.6 * s);
      ctx.quadraticCurveTo(bx, browY + 0.2 * s, bx + browLen, browY - 0.2 * s);
    } else {
      // Neutral flat brows
      ctx.moveTo(bx - browLen, browY);
      ctx.lineTo(bx + browLen, browY);
    }

    ctx.stroke();
  });
}

function drawMouth(
  ctx: CanvasRenderingContext2D,
  opts: RenderOpts,
  s: number,
  isSleeping: boolean,
  isReacting: boolean,
): void {
  const { courage } = opts;
  const mouthY = 3 * s;

  ctx.strokeStyle = '#3a6a20';
  ctx.lineWidth = 0.6 * s;
  ctx.lineCap = 'round';
  ctx.beginPath();

  if (isSleeping) {
    // Small open "o" mouth while sleeping
    ctx.fillStyle = '#2a5010';
    ctx.ellipse(0, mouthY, 1.4 * s, 1.0 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (isReacting) {
    // Surprised open mouth (wider)
    ctx.fillStyle = '#2a5010';
    ctx.ellipse(0, mouthY, 2.8 * s, 2.2 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (opts.state === 'stretching') {
    // Big yawn mouth
    ctx.fillStyle = '#2a5010';
    ctx.ellipse(0, mouthY, 3 * s, 2.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else if (courage > 0.6) {
    // Big happy grin
    ctx.arc(0, mouthY - 1 * s, 3.5 * s, 0.15, Math.PI - 0.15);
  } else if (courage < 0.35) {
    // Worried frown
    ctx.arc(0, mouthY + 3.5 * s, 3.2 * s, Math.PI + 0.35, -0.35);
  } else {
    // Slight neutral smile
    ctx.arc(0, mouthY - 0.2 * s, 2.8 * s, 0.2, Math.PI - 0.2);
  }

  if (!isSleeping && !isReacting && opts.state !== 'stretching') {
    ctx.stroke();
  }
}

function drawHairTuft(
  ctx: CanvasRenderingContext2D,
  s: number,
  headR: number,
): void {
  // Small tuft of hair sticking out from top of head
  ctx.fillStyle = '#3a3a2a';
  ctx.beginPath();
  ctx.moveTo(-1 * s, -headR + 0.5 * s);
  ctx.quadraticCurveTo(2 * s, -headR - 5 * s, 3 * s, -headR + 1 * s);
  ctx.quadraticCurveTo(0.5 * s, -headR + 2 * s, -1 * s, -headR + 0.5 * s);
  ctx.fill();

  // Subtle highlight on tuft
  ctx.fillStyle = 'rgba(80,80,50,0.4)';
  ctx.beginPath();
  ctx.moveTo(-0.2 * s, -headR + 0.5 * s);
  ctx.quadraticCurveTo(1.5 * s, -headR - 3.5 * s, 2.2 * s, -headR + 0.5 * s);
  ctx.quadraticCurveTo(1 * s, -headR + 1.2 * s, -0.2 * s, -headR + 0.5 * s);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Accessories (coffee cup, Zzz, etc.)
// ---------------------------------------------------------------------------

function drawAccessories(ctx: CanvasRenderingContext2D, opts: RenderOpts): void {
  const s = opts.scale;
  const x = opts.x;

  if (opts.state === 'drinking') {
    drawCoffeeCup(ctx, opts, x, s);
  }

  if (opts.state === 'sleeping') {
    drawSleepZzz(ctx, opts, x, s);
  }

  // Small name tag label
  // Disabled for cleanliness — uncomment to show names
  // if (opts.state === 'idle') {
  //   drawNameTag(ctx, opts, x, s);
  // }
}

function drawCoffeeCup(
  ctx: CanvasRenderingContext2D,
  opts: RenderOpts,
  x: number,
  s: number,
): void {
  // Cup held near mouth area by right hand
  const cupX = x + 8.5 * s;
  const cupY = opts.y - 27 * s - Math.sin(opts.frameIndex * 0.3) * 1 * s;

  // Cup shadow
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  roundRect(ctx, cupX - 3.2 * s, cupY + 0.5 * s, 6.4 * s, 5 * s, 1.5 * s);
  ctx.fill();

  // Cup body
  ctx.fillStyle = '#f5f0e8';
  ctx.strokeStyle = '#bbb';
  ctx.lineWidth = 0.6 * s;
  roundRect(ctx, cupX - 3 * s, cupY, 6 * s, 5.5 * s, 1.5 * s);
  ctx.fill();
  ctx.stroke();

  // Cup rim highlight
  ctx.strokeStyle = '#ddd';
  ctx.lineWidth = 0.4 * s;
  ctx.beginPath();
  ctx.moveTo(cupX - 2.5 * s, cupY + 0.3 * s);
  ctx.lineTo(cupX + 2.5 * s, cupY + 0.3 * s);
  ctx.stroke();

  // Cup handle
  ctx.strokeStyle = '#bbb';
  ctx.lineWidth = 0.8 * s;
  ctx.beginPath();
  ctx.arc(cupX + 3 * s, cupY + 2.8 * s, 1.8 * s, -0.6, 0.9);
  ctx.stroke();

  // Coffee liquid visible at top
  ctx.fillStyle = '#6b3a2a';
  ctx.fillRect(cupX - 2.2 * s, cupY + 0.5 * s, 4.4 * s, 1.2 * s);

  // Steam wisps
  const steamBaseY = cupY - 0.5 * s;
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 0.5 * s;
  ctx.lineCap = 'round';

  // Wisp 1
  ctx.beginPath();
  ctx.moveTo(cupX - 1 * s, steamBaseY);
  ctx.quadraticCurveTo(
    cupX - 0.5 * s + Math.sin(opts.frameIndex * 0.3) * 1.5 * s,
    steamBaseY - 3.5 * s,
    cupX - 1.5 * s + Math.sin(opts.frameIndex * 0.3 + 1) * 1.5 * s,
    steamBaseY - 6 * s,
  );
  ctx.stroke();

  // Wisp 2
  ctx.beginPath();
  ctx.moveTo(cupX + 1 * s, steamBaseY);
  ctx.quadraticCurveTo(
    cupX + 1.5 * s + Math.cos(opts.frameIndex * 0.35) * 1.5 * s,
    steamBaseY - 4 * s,
    cupX + 0.5 * s + Math.cos(opts.frameIndex * 0.35 + 1) * 1.5 * s,
    steamBaseY - 6.5 * s,
  );
  ctx.stroke();
}

function drawSleepZzz(
  ctx: CanvasRenderingContext2D,
  opts: RenderOpts,
  x: number,
  s: number,
): void {
  const zzX = x + 13 * s;
  const zzBaseY = opts.y - 42 * s;
  const floatOffset = Math.sin(opts.frameIndex * 0.08) * 2.5 * s;

  const zs = [
    { char: 'z', dx: 3, dy: 0, alpha: 0.3 },
    { char: 'z', dx: 6, dy: -6, alpha: 0.45 },
    { char: 'Z', dx: 9, dy: -12, alpha: 0.6 },
  ];

  zs.forEach((z, i) => {
    const phase = opts.frameIndex * 0.08 + i * 1.2;
    const alpha = z.alpha + Math.sin(phase) * 0.12;
    ctx.fillStyle = `rgba(120, 170, 240, ${alpha})`;
    ctx.font = `bold ${7 * s}px sans-serif`;
    ctx.fillText(z.char, zzX + z.dx * s, zzBaseY + z.dy * s + floatOffset);
  });
}

// ---------------------------------------------------------------------------
// Main render orchestrator — draws all body parts back-to-front
// ---------------------------------------------------------------------------

function drawKerbal(ctx: CanvasRenderingContext2D, opts: RenderOpts): void {
  // Walking body bounce (upper body only)
  let bodyBob = 0;
  if (opts.state === 'walking') {
    bodyBob = Math.sin(opts.frameIndex * 0.5) * 1.2 * opts.scale;
  }

  if (opts.state === 'sitting') {
    // Sitting pose: bent legs, lowered upper body, typing arms
    // The upper body renders BEHIND the desk (zPriority=0 < desk=1), so the
    // desk naturally hides everything below its surface (Y ≈ 586). We raise
    // the upper body just enough so the head and collar peek above the desk.
    // offset=30 → head emerges at Y≈563, body top at Y≈584; ~12px of head +
    // collar visible above desk surface, body fully hidden behind desk front face.
    const loweredOpts: RenderOpts = { ...opts, y: opts.y - 30 * opts.scale };

    if (opts.renderPart === 'upper') {
      // Upper body only — renders ABOVE the desk (after desk in z-order)
      drawBody(ctx, loweredOpts);
      drawArms(ctx, { ...loweredOpts, state: 'typing' as SpriteState });
      drawCollar(ctx, loweredOpts);
      drawHead(ctx, loweredOpts);
      drawAccessories(ctx, loweredOpts);
    } else {
      // Full sitting pose or 'lower' part — renders BEHIND the desk (before desk in z-order)
      drawShadow(ctx, opts);
      drawSittingLegs(ctx, opts);
      if (!opts.renderPart || opts.renderPart === 'full') {
        // Full: draw upper body too
        drawBody(ctx, loweredOpts);
        drawArms(ctx, { ...loweredOpts, state: 'typing' as SpriteState });
        drawCollar(ctx, loweredOpts);
        drawHead(ctx, loweredOpts);
        drawAccessories(ctx, loweredOpts);
      }
    }
    return;
  }

  const upperOpts: RenderOpts = { ...opts, y: opts.y - bodyBob };

  // Back-to-front draw order
  drawShadow(ctx, opts);
  drawBackpack(ctx, upperOpts);
  drawLegs(ctx, opts);
  drawBody(ctx, upperOpts);
  drawArms(ctx, upperOpts);
  drawCollar(ctx, upperOpts);
  drawHead(ctx, upperOpts);
  drawAccessories(ctx, upperOpts);
}

// ---------------------------------------------------------------------------
// KerbalSprite
// ---------------------------------------------------------------------------

export class KerbalSprite {
  public name: string;
  public soul: KerbalSoul;
  public state: SpriteState;

  private x: number;
  private y: number;
  private scale: number;
  private frameIndex: number;
  private frameTimer: number;
  private suitColor: SuitColor;
  private movement: MovementState | null;

  private static readonly FRAME_INTERVAL = 120; // ms per animation frame

  constructor(name: string, soul: KerbalSoul, x: number, y: number) {
    this.name = name;
    this.soul = soul;
    this.x = x;
    this.y = y;
    this.scale = 1;
    this.state = 'idle';
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.suitColor = getSuitColor(soul);
    this.movement = null;
  }

  /** Advance the animation clock. Call each frame with the elapsed ms. */
  update(deltaTime: number): void {
    this.frameTimer += deltaTime;

    const effectiveInterval =
      this.state === 'walking'
        ? KerbalSprite.FRAME_INTERVAL * 0.85
        : KerbalSprite.FRAME_INTERVAL;

    while (this.frameTimer >= effectiveInterval) {
      this.frameTimer -= effectiveInterval;
      this.frameIndex++;
    }

    // Smooth movement interpolation
    if (this.movement) {
      this.movement.elapsed += deltaTime;
      const t = Math.min(this.movement.elapsed / this.movement.duration, 1);
      // Ease in-out
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      this.x = this.movement.startX + (this.movement.targetX - this.movement.startX) * eased;
      this.y = this.movement.startY + (this.movement.targetY - this.movement.startY) * eased;

      if (t >= 1) {
        this.x = this.movement.targetX;
        this.y = this.movement.targetY;
        this.movement = null;
        // Arrived at destination — sit if entering, otherwise idle
        if (this.state === 'entering') {
          this.state = 'sitting';
        } else if (this.state === 'walking' || this.state === 'leaving') {
          this.state = 'idle';
        }
      }
    }

    // Auto-revert reacting state after 2 seconds
    if (this.state === 'reacting' && this.frameTimer > 120) {
      this.setState('sitting');
    }
  }

  /** Draw the Kerbal onto a Canvas 2D context. `timeOfDay` is 0..1 (0=midnight, 0.5=noon). */
  render(ctx: CanvasRenderingContext2D, _timeOfDay: number, renderPart?: 'full' | 'lower' | 'upper'): void {
    const soul = this.soul;
    // Resolve courage / stupidity from soul; fallback to sensible defaults
    const courage = typeof soul.courage === 'number' ? soul.courage : 0.5;
    const stupidity = typeof soul.stupidity === 'number' ? soul.stupidity : 0.5;

    const opts: RenderOpts = {
      x: this.x,
      y: this.y,
      scale: this.scale,
      frameIndex: this.frameIndex,
      state: this.state,
      suitColor: this.suitColor,
      courage,
      stupidity,
      renderPart,
    };

    drawKerbal(ctx, opts);
  }

  /** Change animation state, resetting the frame counter. */
  setState(state: SpriteState): void {
    if (this.state !== state) {
      this.state = state;
      this.frameIndex = 0;
      this.frameTimer = 0;
    }
  }

  /** Update the soul data (replaces stub with real loaded soul). */
  updateSoul(soul: KerbalSoul): void {
    this.soul = soul;
    this.suitColor = getSuitColor(soul);
  }

  /** Begin a smooth movement to (x, y) over `duration` ms. Sets state to 'walking'. */
  moveTo(x: number, y: number, duration: number): void {
    this.movement = {
      startX: this.x,
      startY: this.y,
      targetX: x,
      targetY: y,
      elapsed: 0,
      duration,
    };
    this.setState('walking');
  }

  /** Current world position. */
  getPosition(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  /** Check whether the sprite is currently in a movement animation. */
  get isMoving(): boolean {
    return this.movement !== null;
  }

  /** Teleport instantly (no animation). */
  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
    this.movement = null;
  }
}
