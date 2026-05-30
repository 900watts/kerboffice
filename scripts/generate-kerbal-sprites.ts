/**
 * Procedural Kerbal sprite generator.
 * Generates all animation frames via Canvas (no external image assets).
 *
 * NOTE: This script requires the 'canvas' npm package (node-canvas).
 * For runtime rendering, use KerbalRenderer.ts in src/agents/ instead.
 *
 * Usage: npx tsx scripts/generate-kerbal-sprites.ts
 *
 * Prerequisites: npm install canvas (native dependency)
 */

import fs from 'fs';
import path from 'path';

export interface KerbalConfig {
  name: string;
  skinColor: string;
  helmetColor: string;
  suitColor: string;
  antennaStyle: 'straight' | 'curved' | 'double' | 'none';
  eyeStyle: 'normal' | 'goggles' | 'visor';
}

export const KERBAL_CONFIGS: KerbalConfig[] = [
  { name: 'Alice',   skinColor: '#7cc47c', helmetColor: '#ff6b00', suitColor: '#ff8c33', antennaStyle: 'straight', eyeStyle: 'goggles' },
  { name: 'Bob',     skinColor: '#6db86d', helmetColor: '#4488ff', suitColor: '#66aaff', antennaStyle: 'curved',  eyeStyle: 'normal' },
  { name: 'Carol',   skinColor: '#8ccf8c', helmetColor: '#ff44aa', suitColor: '#ff77bb', antennaStyle: 'double',  eyeStyle: 'visor' },
  { name: 'Dave',    skinColor: '#72bc72', helmetColor: '#ffcc00', suitColor: '#ffdd44', antennaStyle: 'straight', eyeStyle: 'normal' },
  { name: 'Eve',     skinColor: '#82c882', helmetColor: '#aa44ff', suitColor: '#bb66ff', antennaStyle: 'curved',  eyeStyle: 'goggles' },
  { name: 'Frank',   skinColor: '#68b468', helmetColor: '#44cc44', suitColor: '#66dd66', antennaStyle: 'none',    eyeStyle: 'visor' },
];

export const SPRITE_SIZE = 48;
const SPACING = 4;

export type AnimState = 'idle' | 'walk1' | 'walk2' | 'walk3' | 'walk4' | 'work' | 'coffee';
export const ANIM_FRAMES: AnimState[] = ['idle', 'walk1', 'walk2', 'walk3', 'walk4', 'work', 'coffee'];
const FRAMES_PER_ROW = ANIM_FRAMES.length;

function generateSpritesheet(): void {
  let createCanvas: any;
  try {
    createCanvas = require('canvas').createCanvas;
  } catch {
    console.error(
      '❌ The "canvas" native package is not installed.\n' +
      '   Install it: npm install canvas\n' +
      '   For runtime rendering without native deps, use src/agents/KerbalRenderer.ts (PIXI.Graphics).'
    );
    process.exit(1);
  }

  const cols = FRAMES_PER_ROW;
  const rows = KERBAL_CONFIGS.length;
  const totalW = cols * (SPRITE_SIZE + SPACING) + SPACING;
  const totalH = rows * (SPRITE_SIZE + SPACING) + SPACING;

  const cvs = createCanvas(totalW, totalH);
  const ctx = cvs.getContext('2d');

  ctx.clearRect(0, 0, totalW, totalH);

  KERBAL_CONFIGS.forEach((config, row) => {
    ANIM_FRAMES.forEach((frame, col) => {
      const x = SPACING + col * (SPRITE_SIZE + SPACING);
      const y = SPACING + row * (SPRITE_SIZE + SPACING);

      ctx.save();
      ctx.translate(x, y);
      drawKerbalCanvas(ctx, config, frame);
      ctx.restore();

      if (col === 0) {
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '8px monospace';
        ctx.fillText(config.name, x, y + SPRITE_SIZE + 10);
      }
    });
  });

  const outDir = path.join(__dirname, '..', 'assets', 'sprites');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const buffer = cvs.toBuffer('image/png');
  fs.writeFileSync(path.join(outDir, 'kerbals.png'), buffer);

  const meta = {
    spriteSize: SPRITE_SIZE,
    spacing: SPACING,
    totalFrames: FRAMES_PER_ROW,
    totalAgents: KERBAL_CONFIGS.length,
    frames: ANIM_FRAMES,
    agents: KERBAL_CONFIGS.map(c => ({ name: c.name, helmetColor: c.helmetColor, suitColor: c.suitColor })),
  };
  fs.writeFileSync(path.join(outDir, 'kerbals.json'), JSON.stringify(meta, null, 2));

  console.log(`✅ Generated spritesheet: ${outDir}/kerbals.png (${KERBAL_CONFIGS.length} Kerbals × ${FRAMES_PER_ROW} frames)`);
}

/**
 * Draw a single Kerbal frame on a Canvas2D context.
 * This is the reference implementation — the PIXI equivalent is in KerbalRenderer.ts.
 */
export function drawKerbalCanvas(ctx: CanvasRenderingContext2D, config: KerbalConfig, state: AnimState): void {
  const w = SPRITE_SIZE;
  const h = SPRITE_SIZE;
  const cx = w / 2;

  let bobY = 0;
  let legSpread = 0;
  if (state === 'walk1' || state === 'walk3') bobY = -1;
  if (state === 'walk2') { bobY = -2; legSpread = 3; }
  if (state === 'walk4') { bobY = -1; legSpread = -3; }

  // BODY
  ctx.fillStyle = config.suitColor;
  const bodyW = 20, bodyH = 14;
  const bodyY = 18 + bobY;
  roundRect(ctx, cx - bodyW / 2, bodyY, bodyW, bodyH, 4);
  ctx.fill();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(cx - 1, bodyY + 2, 2, bodyH - 4);

  // ARMS
  const armSwing = state === 'walk1' || state === 'walk3' ? 3 :
                   state === 'walk2' ? 5 : state === 'walk4' ? -5 : 0;
  ctx.fillStyle = config.suitColor;
  ctx.fillRect(cx - bodyW / 2 - 4, bodyY + 4 + armSwing, 4, 8);
  ctx.fillRect(cx + bodyW / 2, bodyY + 4 - armSwing, 4, 8);

  // LEGS
  ctx.fillStyle = '#555555';
  ctx.fillRect(cx - 6 + legSpread, bodyY + bodyH, 5, 7);
  ctx.fillRect(cx + 1 - legSpread, bodyY + bodyH, 5, 7);

  // HEAD
  const headR = 12;
  const headY = 6 + bobY;

  ctx.fillStyle = config.skinColor;
  ctx.beginPath();
  ctx.arc(cx, headY, headR, 0, Math.PI * 2);
  ctx.fill();

  // EYES
  ctx.fillStyle = '#ffffff';
  if (config.eyeStyle === 'visor') {
    ctx.fillStyle = '#222244';
    ctx.fillRect(cx - 9, headY - 4, 18, 6);
    ctx.fillStyle = '#88bbff';
    ctx.fillRect(cx - 7, headY - 3, 5, 4);
    ctx.fillRect(cx + 2, headY - 3, 5, 4);
  } else {
    ctx.beginPath();
    ctx.ellipse(cx - 4, headY - 1, 3.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + 4, headY - 1, 3.5, 4, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#222222';
    ctx.beginPath();
    ctx.arc(cx - 3, headY, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 5, headY, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  if (config.eyeStyle === 'goggles') {
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(cx - 4, headY - 1, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + 4, headY - 1, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#555555';
    ctx.beginPath(); ctx.moveTo(cx - 9, headY - 2); ctx.lineTo(cx - 12, headY - 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 9, headY - 2); ctx.lineTo(cx + 12, headY - 4); ctx.stroke();
  }

  // MOUTH
  ctx.strokeStyle = '#335533';
  ctx.lineWidth = 1;
  ctx.beginPath();
  if (state === 'coffee') {
    ctx.arc(cx, headY + 5, 2, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.arc(cx, headY + 4, 3, 0.1, Math.PI - 0.1);
    ctx.stroke();
  }

  // HELMET
  ctx.strokeStyle = config.helmetColor;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, headY, headR + 1.5, 0.3, Math.PI - 0.3);
  ctx.stroke();

  // ANTENNA
  if (config.antennaStyle !== 'none') {
    ctx.strokeStyle = '#aaaaaa';
    ctx.lineWidth = 1.5;
    const antX = cx + (config.antennaStyle === 'curved' ? 3 : 0);
    const antBaseY = headY - headR - 1;

    if (config.antennaStyle === 'straight') {
      ctx.beginPath(); ctx.moveTo(cx, antBaseY); ctx.lineTo(cx, antBaseY - 8); ctx.stroke();
      ctx.fillStyle = '#ff4444';
      ctx.beginPath(); ctx.arc(cx, antBaseY - 8, 2, 0, Math.PI * 2); ctx.fill();
    } else if (config.antennaStyle === 'curved') {
      ctx.beginPath();
      ctx.moveTo(antX, antBaseY);
      ctx.quadraticCurveTo(antX + 6, antBaseY - 6, antX + 8, antBaseY - 10);
      ctx.stroke();
      ctx.fillStyle = '#ff4444';
      ctx.beginPath(); ctx.arc(antX + 8, antBaseY - 10, 2, 0, Math.PI * 2); ctx.fill();
    } else if (config.antennaStyle === 'double') {
      for (const ax of [cx - 3, cx + 3]) {
        ctx.beginPath(); ctx.moveTo(ax, antBaseY); ctx.lineTo(ax, antBaseY - 6); ctx.stroke();
        ctx.fillStyle = '#ff4444';
        ctx.beginPath(); ctx.arc(ax, antBaseY - 6, 1.5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // WORK — hands on keyboard
  if (state === 'work') {
    ctx.fillStyle = config.suitColor;
    ctx.fillRect(cx - bodyW / 2 - 2, bodyY + bodyH - 2, 5, 3);
    ctx.fillRect(cx + bodyW / 2 - 3, bodyY + bodyH - 2, 5, 3);
  }

  // COFFEE — cup
  if (state === 'coffee') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx + bodyW / 2 + 2, bodyY + 2, 5, 8);
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(cx + bodyW / 2 + 3, bodyY + 3, 3, 6);
    ctx.strokeStyle = '#ffffff88';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(cx + bodyW / 2 + 4, bodyY + 1); ctx.lineTo(cx + bodyW / 2 + 3, bodyY - 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + bodyW / 2 + 5, bodyY + 1); ctx.lineTo(cx + bodyW / 2 + 6, bodyY - 2); ctx.stroke();
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

if (require.main === module) {
  generateSpritesheet();
}
