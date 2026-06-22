import React, { useRef, useEffect, useCallback } from 'react';
import { KerbalSprite } from './KerbalSprite';
import { SoulLoader } from '../SoulLoader';
import type { KerbalSoul } from '../SoulLoader';
import {
  DESK_POSITIONS,
  ENTRANCE_POSITION,
  DOOR_POSITION,
  WINDOW_POSITION,
  WINDOW_DIMENSIONS,
} from './RoomLayout';
import type { DeskPosition } from './RoomLayout';
import { kerbalStore } from '../KerbalStore';
import type { KerbalState } from '../KerbalStore';
import { timeSystem } from '../TimeSystem';
import type { TimeState } from '../TimeSystem';
import { proactiveAgent } from '../ProactiveAgent';
import { t } from '../../services/i18n';

// ==========================================================================
// RoomCanvas  —  React component for the 2.5D Mission Control room
// ==========================================================================

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Target aspect ratio (width / height). */
const ASPECT_RATIO = 16 / 9;

/** How long a walk animation takes (ms). */
const WALK_DURATION = 3000;

/** Slower duration for leaving (walking toward exit — should look like a relaxed stroll). */
const LEAVE_DURATION = 7000;

/** Maximum number of coffee cups visible on desks at once. */
const MAX_COFFEE_CUPS = 4;

// ---------------------------------------------------------------------------
// Background rendering helpers
// ---------------------------------------------------------------------------

const FLOOR_Y_RATIO = 0.72;

/** Draw the room background: KSC-themed walls, baseboard trim, floor grid, big screen, shift badge, posters. */
function drawBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  timeOfDay: number,
): void {
  const floorLine = h * FLOOR_Y_RATIO;

  // ----- Wall: KSC-themed panelled walls with orange/white accents -----
  const wallColor = lerpColor('#3d4450', '#1e2430', timeOfDay);
  ctx.fillStyle = wallColor;
  ctx.fillRect(0, 0, w, floorLine);

  // KSC orange accent stripe at the very top of the wall (like a warning band)
  {
    const stripeH = Math.max(4, h * 0.012);
    const stripeGrad = ctx.createLinearGradient(0, 0, 0, stripeH);
    stripeGrad.addColorStop(0, 'rgba(255, 120, 50, 0.4)');
    stripeGrad.addColorStop(0.5, 'rgba(255, 120, 50, 0.7)');
    stripeGrad.addColorStop(1, 'rgba(255, 120, 50, 0)');
    ctx.fillStyle = stripeGrad;
    ctx.fillRect(0, 0, w, stripeH);
  }

  // KSC orange/white vertical accent strips at wall edges
  ctx.fillStyle = 'rgba(255, 140, 60, 0.15)';
  ctx.fillRect(0, 0, 3, floorLine);
  ctx.fillRect(w - 3, 0, 3, floorLine);

  // ----- Scenery window (left wall: KSC outdoor view) -----
  drawSceneryWindow(ctx, w, h, timeOfDay);

  // Paneled wall texture — more visible vertical seams with KSC orange tint
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 0.8;
  for (let px = w * 0.04; px < w * 0.96; px += w * 0.08) {
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, floorLine);
    ctx.stroke();
  }

  // Horizontal chair rail at mid-wall with KSC orange accent
  const chairRailY = floorLine * 0.55;
  // Rail body
  ctx.strokeStyle = 'rgba(255,140,60,0.3)';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, chairRailY);
  ctx.lineTo(w, chairRailY);
  ctx.stroke();
  // Rail highlight (white line above rail)
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, chairRailY - 2);
  ctx.lineTo(w, chairRailY - 2);
  ctx.stroke();
  // Rail shadow (darker line below rail)
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, chairRailY + 2);
  ctx.lineTo(w, chairRailY + 2);
  ctx.stroke();

  // Wall-bottom KSC orange accent strip at ~85% wall height
  const accentY = floorLine * 0.85;
  const accentH = 3;
  ctx.fillStyle = 'rgba(255, 140, 60, 0.25)';
  ctx.fillRect(0, accentY, w, accentH);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.fillRect(0, accentY - 1, w, 1);

  // ----- Baseboard / trim (KSC orange top edge) -----
  const baseboardH = h * 0.02;
  ctx.fillStyle = '#2a2d35';
  ctx.fillRect(0, floorLine - baseboardH, w, baseboardH);
  // Baseboard top edge — KSC orange trim
  ctx.strokeStyle = 'rgba(255, 140, 60, 0.5)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, floorLine - baseboardH);
  ctx.lineTo(w, floorLine - baseboardH);
  ctx.stroke();
  // Baseboard top edge white highlight (just above orange)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(0, floorLine - baseboardH - 0.5);
  ctx.lineTo(w, floorLine - baseboardH - 0.5);
  ctx.stroke();

  // ----- Floor: dark KSC-style with grid lines and orange accent -----
  const floorColor = lerpColor('#3d3c38', '#222120', timeOfDay);
  ctx.fillStyle = floorColor;
  ctx.fillRect(0, floorLine, w, h - floorLine);

  // Floor tile grid
  const tileSize = h * 0.045;
  // Horizontal lines
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 0.5;
  for (let ty = floorLine + tileSize; ty < h; ty += tileSize) {
    ctx.beginPath();
    ctx.moveTo(0, ty);
    ctx.lineTo(w, ty);
    ctx.stroke();
  }
  // Vertical lines
  for (let tx = tileSize; tx < w; tx += tileSize) {
    ctx.beginPath();
    ctx.moveTo(tx, floorLine);
    ctx.lineTo(tx, h);
    ctx.stroke();
  }

  // Floor accent: KSC orange tile every 3rd row near walls
  ctx.fillStyle = 'rgba(255, 140, 60, 0.04)';
  for (let row = 1; row < (h - floorLine) / tileSize; row += 3) {
    const ry = floorLine + row * tileSize;
    // Left accent strip
    ctx.fillRect(0, ry, w * 0.04, tileSize);
    // Right accent strip
    ctx.fillRect(w * 0.96, ry, w * 0.04, tileSize);
  }

  // Floor center guideline (subtle, like KSC runway center line)
  ctx.strokeStyle = 'rgba(255, 140, 60, 0.06)';
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 16]);
  ctx.beginPath();
  ctx.moveTo(w * 0.5, floorLine);
  ctx.lineTo(w * 0.5, h);
  ctx.stroke();
  ctx.setLineDash([]); // reset

  // Ambient warmth — warm orange glow from right side (launch-pad lighting spill)
  const ambientGrad = ctx.createRadialGradient(w * 0.9, floorLine * 0.3, 0, w * 0.9, floorLine * 0.3, w * 0.6);
  ambientGrad.addColorStop(0, `rgba(255, 140, 60, ${0.035 * (1 - timeOfDay * 0.5)})`);
  ambientGrad.addColorStop(0.5, `rgba(255, 140, 60, ${0.015 * (1 - timeOfDay * 0.5)})`);
  ambientGrad.addColorStop(1, 'rgba(255, 140, 60, 0)');
  ctx.fillStyle = ambientGrad;
  ctx.fillRect(0, 0, w, h);

  // ----- Big Screen -----
  drawBigScreen(ctx, w, h, floorLine);

  // ----- Shift badge -----
  drawShiftBadge(ctx, w, h, timeOfDay);

  // ----- Ceiling light (brightness follows time of day) -----
  drawCeilingLight(ctx, w, h, timeOfDay);
}

// ==========================================================================
// Scenery window — KSC outdoor view through the left wall
// ==========================================================================

// ---------------------------------------------------------------------------
// Easter-egg state (re-evaluated periodically, not every frame)
// ---------------------------------------------------------------------------

interface EasterEggInfo {
  visible: boolean;
  type: 'mun' | 'ufo' | 'flying-kerbal' | 'duna' | 'mushroom' | '';
}

let easterEggCache: { bucket: number; info: EasterEggInfo } = {
  bucket: -1,
  info: { visible: false, type: '' },
};

/** Debug: set to `true` to force the mushroom cloud on the next frame. */
let debugForceMushroom = false;

/**
 * Debug helper — call `triggerMushroomCloud()` from the browser console
 * to instantly show the mushroom cloud explosion in the scenery window.
 */
(window as unknown as Record<string, unknown>).triggerMushroomCloud = () => {
  debugForceMushroom = true;
};

/** Refresh easter-egg visibility every 8-second bucket (stable per bucket). */
function refreshEasterEggs(): EasterEggInfo {
  // Debug force: immediately show mushroom cloud, resets after one render
  if (debugForceMushroom) {
    debugForceMushroom = false;
    // Force a new bucket so the egg is active
    easterEggCache.bucket = Math.floor(Date.now() / 8000);
    easterEggCache.info = { visible: true, type: 'mushroom' };
    return easterEggCache.info;
  }

  const bucket = Math.floor(Date.now() / 8000);
  if (bucket !== easterEggCache.bucket) {
    easterEggCache.bucket = bucket;
    easterEggCache.info.visible = Math.random() < 0.008; // 0.8 % chance
    if (easterEggCache.info.visible) {
      const roll = Math.random();
      if (roll < 0.35) easterEggCache.info.type = 'mun';
      else if (roll < 0.60) easterEggCache.info.type = 'ufo';
      else if (roll < 0.85) easterEggCache.info.type = 'flying-kerbal';
      else easterEggCache.info.type = 'duna';
    }
    // Independent mushroom cloud check (1/67 ≈ 1.49 %) — overrides other eggs
    if (!easterEggCache.info.visible && Math.random() < 1 / 67) {
      easterEggCache.info.visible = true;
      easterEggCache.info.type = 'mushroom';
    }
  }
  return easterEggCache.info;
}

// ---------------------------------------------------------------------------
// Sky rendering helpers
// ---------------------------------------------------------------------------

/** Get the sky gradient colours for a given hour ratio (0..1, 0=midnight). */
function getSkyColors(t: number): { top: string; bottom: string } {
  // Night:        0.00 – 0.20
  // Sunrise:      0.20 – 0.30
  // Day:          0.30 – 0.70
  // Sunset:       0.70 – 0.80
  // Night:        0.80 – 1.00

  if (t < 0.2) {
    // Deep night
    return { top: '#050515', bottom: '#0d0d30' };
  }
  if (t < 0.3) {
    // Sunrise
    const p = (t - 0.2) / 0.1; // 0 → 1
    return {
      top: lerpColor('#050515', '#15154a', p),
      bottom: lerpColor('#0d0d30', '#ff6633', p),
    };
  }
  if (t < 0.7) {
    // Day
    return { top: '#1a3a7a', bottom: '#6ab0e6' };
  }
  if (t < 0.8) {
    // Sunset
    const p = (t - 0.7) / 0.1;
    return {
      top: lerpColor('#1a3a7a', '#0a0a28', p),
      bottom: lerpColor('#6ab0e6', '#ff4422', p),
    };
  }
  // Late sunset → night
  const p = (t - 0.8) / 0.2;
  return {
    top: lerpColor('#0a0a28', '#050515', Math.min(p, 1)),
    bottom: lerpColor('#ff4422', '#0d0d30', Math.min(p, 1)),
  };
}

// ---------------------------------------------------------------------------
// Scenery window — main entry
// ---------------------------------------------------------------------------

/**
 * Draw the KSC outdoor scenery through the left-wall window.
 *
 * Composite order (back → front):
 *   1. Sky gradient
 *   2. Stars (night only)
 *   3. Mid-ground terrain (lighter hills for depth)
 *   4. Foreground terrain / horizon
 *   5. Atmospheric haze at horizon
 *   6. KSC landmark silhouettes (VAB, tracking dish, launch pad) + ground shadows
 *   7. Randomized easter eggs (Mun, UFO, flying Kerbal, Duna, mushroom cloud)
 *   8. Glass reflection overlay
 *   9. Window frame
 */
function drawSceneryWindow(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  timeOfDay: number,
): void {
  const wx = (WINDOW_POSITION.x / 100) * w;
  const wy = (WINDOW_POSITION.y / 100) * h;
  const ww = (WINDOW_DIMENSIONS.width / 100) * w;
  const wh = (WINDOW_DIMENSIONS.height / 100) * h;
  const s = Math.min(w, h) / 720;

  // ---- Draw inside clip region ----
  ctx.save();

  ctx.beginPath();
  roundRect(ctx, wx, wy, ww, wh, 3 * s);
  ctx.clip();

  // 1. Sky backdrop
  const sky = getSkyColors(timeOfDay);
  const skyGrad = ctx.createLinearGradient(wx, wy, wx, wy + wh);
  skyGrad.addColorStop(0, sky.top);
  skyGrad.addColorStop(1, sky.bottom);
  ctx.fillStyle = skyGrad;
  ctx.fillRect(wx, wy, ww, wh);

  // 2. Stars (night / twilight only)
  if (timeOfDay < 0.22 || timeOfDay > 0.78) {
    drawWindowStars(ctx, wx, wy, ww, wh);
  }

  // 2.5 Mid-ground terrain (lighter hills between sky and foreground)
  drawMidgroundTerrain(ctx, wx, wy, ww, wh, timeOfDay);

  // 3. Foreground terrain horizon
  drawWindowTerrain(ctx, wx, wy, ww, wh, timeOfDay);

  // 3.5 Atmospheric haze at horizon
  drawAtmosphericHaze(ctx, wx, wy, ww, wh, timeOfDay);

  // 4. KSC landmark silhouettes
  drawKSCSilhouettes(ctx, wx, wy, ww, wh, timeOfDay);

  // 5. Easter eggs
  drawEasterEggs(ctx, wx, wy, ww, wh, timeOfDay, s);

  // 6. Glass reflection overlay
  drawWindowGlass(ctx, wx, wy, ww, wh, s);

  ctx.restore();

  // ---- Window frame (drawn outside clip) ----
  ctx.strokeStyle = '#4a4c54';
  ctx.lineWidth = 3 * s;
  ctx.strokeRect(wx, wy, ww, wh);

  // Frame inner shadow / highlight
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.5 * s;
  ctx.strokeRect(wx + 2 * s, wy + 2 * s, ww - 4 * s, wh - 4 * s);

  // Frame outer highlight
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1 * s;
  ctx.strokeRect(wx - 1, wy - 1, ww + 2, wh + 2);
}

// ---------------------------------------------------------------------------
// Sub-layer functions
// ---------------------------------------------------------------------------

/** Twinkling stars — only visible at night. Deterministic positions. */
function drawWindowStars(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  ww: number,
  wh: number,
): void {
  const starCount = 35;
  for (let i = 0; i < starCount; i++) {
    // Deterministic position from index (stable across frames)
    const px = (Math.sin(i * 317 + 12) * 0.5 + 0.5);
    const py = (Math.sin(i * 719 + 34) * 0.5 + 0.5);
    const sx = wx + px * ww;
    const sy = wy + py * wh * 0.55; // upper 55 % of window
    const size = 0.4 + (Math.sin(i * 553 + 56) * 0.5 + 0.5) * 1.2;

    // Twinkle
    const twinkle = 0.5 + 0.5 * Math.sin(Date.now() / 1800 + i * 1.7);
    ctx.globalAlpha = 0.3 + 0.7 * Math.max(twinkle, 0);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(sx, sy, size, 0, Math.PI * 2);
    ctx.fill();

    // Brighter core for brightest stars
    if (twinkle > 0.6) {
      ctx.globalAlpha = 0.4 * twinkle;
      ctx.fillStyle = '#ccddff';
      ctx.beginPath();
      ctx.arc(sx, sy, size * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

/** Mid-ground terrain — lighter, lower-amplitude hills for depth between sky and foreground. */
function drawMidgroundTerrain(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  ww: number,
  wh: number,
  timeOfDay: number,
): void {
  const horizonY = wy + wh * 0.58;
  const isNight = timeOfDay < 0.22 || timeOfDay > 0.78;
  const fillColor = isNight ? '#22222a' : '#6a8a50';

  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.moveTo(wx, horizonY);

  // Lower frequency, lower amplitude — creates distance impression
  for (let x = 0; x <= ww; x += 2) {
    const hill =
      Math.sin((x / ww) * Math.PI * 2.5) * wh * 0.020 +
      Math.sin((x / ww) * Math.PI * 5.5) * wh * 0.012;
    ctx.lineTo(wx + x, horizonY + hill);
  }

  ctx.lineTo(wx + ww, wy + wh);
  ctx.lineTo(wx, wy + wh);
  ctx.closePath();

  // Opacity blend — more transparent near horizon for distance fade
  const hazeAlpha = isNight ? 0.45 : 0.50;
  ctx.globalAlpha = hazeAlpha;
  ctx.fill();
  ctx.globalAlpha = 1;
}

/** Atmospheric haze gradient near the horizon — softens the sky/ground meeting line. */
function drawAtmosphericHaze(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  ww: number,
  wh: number,
  timeOfDay: number,
): void {
  const horizonY = wy + wh * 0.58;
  const isNight = timeOfDay < 0.22 || timeOfDay > 0.78;

  const hazeHeight = wh * 0.12;
  const grad = ctx.createLinearGradient(
    wx, horizonY - hazeHeight * 0.3,
    wx, horizonY + hazeHeight * 0.7,
  );

  if (isNight) {
    grad.addColorStop(0, 'rgba(40,40,60,0)');
    grad.addColorStop(0.4, 'rgba(40,40,60,0.12)');
    grad.addColorStop(0.6, 'rgba(40,40,60,0.12)');
    grad.addColorStop(1, 'rgba(30,30,50,0)');
  } else {
    grad.addColorStop(0, 'rgba(180,200,220,0)');
    grad.addColorStop(0.4, 'rgba(170,200,210,0.10)');
    grad.addColorStop(0.6, 'rgba(150,190,200,0.08)');
    grad.addColorStop(1, 'rgba(100,140,160,0)');
  }

  ctx.fillStyle = grad;
  ctx.fillRect(wx, horizonY - hazeHeight * 0.3, ww, hazeHeight);
}

/** Rolling terrain / horizon at ~58 % of window height. */
function drawWindowTerrain(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  ww: number,
  wh: number,
  timeOfDay: number,
): void {
  const horizonY = wy + wh * 0.58;
  const isNight = timeOfDay < 0.22 || timeOfDay > 0.78;
  const fillColor = isNight ? '#1a1a14' : '#2d3a1a';
  const edgeColor = isNight ? '#2a2a20' : '#4a6a2a';

  // Ground fill
  ctx.fillStyle = fillColor;
  ctx.beginPath();
  ctx.moveTo(wx, horizonY);

  for (let x = 0; x <= ww; x += 1) {
    const hill =
      Math.sin((x / ww) * Math.PI * 3) * wh * 0.04 +
      Math.sin((x / ww) * Math.PI * 7) * wh * 0.02;
    ctx.lineTo(wx + x, horizonY + hill);
  }

  ctx.lineTo(wx + ww, wy + wh);
  ctx.lineTo(wx, wy + wh);
  ctx.closePath();
  ctx.fill();

  // Horizon edge highlight
  ctx.strokeStyle = edgeColor;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(wx, horizonY);
  for (let x = 0; x <= ww; x += 2) {
    const hill =
      Math.sin((x / ww) * Math.PI * 3) * wh * 0.04 +
      Math.sin((x / ww) * Math.PI * 7) * wh * 0.02;
    ctx.lineTo(wx + x, horizonY + hill);
  }
  ctx.stroke();
}

/** Kerbal Space Center landmark silhouettes (VAB, tracking dish, launch pad). */
function drawKSCSilhouettes(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  ww: number,
  wh: number,
  timeOfDay: number,
): void {
  const horizonY = wy + wh * 0.58;
  const isNight = timeOfDay < 0.22 || timeOfDay > 0.78;
  const color = isNight ? '#1a1a18' : '#2a3a1a';

  ctx.fillStyle = color;

  // ---- VAB (Vehicle Assembly Building) — tall, iconic flat-top ----
  const vabX = wx + ww * 0.55;
  const vabW = ww * 0.22;
  const vabH = wh * 0.30;

  // Main body
  ctx.fillRect(vabX, horizonY - vabH, vabW, vabH);

  // Curved top — the VAB's iconic arched roof
  ctx.beginPath();
  ctx.moveTo(vabX, horizonY - vabH);
  ctx.quadraticCurveTo(
    vabX + vabW / 2,
    horizonY - vabH - wh * 0.03,
    vabX + vabW,
    horizonY - vabH,
  );
  ctx.fill();

  // Vertical stripe detail
  ctx.fillStyle = isNight ? '#22221a' : '#3a4a2a';
  ctx.fillRect(vabX + vabW * 0.42, horizonY - vabH, vabW * 0.16, vabH);

  // ---- Tracking dish (left side) ----
  const dishX = wx + ww * 0.18;
  const dishStemH = wh * 0.15;

  // Stem
  ctx.fillStyle = color;
  ctx.fillRect(dishX - 1, horizonY - dishStemH, 2, dishStemH);

  // Dish — large circle
  ctx.beginPath();
  ctx.arc(dishX, horizonY - dishStemH, ww * 0.055, 0, Math.PI * 2);
  ctx.fill();

  // Inner dish detail
  ctx.fillStyle = isNight ? '#22221a' : '#3a4a2a';
  ctx.beginPath();
  ctx.arc(dishX, horizonY - dishStemH, ww * 0.028, 0, Math.PI * 2);
  ctx.fill();

  // ---- Launch pad / gantry (centre-left) ----
  const padX = wx + ww * 0.32;
  const padW = ww * 0.08;
  const padH = wh * 0.10;

  // Gantry structure
  ctx.fillStyle = color;
  ctx.fillRect(padX, horizonY - padH, padW, padH);

  // Small rocket on the pad
  const rocketW = padW * 0.4;
  const rocketH = wh * 0.08;
  ctx.fillRect(
    padX + padW * 0.3,
    horizonY - padH - rocketH,
    rocketW,
    rocketH,
  );

  // Rocket nose cone
  ctx.beginPath();
  ctx.moveTo(padX + padW * 0.3, horizonY - padH - rocketH);
  ctx.lineTo(padX + padW * 0.5, horizonY - padH - rocketH - wh * 0.06);
  ctx.lineTo(padX + padW * 0.7, horizonY - padH - rocketH);
  ctx.closePath();
  ctx.fill();

  // Rocket window detail
  ctx.fillStyle = isNight ? '#1a1a14' : '#4a6a2a';
  ctx.beginPath();
  ctx.arc(
    padX + padW * 0.5,
    horizonY - padH - rocketH * 0.6,
    rocketW * 0.12,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  // -----------------------------------------------------------------------
  // Ground shadows — dark gradient anchored at horizon below each building
  // -----------------------------------------------------------------------
  const shadowHeight = wh * 0.035;
  const shadowMaxAlpha = isNight ? 0.35 : 0.30;

  // Helper: draw a single ground shadow
  function drawGroundShadow(shadowX: number, shadowW: number): void {
    const grad = ctx.createLinearGradient(0, horizonY, 0, horizonY + shadowHeight);
    grad.addColorStop(0, `rgba(0,0,0,${shadowMaxAlpha})`);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(shadowX, horizonY, shadowW, shadowHeight);
  }

  // VAB shadow
  drawGroundShadow(vabX - vabW * 0.03, vabW * 1.06);
  // Tracking dish shadow
  drawGroundShadow(dishX - ww * 0.04, ww * 0.08);
  // Launch pad shadow
  drawGroundShadow(padX - padW * 0.05, padW * 1.1);
}

/** Rare easter eggs: Mun, UFO, flying Kerbal, Duna. */
function drawEasterEggs(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  ww: number,
  wh: number,
  timeOfDay: number,
  s: number,
): void {
  const egg = refreshEasterEggs();
  if (!egg.visible) return;

  const horizonY = wy + wh * 0.58;

  switch (egg.type) {
    // ---- The Mun (large cratered moon) ----
    case 'mun': {
      // Only visible outside day hours
      if (timeOfDay > 0.2 && timeOfDay < 0.7) return;
      const mx = wx + ww * 0.35;
      const my = wy + wh * 0.15;
      const mr = ww * 0.06;

      // Main body
      ctx.fillStyle = '#c8c0b0';
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();

      // Craters
      ctx.fillStyle = '#a8a090';
      ctx.beginPath();
      ctx.arc(mx - mr * 0.2, my - mr * 0.1, mr * 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(mx + mr * 0.25, my + mr * 0.2, mr * 0.15, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(mx - mr * 0.1, my + mr * 0.3, mr * 0.12, 0, Math.PI * 2);
      ctx.fill();

      // Subtle glow
      ctx.fillStyle = 'rgba(255, 255, 200, 0.05)';
      ctx.beginPath();
      ctx.arc(mx, my, mr * 1.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    // ---- UFO ----
    case 'ufo': {
      const ux = wx + ww * 0.6;
      const uy = wy + wh * (0.2 + 0.3 * Math.sin(Date.now() / 5000));

      // Saucer body
      ctx.fillStyle = '#556';
      ctx.beginPath();
      ctx.ellipse(ux, uy, ww * 0.05, wh * 0.02, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dome
      ctx.fillStyle = '#779';
      ctx.beginPath();
      ctx.arc(ux, uy - wh * 0.01, ww * 0.02, 0, Math.PI * 2);
      ctx.fill();

      // Blinking lights
      const blink = 0.5 + 0.5 * Math.sin(Date.now() / 300);
      ctx.fillStyle = `rgba(100, 255, 100, ${blink})`;
      ctx.beginPath();
      ctx.arc(ux - ww * 0.025, uy + wh * 0.005, 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ux + ww * 0.025, uy + wh * 0.005, 1, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    // ---- Flying Kerbal with jetpack ----
    case 'flying-kerbal': {
      const kx = wx + ww * 0.45;
      const ky = wy + wh * (0.3 + 0.2 * Math.sin(Date.now() / 4000));
      const ks = s * 5; // kerbal size

      // Green body
      ctx.fillStyle = '#7ec850';
      ctx.beginPath();
      ctx.arc(kx, ky, ks * 0.6, 0, Math.PI * 2);
      ctx.fill();

      // Helmet (red — Jeb style)
      ctx.fillStyle = '#ee3333';
      ctx.beginPath();
      ctx.arc(kx, ky - ks * 0.3, ks * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Helmet visor
      ctx.fillStyle = '#ccffff';
      ctx.beginPath();
      ctx.arc(kx, ky - ks * 0.3, ks * 0.18, 0, Math.PI * 2);
      ctx.fill();

      // Jetpack flame (flickering)
      const flame = 0.6 + 0.4 * Math.sin(Date.now() / 100);
      ctx.fillStyle = `rgba(255, 150, 50, ${flame})`;
      ctx.beginPath();
      ctx.moveTo(kx - ks * 0.15, ky + ks * 0.5);
      ctx.lineTo(kx + ks * 0.15, ky + ks * 0.5);
      ctx.lineTo(kx, ky + ks * 1.0);
      ctx.closePath();
      ctx.fill();

      // Inner flame
      ctx.fillStyle = `rgba(255, 255, 100, ${flame * 0.6})`;
      ctx.beginPath();
      ctx.moveTo(kx - ks * 0.06, ky + ks * 0.55);
      ctx.lineTo(kx + ks * 0.06, ky + ks * 0.55);
      ctx.lineTo(kx, ky + ks * 0.8);
      ctx.closePath();
      ctx.fill();
      break;
    }

    // ---- Duna (tiny red dot) ----
    case 'duna': {
      // Only visible during twilight / night
      if (timeOfDay > 0.22 && timeOfDay < 0.68) return;
      const dx = wx + ww * 0.75;
      const dy = wy + wh * 0.12;
      ctx.fillStyle = '#cc5533';
      ctx.beginPath();
      ctx.arc(dx, dy, 1.5, 0, Math.PI * 2);
      ctx.fill();
      break;
    }

    // ---- MUSHROOM CLOUD (FULL-SCREEN) ----
    case 'mushroom': {
      const bucketElapsed = Date.now() % 8000;
      const progress = Math.min(bucketElapsed / 8000, 1);
      const isNight = timeOfDay < 0.22 || timeOfDay > 0.78;

      // Center-ish so the blast fills the whole window
      const mx = wx + ww * 0.50;
      const my = horizonY;

      // ---- FLASH (0-10%) — brilliant white fills the entire window ----
      if (progress < 0.10) {
        const t = progress / 0.10;
        const flashR = ww * (0.80 + t * 1.70);   // 80% → 250% of window width
        const alpha = 0.7 + t * 0.3;

        ctx.save();
        ctx.globalAlpha = alpha;

        // Bright inner flash
        const grad = ctx.createRadialGradient(mx, my, 0, mx, my, flashR);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.35, 'rgba(255,255,200,0.95)');
        grad.addColorStop(0.6, 'rgba(255,200,100,0.5)');
        grad.addColorStop(1, 'rgba(255,150,50,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mx, my, flashR, 0, Math.PI * 2);
        ctx.fill();

        // Massive outer halo — exceeds window bounds
        const haloGrad = ctx.createRadialGradient(mx, my, 0, mx, my, flashR * 3.5);
        haloGrad.addColorStop(0, 'rgba(255,255,255,0.25)');
        haloGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = haloGrad;
        ctx.beginPath();
        ctx.arc(mx, my, flashR * 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        break;
      }

      // ---- FIREBALL (10-35%) — immense fireball fills most of the window ----
      if (progress < 0.35) {
        const t = (progress - 0.10) / 0.25;
        const fbR = ww * (0.40 + t * 2.10);       // 40% → 250% of window width
        const fbY = my - fbR * 0.35 * t;
        const alpha = 0.85 + t * 0.15;

        ctx.save();
        ctx.globalAlpha = alpha;

        // Main fireball
        const grad = ctx.createRadialGradient(mx, fbY, 0, mx, fbY, fbR);
        grad.addColorStop(0, 'rgba(255,255,200,1)');
        grad.addColorStop(0.15, 'rgba(255,200,100,0.95)');
        grad.addColorStop(0.4, 'rgba(255,120,50,0.85)');
        grad.addColorStop(0.7, 'rgba(200,60,20,0.6)');
        grad.addColorStop(1, 'rgba(80,20,10,0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(mx, fbY, fbR, 0, Math.PI * 2);
        ctx.fill();

        // White-hot core
        const coreGrad = ctx.createRadialGradient(mx, fbY, 0, mx, fbY, fbR * 0.35);
        coreGrad.addColorStop(0, 'rgba(255,255,255,0.95)');
        coreGrad.addColorStop(1, 'rgba(255,255,200,0)');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(mx, fbY, fbR * 0.35, 0, Math.PI * 2);
        ctx.fill();

        // Ground reflection — wide arc
        const groundGrad = ctx.createRadialGradient(mx, my, 0, mx, my, fbR * 2.0);
        groundGrad.addColorStop(0, 'rgba(255,150,50,0.12)');
        groundGrad.addColorStop(1, 'rgba(255,150,50,0)');
        ctx.fillStyle = groundGrad;
        ctx.beginPath();
        ctx.ellipse(mx, my, fbR * 2.0, fbR * 0.50, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        break;
      }

      // ---- MUSHROOM CLOUD FORMATION (35-65%) — fills from horizon to above the window top ----
      if (progress < 0.65) {
        const t = (progress - 0.35) / 0.30;
        const cloudW = ww * (1.00 + t * 3.00);     // 100% → 400% — wider than window
        const cloudH = wh * (0.80 + t * 3.20);     // 80% → 400% — taller than window
        const capY = my - cloudH * 0.85;            // rises above window top edge
        const alpha = 0.80 + t * 0.20;

        const stemColor = isNight ? '#3a3a32' : '#6a6a60';
        const capColor = isNight ? '#4a4a40' : '#8a8a78';
        const puffColor = isNight ? '#505048' : '#9a9a88';

        ctx.save();
        ctx.globalAlpha = alpha;

        // Massive stem — thick trapezoid from horizon
        ctx.fillStyle = stemColor;
        const stemTopW = cloudW * 0.70;
        const stemBotW = cloudW * 0.45;
        ctx.beginPath();
        ctx.moveTo(mx - stemBotW / 2, my);
        ctx.lineTo(mx - stemTopW / 2, capY + cloudH * 0.15);
        ctx.lineTo(mx + stemTopW / 2, capY + cloudH * 0.15);
        ctx.lineTo(mx + stemBotW / 2, my);
        ctx.closePath();
        ctx.fill();

        // Mushroom cap — huge ellipse
        ctx.fillStyle = capColor;
        ctx.beginPath();
        ctx.ellipse(mx, capY, cloudW * 0.55, cloudH * 0.25, 0, 0, Math.PI * 2);
        ctx.fill();

        // Billowing puffs — many, covering the whole cap
        const puffs = [
          [-0.55, -0.05], [0.55, -0.05],
          [-0.35, -0.30], [0.35, -0.30],
          [0, -0.25],
          [-0.75, 0.10], [0.75, 0.10],
          [-0.25, 0.18], [0.25, 0.18],
          [-0.90, -0.15], [0.90, -0.15],
          [-0.15, -0.35], [0.15, -0.35],
          [-0.65, 0.20], [0.65, 0.20],
        ];
        ctx.fillStyle = puffColor;
        for (const [px, py] of puffs) {
          ctx.beginPath();
          ctx.arc(
            mx + px * cloudW * 0.55,
            capY + py * cloudH * 0.55,
            cloudW * 0.22,
            0, Math.PI * 2,
          );
          ctx.fill();
        }

        ctx.restore();
        break;
      }

      // ---- SMOKE & FADE (65-100%) — billowing smoke spills beyond every edge ----
      {
        const t = (progress - 0.65) / 0.35;
        const cloudW = ww * (1.20 + t * 4.80);     // 120% → 600% — spills far past both sides
        const cloudH = wh * (1.00 + t * 4.00);     // 100% → 500% — spills far past top
        const capY = my - cloudH * 0.70;
        const alpha = 0.90 * (1 - t);

        if (alpha > 0.01) {
          ctx.save();
          ctx.globalAlpha = alpha;

          const smokeColor = isNight ? '#3a3a38' : '#707068';
          ctx.fillStyle = smokeColor;

          // Central mass — fills width
          ctx.beginPath();
          ctx.ellipse(mx, capY, cloudW * 0.45, cloudH * 0.22, 0, 0, Math.PI * 2);
          ctx.fill();

          // Expanding smoke puffs — many, drifting far beyond window edges
          const puffCount = 12 + Math.floor(t * 12);
          for (let i = 0; i < puffCount; i++) {
            const angle = (i / puffCount) * Math.PI * 2 + t * 0.6;
            const drift = cloudW * (0.30 + t * 0.40);
            const px = mx + Math.cos(angle) * drift;
            const py = capY + Math.sin(angle * 0.5) * cloudH * 0.15;
            const pr = cloudW * (0.15 + t * 0.15);
            ctx.beginPath();
            ctx.arc(px, py, pr, 0, Math.PI * 2);
            ctx.fill();
          }

          ctx.restore();
        }
        break;
      }
    }
  }
}

/** Subtle glass reflection streaks and tint overlay. */
function drawWindowGlass(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  ww: number,
  wh: number,
  s: number,
): void {
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, wx, wy, ww, wh, 3 * s);
  ctx.clip();

  // Two diagonal reflection streaks
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.035)';
  ctx.lineWidth = ww * 0.15;
  for (let i = 0; i < 2; i++) {
    const yOff = wy + wh * (0.25 + i * 0.35);
    ctx.beginPath();
    ctx.moveTo(wx - ww * 0.1, yOff - ww * 0.15);
    ctx.lineTo(wx + ww * 1.1, yOff + ww * 0.15);
    ctx.stroke();
  }

  // Very subtle blue glass tint
  ctx.fillStyle = 'rgba(180, 210, 240, 0.03)';
  ctx.fillRect(wx, wy, ww, wh);

  ctx.restore();
}

/** The large central Mission Control display. */
function drawBigScreen(ctx: CanvasRenderingContext2D, w: number, h: number, _floorLine: number): void {
  const sx = w * 0.18;
  const sy = h * 0.03;
  const sw = w * 0.38;
  const sh = Math.min(h * 0.18, h * FLOOR_Y_RATIO * 0.5);

  // ---- Bezel ----
  ctx.fillStyle = '#1a1a24';
  ctx.strokeStyle = '#333344';
  ctx.lineWidth = 3;
  roundRect(ctx, sx - 3, sy - 3, sw + 6, sh + 6, 4);
  ctx.fill();
  ctx.stroke();

  // ---- Screen surface ----
  const glowGrad = ctx.createLinearGradient(sx, sy, sx, sy + sh);
  glowGrad.addColorStop(0, '#0a2a1a');
  glowGrad.addColorStop(0.5, '#0d3d25');
  glowGrad.addColorStop(1, '#0a2a1a');
  ctx.fillStyle = glowGrad;
  roundRect(ctx, sx, sy, sw, sh, 2);
  ctx.fill();

  // ---- Scan line overlay ----
  ctx.strokeStyle = 'rgba(50, 255, 180, 0.06)';
  ctx.lineWidth = 0.5;
  const now = Date.now();
  for (let i = 0; i < 12; i++) {
    const ly = sy + (sh / 13) * (i + 0.5) + Math.sin(now / 2000 + i) * 1.5;
    ctx.beginPath();
    ctx.moveTo(sx + 4, ly);
    ctx.lineTo(sx + sw - 4, ly);
    ctx.stroke();
  }

  // ---- Live data ----
  const timeState = timeSystem.getTime();
  const presentKerbals = kerbalStore.getPresent();
  const crewCount = presentKerbals.length;
  const totalCount = 9;
  const shiftLabel = timeState.shiftType === 'day' ? t('room.dayShift') : t('room.nightShift');
  const hourStr = String(timeState.currentHour).padStart(2, '0');
  const minStr = String(timeState.currentMinute).padStart(2, '0');

  const paddingX = sx + 8;
  const headerSize = Math.round(h * 0.014);
  const fs = Math.round(h * 0.010); // base font size

  ctx.textBaseline = 'top';

  // ---- 1. Title bar with clock ----
  ctx.fillStyle = 'rgba(80, 255, 200, 0.9)';
  ctx.font = `bold ${headerSize}px "Courier New", monospace`;
  ctx.textAlign = 'left';
  ctx.fillText(t('room.title'), paddingX, sy + 4);
  ctx.textAlign = 'right';
  ctx.fillText(`${hourStr}:${minStr}`, sx + sw - 8, sy + 4);

  // ---- 2. Divider ----
  const dividerY = sy + 4 + headerSize * 1.7;
  ctx.strokeStyle = 'rgba(80, 255, 180, 0.3)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(paddingX, dividerY);
  ctx.lineTo(sx + sw - 8, dividerY);
  ctx.stroke();

  // ---- 3. Shift + crew summary ----
  ctx.textAlign = 'left';
  ctx.font = `${fs}px "Courier New", monospace`;
  let lineY = dividerY + 3;
  ctx.fillStyle = 'rgba(80, 255, 200, 0.7)';
  ctx.fillText(`SHIFT: ${shiftLabel}`, paddingX, lineY);
  lineY += fs * 1.5;
  ctx.fillText(`CREW:  ${crewCount}/${totalCount} on duty`, paddingX, lineY);
  lineY += fs * 1.5;

  // ---- 4. Per-kerbal status rows ----
  const rowH = fs * 1.35;
  const maxRows = Math.max(1, Math.floor((sh - (lineY - sy) - 20) / rowH));
  const visibleKerbals = presentKerbals.slice(0, maxRows);

  for (const k of visibleKerbals) {
    // Mood-based dot/star
    let moodDot: string;
    let moodColor: string;
    switch (k.mood) {
      case 'excited':
      case 'ecstatic':
        moodDot = '★';
        moodColor = '#66ff66';
        break;
      case 'tired':
      case 'groggy':
        moodDot = '○';
        moodColor = '#ffaa33';
        break;
      case 'annoyed':
        moodDot = '◆';
        moodColor = '#ff6644';
        break;
      case 'anxious':
        moodDot = '◆';
        moodColor = '#ff8844';
        break;
      default:
        moodDot = '●';
        moodColor = '#80ffcc';
    }

    // Position label
    const posColor = k.position === 'desk' ? '#80ffcc' : k.position === 'coffee' ? '#ffcc44' : k.position === 'break' || k.position === 'bathroom' || k.position === 'lunch' ? '#ff8844' : '#66aaff';
    const posLabel = k.position.toUpperCase();

    ctx.fillStyle = moodColor;
    ctx.font = `${fs}px "Courier New", monospace`;
    ctx.textAlign = 'left';
    ctx.fillText(moodDot, paddingX, lineY);

    ctx.fillStyle = '#ccffcc';
    const nameX = paddingX + fs * 1.4;
    ctx.fillText(k.name.padEnd(12), nameX, lineY);

    ctx.fillStyle = posColor;
    ctx.fillText(posLabel, nameX + fs * 9, lineY);
    lineY += rowH;
  }

  // ---- 5. Bottom status bar ----
  const statusY = sy + sh - fs * 1.8;
  ctx.strokeStyle = 'rgba(80, 255, 180, 0.3)';
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(paddingX, statusY - 2);
  ctx.lineTo(sx + sw - 8, statusY - 2);
  ctx.stroke();

  const hasIssues = presentKerbals.some((k) => k.mood === 'annoyed' || k.mood === 'anxious');
  const hasTired = presentKerbals.some((k) => k.mood === 'tired' || k.mood === 'groggy');
  ctx.font = `${fs}px "Courier New", monospace`;
  ctx.textAlign = 'left';
  if (hasIssues) {
    ctx.fillStyle = '#ff6644';
    ctx.fillText('⚠ CREW STRESS DETECTED', paddingX, statusY);
  } else if (hasTired) {
    ctx.fillStyle = '#ffaa33';
    ctx.fillText('⚠ FATIGUE MONITORING ACTIVE', paddingX, statusY);
  } else {
    ctx.fillStyle = 'rgba(80, 255, 200, 0.6)';
    ctx.fillText(t('room.statusOk'), paddingX, statusY);
  }

  // Blinking cursor indicator
  if (Math.sin(now / 500) > 0) {
    ctx.fillStyle = 'rgba(80, 255, 180, 0.7)';
    ctx.textAlign = 'right';
    ctx.font = `${fs}px "Courier New", monospace`;
    ctx.fillText('_', sx + sw - 8, statusY);
  }
}

/** Draw a few Kerbal-themed posters / drawings on the walls. */
/** Draw an LED panel across the entire ceiling that lights up the whole room.
 *  Brightness is inverse to timeOfDay — full power at night, dim during the day. */
function drawCeilingLight(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  timeOfDay: number,
): void {
  // Brightness: night=1.0, day=0.15
  const brightness = 1.0 - timeOfDay * 0.85;
  if (brightness < 0.01) return;

  const floorLine = h * FLOOR_Y_RATIO;

  // ---- Full-room light wash — a warm glow that overlays walls + floor ----
  // Brighter near the ceiling, fading toward the floor (like real ceiling LEDs)
  const roomGrad = ctx.createLinearGradient(0, 0, 0, floorLine);
  roomGrad.addColorStop(0, `rgba(255, 235, 200, ${0.040 * brightness})`);
  roomGrad.addColorStop(0.3, `rgba(255, 235, 200, ${0.028 * brightness})`);
  roomGrad.addColorStop(0.6, `rgba(255, 235, 200, ${0.016 * brightness})`);
  roomGrad.addColorStop(1, `rgba(255, 235, 200, ${0.005 * brightness})`);
  ctx.fillStyle = roomGrad;
  ctx.fillRect(0, 0, w, floorLine);

  // Floor also gets a subtle warm wash
  const floorGrad = ctx.createLinearGradient(0, floorLine, 0, h);
  floorGrad.addColorStop(0, `rgba(255, 235, 200, ${0.008 * brightness})`);
  floorGrad.addColorStop(1, `rgba(255, 235, 200, 0)`);
  ctx.fillStyle = floorGrad;
  ctx.fillRect(0, floorLine, w, h - floorLine);

  // ---- LED panel fixture — a thin glowing strip along the ceiling ----
  const panelH = Math.max(2, h * 0.006);
  const panelGrad = ctx.createLinearGradient(0, 0, 0, panelH);
  panelGrad.addColorStop(0, `rgba(255, 245, 225, ${0.5 * brightness})`);
  panelGrad.addColorStop(0.4, `rgba(255, 245, 225, ${0.9 * brightness})`);
  panelGrad.addColorStop(0.8, `rgba(255, 245, 225, ${brightness})`);
  panelGrad.addColorStop(1, `rgba(255, 245, 225, ${0.3 * brightness})`);
  ctx.fillStyle = panelGrad;
  ctx.fillRect(0, 0, w, panelH);

  // LED panel frame (thin metal border)
  ctx.strokeStyle = `rgba(180, 180, 190, ${0.15 * brightness + 0.05})`;
  ctx.lineWidth = 0.5;
  ctx.strokeRect(0, 0, w, panelH);

  // ---- Ceiling glow — soft halo spreading across the top of the room ----
  const ceilingGlowGrad = ctx.createRadialGradient(w * 0.5, 0, 0, w * 0.5, 0, w * 0.35);
  ceilingGlowGrad.addColorStop(0, `rgba(255, 240, 210, ${0.030 * brightness})`);
  ceilingGlowGrad.addColorStop(0.5, `rgba(255, 240, 210, ${0.012 * brightness})`);
  ceilingGlowGrad.addColorStop(1, `rgba(255, 240, 210, 0)`);
  ctx.fillStyle = ceilingGlowGrad;
  ctx.fillRect(0, 0, w, floorLine);
}

/** Shift badge in the top-right corner showing current shift + crew count + KSC branding. */
function drawShiftBadge(ctx: CanvasRenderingContext2D, w: number, h: number, _timeOfDay: number): void {
  const timeState = timeSystem.getTime();
  const isDay = timeState.shiftType === 'day';
  const present = kerbalStore.getPresent();
  const count = present.length;

  const bx = w * 0.72;
  const by = h * 0.025;
  const bw = w * 0.18;
  const bh = h * 0.055;

  // KSC orange accent dot on left edge
  ctx.fillStyle = 'rgba(255, 140, 60, 0.7)';
  ctx.beginPath();
  ctx.arc(bx - 2, by + bh / 2, 3, 0, Math.PI * 2);
  ctx.fill();

  // Badge background with KSC dark panel
  const bgColor = isDay ? 'rgba(234, 179, 8, 0.20)' : 'rgba(99, 102, 241, 0.20)';
  const borderColor = isDay ? 'rgba(234, 179, 8, 0.45)' : 'rgba(99, 102, 241, 0.45)';
  ctx.fillStyle = bgColor;
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  roundRect(ctx, bx, by, bw, bh, 4);
  ctx.fill();
  ctx.stroke();

  // Top thin KSC orange stripe on badge
  ctx.fillStyle = 'rgba(255, 140, 60, 0.3)';
  ctx.fillRect(bx + 4, by + 1, bw - 8, 2);

  // Label
  const shiftLabel = isDay ? t('room.dayShift') : t('room.nightShift');
  const labelColor = isDay ? '#fbbf24' : '#a5b4fc';
  ctx.fillStyle = labelColor;
  ctx.font = `bold ${Math.round(h * 0.016)}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`✦ ${shiftLabel}  ·  ${t('room.crew', { count })}`, bx + bw / 2, by + bh / 2);
}

// ---------------------------------------------------------------------------
// Furniture rendering
// ---------------------------------------------------------------------------

interface DrawDeskOptions {
  x: number;
  y: number;
  w: number;
  h: number;
  facing: 'left' | 'right' | 'front';
  hasMonitor: boolean;
  assignedName: string | null;
  timeOfDay: number;
}

/** Draw a single mission-control console desk. */
function drawDesk(ctx: CanvasRenderingContext2D, opts: DrawDeskOptions): void {
  const { x, y, w, h: height, hasMonitor, assignedName, timeOfDay } = opts;

  // Desk surface (dark gray industrial)
  ctx.fillStyle = '#3a3c40';
  ctx.strokeStyle = '#55575c';
  ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, height, 2);
  ctx.fill();
  ctx.stroke();

  // Front panel with slight highlight
  ctx.fillStyle = '#2e3035';
  ctx.fillRect(x + 2, y + height * 0.3, w - 4, height * 0.4);

  // Monitor if present
  if (hasMonitor) {
    drawMonitor(ctx, x + w * 0.08, y - height * 0.1, w * 0.84, height * 0.22, assignedName, timeOfDay);
  }

  // Nameplate
  if (assignedName) {
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.font = `${Math.round(height * 0.18)}px "Courier New", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(assignedName.toUpperCase(), x + w / 2, y + height * 0.55);
  }

  // Cables underneath
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const cx = x + w * (0.2 + i * 0.25);
    ctx.moveTo(cx, y + height);
    ctx.bezierCurveTo(
      cx - 3, y + height + 4,
      cx + 3, y + height + 8,
      cx - 2, y + height + 12,
    );
    ctx.stroke();
  }
}

/** Draw a monitor on a desk with live per-kerbal data. */
function drawMonitor(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  assignedName: string | null,
  timeOfDay: number,
): void {
  // Monitor casing
  ctx.fillStyle = '#1c1c24';
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  roundRect(ctx, x - 1, y - 1, w + 2, h * 0.9 + 2, 2);
  ctx.fill();
  ctx.stroke();

  // Screen surface
  const screenX = x + 2;
  const screenY = y + 2;
  const screenW = w - 4;
  const screenH = h * 0.9 - 4;

  const glowIntensity = 0.7 + 0.3 * (1 - timeOfDay); // brighter at night
  ctx.fillStyle = `rgba(20, 40, 30, ${glowIntensity})`;
  roundRect(ctx, screenX, screenY, screenW, screenH, 1);
  ctx.fill();

  const now = Date.now();
  const kerbal = assignedName ? kerbalStore.getByName(assignedName) : undefined;

  // Base font size scales with screen height
  const fs = Math.max(5, Math.round(screenH * 0.14));
  const padding = 2;

  ctx.textBaseline = 'top';

  if (!kerbal || !kerbal.present) {
    // ---- Off-shift / unassigned state ----
    ctx.fillStyle = `rgba(80, 100, 90, ${0.4 + 0.15 * Math.sin(now / 2500)})`;
    ctx.font = `${fs}px "Courier New", monospace`;
    ctx.textAlign = 'left';
    const label = kerbal ? 'OFF-SHIFT' : 'UNASSIGNED';
    ctx.fillText(label, screenX + padding, screenY + screenH * 0.35);

    // Dimmed screen reflection
    const dimReflection = ctx.createLinearGradient(x, y + h * 0.9, x, y + h * 0.9 + 6);
    dimReflection.addColorStop(0, `rgba(80, 100, 90, ${0.06 * glowIntensity})`);
    dimReflection.addColorStop(1, 'rgba(80, 100, 90, 0)');
    ctx.fillStyle = dimReflection;
    ctx.fillRect(x, y + h * 0.9, w, 6);
    return;
  }

  // ---- Live kerbal state ----

  // Mood color
  const moodColor = (() => {
    switch (kerbal.mood) {
      case 'excited': case 'ecstatic': return '#66ff66';
      case 'tired': case 'groggy': return '#ffaa33';
      case 'annoyed': case 'anxious': return '#ff6644';
      default: return '#80ffcc';
    }
  })();

  const intensity = kerbal.moodIntensity ?? 0.5;

  // 1. Name line with mood dot
  const nameY = screenY + 3;
  ctx.textAlign = 'left';
  ctx.font = `bold ${fs}px "Courier New", monospace`;

  // Mood dot
  ctx.fillStyle = moodColor;
  ctx.fillText('●', screenX + padding, nameY);

  // Name
  ctx.fillStyle = `rgba(200, 255, 220, ${0.85 + 0.15 * Math.sin(now / 1800 + hashString(assignedName!))})`;
  const nameX = screenX + padding + fs * 1.2;
  ctx.fillText(kerbal.name.toUpperCase(), nameX, nameY);

  // 2. Position status line
  const posY = nameY + fs * 1.4;
  const posColor = kerbal.position === 'desk' ? '#80ffcc'
    : kerbal.position === 'coffee' ? '#ffcc44'
    : kerbal.position === 'entering' || kerbal.position === 'leaving' ? '#66aaff'
    : '#ff8844';
  const posLabel = (() => {
    switch (kerbal.position) {
      case 'desk': return 'ACTIVE';
      case 'coffee': return '☕ COFFEE';
      case 'break': return 'BREAK';
      case 'entering': return 'ARRIVING';
      case 'leaving': return 'DEPARTING';
      case 'bathroom': return 'RESTROOM';
      case 'lunch': return 'LUNCH';
      case 'snack': return 'SNACK';
      default: return kerbal.position.toUpperCase();
    }
  })();

  ctx.font = `${Math.round(fs * 0.75)}px "Courier New", monospace`;
  ctx.fillStyle = posColor;
  ctx.textAlign = 'left';
  ctx.fillText(posLabel, screenX + padding, posY);

  // 3. Mood intensity bar (animated waveform)
  const barY = posY + fs * 1.2;
  const barH = Math.max(2, Math.round(screenH * 0.12));
  const barW = screenW - padding * 2;

  // Bar background
  ctx.fillStyle = 'rgba(60, 60, 80, 0.5)';
  ctx.fillRect(screenX + padding, barY, barW, barH);

  // Fill bar to intensity
  const fillW = barW * intensity;
  ctx.fillStyle = moodColor;
  ctx.globalAlpha = 0.6 + 0.3 * (0.5 + 0.5 * Math.sin(now / 1200 + hashString(assignedName!)));
  ctx.fillRect(screenX + padding, barY, fillW, barH);
  ctx.globalAlpha = 1;

  // Bar border
  ctx.strokeStyle = 'rgba(80, 255, 180, 0.3)';
  ctx.lineWidth = 0.4;
  ctx.strokeRect(screenX + padding, barY, barW, barH);

  // 4. Blinking activity dot
  const dotY = barY + barH + fs * 0.3;
  ctx.fillStyle = `rgba(80, 255, 180, ${0.3 + 0.4 * (0.5 + 0.5 * Math.sin(now / 600 + hashString(assignedName!)))})`;
  ctx.beginPath();
  ctx.arc(screenX + padding + 3, dotY + 1.5, 1.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(80, 255, 180, ${0.15 + 0.1 * Math.sin(now / 1400)})`;
  ctx.font = `${Math.round(fs * 0.5)}px "Courier New", monospace`;
  ctx.textAlign = 'left';
  ctx.fillText('SYS OK', screenX + padding + 5, dotY);

  // 5. Scan-line flicker overlay (thin, adds terminal feel)
  ctx.strokeStyle = 'rgba(50, 255, 180, 0.04)';
  ctx.lineWidth = 0.3;
  for (let i = 0; i < 4; i++) {
    const ly = screenY + (screenH / 5) * (i + 1) + Math.sin(now / 2000 + i) * 0.5;
    ctx.beginPath();
    ctx.moveTo(screenX + 1, ly);
    ctx.lineTo(screenX + screenW - 1, ly);
    ctx.stroke();
  }

  // Screen glow reflection onto desk
  const reflectionGrad = ctx.createLinearGradient(x, y + h * 0.9, x, y + h * 0.9 + 8);
  reflectionGrad.addColorStop(0, `rgba(${kerbal.position === 'desk' ? '80,255,180' : '255,200,100'}, ${0.12 * glowIntensity})`);
  reflectionGrad.addColorStop(1, 'rgba(80, 255, 180, 0)');
  ctx.fillStyle = reflectionGrad;
  ctx.fillRect(x, y + h * 0.9, w, 8);
}

/** Draw an office chair at a desk position (static, doesn't move with kerbal). */
function drawChairAtDesk(ctx: CanvasRenderingContext2D, deskX: number, deskY: number): void {
  const x = deskX;
  const seatY = deskY - 3;

  // Centre pillar + base
  ctx.fillStyle = '#222222';
  ctx.fillRect(x - 0.8, seatY, 1.6, deskY - seatY + 2);
  ctx.strokeStyle = '#333333';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2.5) {
    ctx.beginPath();
    ctx.moveTo(x, deskY + 1.5);
    ctx.lineTo(x + Math.cos(angle) * 5.5, deskY + 2.5);
    ctx.stroke();
  }
  ctx.fillStyle = '#1a1a1a';
  for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 2.5) {
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * 5.5, deskY + 2.5, 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // Seat cushion
  ctx.fillStyle = '#3a3a3e';
  ctx.strokeStyle = '#1e1e22';
  ctx.lineWidth = 0.6;
  roundRect(ctx, x - 7, seatY - 1.5, 14, 3, 1.5);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  roundRect(ctx, x - 5.5, seatY - 1.2, 11, 1.2, 0.8);
  ctx.fill();

  // Armrests
  ctx.strokeStyle = '#2a2a2e';
  ctx.lineWidth = 1.2;
  ctx.lineCap = 'round';
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.moveTo(x + side * 6, seatY - 1);
    ctx.lineTo(x + side * 6, deskY - 7);
    ctx.stroke();
  });
  ctx.fillStyle = '#2e2e32';
  [-1, 1].forEach((side) => {
    roundRect(ctx, x + side * 6 - 2, deskY - 7.5, 4, 1.8, 0.8);
    ctx.fill();
  });

  // Backrest
  ctx.strokeStyle = '#2a2a2e';
  ctx.lineWidth = 1;
  [-1, 1].forEach((side) => {
    ctx.beginPath();
    ctx.moveTo(x + side * 4.5, seatY - 1);
    ctx.lineTo(x + side * 4.5, deskY - 16);
    ctx.stroke();
  });
  ctx.fillStyle = '#3a3a3e';
  ctx.strokeStyle = '#1e1e22';
  ctx.lineWidth = 0.6;
  roundRect(ctx, x - 6.5, deskY - 17, 13, 10, 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.03)';
  ctx.lineWidth = 0.4;
  for (let ly = deskY - 16; ly < deskY - 8; ly += 1.8) {
    ctx.beginPath();
    ctx.moveTo(x - 5, ly);
    ctx.lineTo(x + 5, ly);
    ctx.stroke();
  }
}

/** Draw the coffee station on the floor in the right corner. */
function drawCoffeeStation(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const cx = w * 0.76;
  const cy = h * 0.80;

  // Counter
  ctx.fillStyle = '#4a4c50';
  ctx.strokeStyle = '#6a6c70';
  ctx.lineWidth = 1;
  roundRect(ctx, cx - w * 0.04, cy, w * 0.08, h * 0.04, 3);
  ctx.fill();
  ctx.stroke();

  // Coffee machine body
  ctx.fillStyle = '#2a2a30';
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  roundRect(ctx, cx - w * 0.025, cy - h * 0.065, w * 0.05, h * 0.06, 2);
  ctx.fill();
  ctx.stroke();

  // Coffee pot
  ctx.fillStyle = 'rgba(60, 40, 20, 0.7)';
  roundRect(ctx, cx + w * 0.006, cy - h * 0.04, w * 0.012, h * 0.035, 1);
  ctx.fill();

  // Steam
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 0.7;
  for (let i = 0; i < 2; i++) {
    const sx = cx + w * 0.01 + i * w * 0.006;
    const sy = cy - h * 0.068 - Math.sin(Date.now() / 1200 + i) * 1.5;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.quadraticCurveTo(sx + 1, sy - 3, sx, sy - 5);
    ctx.stroke();
  }

  // "COFFEE" label
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = `${Math.round(h * 0.011)}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.fillText(t('room.coffee'), cx, cy + h * 0.065);
}

/** Door width as fraction of display width. */
const DOOR_WIDTH_RATIO = 0.08;
/** Door height as fraction of display height. */
const DOOR_HEIGHT_RATIO = 0.22;

/** Draw the exit door on the back wall near the entrance — slides horizontally. */
function drawDoor(ctx: CanvasRenderingContext2D, displayW: number, displayH: number, slideOffset: number = 0): void {
  const cx = (DOOR_POSITION.x / 100) * displayW;
  const cy = (DOOR_POSITION.y / 100) * displayH;
  const dw = displayW * DOOR_WIDTH_RATIO;
  const dh = displayH * DOOR_HEIGHT_RATIO;
  const s = Math.min(displayW, displayH) / 720;

  // Door frame (dark industrial steel) — stays fixed
  ctx.fillStyle = '#3a3c40';
  ctx.fillRect(cx - dw / 2, cy - dh, dw, dh);

  // Frame border rivets
  ctx.strokeStyle = '#55575c';
  ctx.lineWidth = 2 * s;
  ctx.strokeRect(cx - dw / 2 + 1, cy - dh + 1, dw - 2, dh - 2);

  // Top sliding rail (industrial metal)
  ctx.fillStyle = '#50555c';
  ctx.fillRect(cx - dw / 2 - 6 * s, cy - dh - 4 * s, dw + 12 * s, 6 * s);
  ctx.fillStyle = '#656a72';
  ctx.fillRect(cx - dw / 2 - 4 * s, cy - dh - 2 * s, dw + 8 * s, 2 * s);

  // Outside light through door gap
  if (slideOffset > 1) {
    const gapWidth = Math.min(slideOffset, dw - 4 * s);
    const grad = ctx.createLinearGradient(cx - dw / 2, 0, cx - dw / 2 + gapWidth, 0);
    grad.addColorStop(0, 'rgba(255,200,100,0.35)');
    grad.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(cx - dw / 2, cy - dh + 2 * s, gapWidth, dh - 4 * s);
  }

  // Door panel (metallic gray-blue) — slides right
  const doorX = cx - dw / 2 + 2 * s + slideOffset;
  ctx.fillStyle = '#8a9aa8';
  ctx.fillRect(doorX, cy - dh + 2 * s, dw - 4 * s, dh - 4 * s);

  // Panel border (darker metallic edge)
  ctx.strokeStyle = '#6a7a88';
  ctx.lineWidth = 1.5 * s;
  ctx.strokeRect(doorX + 2 * s, cy - dh + 4 * s, dw - 8 * s, dh - 8 * s);

  // Top inset panel on door
  ctx.fillStyle = '#748494';
  roundRect(ctx, doorX + 4 * s, cy - dh + 6 * s, dw - 12 * s, dh * 0.3, 3 * s);
  ctx.fill();

  // Bottom inset panel on door
  ctx.fillStyle = '#748494';
  roundRect(ctx, doorX + 4 * s, cy - dh * 0.52, dw - 12 * s, dh * 0.36, 3 * s);
  ctx.fill();

  // Warning stripes (yellow/black hazard) at bottom of door
  const stripeY = cy - 6 * s;
  const stripeH = 6 * s;
  ctx.save();
  ctx.beginPath();
  ctx.rect(doorX + 3 * s, stripeY, dw - 10 * s, stripeH);
  ctx.clip();
  const stripeW = 8 * s;
  for (let sx = doorX + 3 * s; sx < doorX + dw - 3 * s; sx += stripeW * 2) {
    ctx.fillStyle = '#ffcc00';
    ctx.fillRect(sx, stripeY, stripeW, stripeH);
    ctx.fillStyle = '#333333';
    ctx.fillRect(sx + stripeW, stripeY, stripeW, stripeH);
  }
  ctx.restore();

  // Chrome handle (slides with door)
  ctx.fillStyle = '#c0c8d0';
  ctx.shadowColor = 'rgba(0,0,0,0.3)';
  ctx.shadowBlur = 3 * s;
  roundRect(ctx, doorX + dw - 10 * s, cy - dh * 0.55, 4 * s, dh * 0.15, 2 * s);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#909aa5';
  roundRect(ctx, doorX + dw - 9 * s, cy - dh * 0.53, 2 * s, dh * 0.11, 1 * s);
  ctx.fill();

  // RED "EXIT" sign above door — KSC style
  ctx.fillStyle = '#cc2222';
  roundRect(ctx, cx - 14 * s, cy - dh - 8 * s, 28 * s, 6 * s, 2 * s);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${4 * s}px "Courier New", monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('EXIT', cx, cy - dh - 5 * s);

  // Small green indicator light (next to EXIT sign)
  ctx.fillStyle = slideOffset > 5 ? '#33cc33' : '#66ee66';
  ctx.beginPath();
  ctx.arc(cx + 18 * s, cy - dh - 5 * s, 2 * s, 0, Math.PI * 2);
  ctx.fill();
}

// ---------------------------------------------------------------------------
// Coffee cups on desks
// ---------------------------------------------------------------------------

interface CoffeeCup {
  deskId: string;
  deskX: number;
  deskY: number;
  deskW: number;
  deskH: number;
  placedAt: number; // timestamp
}

let coffeeCups: CoffeeCup[] = [];

/** Possibly add a coffee cup on a random occupied desk. */
function maybeAddCoffeeCup(deskRenderData: Array<{ deskId: string; deskX: number; deskY: number; deskW: number; deskH: number }>): void {
  if (coffeeCups.length >= MAX_COFFEE_CUPS) return;
  // Only occasionally add cups
  if (Math.random() > 0.003) return;

  const occupied = deskRenderData.filter(
    (d) => !coffeeCups.some((c) => c.deskId === d.deskId),
  );
  if (occupied.length === 0) return;

  const pick = occupied[Math.floor(Math.random() * occupied.length)];
  coffeeCups.push({ ...pick, placedAt: Date.now() });
}

/** Remove cups older than a threshold to keep things tidy. */
function evictOldCoffeeCups(): void {
  const now = Date.now();
  coffeeCups = coffeeCups.filter((c) => now - c.placedAt < 30000);
}

function drawCoffeeCups(ctx: CanvasRenderingContext2D): void {
  for (const cup of coffeeCups) {
    const cx = cup.deskX + cup.deskW * 0.75;
    const cy = cup.deskY + cup.deskH * 0.1;

    // Cup
    ctx.fillStyle = '#f0ede5';
    ctx.strokeStyle = '#bbb';
    ctx.lineWidth = 0.6;
    roundRect(ctx, cx, cy, cup.deskW * 0.1, cup.deskH * 0.22, 1.2);
    ctx.fill();
    ctx.stroke();

    // Handle
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.arc(cx + cup.deskW * 0.1, cy + cup.deskH * 0.08, cup.deskW * 0.03, 0, Math.PI * 1.3);
    ctx.stroke();

    // Steam
    const elapsed = (Date.now() - cup.placedAt) / 1000;
    if (elapsed < 15) {
      ctx.strokeStyle = `rgba(255,255,255,${0.15 * (1 - elapsed / 15)})`;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      const sy = cy - 2 - elapsed * 0.3;
      ctx.moveTo(cx + cup.deskW * 0.05, sy);
      ctx.quadraticCurveTo(cx + cup.deskW * 0.05 + 1, sy - 2, cx + cup.deskW * 0.05, sy - 3);
      ctx.stroke();
    }
  }
}

// ---------------------------------------------------------------------------
// Lighting overlay
// ---------------------------------------------------------------------------

function drawLightingOverlay(ctx: CanvasRenderingContext2D, w: number, h: number, timeOfDay: number): void {
  // Day = warm, Night = cool blue
  const r = Math.round(lerp(20, 40, timeOfDay));  // red at night is low
  const g = Math.round(lerp(20, 45, timeOfDay));
  const b = Math.round(lerp(60, 30, timeOfDay));  // blue at night is high
  const alpha = 0.08 + 0.1 * (1 - timeOfDay); // stronger tint at night

  ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
  ctx.fillRect(0, 0, w, h);

  // Vignette
  const vignetteGrad = ctx.createRadialGradient(w / 2, h / 2, w * 0.35, w / 2, h / 2, w * 0.75);
  vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
  vignetteGrad.addColorStop(1, `rgba(0,0,0,${0.25 + 0.15 * (1 - timeOfDay)})`);
  ctx.fillStyle = vignetteGrad;
  ctx.fillRect(0, 0, w, h);
}

// ---------------------------------------------------------------------------
// Utility functions
// ---------------------------------------------------------------------------

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => {
    const v = parseInt(hex.slice(1), 16);
    return [(v >> 16) & 0xff, (v >> 8) & 0xff, v & 0xff];
  };
  const ca = parse(a);
  const cb = parse(b);
  const r = Math.round(lerp(ca[0], cb[0], t));
  const g = Math.round(lerp(ca[1], cb[1], t));
  const bl = Math.round(lerp(ca[2], cb[2], t));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

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

// ---------------------------------------------------------------------------
// Autonomous kerbal activity system
// ---------------------------------------------------------------------------

type AwayActivity = 'coffee' | 'visit' | 'stretch' | 'wander' | 'bathroom' | 'lunch';

interface AwayState {
  activity: AwayActivity;
  deskX: number;
  deskY: number;
  targetX: number;
  targetY: number;
  arrivedAt: number;     // timestamp when they reached the target
  activityDuration: number; // ms to stay at target
}

const ACTIVITY_CHECK_INTERVAL = 45_000; // check every 45 seconds
const ACTIVITY_CHANCE = 0.12;           // 12% chance per eligible kerbal per check

function getCoffeeStationPos(displayW: number, displayH: number): { x: number; y: number } {
  return { x: displayW * 0.76, y: displayH * 0.80 };
}

function getRandomFloorPos(displayW: number, displayH: number): { x: number; y: number } {
  return {
    x: displayW * (0.25 + Math.random() * 0.45),
    y: displayH * (0.80 + Math.random() * 0.10),
  };
}

// ---------------------------------------------------------------------------
// Draw-item types for unified z-sorted rendering
// ---------------------------------------------------------------------------

const DrawItemType = {
  desk: 'desk',
  sprite: 'sprite',
  'coffee-station': 'coffee-station',
  'coffee-cup': 'coffee-cup',
  door: 'door',
  chair: 'chair',
} as const;

type DrawItemType = (typeof DrawItemType)[keyof typeof DrawItemType];

interface DrawItem {
  y: number;
  itemType: DrawItemType;
  desk?: DeskPosition;
  sprite?: KerbalSprite;
  /** For split-rendering sitting kerbals. 'lower'=legs+chair behind desk, 'upper'=torso+head above desk. */
  renderPart?: 'full' | 'lower' | 'upper';
}

// ---------------------------------------------------------------------------
// RoomCanvas Component
// ---------------------------------------------------------------------------

const RoomCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const spritesRef = useRef<Map<string, KerbalSprite>>(new Map());
  const rafIdRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const prevPresentRef = useRef<Set<string>>(new Set());
  /** True after the first sync — prevents walk-in animation on page load. */
  const initialisedRef = useRef(false);
  /** Whether the door is currently open (kerbal proximity toggles). */
  const doorOpenRef = useRef(false);
  /** Slide offset (0 = closed, >0 = slid to the right). */
  const doorSlideOffsetRef = useRef(0);
  /** Timer ID for auto-closing the door after a kerbal passes through. */
  const doorAutoCloseTimerRef = useRef<number | null>(null);

  /**
   * Tracks kerbals that are currently in an entering or leaving transition,
   * so we don't re-trigger the same transition on every store update.
   */
  const transitioningRef = useRef<Map<string, 'entering' | 'leaving'>>(new Map());

  /** Tracks kerbals away from their desk doing autonomous activities. */
  const awayStatesRef = useRef<Map<string, AwayState>>(new Map());

  const sizesRef = useRef<{ w: number; h: number; displayW: number; displayH: number }>({
    w: 1280,
    h: 720,
    displayW: 1280,
    displayH: 720,
  });

  // -----------------------------------------------------------------------
  // Sizing
  // -----------------------------------------------------------------------

  const updateSizes = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const rect = container.getBoundingClientRect();
    let displayW = rect.width;
    let displayH = rect.height;

    // Clamp to 16:9
    if (displayW / displayH > ASPECT_RATIO) {
      displayW = displayH * ASPECT_RATIO;
    } else {
      displayH = displayW / ASPECT_RATIO;
    }

    const dpr = window.devicePixelRatio || 1;
    const w = Math.round(displayW * dpr);
    const h = Math.round(displayH * dpr);

    canvas.width = w;
    canvas.height = h;
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;

    sizesRef.current = { w, h, displayW, displayH };
  }, []);

  // -----------------------------------------------------------------------
  // Look up assigned desk for a kerbal by name
  // -----------------------------------------------------------------------

  function getDeskForKerbalFromLayout(name: string): { x: number; y: number } | undefined {
    const desk = DESK_POSITIONS.find((d) => d.assignedKerbal === name);
    return desk ? { x: desk.x, y: desk.y } : undefined;
  }

  /** Calculate the chair position (desk center X + desk bottom Y) for a given desk. */
  function getChairTargetXY(desk: { x: number; y: number }, displayW: number, displayH: number): { x: number; y: number } {
    const dx = (desk.x / 100) * displayW;
    const dy = (desk.y / 100) * displayH;
    // dw = displayW * 0.09, dh = displayH * 0.12
    // Chair is at dx + dw/2, dy + dh*0.45
    return { x: dx + displayW * 0.045, y: dy + displayH * 0.054 };
  }

  // -----------------------------------------------------------------------
  // Sync sprites with kerbalStore  (called only when store changes)
  // -----------------------------------------------------------------------

  const syncSprites = useCallback(() => {
    const present = kerbalStore.getPresent();
    const presentNames = new Set(present.map((k: KerbalState) => k.name));
    console.log('[DBG] syncSprites called, present:', present.map(k => k.name), 'existing sprites:', Array.from(spritesRef.current.keys()));

    const { displayW, displayH } = sizesRef.current;
    const entranceX = (ENTRANCE_POSITION.x / 100) * displayW;
    const entranceY = (ENTRANCE_POSITION.y / 100) * displayH;

    const isInitial = !initialisedRef.current;
    initialisedRef.current = true;

    // --- New arrivals: kerbals who just became present ---
    for (const kerbal of present) {
      if (spritesRef.current.has(kerbal.name)) continue;
      if (transitioningRef.current.has(kerbal.name)) continue;

      const desk = getDeskForKerbalFromLayout(kerbal.name);
      const stubSoul: KerbalSoul = {
        name: kerbal.name,
        role: '',
        courage: 50,
        stupidity: 50,
        badS: false,
        personality: '',
        knowledge: [],
        speechStyle: '',
        catchphrases: [],
        rawMarkdown: '',
      };

      if (isInitial && desk) {
        // First load — spawn at chair already sitting, no walk-in
        const chairPos = getChairTargetXY(desk, displayW, displayH);
        const sx = chairPos.x;
        const sy = chairPos.y;
        const sprite = new KerbalSprite(kerbal.name, stubSoul, sx, sy);
        sprite.setState('sitting');
        spritesRef.current.set(kerbal.name, sprite);
      } else {
        // Actual arrival — walk in from entrance to chair
        const targetPos = desk ? getChairTargetXY(desk, displayW, displayH) : null;
        const targetX = targetPos ? targetPos.x : entranceX;
        const targetY = targetPos ? targetPos.y : entranceY;
        const sprite = new KerbalSprite(kerbal.name, stubSoul, entranceX, entranceY);
        sprite.setState('entering');
        sprite.moveTo(targetX, targetY, WALK_DURATION);
        spritesRef.current.set(kerbal.name, sprite);
        transitioningRef.current.set(kerbal.name, 'entering');
      }
    }

    // --- Departures: kerbals who just left ---
    for (const [name, sprite] of spritesRef.current.entries()) {
      if (!presentNames.has(name)) {
        if (!transitioningRef.current.has(name)) {
          sprite.setState('leaving');
          sprite.moveTo(entranceX, entranceY, LEAVE_DURATION);
          transitioningRef.current.set(name, 'leaving');
        }
      }
    }

    // --- "Coming back": kerbal was leaving but is now present again ---
    for (const kerbal of present) {
      if (transitioningRef.current.get(kerbal.name) === 'leaving') {
        const sprite = spritesRef.current.get(kerbal.name);
        if (sprite) {
          const desk = getDeskForKerbalFromLayout(kerbal.name);
          if (desk) {
            const chairPos = getChairTargetXY(desk, displayW, displayH);
            sprite.setState('entering');
            sprite.moveTo(
              chairPos.x,
              chairPos.y,
              WALK_DURATION * 0.5,
            );
            transitioningRef.current.set(kerbal.name, 'entering');
          }
        }
      }
    }

    prevPresentRef.current = presentNames;
  }, []);

  // -----------------------------------------------------------------------
  // Load real soul data into sprites (replaces stub souls used during init)
  // -----------------------------------------------------------------------

  const soulsLoadedRef = useRef<Set<string>>(new Set());

  const loadSoulsIntoSprites = useCallback(() => {
    for (const [name] of spritesRef.current.entries()) {
      if (soulsLoadedRef.current.has(name)) continue;
      SoulLoader.load(name).then((soul) => {
        if (spritesRef.current.has(name)) {
          spritesRef.current.get(name)!.updateSoul(soul);
          soulsLoadedRef.current.add(name);
        }
      }).catch(() => {
        // Soul file not found — keep stub soul
      });
    }
  }, []);

  // -----------------------------------------------------------------------
  // Main render loop
  // -----------------------------------------------------------------------

  const renderLoop = useCallback((timestamp: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { w, h, displayW, displayH } = sizesRef.current;
    const deltaTime = lastTimeRef.current ? timestamp - lastTimeRef.current : 16;
    lastTimeRef.current = timestamp;

    const timeState: TimeState = timeSystem.getTime();
    const timeOfDay = (timeState.currentHour + timeState.currentMinute / 60) / 24; // 0..1, 0=midnight, 0.5=noon

    // ---- 1. Clear ----
    ctx.clearRect(0, 0, w, h);

    // ---- 2. Background (walls, floor, screen, posters) ----
    ctx.save();
    ctx.scale(w / displayW, h / displayH);
    drawBackground(ctx, displayW, displayH, timeOfDay);
    ctx.restore();

    // ---- 3. Update all sprites (once per frame) ----
    if (spritesRef.current.size === 0 && Math.random() < 0.01) {
      console.log('[DBG] renderLoop: spritesRef is EMPTY');
    }
    for (const sprite of spritesRef.current.values()) {
      sprite.update(deltaTime);
    }

    // ---- 3b. Animate door with smooth slide ----
    const doorWidth = displayW * DOOR_WIDTH_RATIO;
    const DOOR_TARGET_OFFSET = doorOpenRef.current ? doorWidth : 0;
    doorSlideOffsetRef.current += (DOOR_TARGET_OFFSET - doorSlideOffsetRef.current) * 0.08;
    // Snap when close enough to prevent micro-gaps
    if (Math.abs(doorSlideOffsetRef.current - DOOR_TARGET_OFFSET) < 0.5) {
      doorSlideOffsetRef.current = DOOR_TARGET_OFFSET;
    }

    // ---- 3b2. Auto-open door when kerbals approach/leave ----
    // Use entrance floor position (not door wall position) — kerbals walk the floor
    const entrancePixelX = (ENTRANCE_POSITION.x / 100) * displayW;
    const entrancePixelY = (ENTRANCE_POSITION.y / 100) * displayH;
    let kerbalNearDoor = false;
    for (const sprite of spritesRef.current.values()) {
      const pos = sprite.getPosition();
      const dist = Math.hypot(pos.x - entrancePixelX, pos.y - entrancePixelY);
      if (dist < 40) {
        kerbalNearDoor = true;
        break;
      }
    }
    if (kerbalNearDoor) {
      doorOpenRef.current = true;
      if (doorAutoCloseTimerRef.current !== null) {
        clearTimeout(doorAutoCloseTimerRef.current);
        doorAutoCloseTimerRef.current = null;
      }
    } else if (doorOpenRef.current && doorAutoCloseTimerRef.current === null) {
      doorAutoCloseTimerRef.current = window.setTimeout(() => {
        doorOpenRef.current = false;
        doorAutoCloseTimerRef.current = null;
      }, 2000);
    }

    // ---- 3c. Check for bathroom/lunch kerbals ready to return ----
    const { displayW: dw, displayH: dh } = sizesRef.current;
    const doorSpawnX = (DOOR_POSITION.x / 100) * dw;
    const doorSpawnY = (DOOR_POSITION.y / 100) * dh;

    for (const [name, away] of awayStatesRef.current.entries()) {
      if ((away.activity === 'bathroom' || away.activity === 'lunch') && away.arrivedAt > 0) {
        if (!spritesRef.current.has(name) && Date.now() - away.arrivedAt >= away.activityDuration) {
          // Kerbal returns from bathroom/lunch — spawn at entrance and walk to desk
          const stubSoul: KerbalSoul = {
            name,
            role: '',
            courage: 50,
            stupidity: 50,
            badS: false,
            personality: '',
            knowledge: [],
            speechStyle: '',
            catchphrases: [],
            rawMarkdown: '',
          };
          const sprite = new KerbalSprite(name, stubSoul, doorSpawnX, doorSpawnY);
          sprite.setState('entering');
          const desk = getDeskForKerbalFromLayout(name);
          if (desk) {
            const chairPos = getChairTargetXY(desk, dw, dh);
            sprite.moveTo(
              chairPos.x,
              chairPos.y,
              WALK_DURATION + Math.random() * 1000,
            );
          }
          spritesRef.current.set(name, sprite);
          transitioningRef.current.set(name, 'entering');
          awayStatesRef.current.delete(name);
          kerbalStore.returnFromBreak(name);
        }
      }
    }

    // ---- 4. Build sorted draw-item list for correct z-ordering ----
    //
    // The room uses a 2.5D top-down perspective where lower Y (closer to
    // the wall) = farther back.  We collect desks, sprites, and the
    // coffee station into a single list, sort by Y ascending, and
    // render back-to-front so nearer objects occlude farther ones.

    const drawItems: DrawItem[] = [];

    // Desks + chairs (separate draw items for correct z-ordering)
    for (const desk of DESK_POSITIONS) {
      drawItems.push({ y: desk.y, itemType: 'desk', desk });
      // Chair at floor level — renders BEFORE the desk, AFTER the door
      drawItems.push({ y: desk.y, itemType: 'chair', desk });
    }

    // Sprites (use their assigned desk Y for correct row z-ordering)
    // Sitting kerbals are split into TWO draw items for correct desk occlusion:
    //   lower (legs+shadow) renders BEFORE desk (zPriority=0)
    //   upper (body+head) renders AFTER desk (zPriority=2)
    for (const sprite of spritesRef.current.values()) {
      const desk = getDeskForKerbalFromLayout(sprite.name);
      let spriteY: number;
      if (sprite.state === 'sitting') {
        // Sitting sprites use desk Y (percentage) for row-based z-ordering so upper/lower
        // body parts sort correctly relative to the desk surface.
        spriteY = desk ? desk.y : sprite.getPosition().y;
      } else if (awayStatesRef.current.has(sprite.name)) {
        // Away-from-desk (coffee, visit, stretch, etc.): use actual pixel position
        // converted to percentage Y so the kerbal sorts at the correct z-order
        // position (e.g. coffee station Y ~80%) rather than at their assigned desk Y.
        spriteY = (sprite.getPosition().y / dh) * 100;
      } else {
        spriteY = desk ? desk.y : sprite.getPosition().y;
      }
      if (sprite.state === 'sitting') {
        drawItems.push({ y: spriteY, itemType: 'sprite', sprite, renderPart: 'lower' });
        drawItems.push({ y: spriteY, itemType: 'sprite', sprite, renderPart: 'upper' });
      } else {
        drawItems.push({ y: spriteY, itemType: 'sprite', sprite, renderPart: 'full' });
      }
    }

    // Coffee station — on the floor to the right
    drawItems.push({ y: 80, itemType: 'coffee-station' });

    // Exit door — on the back wall near the entrance
    drawItems.push({ y: DOOR_POSITION.y, itemType: 'door' });

    // Sort: lower Y first (back rows behind front rows);
    // Sitting sprites render after desks so kerbal's upper body is visible above desk surface;
    // non-sitting sprites render after desks (kerbal is in front of desk).
    drawItems.sort((a, b) => {
      if (a.y !== b.y) return a.y - b.y;
      return zPriority(a) - zPriority(b);
    });

    function zPriority(item: DrawItem): number {
      if (item.itemType === 'sprite' && item.sprite?.state === 'sitting') {
        // Both upper and lower body render BEHIND the desk (zPriority < desk=1).
        // The upper body's head naturally extends above the desk's visual Y-range,
        // so it appears visible above the desk surface while the body below is
        // properly hidden behind the desk — no floating effect.
        return 0;
      }
      switch (item.itemType) {
        case 'door':
          return -2;
        case 'chair':
          return -1;
        case 'sprite':
          return 3;
        case 'desk':
          return 1;
        case 'coffee-station':
          return 2;
        case 'coffee-cup':
          return 3;
      }
    }

    // ---- 5. Render draw items and detect completed transitions ----
    const toRemove: string[] = [];

    // Track which sprites have already had their transition logic run this frame.
    // Sitting kerbals have two draw items (lower+upper); the transition logic
    // (entering/leaving detect, activity handling, desk-return check) must
    // run only ONCE per sprite per frame to avoid double-processing.
    const transitionedThisFrame = new Set<string>();

    ctx.save();
    ctx.scale(w / displayW, h / displayH);

    for (const item of drawItems) {
      switch (item.itemType) {
        case 'desk': {
          if (item.desk) {
            const dx = (item.desk.x / 100) * displayW;
            const dy = (item.desk.y / 100) * displayH;
            const dw = displayW * 0.09;
            const dh = displayH * 0.12;
            const deskY = dy - dh * 0.55;

            // Desk surface only (chair is a separate draw item)
            drawDesk(ctx, {
              x: dx,
              y: deskY,
              w: dw,
              h: dh,
              facing: item.desk.facing,
              hasMonitor: item.desk.hasMonitor,
              assignedName: item.desk.assignedKerbal,
              timeOfDay,
            });
          }
          break;
        }
        case 'chair': {
          if (item.desk) {
            const dx = (item.desk.x / 100) * displayW;
            const dy = (item.desk.y / 100) * displayH;
            const dw = displayW * 0.09;
            const dh = displayH * 0.12;
            const deskBtmY = dy + dh * 0.45;
            drawChairAtDesk(ctx, dx + dw / 2, deskBtmY);
          }
          break;
        }
        case 'sprite': {
          if (item.sprite) {
            // Render only the specified part (or full for non-sitting kerbals)
            item.sprite.render(ctx, timeOfDay, item.renderPart);

            // Run transition/activity logic only ONCE per sprite per frame
            if (!transitionedThisFrame.has(item.sprite.name)) {
              transitionedThisFrame.add(item.sprite.name);

              // Check if a transition has completed
              const transition = transitioningRef.current.get(item.sprite.name);
              if (transition === 'entering' && !item.sprite.isMoving) {
                // Entering walk finished — sit at desk if assigned
                // (KerbalSprite.update now sets state to 'sitting' automatically
                // when entering movement completes; this just cleans up the tracking)
                transitioningRef.current.delete(item.sprite.name);
                const desk = getDeskForKerbalFromLayout(item.sprite.name);
                if (desk && item.sprite.state !== 'sitting') {
                  item.sprite.setState('sitting');
                }
              } else if (transition === 'leaving' && item.sprite.state === 'idle') {
                // Leaving walk finished — kerbal has reached the exit, remove sprite
                toRemove.push(item.sprite.name);
                transitioningRef.current.delete(item.sprite.name);
              }

              // ---- Autonomous activity handling ----
              const away = awayStatesRef.current.get(item.sprite.name);
              if (away && !item.sprite.isMoving) {
                const now = Date.now();
                // First frame after arrival — record the time
                if (away.arrivedAt === 0) {
                  away.arrivedAt = now;
                }
                const elapsed = now - away.arrivedAt;

                // Handle bathroom/lunch — kerbal leaves the room
                if (away.activity === 'bathroom' || away.activity === 'lunch') {
                  // Kerbal arrived at entrance, remove sprite (they leave the room)
                  if (elapsed < 100) {
                    toRemove.push(item.sprite.name);
                    kerbalStore.goOnBreak(item.sprite.name, away.activity as 'bathroom' | 'lunch', away.activityDuration);
                  }
                  // Do not do activity animations for bathroom/lunch
                  continue;
                }

                if (item.sprite.state === 'idle' && elapsed < away.activityDuration) {
                  // Just arrived at activity target — start the activity pose
                  if (away.activity === 'coffee') {
                    item.sprite.setState('drinking');
                  } else if (away.activity === 'stretch') {
                    item.sprite.setState('stretching');
                  } else if (away.activity === 'visit') {
                    item.sprite.setState('typing');
                  } else {
                    item.sprite.setState('idle');
                  }
                }

                if (elapsed >= away.activityDuration && item.sprite.state !== 'walking') {
                  // Activity done — walk back to desk
                  const desk = getDeskForKerbalFromLayout(item.sprite.name);
                  if (desk) {
                    const chairPos = getChairTargetXY(desk, displayW, displayH);
                    item.sprite.moveTo(chairPos.x, chairPos.y, 2000 + Math.random() * 1500);
                    awayStatesRef.current.delete(item.sprite.name);
                    // Will sit after arriving back (handled below)
                  }
                }
              }

              // Kerbal just walked back to desk from an activity — sit down
              if (!away && !item.sprite.isMoving && item.sprite.state === 'idle') {
                const desk = getDeskForKerbalFromLayout(item.sprite.name);
                if (desk) {
                  const chairPos = getChairTargetXY(desk, displayW, displayH);
                  const pos = item.sprite.getPosition();
                  const nearDesk = Math.abs(pos.x - chairPos.x) < 18 && Math.abs(pos.y - chairPos.y) < 18;
                  const isTransitioning = transitioningRef.current.has(item.sprite.name);
                  if (nearDesk && !isTransitioning) {
                    item.sprite.setState('sitting');
                  }
                }
              }
            }
          }
          break;
        }
        case 'coffee-station': {
          drawCoffeeStation(ctx, displayW, displayH);
          break;
        }
        case 'door': {
          drawDoor(ctx, displayW, displayH, doorSlideOffsetRef.current);
          break;
        }
      }
    }

    // Coffee cups (render on top of desks but under lighting)
    drawCoffeeCups(ctx);

    ctx.restore();

    // Clean up departed kerbals
    for (const name of toRemove) {
      spritesRef.current.delete(name);
    }

    // ---- 6. Lighting overlay ----
    ctx.save();
    ctx.scale(w / displayW, h / displayH);
    drawLightingOverlay(ctx, displayW, displayH, timeOfDay);
    ctx.restore();

    rafIdRef.current = requestAnimationFrame(renderLoop);
  }, []);

  // -----------------------------------------------------------------------
  // Effects
  // -----------------------------------------------------------------------

  useEffect(() => {
    updateSizes();
    // Defer first sync — the container may not have its final dimensions
    // until after the browser paints the layout.
    const frame = requestAnimationFrame(() => {
      updateSizes();
      syncSprites();
      // Load real soul data into sprites after initial sync
      loadSoulsIntoSprites();
    });

    rafIdRef.current = requestAnimationFrame(renderLoop);

    const handleResize = () => {
      updateSizes();
      // Reposition non-transitioning sprites proportionally
      const { displayW, displayH } = sizesRef.current;
      for (const [name, sprite] of spritesRef.current.entries()) {
        const transitioning = transitioningRef.current.has(name);
        if (!transitioning && !sprite.isMoving) {
          const desk = getDeskForKerbalFromLayout(name);
          if (desk) {
            const chairPos = getChairTargetXY(desk, displayW, displayH);
            sprite.setPosition(chairPos.x, chairPos.y);
          }
        }
      }
    };

    // Autonomous activity timer — kerbals wander around
    const activityInterval = setInterval(() => {
      const { displayW, displayH } = sizesRef.current;
      const coffeePos = getCoffeeStationPos(displayW, displayH);
      const entranceX = (ENTRANCE_POSITION.x / 100) * displayW;
      const entranceY = (ENTRANCE_POSITION.y / 100) * displayH;

      for (const [name, sprite] of spritesRef.current.entries()) {
        // Skip kerbals already busy
        if (transitioningRef.current.has(name)) continue;
        if (awayStatesRef.current.has(name)) continue;
        if (sprite.isMoving) continue;
        if (sprite.state !== 'sitting') continue;
        if (Math.random() > ACTIVITY_CHANCE) continue;

        const desk = getDeskForKerbalFromLayout(name);
        if (!desk) continue;

        const chairPos = getChairTargetXY(desk, displayW, displayH);
        const dx = chairPos.x;
        const dy = chairPos.y;

        // Choose activity
        const roll = Math.random();
        let activity: AwayActivity;
        let targetX: number;
        let targetY: number;
        let duration: number;

        if (roll < 0.2) {
          // Coffee run
          activity = 'coffee';
          targetX = coffeePos.x + (Math.random() - 0.5) * 30;
          targetY = coffeePos.y;
          duration = 5000 + Math.random() * 7000;
        } else if (roll < 0.35) {
          // Visit another kerbal's desk
          activity = 'visit';
          const otherDesks = DESK_POSITIONS.filter(d => d.assignedKerbal !== name && d.assignedKerbal);
          if (otherDesks.length === 0) continue;
          const pick = otherDesks[Math.floor(Math.random() * otherDesks.length)];
          const pickChair = getChairTargetXY(pick, displayW, displayH);
          targetX = pickChair.x;
          targetY = pickChair.y;
          duration = 4000 + Math.random() * 5000;
        } else if (roll < 0.5) {
          // Stretch near desk
          activity = 'stretch';
          targetX = dx + (Math.random() - 0.5) * 40;
          targetY = dy;
          duration = 3000 + Math.random() * 4000;
        } else if (roll < 0.65) {
          // Bathroom break — walk to entrance, leave, return
          activity = 'bathroom';
          targetX = entranceX;
          targetY = entranceY;
          duration = 180_000 + Math.random() * 300_000; // 3-8 minutes
        } else if (roll < 0.75) {
          // Lunch break — only during appropriate hours
          const currentHour = timeSystem.getTime().currentHour;
          const isLunchTime =
            (currentHour >= 10 && currentHour < 14) ||   // day shift (06-18)
            (currentHour >= 22 || currentHour < 2);        // night shift (18-06)
          if (!isLunchTime) {
            // Redirect to wander outside lunch hours
            activity = 'wander';
            const randPos = getRandomFloorPos(displayW, displayH);
            targetX = randPos.x;
            targetY = randPos.y;
            duration = 3000 + Math.random() * 5000;
          } else {
            activity = 'lunch';
            targetX = entranceX;
            targetY = entranceY;
            duration = 900_000 + Math.random() * 900_000; // 15-30 minutes
          }
        } else {
          // Wander to random floor spot
          activity = 'wander';
          const randPos = getRandomFloorPos(displayW, displayH);
          targetX = randPos.x;
          targetY = randPos.y;
          duration = 3000 + Math.random() * 5000;
        }

        // Send the kerbal on their way
        sprite.setState('walking');
        sprite.moveTo(targetX, targetY, 1500 + Math.random() * 2000);

        awayStatesRef.current.set(name, {
          activity,
          deskX: dx,
          deskY: dy,
          targetX,
          targetY,
          arrivedAt: 0, // set when they actually arrive
          activityDuration: duration,
        });
      }
    }, ACTIVITY_CHECK_INTERVAL);

    // Coffee cup timer
    const coffeeInterval = setInterval(() => {
      const { displayW, displayH } = sizesRef.current;
      const deskRenderData = DESK_POSITIONS.map((d) => ({
        deskId: d.id,
        deskX: (d.x / 100) * displayW,
        deskY: (d.y / 100) * displayH,
        deskW: displayW * 0.09,
        deskH: displayH * 0.12,
      }));
      maybeAddCoffeeCup(deskRenderData);
      evictOldCoffeeCups();
    }, 2000);

    window.addEventListener('resize', handleResize);

    // Subscribe to timeSystem ticks (rAF loop reads time on every frame,
    // but this ensures we catch shift changes promptly)
    const unsubTime = timeSystem.subscribe(() => {
      // The render loop already reads the current time each frame,
      // so nothing extra needed here.
    });

    // Subscribe to kerbalStore changes — sync sprites only when state changes
    const unsubStore = kerbalStore.subscribe(() => {
      syncSprites();
      loadSoulsIntoSprites();
    });

    // Subscribe to proactiveAgent — trigger 'reacting' animation on sprites
    const unsubProactive = proactiveAgent.onMessage((msg) => {
      const sprite = spritesRef.current.get(msg.kerbalName);
      if (sprite) {
        sprite.setState('reacting');
        // Revert to sitting after 2 seconds if still at desk
        setTimeout(() => {
          if (sprite.state === 'reacting') {
            const kerbal = kerbalStore.getByName(msg.kerbalName);
            if (kerbal && kerbal.position === 'desk') {
              sprite.setState('sitting');
            }
          }
        }, 2000);
      }
    });

    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(rafIdRef.current);
      clearInterval(activityInterval);
      clearInterval(coffeeInterval);
      window.removeEventListener('resize', handleResize);
      if (doorAutoCloseTimerRef.current !== null) {
        clearTimeout(doorAutoCloseTimerRef.current);
      }
      unsubTime();
      unsubStore();
      unsubProactive();
    };
  }, [updateSizes, syncSprites, loadSoulsIntoSprites, renderLoop]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full overflow-hidden bg-gray-950 flex items-center justify-center"
    >
      <canvas
        ref={canvasRef}
        className="block rounded shadow-2xl"
      />
    </div>
  );
};

export default RoomCanvas;
