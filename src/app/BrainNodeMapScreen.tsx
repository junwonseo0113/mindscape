import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  CognitiveRegion,
  COGNITIVE_REGIONS,
  Vec3,
  assignBeliefsToIndices,
  buildProximityEdges,
  cognitiveRegionForPosition,
  generateBrainCloud,
  pickPromotableIndicesByRegion,
  stableUnit,
} from "./neuralBrainLayout";
import { NeuralBeliefConnection, NeuralBeliefNode, REGION_CONFIG, resolveRegion } from "./NeuralBeliefGraph3D";
import { StoredEvidenceQuote } from "./types";

// ── A dedicated, full-screen, dark "control room" view of the same belief
// tissue the Home hero card shows in miniature — additive-blended glowing
// sprites on near-black instead of the card's quiet daylight rendering, a
// left rail for filtering by cognitive region, a search box, and a
// slide-in detail panel for the selected belief and what it connects to.
// Reuses the exact same brain-shaped point cloud, region colors, and
// region assignment logic as NeuralBeliefGraph3D — this is a different
// skin over the same real tissue, never a separate dataset. ─────────────────

const IS_SMALL_SCREEN = typeof window !== "undefined" && window.innerWidth < 480;
const BRAIN_SEED = 1729; // same seed as the Home hero card — same tissue everywhere
// Matches NeuralBeliefGraph3D's own BACKGROUND_COUNT exactly (not just the
// seed) — with the shell generator's thin, hollow silhouette, a mismatched
// count would mean this screen only ever sees a strict prefix of the other
// screen's point sequence, i.e. visibly sparser tissue instead of the same
// tissue at a different camera distance.
const BACKGROUND_COUNT = IS_SMALL_SCREEN ? 5000 : 8000;
const SLOTS_PER_REGION = IS_SMALL_SCREEN ? 22 : 30;

// Dark (default) theme values — shadowed inside the component with
// Modernist light-theme equivalents when `modernist` is true, see there.
const bgDark = "#161826";
const panelBgDark = "#232532";
const lineDark = "#3f424d";
const inkDark = "#E9E9ED";
const inkSoftDark = "rgba(233,233,237,0.85)";
const inkMidDark = "rgba(233,233,237,0.5)";
const inkFaintDark = "rgba(233,233,237,0.4)";
// Pure white — every node, dormant tissue and real belief alike. Real
// beliefs are still distinguished from background tissue (see sizeArr
// below), but by size/brightness only, the way an actual night sky reads —
// not by hue. REGION_CONFIG colors are still used elsewhere (the region
// rail's legend dots, the linked-notes chips, the detail panel's tag) —
// just never on the 3D points themselves anymore.
const dormantColorDark = new THREE.Color(0xffffff);
// A muted slate, used only to dim a real belief point that the current
// search/region filter excludes — everything else on the 3D points stays
// pure white.
const FILTERED_OUT_TINT_DARK = new THREE.Color(0x33364a);

// ── "Network activation" — the node-tap interaction. Vivid ruby/crimson,
// picked for the dramatic "a dormant circuit just came alive" feeling
// (Project Hail Mary's activation glow), deliberately not the red this app
// otherwise reserves for warnings/tension. Points only now — the
// connecting lines themselves were removed (see the construction effect's
// own comment), so the pulse reads purely through which stars light up and
// in what order, not a traveling line.
const CRIMSON_R = 1.0, CRIMSON_G = 0.231, CRIMSON_B = 0.341; // #ff3b57
// Everything outside the tapped node's own network dims to this — never
// hidden entirely (point 9: "preserving context of the entire brain").
const DIM_OPACITY = 0.16;
// Timing: a short pause before anything happens, then the tapped node and
// every direct neighbor light up together (no stagger anymore — they read
// as one collective "network firing" rather than a traveling pulse).
const ACTIVATION_PAUSE_MS = 200;
// The double-pulse: each activated point flashes twice in quick succession
// — "violently" — before settling into its permanent steady crimson glow.
// PULSE_DURATION_MS is one flash's own rise+decay length; PULSE_GAP_MS is
// the time between the two flashes' start. Both pulses land well inside a
// 2-second window (900 + 420 = 1320ms), leaving room to visibly "return to
// normal" — stop flashing, but stay red — before the 2s mark.
const PULSE_DURATION_MS = 420;
const PULSE_GAP_MS = 900;
const PULSE_COUNT = 2;
const sans = { fontFamily: "Inter, sans-serif" };
const serif = { fontFamily: "'Instrument Serif', Georgia, serif" };
const mono = { fontFamily: "'JetBrains Mono', monospace" };

// A real 4-point sparkle (the "north star" glyph — ✦), not a plain dot: a
// small solid core plus two tapering rays, one vertical one horizontal.
// The core stays crisp (solid center, only its own rim feathered) — the
// rays taper to a point by design, which reads as "a sharp star spike,"
// not as the shapeless blur a soft-edged circle read as before.
function makeStarTexture(): THREE.Texture {
  const size = 128;
  const c = size / 2;
  const cvs = document.createElement("canvas");
  cvs.width = size;
  cvs.height = size;
  const ctx = cvs.getContext("2d")!;

  const drawRay = (length: number, width: number, vertical: boolean) => {
    ctx.save();
    ctx.translate(c, c);
    if (vertical) ctx.rotate(Math.PI / 2);
    const grad = ctx.createLinearGradient(-length, 0, length, 0);
    grad.addColorStop(0, "rgba(255,255,255,0)");
    grad.addColorStop(0.5, "rgba(255,255,255,1)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(-length, -width * 0.1);
    ctx.lineTo(-width * 0.5, -width * 0.5);
    ctx.lineTo(0, 0);
    ctx.lineTo(-width * 0.5, width * 0.5);
    ctx.lineTo(-length, width * 0.1);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(length, -width * 0.1);
    ctx.lineTo(width * 0.5, -width * 0.5);
    ctx.lineTo(0, 0);
    ctx.lineTo(width * 0.5, width * 0.5);
    ctx.lineTo(length, width * 0.1);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  drawRay(size * 0.5, size * 0.1, false);
  drawRay(size * 0.5, size * 0.1, true);

  // Solid crisp core on top of the rays — this is the part that must never
  // read as soft, per the earlier "not blurry" fix: opaque out to 70% of
  // its own small radius, only the last 30% anti-aliased.
  const core = ctx.createRadialGradient(c, c, 0, c, c, size * 0.16);
  core.addColorStop(0, "rgba(255,255,255,1)");
  core.addColorStop(0.7, "rgba(255,255,255,1)");
  core.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(c, c, size * 0.16, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(cvs);
  // Mipmapping blurs a small point sprite further as the camera moves back
  // — turn it off and pin to linear filtering so the sparkle stays exactly
  // this crisp at any distance.
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

// ── Star field material — every node (real belief or dormant tissue) gets
// its own fixed twinkle phase/speed (aTwinkle, seeded via stableUnit so
// it's stable across reloads, not Math.random) and its own point size
// (aSize — previously computed per-point but never actually bound to the
// geometry, so every point silently rendered at the same flat material.size
// regardless of whether it was a real belief or background dust; binding it
// here is what makes real "coded" nodes actually read as bigger/brighter
// stars than the dormant field around them, not just differently colored).
// gl_PointSize replicates PointsMaterial's own sizeAttenuation formula
// (size * scale / -mvZ, scale = 0.5 * canvas height in device pixels) so
// swapping the material doesn't also change the base scale everything was
// already tuned against.
const STAR_VERTEX_SHADER = `
  attribute vec3 color;
  attribute float aSize;
  attribute vec2 aTwinkle; // x: phase, y: speed
  // Network-activation state, both eased/computed in JS every frame (see
  // animate() — the same place that already eases the camera fly-to), not
  // shader-side animation:
  //   aFocus      — opacity: ${DIM_OPACITY} (dimmed, "not part of this
  //                 network") eased up to 1 for the tapped node and each
  //                 neighbor as its own scheduled activation time arrives.
  //   aActivation — 0..1 steady mix toward crimson, ramps in alongside
  //                 aFocus and then just stays there — the "settled into a
  //                 soft glow" state.
  //   aFlash      — 0..1 decaying spike computed fresh each frame from how
  //                 long ago this point activated (not eased) — the brief,
  //                 sharper "just came alive" pulse before it settles.
  attribute float aFocus;
  attribute float aActivation;
  attribute float aFlash;
  uniform float uTime;
  uniform float uScale;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float tw = 0.5 + 0.5 * sin(uTime * aTwinkle.y + aTwinkle.x);
    vColor = mix(color, vec3(${CRIMSON_R}, ${CRIMSON_G}, ${CRIMSON_B}), aActivation);
    float baseAlpha = (0.45 + 0.55 * tw) * aFocus;
    vAlpha = min(1.0, baseAlpha * (1.0 + aFlash * 1.1));
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    // Clamped so zooming in close (see the reduced OrbitControls
    // minDistance) doesn't blow points up into oversized blobs — sizes
    // still grow the closer you get, just not past a sane cap. aFlash adds
    // a brief extra size boost right at the moment of activation.
    float sizeBoost = 1.0 + aFlash * 1.7;
    gl_PointSize = min(aSize * (uScale / -mvPosition.z) * (0.72 + 0.4 * tw) * sizeBoost, 150.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;
// Discard near-zero-alpha fragments instead of letting them blend — with
// AdditiveBlending, every point's soft rim was summing on top of its
// neighbors' rims in the dense field, so whole regions read as a blurred
// glow instead of individual dots. Normal (non-additive) blending fixes
// that. The threshold itself stays low (0.04, just skipping fully-invisible
// pixels) rather than a hard cutoff — the sparkle's rays are *supposed* to
// taper to nothing at their tips, that's the star shape, not blur; a high
// cutoff would just chop the rays off short.
const STAR_FRAGMENT_SHADER = `
  uniform sampler2D uMap;
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec4 tex = texture2D(uMap, gl_PointCoord);
    float a = tex.a * vAlpha;
    if (a < 0.04) discard;
    gl_FragColor = vec4(vColor, a);
  }
`;

function makeStarMaterial(map: THREE.Texture, scale: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uMap: { value: map }, uScale: { value: scale } },
    vertexShader: STAR_VERTEX_SHADER,
    fragmentShader: STAR_FRAGMENT_SHADER,
    transparent: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
  });
}

type PanelNode = {
  id: string;
  domain: string;
  statement: string;
  confidence: number;
  evidenceCount: number;
  region: CognitiveRegion;
  // Each linked belief carries the *reason* the two are connected, not
  // just which one — the connection's own note plus whether it's a
  // mutually-reinforcing "root" link or a "contradiction" one, so the
  // panel can answer "why are these stars connected" instead of just
  // listing neighbors.
  linked: { id: string; title: string; color: string; note: string; kind: "root" | "contradiction" }[];
  evidenceQuotes: StoredEvidenceQuote[];
};

export default function BrainNodeMapScreen({
  beliefs,
  connections,
  onBack,
  embedded = false,
  height = 480,
  onExpand,
  modernist = false,
}: {
  beliefs: NeuralBeliefNode[];
  connections: NeuralBeliefConnection[];
  onBack?: () => void;
  // Inline-in-a-card mode for the Home screen: fixed height instead of a
  // full-screen overlay, rounded corners, no back button (there's nowhere
  // to navigate back from — it's just sitting on the page). The full-screen
  // "brainmap" route still uses the default (embedded=false) so there's
  // still a bigger, more immersive version to grow into later.
  embedded?: boolean;
  height?: number;
  // Embedded mode only — shows a 확대 (expand) button that hands off to
  // whatever the caller wants to do to show this same map full-screen
  // (App.tsx wires this to the existing "brainmap" route). No-op/hidden if
  // omitted, and never shown in full-screen mode itself (nothing to expand
  // to from there).
  onExpand?: () => void;
  // Light/red Modernist theme (per the imported claude.ai/design import) —
  // shadows the dark module-level bg/panelBg/ink*/dormantColor/
  // FILTERED_OUT_TINT constants below with light-theme equivalents for the
  // rest of this closure, including the mount-once Three.js scene effect
  // (a stable prop per mount, so no need for it in that effect's deps).
  modernist?: boolean;
}) {
  const bg = modernist ? "#ffffff" : bgDark;
  const panelBg = modernist ? "#ffffff" : panelBgDark;
  const line = modernist ? "rgba(32,30,29,0.14)" : lineDark;
  const ink = modernist ? "#201e1d" : inkDark;
  const inkSoft = modernist ? "rgba(32,30,29,0.85)" : inkSoftDark;
  const inkMid = modernist ? "rgba(32,30,29,0.6)" : inkMidDark;
  const inkFaint = modernist ? "rgba(32,30,29,0.42)" : inkFaintDark;
  const dormantColor = modernist ? new THREE.Color(0x201e1d) : dormantColorDark;
  const FILTERED_OUT_TINT = modernist ? new THREE.Color(0xd7d3d3) : FILTERED_OUT_TINT_DARK;
  // The dark theme's generic purple UI-chrome accent (search caret, 초기화/
  // 확대 buttons, region-rail active row, panel tag pill) — swapped for the
  // Modernist palette's own red accent, not left purple, since Modernist is
  // explicitly mono-red ("no second accent was chosen").
  const accentUi = modernist ? "#ec3013" : "#9184d9";
  const accentUiSoft = modernist ? "rgba(236,48,19,0.12)" : "rgba(145,132,217,0.12)";
  const accentUiSofter = modernist ? "rgba(236,48,19,0.16)" : "rgba(145,132,217,0.16)";
  const mdNeutralTagLocal = "#f8f4f4";
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const three = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    raycaster: THREE.Raycaster;
    clock: THREE.Clock;
    points: THREE.Points;
    pointsMat: THREE.ShaderMaterial;
    tissueLines: THREE.LineSegments;
    drift: THREE.Points;
    rafId: number;
    resumeTimer: ReturnType<typeof setTimeout> | null;
    camAnim: { from: THREE.Vector3; to: THREE.Vector3; fromT: THREE.Vector3; toT: THREE.Vector3; t0: number; duration: number } | null;
    defaultCamPos: THREE.Vector3;
    defaultTarget: THREE.Vector3;
    baseColors: Float32Array;
    beliefIndexOf: Map<number, string>; // background point index -> belief id, only for promoted points
    indexOfBelief: Map<string, number>; // belief id -> background point index (reverse of the above)
    positions: Vec3[];
    // ── "Network activation" state, all eased/scheduled every frame in
    // animate(), driven by the `selected` effect below. Nothing here ever
    // hides a point or connection outright — dimming is the floor, not 0
    // (point 9: "preserving context of the entire brain"). ─────────────────
    //
    // Points: opacity (aFocus, dim..1) and crimson mix (aActivation, eased
    // 0..1) both driven off a per-point scheduled activation timestamp —
    // `activationStart[i] < 0` means "not part of the current network, stay
    // dimmed forever"; otherwise animate() flips both targets to 1 the
    // instant `performance.now()` passes that timestamp, which is what
    // turns a single "set some numbers" effect into staggered, sequential
    // propagation instead of everything moving at once. aFlash is a
    // separate, NOT-eased decaying spike computed straight from elapsed
    // time each frame — the brief flash before a point settles into its
    // steady glow.
    focusTarget: Float32Array;
    focusCurrent: Float32Array;
    activationStart: Float32Array; // ms (performance.now() timebase), -1 = never
    activationCurrent: Float32Array;
  } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeRegion, setActiveRegion] = useState<CognitiveRegion | null>(null);
  const [selected, setSelected] = useState<PanelNode | null>(null);
  const [hover, setHover] = useState<{ label: string; x: number; y: number } | null>(null);
  const [cursor, setCursor] = useState<"grab" | "grabbing" | "pointer">("grab");
  const [regionCounts, setRegionCounts] = useState<Record<CognitiveRegion, number>>(
    () => Object.fromEntries(COGNITIVE_REGIONS.map((r) => [r, 0])) as Record<CognitiveRegion, number>
  );
  const [connectionCount, setConnectionCount] = useState(0);

  const beliefsRef = useRef(beliefs);
  const connectionsRef = useRef(connections);
  beliefsRef.current = beliefs;
  connectionsRef.current = connections;

  const applyFilters = () => {
    const t = three.current;
    if (!t) return;
    const q = searchQuery.trim().toLowerCase();
    const geo = t.points.geometry;
    const colorAttr = geo.getAttribute("color") as THREE.BufferAttribute;
    t.beliefIndexOf.forEach((beliefId, ptIndex) => {
      const belief = beliefsRef.current.find((b) => b.id === beliefId);
      if (!belief) return;
      const region = resolveRegion(belief);
      const matchesSearch = !q || belief.statement.toLowerCase().includes(q) || belief.domain.toLowerCase().includes(q);
      const matchesRegion = !activeRegion || region === activeRegion;
      const active = matchesSearch && matchesRegion;
      // Real belief nodes render their own region color again (see the
      // construction loop above) — matching restores that color, not
      // matching dims to the same muted slate dormant tissue never uses.
      const c = active ? new THREE.Color(REGION_CONFIG[region].color) : FILTERED_OUT_TINT;
      colorAttr.setXYZ(ptIndex, c.r, c.g, c.b);
    });
    colorAttr.needsUpdate = true;
  };

  const flyTo = (pos: THREE.Vector3, target: THREE.Vector3, duration = 850) => {
    const t = three.current;
    if (!t) return;
    t.camAnim = { from: t.camera.position.clone(), to: pos, fromT: t.controls.target.clone(), toT: target, t0: performance.now(), duration };
    t.controls.autoRotate = false;
    if (t.resumeTimer) clearTimeout(t.resumeTimer);
    t.resumeTimer = setTimeout(() => {
      if (three.current) three.current.controls.autoRotate = true;
    }, 3200);
  };

  // ── Scene setup — runs once. Rebuilding on every belief change would tear
  // down the camera/orbit state the user is mid-interaction with; instead
  // the tissue+belief geometry is built once from whatever beliefs/
  // connections this screen was opened with (a fresh mount every time it's
  // navigated to, same as the rest of the app's screen stack). ─────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(wrap.clientWidth, wrap.clientHeight);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x161826, 0.11);

    const camera = new THREE.PerspectiveCamera(50, wrap.clientWidth / wrap.clientHeight, 0.1, 100);
    camera.position.set(0, 0.2, 6.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    // Was 2.2 — that kept the camera further out than the brain shell's own
    // radius (~1.5 units), so you could never actually get close to
    // individual stars. 0.5 lets you push in past the outer shell, close
    // enough to read individual sparkle shapes (see the point-size clamp
    // in STAR_VERTEX_SHADER, which keeps this from blowing points up into
    // oversized blobs at this range).
    controls.minDistance = 0.5;
    controls.maxDistance = 11;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.42;
    controls.addEventListener("start", () => {
      controls.autoRotate = false;
      if (three.current?.resumeTimer) clearTimeout(three.current.resumeTimer);
      setCursor("grabbing");
    });
    controls.addEventListener("end", () => {
      setCursor("grab");
      if (three.current) {
        if (three.current.resumeTimer) clearTimeout(three.current.resumeTimer);
        three.current.resumeTimer = setTimeout(() => {
          if (three.current) three.current.controls.autoRotate = true;
        }, 2400);
      }
    });

    const raycaster = new THREE.Raycaster();
    raycaster.params.Points = { threshold: 0.05 };
    const clock = new THREE.Clock();

    // ── Tissue: same deterministic brain-shaped cloud as the Home card ──
    const backgroundPoints = generateBrainCloud(BACKGROUND_COUNT, BRAIN_SEED);
    const positions: Vec3[] = backgroundPoints.map((p) => p.position);
    const tissueEdges = buildProximityEdges(positions, 2, 0.55);
    const promotableByRegion = pickPromotableIndicesByRegion(
      backgroundPoints,
      (i) => cognitiveRegionForPosition(positions[i]),
      SLOTS_PER_REGION,
      0.34
    );

    // ── Assign real beliefs into their own region's slot pool — the same
    // scheme NeuralBeliefGraph3D uses, so a belief always claims the same
    // neuron on this screen as it does on the Home card. ──────────────────
    const beliefsByRegion = new Map<CognitiveRegion, NeuralBeliefNode[]>();
    beliefsRef.current.forEach((b) => {
      const region = resolveRegion(b);
      const bucket = beliefsByRegion.get(region);
      if (bucket) bucket.push(b);
      else beliefsByRegion.set(region, [b]);
    });
    const beliefIndexOf = new Map<number, string>(); // bg point index -> belief id
    const indexOfBelief = new Map<string, number>(); // belief id -> bg point index
    beliefsByRegion.forEach((regionBeliefs, region) => {
      const slots = promotableByRegion[region] ?? [];
      const assignment = assignBeliefsToIndices(regionBeliefs, slots);
      assignment.forEach((idx, id) => {
        beliefIndexOf.set(idx, id);
        indexOfBelief.set(id, idx);
      });
    });

    const n = positions.length;
    const posArr = new Float32Array(n * 3);
    const colorArr = new Float32Array(n * 3);
    const sizeArr = new Float32Array(n);
    const twinkleArr = new Float32Array(n * 2); // [phase, speed] per point
    const counts = Object.fromEntries(COGNITIVE_REGIONS.map((r) => [r, 0])) as Record<CognitiveRegion, number>;
    for (let i = 0; i < n; i += 1) {
      const [x, y, z] = positions[i];
      posArr[i * 3] = x;
      posArr[i * 3 + 1] = y;
      posArr[i * 3 + 2] = z;
      // Deterministic per-point twinkle — same stable-hash approach used
      // everywhere else in this app for per-node animation seeds, so the
      // sky looks the same on every reload instead of re-shuffling.
      twinkleArr[i * 2] = stableUnit(`star-${i}-phase`) * Math.PI * 2;
      twinkleArr[i * 2 + 1] = 0.5 + stableUnit(`star-${i}-speed`) * 1.1;
      // Dormant tissue is pure white; real belief nodes get their own
      // region color back (matching the 영역 rail's colored legend dots —
      // that panel already shows six distinct colors, so a real node
      // rendering flat white instead was a real inconsistency, not a
      // deliberate "all white" look). Still distinguished from the
      // background by size too (see sizeArr below), not by hue alone.
      const beliefId = beliefIndexOf.get(i);
      if (beliefId) {
        const belief = beliefsRef.current.find((b) => b.id === beliefId)!;
        const region = resolveRegion(belief);
        counts[region] += 1;
        const c = new THREE.Color(REGION_CONFIG[region].color);
        colorArr[i * 3] = c.r;
        colorArr[i * 3 + 1] = c.g;
        colorArr[i * 3 + 2] = c.b;
        sizeArr[i] = 0.09 + 0.05 * Math.min(1, (belief.evidenceCount || 1) / 8);
      } else {
        colorArr[i * 3] = dormantColor.r;
        colorArr[i * 3 + 1] = dormantColor.g;
        colorArr[i * 3 + 2] = dormantColor.b;
        sizeArr[i] = 0.028;
      }
    }
    setRegionCounts(counts);

    // Each attribute array is backed directly by the *Current one (not a
    // copy) — animate() mutates these same arrays' values in place every
    // frame, so all it ever needs afterward is `needsUpdate = true`, no
    // reassigning `.array` or re-creating the attribute.
    const focusCurrentArr = new Float32Array(n).fill(1);
    const focusTargetArr = new Float32Array(n).fill(1);
    const activationCurrentArr = new Float32Array(n); // starts at 0 — no crimson until something's selected
    const activationStartArr = new Float32Array(n).fill(-1);
    const flashArr = new Float32Array(n); // not eased — recomputed fresh from elapsed time every frame

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colorArr, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizeArr, 1));
    geo.setAttribute("aTwinkle", new THREE.BufferAttribute(twinkleArr, 2));
    geo.setAttribute("aFocus", new THREE.BufferAttribute(focusCurrentArr, 1));
    geo.setAttribute("aActivation", new THREE.BufferAttribute(activationCurrentArr, 1));
    geo.setAttribute("aFlash", new THREE.BufferAttribute(flashArr, 1));
    const tex = makeStarTexture();
    // scale replicates PointsMaterial's own built-in sizeAttenuation
    // constant (0.5 * framebuffer height) — see makeStarMaterial's comment.
    const mat = makeStarMaterial(tex, 0.5 * wrap.clientHeight * renderer.getPixelRatio());
    const points = new THREE.Points(geo, mat);
    scene.add(points);

    // ── Faint tissue mesh — the same "barely there" background wiring the
    // Home card uses, just to keep the mass reading as one continuous
    // structure rather than a loose scatter. ──────────────────────────────
    const tissuePos = new Float32Array(tissueEdges.length * 6);
    tissueEdges.forEach(([i, j], idx) => {
      tissuePos.set(positions[i], idx * 6);
      tissuePos.set(positions[j], idx * 6 + 3);
    });
    const tissueGeo = new THREE.BufferGeometry();
    tissueGeo.setAttribute("position", new THREE.BufferAttribute(tissuePos, 3));
    const tissueMat = new THREE.LineBasicMaterial({ color: 0x3a3f55, transparent: true, opacity: 0.05, depthWrite: false });
    const tissueLines = new THREE.LineSegments(tissueGeo, tissueMat);
    scene.add(tissueLines);

    // Real connections no longer get their own drawn line — the "network
    // activation" node-tap interaction (see the `selected` effect and
    // animate()) reads purely through which stars light up and in what
    // order now, no traveling line. `indexOfBelief` still resolves both
    // endpoints of every real connection so the count below only ever
    // reflects connections that actually landed on a rendered point.
    const validConnectionCount = connectionsRef.current.filter(
      (c) => indexOfBelief.has(c.a) && indexOfBelief.has(c.b)
    ).length;
    setConnectionCount(validConnectionCount);

    // ── Ambient drifting dust — pure atmosphere, no data behind it. ───────
    const driftN = 140;
    const driftPos = new Float32Array(driftN * 3);
    for (let i = 0; i < driftN; i += 1) {
      const r = 2.6 + Math.random() * 1.6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * 2 - 1);
      driftPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      driftPos[i * 3 + 1] = r * Math.cos(phi) * 0.6;
      driftPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    const driftGeo = new THREE.BufferGeometry();
    driftGeo.setAttribute("position", new THREE.BufferAttribute(driftPos, 3));
    const driftMat = new THREE.PointsMaterial({ size: 0.026, map: tex, transparent: true, opacity: 0.3, color: 0x9397ab, depthWrite: false, blending: THREE.AdditiveBlending });
    const drift = new THREE.Points(driftGeo, driftMat);
    scene.add(drift);

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambient);

    three.current = {
      renderer,
      scene,
      camera,
      controls,
      raycaster,
      clock,
      points,
      pointsMat: mat,
      tissueLines,
      drift,
      rafId: 0,
      resumeTimer: null,
      camAnim: null,
      defaultCamPos: camera.position.clone(),
      defaultTarget: new THREE.Vector3(0, 0, 0),
      baseColors: colorArr,
      beliefIndexOf,
      indexOfBelief,
      positions,
      focusTarget: focusTargetArr,
      focusCurrent: focusCurrentArr,
      activationStart: activationStartArr,
      activationCurrent: activationCurrentArr,
    };

    let lastFrameMs = performance.now();
    const animate = () => {
      const t = three.current;
      if (!t) return;
      t.rafId = requestAnimationFrame(animate);
      const nowMs = performance.now();
      const dt = Math.min(0.05, (nowMs - lastFrameMs) / 1000);
      lastFrameMs = nowMs;
      const el = t.clock.getElapsedTime();
      t.pointsMat.uniforms.uTime.value = el;
      t.drift.rotation.y = el * 0.025;

      // ── Network activation, eased in real time — see the ref type's own
      // comment block for the full scheme. Nothing here decides *whether*
      // to activate; that's all in the `selected` effect below, which only
      // ever writes target values and schedule timestamps. This loop's only
      // job is reacting to time having passed a threshold, which is what
      // turns "a bunch of numbers changed" into staggered, sequential
      // propagation instead of everything moving at once. ─────────────────
      const ease = Math.min(1, dt * 5);
      let pointsMoving = false;
      const aFocusAttr = t.points.geometry.getAttribute("aFocus") as THREE.BufferAttribute;
      const aActivationAttr = t.points.geometry.getAttribute("aActivation") as THREE.BufferAttribute;
      const aFlashAttr = t.points.geometry.getAttribute("aFlash") as THREE.BufferAttribute;
      const flashArr = aFlashAttr.array as Float32Array;
      for (let i = 0; i < t.focusCurrent.length; i += 1) {
        const start = t.activationStart[i];
        const arrived = start >= 0 && nowMs >= start;
        // The instant a point's scheduled moment arrives, it's both fully
        // visible and fully "activated" — everything else here is just the
        // smooth approach toward that.
        if (arrived) t.focusTarget[i] = 1;

        const fCur = t.focusCurrent[i];
        const fTarget = t.focusTarget[i];
        const fDiff = fTarget - fCur;
        if (Math.abs(fDiff) > 0.003) {
          t.focusCurrent[i] = fCur + fDiff * ease;
          pointsMoving = true;
        } else if (fCur !== fTarget) {
          t.focusCurrent[i] = fTarget;
        }

        const aTarget = arrived ? 1 : 0;
        const aCur = t.activationCurrent[i];
        const aDiff = aTarget - aCur;
        if (Math.abs(aDiff) > 0.003) {
          t.activationCurrent[i] = aCur + aDiff * ease;
          pointsMoving = true;
        } else if (aCur !== aTarget) {
          t.activationCurrent[i] = aTarget;
        }

        // The double "violent" pulse right as a point activates — computed
        // fresh from elapsed time every frame (not eased). Two decaying
        // spikes back to back (see PULSE_DURATION_MS/PULSE_GAP_MS above),
        // then flash drops to 0 for good and the point just sits at its
        // steady crimson glow (aActivation, eased above) — "returns to
        // normal but stays red."
        let flash = 0;
        if (start >= 0) {
          const elapsed = nowMs - start;
          for (let p = 0; p < PULSE_COUNT; p += 1) {
            const pElapsed = elapsed - p * PULSE_GAP_MS;
            if (pElapsed >= 0 && pElapsed < PULSE_DURATION_MS) {
              const norm = pElapsed / PULSE_DURATION_MS;
              const val = Math.exp(-norm * 6.5) * (1 - norm);
              if (val > flash) flash = val;
            }
          }
        }
        flashArr[i] = flash;
      }
      if (pointsMoving) {
        aFocusAttr.needsUpdate = true;
        aActivationAttr.needsUpdate = true;
      }
      aFlashAttr.needsUpdate = true;

      if (t.camAnim) {
        const a = t.camAnim;
        const p = Math.min(1, (performance.now() - a.t0) / a.duration);
        const e = 1 - Math.pow(1 - p, 3);
        t.camera.position.lerpVectors(a.from, a.to, e);
        t.controls.target.lerpVectors(a.fromT, a.toT, e);
        if (p >= 1) t.camAnim = null;
      }
      t.controls.update();
      t.renderer.render(t.scene, t.camera);
    };
    animate();

    const handleResize = () => {
      if (!three.current || !wrapRef.current) return;
      const w = wrapRef.current.clientWidth;
      const h = wrapRef.current.clientHeight;
      three.current.camera.aspect = w / h;
      three.current.camera.updateProjectionMatrix();
      three.current.renderer.setSize(w, h);
      three.current.pointsMat.uniforms.uScale.value = 0.5 * h * three.current.renderer.getPixelRatio();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (three.current) {
        cancelAnimationFrame(three.current.rafId);
        if (three.current.resumeTimer) clearTimeout(three.current.resumeTimer);
        three.current.renderer.dispose();
        geo.dispose();
        tissueGeo.dispose();
        driftGeo.dispose();
        tex.dispose();
      }
      three.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-run the color pass whenever search text or the active region filter
  // changes — cheap (just a color-buffer rewrite), never rebuilds geometry.
  useEffect(() => {
    applyFilters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, activeRegion]);

  // "Network activation" — tapping a real node. Never removes the rest of
  // the brain (point 1/9): everything not part of the tapped node's own
  // network dims to DIM_OPACITY, and — after a short ACTIVATION_PAUSE_MS —
  // the tapped node and every direct neighbor light up together, each
  // playing the double "violent" pulse (see PULSE_DURATION_MS/PULSE_GAP_MS)
  // before settling into a steady crimson glow that stays put. This effect
  // only ever computes *when* things should happen (schedule timestamps)
  // and the resting targets for anything that never activates; animate()
  // is what actually watches the clock and eases toward those targets.
  // Re-fires (with a fresh schedule, starting from "now") if a linked note
  // gets clicked while the panel's already open, so switching selections
  // also eases/re-pulses rather than jumping.
  useEffect(() => {
    const t = three.current;
    if (!t) return;
    const now = performance.now();

    if (!selected) {
      // Deselected: everyone eases back to its normal resting look — full
      // opacity, no crimson.
      t.activationStart.fill(-1);
      t.focusTarget.fill(1);
      return;
    }

    // Baseline: dim first, then carve out the tapped node + its neighbors,
    // all sharing the same activation moment.
    t.focusTarget.fill(DIM_OPACITY);
    t.activationStart.fill(-1);

    const activateAt = now + ACTIVATION_PAUSE_MS;
    const selIdx = [...t.beliefIndexOf.entries()].find(([, id]) => id === selected.id)?.[0];
    if (selIdx != null) {
      t.focusTarget[selIdx] = 1; // "remains fully visible" — immediate, not scheduled
      t.activationStart[selIdx] = activateAt;
    }

    // Neighbors activate in sync with the tapped node — "that node and
    // other related nodes" reads as one collective network firing, not a
    // pulse traveling outward one hop at a time.
    selected.linked.forEach((l) => {
      const idx = t.indexOfBelief.get(l.id);
      if (idx == null) return;
      t.activationStart[idx] = activateAt;
    });
  }, [selected]);

  const pickBeliefAt = (clientX: number, clientY: number): string | null => {
    const t = three.current;
    if (!t || !canvasRef.current) return null;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    t.raycaster.setFromCamera(mouse, t.camera);
    const hits = t.raycaster.intersectObject(t.points);
    for (const hit of hits) {
      if (hit.index != null && t.beliefIndexOf.has(hit.index)) return t.beliefIndexOf.get(hit.index)!;
    }
    return null;
  };

  const selectBelief = (beliefId: string) => {
    const belief = beliefsRef.current.find((b) => b.id === beliefId);
    if (!belief) return;
    const region = resolveRegion(belief);
    // Keep the connection itself (not just the other id) so each linked
    // belief can carry its own note + root/contradiction kind.
    const linkedConnections = connectionsRef.current.filter((c) => c.a === beliefId || c.b === beliefId);
    const linked = linkedConnections
      .map((c) => {
        const otherId = c.a === beliefId ? c.b : c.a;
        const other = beliefsRef.current.find((b) => b.id === otherId);
        if (!other) return null;
        return {
          id: other.id,
          title: other.statement,
          color: REGION_CONFIG[resolveRegion(other)].color,
          note: c.note,
          kind: c.type === "contradiction" ? ("contradiction" as const) : ("root" as const),
        };
      })
      .filter((l): l is NonNullable<typeof l> => !!l)
      .slice(0, 6);
    setSelected({
      id: belief.id,
      domain: belief.domain,
      statement: belief.statement,
      confidence: belief.confidence,
      evidenceCount: belief.evidenceCount,
      region,
      linked,
      evidenceQuotes: (belief.evidenceQuotes ?? []).slice(-2).reverse(),
    });

    // Recenter the camera on the tapped node so it glides to dead-center
    // of the screen. Preserves whatever zoom/viewing angle is currently
    // in play — the new camera position is just the node's position plus
    // the *same* offset the camera already had from the old orbit target
    // — rather than snapping to some fixed "close-up" distance the way
    // region fly-tos do, since here the point is purely re-framing, not
    // zooming in.
    const t = three.current;
    const idx = t?.indexOfBelief.get(beliefId);
    if (t && idx != null) {
      const p = t.positions[idx];
      const target = new THREE.Vector3(p[0], p[1], p[2]);
      const offset = t.camera.position.clone().sub(t.controls.target);
      flyTo(target.clone().add(offset), target, 750);
    }
  };

  const toggleRegion = (region: CognitiveRegion) => {
    const next = activeRegion === region ? null : region;
    setActiveRegion(next);
    const t = three.current;
    if (!t) return;
    if (next) {
      const ids = [...t.beliefIndexOf.entries()].filter(([idx]) => {
        const beliefId = t.beliefIndexOf.get(idx)!;
        const belief = beliefsRef.current.find((b) => b.id === beliefId);
        return belief && resolveRegion(belief) === next;
      });
      const pts = ids.length > 0 ? ids.map(([idx]) => t.positions[idx]) : [t.positions[0]];
      const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const cz = pts.reduce((s, p) => s + p[2], 0) / pts.length;
      const target = new THREE.Vector3(cx, cy, cz);
      const dir = target.clone().normalize().multiplyScalar(1.9);
      flyTo(new THREE.Vector3(cx + dir.x, cy + dir.y * 0.5, cz + dir.z), target, 850);
    } else {
      flyTo(three.current!.defaultCamPos.clone(), three.current!.defaultTarget.clone(), 700);
    }
  };

  const resetView = () => {
    setSearchQuery("");
    setActiveRegion(null);
    setSelected(null);
    const t = three.current;
    if (t) flyTo(t.defaultCamPos.clone(), t.defaultTarget.clone(), 700);
  };

  const totalBeliefs = beliefs.length;

  return (
    <div
      style={
        embedded
          ? { position: "relative", width: "100%", height, borderRadius: 30, background: bg, color: ink, ...sans, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 18px 50px rgba(10,9,20,0.28)" }
          : { position: "fixed", inset: 0, background: bg, color: ink, ...sans, overflow: "hidden", display: "flex", flexDirection: "column", zIndex: 40 }
      }
    >
      {/* ── Top bar: back (full-screen only), logo, search, reset ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 20px", flex: "none", zIndex: 5 }}>
        {!embedded && (
          <span
            role="button"
            tabIndex={0}
            onClick={onBack}
            style={{ ...sans, fontSize: 13, color: inkMid, cursor: "pointer", flexShrink: 0 }}
          >
            ← 뒤로
          </span>
        )}
        <div style={{ ...sans, fontWeight: 500, fontSize: 16, letterSpacing: "-0.01em", display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none">
            <path d="M6.5 3.2c-2 .3-3.4 2-3.3 4 .05.8-.2 1.1-.7 1.6-.9.9-.9 2.5 0 3.4.5.5.7.9.7 1.6 0 2.1 1.7 3.7 3.7 3.5" stroke={accentUi} strokeWidth="1.4" strokeLinecap="round" />
            <path d="M13.5 3.2c2 .3 3.4 2 3.3 4-.05.8.2 1.1.7 1.6.9.9.9 2.5 0 3.4-.5.5-.7.9-.7 1.6 0 2.1-1.7 3.7-3.7 3.5" stroke={accentUi} strokeWidth="1.4" strokeLinecap="round" />
            <path d="M10 3.6v13" stroke={accentUi} strokeWidth="1.2" strokeLinecap="round" strokeDasharray="0.2 3.2" />
          </svg>
          브레인 맵
        </div>
        {/* Search — full-screen only. On the embedded teaser card there's
            no room left for it once 확대 also needs a slot in this same
            row (this is what overflowed/clipped the 확대 button off the
            edge of the card before); the full search box is one tap away
            via 확대 → the full-screen route. */}
        {!embedded && (
          <div style={{ position: "relative", width: "100%", maxWidth: 240, marginLeft: "auto" }}>
            <svg width="14" height="14" viewBox="0 0 20 20" fill="none" style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}>
              <circle cx="8.5" cy="8.5" r="5.5" stroke="#9397ab" strokeWidth="1.5" />
              <path d="M16 16l-3.2-3.2" stroke="#9397ab" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="신념 검색"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                minHeight: 32,
                padding: "6px 10px 6px 30px",
                font: "inherit",
                fontSize: 12.5,
                color: ink,
                caretColor: accentUi,
                background: panelBg,
                border: modernist ? `1px solid ${line}` : `1px solid rgba(233,233,237,0.16)`,
                borderRadius: 8,
                outline: "none",
              }}
            />
          </div>
        )}
        <button
          onClick={resetView}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            cursor: "pointer",
            fontFamily: "Inter, sans-serif",
            fontWeight: modernist ? 800 : 500,
            fontSize: 12,
            color: accentUi,
            background: "transparent",
            border: `1px solid ${accentUi}`,
            padding: "6px 11px",
            borderRadius: 8,
            flexShrink: 0,
            marginLeft: embedded ? "auto" : undefined,
          }}
        >
          초기화
        </button>
        {embedded && onExpand && (
          <button
            onClick={onExpand}
            aria-label="확대"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              width: 30,
              height: 30,
              color: accentUi,
              background: accentUiSoft,
              border: `1px solid ${accentUi}`,
              borderRadius: 8,
              flexShrink: 0,
              padding: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 20 20" fill="none">
              <path d="M13 3h4v4M17 3l-6 6M7 17H3v-4M3 17l6-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      {/* ── Canvas + overlays ── */}
      <div ref={wrapRef} style={{ position: "relative", flex: 1, minHeight: 0 }}>
        <canvas
          ref={canvasRef}
          onClick={(e) => {
            const id = pickBeliefAt(e.clientX, e.clientY);
            if (id) selectBelief(id);
          }}
          onMouseMove={(e) => {
            const id = pickBeliefAt(e.clientX, e.clientY);
            if (id) {
              const belief = beliefsRef.current.find((b) => b.id === id);
              const rect = canvasRef.current!.getBoundingClientRect();
              setHover(belief ? { label: belief.statement, x: e.clientX - rect.left, y: e.clientY - rect.top } : null);
            } else if (hover) {
              setHover(null);
            }
          }}
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", cursor: hover ? "pointer" : cursor }}
        />

        {/* ── Left rail: regions — full-screen only. At the embedded card's
            width (420px teaser on Home) this 178px opaque panel used to
            cover most of the canvas, hiding almost the whole brain; the
            full rail (with per-region counts) is still one tap away via
            the full-screen "brainmap" route. ── */}
        {!embedded && (
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 18,
              width: 178,
              background: panelBg,
              borderRadius: 8,
              padding: 13,
              display: "flex",
              flexDirection: "column",
              gap: 8,
              boxShadow: `0 0 0 1px ${line}`,
            }}
          >
            <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: accentUi, marginBottom: 2 }}>영역</div>
            {COGNITIVE_REGIONS.map((region) => {
              const active = activeRegion === region;
              return (
                <div
                  key={region}
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleRegion(region)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 12.5,
                    cursor: "pointer",
                    padding: "5px 6px",
                    borderRadius: 6,
                    background: active ? accentUiSofter : "transparent",
                    boxShadow: active ? `inset 0 0 0 1px ${accentUi}` : "none",
                  }}
                >
                  <span style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, backgroundColor: REGION_CONFIG[region].color }} />
                  <span style={{ flex: 1, color: active ? ink : inkSoft }}>{REGION_CONFIG[region].label}</span>
                  <span style={{ fontSize: 10.5, color: inkMid }}>{regionCounts[region] ?? 0}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Stats line always shows (short, never wraps). The longer drag/
            scroll/click hint is full-screen only — on the embedded card it
            used to sit at the same `bottom: 16` row as the stats line with
            no width limit on either, so at teaser-card width the two ran
            into each other. */}
        <div style={{ position: "absolute", bottom: 16, left: 20, right: embedded ? 20 : "auto", fontSize: 11, color: inkFaint, letterSpacing: "0.02em", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {totalBeliefs}개 신념 · {connectionCount}개 연결
        </div>
        {!embedded && (
          <div style={{ position: "absolute", bottom: 16, right: 20, fontSize: 11, color: inkFaint }}>
            드래그해서 회전 · 스크롤해서 확대 · 클릭해서 선택
          </div>
        )}

        {hover && (
          <div
            data-testid="node-tooltip"
            style={{
              position: "absolute",
              left: hover.x,
              top: hover.y,
              transform: "translate(14px,-50%)",
              pointerEvents: "none",
              background: panelBg,
              border: `1px solid ${line}`,
              borderRadius: 6,
              padding: "6px 10px",
              fontSize: 12,
              maxWidth: 220,
              lineHeight: 1.4,
              wordBreak: "keep-all",
              boxShadow: "0 6px 18px rgba(0,0,0,0.55)",
            }}
          >
            {hover.label}
          </div>
        )}

        {/* ── Right slide-in detail panel ── */}
        <div
          data-testid="node-panel"
          data-open={selected ? "true" : "false"}
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            bottom: 0,
            width: 300,
            maxWidth: "82vw",
            background: panelBg,
            boxShadow: `0 0 0 1px ${line}, -16px 0 40px rgba(0,0,0,0.4)`,
            transform: selected ? "translateX(0)" : "translateX(110%)",
            transition: "transform .32s cubic-bezier(.2,.7,.3,1)",
            padding: 20,
            display: "flex",
            flexDirection: "column",
            gap: 10,
            overflowY: "auto",
          }}
        >
          {selected && (
            <>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    fontSize: 10,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    padding: "3px 9px",
                    borderRadius: 6,
                    background: modernist ? mdNeutralTagLocal : "rgba(145,132,217,0.16)",
                    color: modernist ? "#444141" : REGION_CONFIG[selected.region].color,
                  }}
                >
                  {REGION_CONFIG[selected.region].label}
                </span>
                <span data-testid="node-panel-close" role="button" tabIndex={0} onClick={() => setSelected(null)} style={{ background: "transparent", border: "none", cursor: "pointer", color: inkMid, padding: 2 }}>
                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none">
                    <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                </span>
              </div>
              <div style={{ ...serif, fontSize: 18, lineHeight: 1.35, letterSpacing: "-0.01em", wordBreak: "keep-all" }}>{selected.statement}</div>
              <div style={{ ...mono, fontSize: 11, color: inkMid }}>
                {selected.domain} · 근거 {selected.evidenceCount}건 · 확신도 {selected.confidence}%
              </div>
              <div style={{ height: 1, margin: "9px 0", background: `linear-gradient(to right, transparent, ${line} 24px, ${line} calc(100% - 24px), transparent)` }} />
              <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: modernist ? accentUi : inkMid, fontWeight: modernist ? 800 : 400 }}>왜 이 별들이 연결되어 있나요</div>
              {selected.linked.length === 0 ? (
                <div style={{ fontSize: 12.5, color: inkFaint, padding: "6px 0" }}>연결된 신념이 없어요.</div>
              ) : (
                selected.linked.map((l) => (
                  <div key={l.id} style={{ padding: "10px 0", borderBottom: `1px solid ${line}` }}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => selectBelief(l.id)}
                      style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", wordBreak: "keep-all" }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: "50%", flexShrink: 0, backgroundColor: l.color }} />
                      <span style={{ flex: 1, fontWeight: modernist ? 700 : 400 }}>{l.title}</span>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 700,
                          flexShrink: 0,
                          padding: "2px 7px",
                          borderRadius: 999,
                          color: l.kind === "contradiction" ? (modernist ? accentUi : "#ff3b57") : (modernist ? "#444141" : "#9184d9"),
                          background: l.kind === "contradiction" ? (modernist ? "transparent" : "rgba(255,59,87,0.14)") : (modernist ? mdNeutralTagLocal : "rgba(145,132,217,0.16)"),
                          border: l.kind === "contradiction" && modernist ? `1px solid ${accentUi}` : "none",
                        }}
                      >
                        {l.kind === "contradiction" ? "상충" : "기반 공유"}
                      </span>
                    </div>
                    {l.note && (
                      <div style={{ fontSize: 12, color: inkMid, marginTop: 5, lineHeight: 1.55, wordBreak: "keep-all" }}>{l.note}</div>
                    )}
                  </div>
                ))
              )}
              {selected.evidenceQuotes.length > 0 && (
                <>
                  <div style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: modernist ? accentUi : inkMid, fontWeight: modernist ? 800 : 400, marginTop: 14 }}>이 패턴을 뒷받침하는 순간들</div>
                  {selected.evidenceQuotes.map((q, i) => (
                    <div key={i} style={{ borderLeft: `2px solid ${modernist ? accentUi : line}`, paddingLeft: 10, marginTop: i === 0 ? 8 : 10 }}>
                      <div style={{ ...mono, fontSize: 10.5, color: inkMid }}>{q.date}</div>
                      <div style={{ ...serif, fontStyle: "italic", fontSize: 13, color: inkSoft, marginTop: 4, lineHeight: 1.5, wordBreak: "keep-all" }}>"{q.quote}"</div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
