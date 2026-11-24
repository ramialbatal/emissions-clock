// @ts-check
/**
 * Emissions Clock: the picture behind the top of the page. A hot, hazy sky over factory chimneys and cooling
 * towers, with smoke rising and drifting over dry, cracked ground. In the methane view the haze turns purple and
 * gas flares burn on the chimneys. Drawn with a 2D canvas; clock-core's startScene runs it (see app.js).
 */
import { seeded } from "clock-core";

/** @typedef {import("clock-core").SceneFrame} SceneFrame */
/** @typedef {[number, number, number]} RGB */

// Colours for CO2 and for methane; the scene blends between them when the visitor switches gas.
const SKY = {
  co2: { top: [20, 10, 8], mid: [70, 30, 16], low: [150, 66, 30], sun: [235, 96, 44], smoke: [58, 46, 42], haze: [150, 92, 60] },
  ch4: { top: [15, 9, 24], mid: [50, 26, 74], low: [120, 72, 160], sun: [235, 140, 120], smoke: [66, 52, 86], haze: [130, 100, 170] },
};
const GROUND = /** @type {RGB} */ ([52, 26, 13]);

/** @param {RGB} a @param {RGB} b @param {number} m @returns {string} */
const mix = (a, b, m, alpha = 1) => `rgba(${a.map((v, i) => Math.round(v + (b[i] - v) * m)).join(",")},${alpha})`;

/** A soft round sprite (white centre fading out), drawn once and stamped for every puff of smoke. */
function softDot() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = /** @type {CanvasRenderingContext2D} */ (c.getContext("2d"));
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.5, "rgba(255,255,255,.45)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  return c;
}

/**
 * Build the emissions scene.
 * @param {() => string | undefined} gas  the gas on show ("co2" or "ch4"), read every frame
 * @returns {import("clock-core").Scene}
 */
export function emissionsScene(gas) {
  const dot = softDot();
  /** The soft sprite recoloured, cached by colour (the colours only change while switching gas). */
  /** @type {Map<string, HTMLCanvasElement>} */ const tints = new Map();
  /** @param {string} colour */
  const tint = (colour) => {
    let c = tints.get(colour);
    if (!c) {
      if (tints.size > 80) tints.clear();
      c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = /** @type {CanvasRenderingContext2D} */ (c.getContext("2d"));
      g.drawImage(dot, 0, 0);
      g.globalCompositeOperation = "source-in"; g.fillStyle = colour; g.fillRect(0, 0, 64, 64);
      tints.set(colour, c);
    }
    return c;
  };
  /** @type {HTMLCanvasElement | null} */ let ground = null;
  /** @type {{ x: number, w: number, h: number, kind: "stack" | "tower", light: number }[]} */ let stacks = [];
  /** @type {{ x: number, w: number, h: number }[]} */ let blocks = [];
  /** @type {{ x: number, y: number, vx: number, vy: number, r: number, age: number, life: number, big: boolean }[]} */
  let puffs = [];
  /** @type {{ x: number, y: number, v: number, p: number }[]} */ let embers = [];
  let m = 0;   // 0 = CO2 colours, 1 = methane colours

  /** Add smoke from every chimney, for dt seconds of time. */
  function emit(/** @type {number} */ dt, /** @type {number} */ G) {
    for (const s of stacks) {
      const big = s.kind === "tower";
      for (let k = Math.random() < (big ? 3 : 6) * dt ? 1 : 0; k > 0; k--) puffs.push({
        x: s.x + (Math.random() - 0.5) * s.w * 0.3, y: G - s.h + 2, vx: 3 + Math.random() * 5, vy: -(22 + Math.random() * 14),
        r: big ? s.w * 0.3 : s.w * 0.6, age: 0, life: 6 + Math.random() * 4, big,
      });
    }
  }
  /** Move the smoke on by dt seconds. */
  function step(/** @type {number} */ dt, /** @type {number} */ t, /** @type {number} */ G) {
    emit(dt, G);
    const wind = 14 + 8 * Math.sin(t * 0.13);
    for (const p of puffs) {
      p.age += dt;
      p.x += (p.vx + wind * Math.min(1, p.age / 3)) * dt;
      p.y += p.vy * dt;
      p.vy *= 1 - 0.08 * dt;
      p.r += (p.big ? 10 : 8) * dt;
    }
    puffs = puffs.filter((p) => p.age < p.life);
  }

  return {
    layout(f) {
      const { w, h, ground: G } = f;
      const rnd = seeded(7);
      // Factory blocks along the horizon, and chimneys rising out of them
      blocks = [];
      for (let x = -20; x < w + 20;) {
        const bw = 40 + rnd() * 110;
        blocks.push({ x, w: bw, h: 10 + rnd() * Math.min(46, G * 0.12) });
        x += bw - 6;
      }
      stacks = [];
      const n = Math.max(4, Math.round(w / 150));
      for (let i = 0; i < n; i++) {
        const x = ((i + 0.3 + rnd() * 0.4) / n) * w;
        const tower = i % 4 === 2;
        stacks.push(tower
          ? { x, w: Math.min(70, G * 0.2), h: Math.min(90, G * 0.24), kind: "tower", light: rnd() }
          : { x, w: 9 + rnd() * 6, h: Math.min(G * 0.4, 70 + rnd() * 80), kind: "stack", light: rnd() });
      }
      // Dry, cracked ground below the horizon, drawn once per size
      ground = document.createElement("canvas");
      const dpr = f.ctx.getTransform().a || 1;
      ground.width = Math.ceil(w * dpr); ground.height = Math.ceil(Math.max(1, h - G) * dpr);
      const g = /** @type {CanvasRenderingContext2D} */ (ground.getContext("2d"));
      g.scale(dpr, dpr);
      const depth = h - G;
      const grd = g.createLinearGradient(0, 0, 0, depth);
      grd.addColorStop(0, mix(GROUND, [120, 60, 26], 0.5));
      grd.addColorStop(0.25, mix(GROUND, GROUND, 0));
      grd.addColorStop(1, "rgb(14,8,5)");
      g.fillStyle = grd;
      g.fillRect(0, 0, w, depth);
      g.lineCap = "round";
      const cracks = Math.round(w / 9);
      for (let i = 0; i < cracks; i++) {
        let x = rnd() * w, y = Math.pow(rnd(), 1.4) * depth * 0.9 + 2, a = rnd() * Math.PI * 2;
        const near = () => 0.25 + y / depth;   // things look bigger closer to the viewer
        g.beginPath(); g.moveTo(x, y);
        for (let k = 0; k < 7; k++) {
          a += (rnd() - 0.5) * 1.3;
          x += Math.cos(a) * 14 * near() * 1.6; y += Math.sin(a) * 5 * near();
          g.lineTo(x, y);
        }
        g.strokeStyle = "rgba(8,4,2,.9)"; g.lineWidth = 1.6 * near(); g.stroke();
        g.strokeStyle = "rgba(150,80,40,.18)"; g.lineWidth = 0.8 * near(); g.translate(0, 1.2); g.stroke(); g.translate(0, -1.2);
      }
      // Start with smoke already in the air (also what a still frame shows)
      puffs = [];
      for (let i = 0; i < 100; i++) step(0.1, i * 0.1, G);
      embers = Array.from({ length: Math.round(w / 40) }, () => ({ x: rnd() * w, y: rnd() * G, v: 6 + rnd() * 12, p: rnd() * 6.3 }));
    },

    draw(f) {
      const { ctx, w, h, ground: G, t, dt } = f;
      const target = gas() === "ch4" ? 1 : 0;
      m = dt ? m + (target - m) * Math.min(1, dt * 2.5) : target;
      const A = SKY.co2, B = SKY.ch4;
      const c = (/** @type {keyof typeof A} */ k, alpha = 1) => mix(/** @type {RGB} */ (A[k]), /** @type {RGB} */ (B[k]), m, alpha);

      // Sky, darkest at the top so the title stays readable
      const sky = ctx.createLinearGradient(0, 0, 0, G);
      sky.addColorStop(0, c("top")); sky.addColorStop(0.55, c("mid")); sky.addColorStop(1, c("low"));
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, G + 1);

      // A dull, swollen sun low in the haze, gently pulsing
      const sx = w * 0.76, sy = G * 0.72, sr = Math.min(w, G) * 0.13 * (1 + 0.02 * Math.sin(t * 0.8));
      const glow = ctx.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr * 3.2);
      glow.addColorStop(0, c("sun", 0.4)); glow.addColorStop(1, c("sun", 0));
      ctx.fillStyle = glow; ctx.fillRect(sx - sr * 3.2, sy - sr * 3.2, sr * 6.4, sr * 6.4);
      ctx.fillStyle = c("sun", 0.5); ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();

      // Thick bands of brown haze drifting across the sun and the horizon
      const haze = tint(c("haze"));
      ctx.globalAlpha = 0.3;
      for (let i = 0; i < 4; i++) {
        const y = G * (0.5 + i * 0.12), span = w + 1400, x = ((t * (5 + i * 3) + i * 520) % span) - 1000;
        ctx.drawImage(haze, x, y - 34, 1000, 68);
        ctx.drawImage(haze, x + span / 2, y - 26, 900, 52);
      }
      ctx.globalAlpha = 1;

      // Heat shimmer: floating embers rising from the ground
      for (const e of embers) {
        if (dt) { e.y -= e.v * dt; e.x += Math.sin(t + e.p) * 4 * dt; if (e.y < G * 0.25) { e.y = G; e.x = Math.random() * w; } }
        const a = Math.max(0, Math.min(1, (e.y - G * 0.25) / (G * 0.5))) * (0.45 + 0.35 * Math.sin(t * 3 + e.p));
        ctx.fillStyle = `rgba(255,${Math.round(140 + 60 * m)},${Math.round(70 + 140 * m)},${a})`;
        ctx.fillRect(e.x, e.y, 2, 2);
      }

      // Smoke, tinted for the gas on show
      if (dt) step(dt, t, G);
      const tinted = tint(c("smoke"));
      for (const p of puffs) {
        const life = p.age / p.life;
        ctx.globalAlpha = Math.min(1, life * 12) * (1 - life) * (p.big ? 0.5 : 0.7);
        ctx.drawImage(tinted, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
      }
      ctx.globalAlpha = 1;

      // Factories, chimneys and cooling towers in silhouette
      ctx.fillStyle = "rgb(18,9,6)";
      for (const b of blocks) ctx.fillRect(b.x, G - b.h, b.w, b.h + 1);
      for (const s of stacks) {
        ctx.beginPath();
        if (s.kind === "tower") {
          const top = G - s.h, half = s.w / 2;
          ctx.moveTo(s.x - half, G);
          ctx.quadraticCurveTo(s.x - half * 0.45, top + s.h * 0.45, s.x - half * 0.62, top);
          ctx.lineTo(s.x + half * 0.62, top);
          ctx.quadraticCurveTo(s.x + half * 0.45, top + s.h * 0.45, s.x + half, G);
        } else {
          ctx.moveTo(s.x - s.w / 2, G); ctx.lineTo(s.x - s.w * 0.35, G - s.h); ctx.lineTo(s.x + s.w * 0.35, G - s.h); ctx.lineTo(s.x + s.w / 2, G);
        }
        ctx.fill();
        // Methane view: gas flares burning on the chimneys
        if (s.kind === "stack" && m > 0.02) {
          const fl = s.w * (1.4 + 0.35 * Math.sin(t * 9 + s.light * 20) + 0.2 * Math.sin(t * 23 + s.light * 7));
          const fy = G - s.h;
          const fg = ctx.createRadialGradient(s.x, fy - fl * 0.6, 0, s.x, fy - fl * 0.6, fl * 2.2);
          fg.addColorStop(0, `rgba(255,190,90,${0.5 * m})`); fg.addColorStop(1, "rgba(255,120,40,0)");
          ctx.fillStyle = fg; ctx.fillRect(s.x - fl * 2.2, fy - fl * 2.8, fl * 4.4, fl * 4.4);
          ctx.fillStyle = `rgba(255,${Math.round(200 + 40 * Math.sin(t * 13))},120,${0.9 * m})`;
          ctx.beginPath(); ctx.moveTo(s.x - s.w * 0.3, fy);
          ctx.quadraticCurveTo(s.x - s.w * 0.4, fy - fl * 0.6, s.x + Math.sin(t * 5 + s.light) * 3, fy - fl * 1.5);
          ctx.quadraticCurveTo(s.x + s.w * 0.4, fy - fl * 0.6, s.x + s.w * 0.3, fy); ctx.fill();
          ctx.fillStyle = "rgb(18,9,6)";
        }
        // A red warning light blinking on top of the tall chimneys
        if (s.kind === "stack" && s.h > G * 0.25 && Math.sin(t * 2.2 + s.light * 6) > 0.6) {
          ctx.fillStyle = "rgba(255,60,40,.9)"; ctx.fillRect(s.x - 1.5, G - s.h - 4, 3, 3); ctx.fillStyle = "rgb(18,9,6)";
        }
      }

      // Cracked ground
      if (ground) ctx.drawImage(ground, 0, G, w, h - G);
    },
  };
}
