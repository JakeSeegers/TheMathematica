/**
 * Helpers of the Open Doors tour (`sandbox/campaign.open-doors.json`): the demo campaign
 * *Emberfall — Open Doors* (`public/campaigns/emberfall-interiors/`,
 * docs/design/campaigns/emberfall-interiors.md) — Emberfall with a room behind every door and the
 * floors above the inn, the windmill and the barn. On top of the room checks' recorder
 * (`sandbox/campaign_interior.js`, `CI.trip`: per travel its times, whether the level came back set
 * aside, programs at the arrival and after a moment of play, GPU memory, the scene's size, the
 * world hashes) each travel here also checks the arrival — the level, the player at the named
 * entrance — and the room's light descriptors (≤ 12). `expect` failures are page errors (the
 * harness exits 1).
 *
 * Installed by an `eval` step: `import('/sandbox/campaign_open_doors.js')` → `window.OD` (and
 * `window.CI`).
 */
import CI from './campaign_interior.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const G = () => window.__game;
const game = () => window.__game.game;
const text = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * The town's buildings: the door's exit, the room behind it, the town's entrance for the way back,
 * and — for the inn, the windmill and the barn — the floor above (both floors' stairs are the exit
 * `exit_stairs`).
 */
const BUILDINGS = [
  { door: 'door_inn', room: 'inn', outside: 'inn-door', upper: 'inn-upstairs' },
  { door: 'door_windmill', room: 'windmill', outside: 'windmill-door', upper: 'windmill-upper' },
  { door: 'door_barn', room: 'barn', outside: 'barn-door', upper: 'barn-loft' },
  { door: 'door_elder_house', room: 'elder-house', outside: 'elder-door' },
  { door: 'door_riverside_house', room: 'riverside-house', outside: 'riverside-door' },
  { door: 'door_thatch_cottage', room: 'thatch-cottage', outside: 'cottage-door' },
  { door: 'door_lodge', room: 'lodge', outside: 'lodge-door' },
];

/** FNV-1a over a string or the bytes of a typed array. */
function fnv(h, v) {
  if (typeof v === 'string') {
    for (let i = 0; i < v.length; i++) { h ^= v.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h;
  }
  const b = new Uint8Array(v.buffer, v.byteOffset, v.byteLength);
  for (let i = 0; i < b.length; i++) { h ^= b[i]; h = Math.imul(h, 16777619); }
  return h;
}
const r3 = (v) => Math.round(v * 1000) / 1000;

/** The entrance of the level played now called `name` (its `name`, else its id). */
function entranceOf(name) {
  return game().level.objects.find((o) => o.type === 'entrance' && (text(o.name) || o.id) === name) ?? null;
}

const OD = {
  CI,
  BUILDINGS,
  sleep,
  /** Times (ms) of every travel through a door or a stair, by kind (see `go`). */
  times: { first: [], kept: [], built: [] },
  /** Wait for play; the recorder without the cellar key (this campaign has no story items). */
  async ready() {
    CI.suite = 'campaign.open-doors';
    const r = await CI.ready({ give: null });
    const s = G().state();
    return { ...r, programs: CI.gpu().programs, drawCalls: s.drawCalls, lights: s.pointLights, descriptors: game().world.stats.lightDescriptors };
  },
  /**
   * The town's look as data: a hash of the world's static scene (every mesh but the animated ones —
   * `userData.dynamic`, the windmill's sails — with its geometry, material and place), its
   * colliders, light descriptors and emissive registrations, the world's build stats and its object
   * count without exits and entrances. Equal to standalone Emberfall's: the town looks exactly like
   * Emberfall (only the doors' prompts differ — the interactables are left out).
   */
  townPrint() {
    const w = game().world;
    let h = 2166136261;
    let meshes = 0;
    const skip = new Set();
    w.root.updateMatrixWorld(true);
    w.root.traverse((node) => {
      if (node.userData?.dynamic || (node.parent && skip.has(node.parent))) { skip.add(node); return; }
      // (a mesh, a line or points: anything with a geometry)
      const o = /** @type {import('three').Mesh} */ (node);
      const g = o.geometry;
      if (!g) return;
      meshes++;
      h = fnv(h, `${o.type}|${o.name}|${o.visible}|${o.castShadow}|${o.receiveShadow}|`);
      h = fnv(h, new Float32Array(o.matrixWorld.elements.map(r3)));
      for (const m of /** @type {any[]} */ (Array.isArray(o.material) ? o.material : [o.material])) h = fnv(h, `${m?.type}|${m?.name}|${m?.map?.name ?? ''}|`);
      for (const [name, a] of Object.entries(g.attributes)) { h = fnv(h, `${name}:${a.count}:`); if (a.array) h = fnv(h, a.array); }
      if (g.index) h = fnv(h, g.index.array);
    });
    const tm = w.tileMap;
    h = fnv(h, JSON.stringify(tm.colliders.map((c) => (c.type === 'circle' ? [r3(c.x), r3(c.z), r3(c.r)] : [r3(c.minX), r3(c.maxX), r3(c.minZ), r3(c.maxZ)]))));
    h = fnv(h, JSON.stringify((w.lightPool?.descriptors ?? []).map((d) => [d.tag, r3(d.position.x), r3(d.position.y), r3(d.position.z), d.intensity, d.distance])));
    // (the level's object count apart: the town adds its doors' exits and entrances, markers that build nothing)
    const { buildMs, phases, objects, ...stats } = w.stats;
    const markers = game().level.objects.filter((o) => o.type === 'exit' || o.type === 'entrance').length;
    return { hash: (h >>> 0).toString(16).padStart(8, '0'), meshes, colliders: tm.colliders.length, emissives: w.emissiveEntries.length, stats: JSON.stringify(stats), objects: objects - markers };
  },
  /** Stand at entrance `name` of the level played now (where a travel arrives, facing away from the door or stair). */
  standAt(name) {
    const e = entranceOf(name);
    if (!e) throw new Error(`no entrance ${name} in ${G().state().campaign.level}`);
    G().teleport(e.x, e.z);
    return JSON.stringify({ at: [e.x, e.z], facing: e.facing });
  },
  /**
   * The prompt the player sees now: the nearest interactable and its label; checks them.
   * @param {string} id the interactable expected (`exit:<exit id>`)
   * @param {string} label its prompt
   */
  prompt(id, label) {
    const s = G().state();
    const it = game().world.interactables.find((i) => i.id === s.nearest);
    const shown = document.querySelector('.lu-prompt')?.textContent ?? null;
    CI.expect(s.nearest === id && it?.label === label, `the prompt at the door is ${label} (${id}): ${s.nearest} ${it?.label}`);
    return JSON.stringify({ nearest: s.nearest, label: it?.label ?? null, shown, player: [s.player.x, s.player.z, s.player.facing] });
  },
  /**
   * After a travel made with real key presses: the level, the player at the entrance, set aside or
   * not as expected.
   * @param {string} level
   * @param {string} entrance
   * @param {{ kept?: boolean }} [o]
   */
  arrived(level, entrance, { kept } = {}) {
    const s = G().state();
    const c = s.campaign;
    const e = entranceOf(entrance);
    const d = e ? Math.hypot(s.player.x - e.x, s.player.z - e.z) : null;
    CI.expect(c.level === level, `arrived in ${level}: ${c.level}`);
    CI.expect(d !== null && d < 0.6, `arrived at the entrance ${entrance} (${d})`);
    if (kept !== undefined) CI.expect(c.stats.lastKept === kept, `${level}: ${kept ? 'attached again (set aside)' : 'built'}: lastKept ${c.stats.lastKept}`);
    return JSON.stringify({ level: c.level, at: d === null ? null : +d.toFixed(2), kept: c.stats.lastKept, travelMs: c.stats.lastMs, prep: c.stats.lastPrep, aside: c.aside });
  },
  /**
   * One travel through exit `exit` of the level played now, standing on it (`wait` ms first — a
   * player walking up to it: the level behind it is built ahead meanwhile), recorded by `CI.trip`;
   * checks the arrival (the level, the player at the exit's entrance), the light descriptors, that
   * no program compiled after the arrival, and `kept` (true: attached again, false: built) when
   * given.
   * @param {string} exit
   * @param {{ wait?: number, settle?: number, kept?: boolean, label?: string }} [o]
   */
  async go(exit, { wait = 0, settle = 1200, kept, label = '' } = {}) {
    const ex = game().campaign._exits.find((e) => e.id === exit);
    if (!ex) throw new Error(`no exit ${exit} in ${G().state().campaign.level}`);
    /** @type {[number, number]} */
    const at = [(ex.minX + ex.maxX) / 2, (ex.minZ + ex.maxZ) / 2];
    const r = await CI.trip(exit, { wait, settle, at, label });
    const route = r.route;
    const p = game().player.position;
    const e = entranceOf(text(ex.entrance));
    r.arrival = e ? +Math.hypot(p.x - e.x, p.z - e.z).toFixed(2) : null;
    r.descriptors = game().world.stats.lightDescriptors;
    CI.expect(r.ok && r.level === ex.to, `${route}: arrived in ${ex.to} (${r.level})`);
    CI.expect(r.arrival !== null && r.arrival < 0.6, `${route}: at the entrance "${ex.entrance}" (${r.arrival})`);
    CI.expect(r.lights === 12 && r.descriptors <= 12, `${route}: 12 point lights, ≤ 12 light descriptors (${r.lights}, ${r.descriptors})`);
    CI.expect(r.programsAtArrival === r.programsAfterPlay, `${route}: no program compiled after the arrival (${r.programsAtArrival} → ${r.programsAfterPlay})`);
    if (kept !== undefined) CI.expect(r.kept === kept, `${route}: ${kept ? 'attached again (set aside)' : 'built'} (lastKept ${r.kept})`);
    if (r.kept && r.leftHash) CI.expect(r.sameHash === true, `${route}: the level set aside comes back as it was left (hash ${r.hash} / ${r.leftHash})`);
    (r.kept ? OD.times.kept : r.prepUsed ? OD.times.first : OD.times.built).push(r.travelMs);
    return r;
  },
  /** A short JSON of a trip record. */
  json(r) {
    return JSON.stringify({ route: r.route, kept: r.kept, travelMs: r.travelMs, buildMs: r.buildMs, prep: r.prepUsed, arrival: r.arrival, programs: `${r.programsAtArrival}/${r.programsAfterPlay}`, lights: `${r.lights}/${r.descriptors}`, drawCalls: r.drawCalls, memory: r.memory, scene: r.scene, aside: r.aside.map((a) => `${a.slot}:${a.level}`).join(' ') });
  },
  /**
   * A building there and back: in through its door (after `wait`), up the stairs and down again
   * when it has an upper floor, out, in again at once (the last room, set aside) and out.
   * @param {typeof BUILDINGS[number]} b
   * @param {{ wait?: number, settle?: number, firstVisit?: boolean }} [o]
   */
  async building(b, { wait = 0, settle = 600, firstVisit = false } = {}) {
    const out = [];
    out.push(await OD.go(b.door, { wait, settle, kept: firstVisit ? false : undefined }));
    if (b.upper) {
      out.push(await OD.go('exit_stairs', { wait, settle, kept: firstVisit ? false : undefined }));
      out.push(await OD.go('exit_stairs', { settle, kept: true }));
    }
    out.push(await OD.go('exit_out', { settle, kept: true }));
    out.push(await OD.go(b.door, { settle, kept: true }));
    out.push(await OD.go('exit_out', { settle, kept: true }));
    return out;
  },
  /**
   * Talk to villager `id` (`talkTo`) and read the conversation page by page (Space through the
   * typewriter and the pages) until the window closes: the speaker and the pages' text. Checks the
   * speaker and that some page contains `expect`.
   * @param {string} id
   * @param {string} speaker
   * @param {string} expect
   */
  async talk(id, speaker, expect) {
    const g = game();
    const ok = G().talkTo(id);
    const pages = [];
    let who = '';
    for (let i = 0; i < 80 && (g.busy || g.ui.dialog.isOpen); i++) {
      await sleep(250);
      const d = g.ui.dialog;
      if (!d.isOpen) continue;
      who = (d._speakerEl ?? d._nameEl)?.textContent?.trim() || who;
      if (!d.isTyping) {
        const t = d._textEl?.textContent?.trim() ?? '';
        if (t && pages.at(-1) !== t) pages.push(t);
      }
      window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true }));
      await sleep(40);
      window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ', bubbles: true }));
    }
    CI.expect(ok && who === speaker && pages.some((p) => p.includes(expect)), `talking to ${id}: ${speaker} says "${expect}…" (${who}: ${JSON.stringify(pages)})`);
    await sleep(900);
    return { id, ok, speaker: who, pages };
  },
  /** Fade the arrival banner out now (for a screenshot of the room; its fade takes ≈ 1.1 s). */
  async hideBanner() {
    game().ui.banner.hide();
    await sleep(1200);
    return 'ok';
  },
  /** Wait for the first gameplay frames of a page without a campaign (Emberfall on its own). */
  async loaded() {
    for (let i = 0; i < 600 && !window.__luminati?.loadMs; i++) await sleep(100);
    await sleep(300);
    return { loadMs: window.__luminati?.loadMs ?? null, level: game().level.name, programs: CI.gpu().programs, drawCalls: G().state().drawCalls };
  },
  /**
   * The town alone: nothing set aside, no level built ahead — GPU memory, programs and the scene's
   * size (for the no-leak comparison of two tours).
   */
  async alone() {
    const c = game().campaign;
    c.prepareAhead = false;
    c._prep?.dispose();
    c._prep = null;
    c.dropAside();
    await sleep(800);
    const out = { level: G().state().campaign.level, memory: CI.gpu(), scene: CI.sceneSize() };
    c.prepareAhead = true;
    return out;
  },
};

window.OD = OD;
export default OD;
