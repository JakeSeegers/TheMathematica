/**
 * The GLAIVE talents this game implements (docs/specs/GLAIVE.md §4): the ones that matter in a
 * turn-based fight. A talent is an id the rules check (`sheet.has('cleave')`) plus data: its
 * archetype, the hit points it adds per level, and for an active talent its uses per rest. Names
 * and descriptions are shown through the 'glaive' strings (`talent.<id>.name` / `.text`), written in
 * our own words. Import-free and Node-safe.
 *
 * Talents the tabletop has that only make sense at a table (tracking, carousing, smelling treasure)
 * are left out; GLAIVE invites groups to pick and reskin, and this list is this game's pick.
 */

/**
 * The archetypes talents are grouped by (a character may take talents from any of them).
 * @typedef {'barbarian'|'holy'|'hunter'|'magic'|'thief'|'warrior'|'raconteur'|'ancestry'} TalentGroup
 */

/**
 * One talent.
 * - `hpPerLevel`: extra HP per level (and at level 1).
 * - `uses` / `per`: an active talent's uses per rest ('long': a Waystone; 'fight': every fight —
 *   the game's reading of GLAIVE's short rest, which a party takes between most fights). A number
 *   or 'HL' ([HL]) or 'HL+1'.
 * - `action`: the menu action it adds in a fight ('rage', 'radiance', 'inspire'); `option`: an
 *   option of the attack ('smite').
 * - `ancestry`: only characters of that ancestry may take it.
 * @typedef {object} TalentDef
 * @property {TalentGroup} group
 * @property {number} [hpPerLevel]
 * @property {number|'HL'|'HL+1'} [uses]
 * @property {'long'|'fight'} [per]
 * @property {'rage'|'radiance'|'inspire'|'rush'} [action]
 * @property {'smite'} [option]
 * @property {string} [ancestry]
 */

/** @type {Readonly<Record<string, Readonly<TalentDef>>>} */
export const TALENTS = Object.freeze({
  // ---- barbarian ----
  cleave: Object.freeze({ group: 'barbarian' }),
  dieHard: Object.freeze({ group: 'barbarian', uses: 1, per: 'long' }),
  favorOfGods: Object.freeze({ group: 'barbarian', hpPerLevel: 2 }),
  rage: Object.freeze({ group: 'barbarian', uses: 'HL', per: 'long', action: 'rage' }),
  rush: Object.freeze({ group: 'barbarian', uses: 'HL+1', per: 'long', action: 'rush' }),
  savageStrike: Object.freeze({ group: 'barbarian' }),
  // ---- holy warrior ----
  smite: Object.freeze({ group: 'holy', uses: 'HL', per: 'fight', option: 'smite' }),
  radiance: Object.freeze({ group: 'holy', uses: 'HL', per: 'long', action: 'radiance' }),
  heavensTouch: Object.freeze({ group: 'holy', hpPerLevel: 2 }),
  signsPortents: Object.freeze({ group: 'holy', uses: 1, per: 'long' }),
  // ---- hunter ----
  deadeye: Object.freeze({ group: 'hunter' }),
  quickShot: Object.freeze({ group: 'hunter' }),
  inhumanAccuracy: Object.freeze({ group: 'hunter' }),
  monsterSlayer: Object.freeze({ group: 'hunter', uses: 'HL', per: 'long' }),
  // ---- magic user ----
  scholar: Object.freeze({ group: 'magic' }),
  magicWard: Object.freeze({ group: 'magic' }),
  thriceDivided: Object.freeze({ group: 'magic' }),
  // ---- thief ----
  backstab: Object.freeze({ group: 'thief' }),
  evasion: Object.freeze({ group: 'thief' }),
  skulker: Object.freeze({ group: 'thief' }),
  // ---- warrior ----
  girdedLoins: Object.freeze({ group: 'warrior', uses: 1, per: 'fight' }),
  hackSlash: Object.freeze({ group: 'warrior' }),
  professionalKiller: Object.freeze({ group: 'warrior', hpPerLevel: 2 }),
  riposte: Object.freeze({ group: 'warrior' }),
  shieldMaster: Object.freeze({ group: 'warrior' }),
  veteran: Object.freeze({ group: 'warrior', hpPerLevel: 2 }),
  opportunist: Object.freeze({ group: 'warrior' }),
  // ---- raconteur ----
  inspire: Object.freeze({ group: 'raconteur', action: 'inspire' }),
  // ---- ancestries ----
  brickOuthouse: Object.freeze({ group: 'ancestry', ancestry: 'demiOgre', hpPerLevel: 2 }),
  rootsOfMountain: Object.freeze({ group: 'ancestry', ancestry: 'dwarf', hpPerLevel: 2 }),
  alert: Object.freeze({ group: 'ancestry', ancestry: 'elf' }),
  luckOfSmallFolk: Object.freeze({ group: 'ancestry', ancestry: 'halfFoot', uses: 1, per: 'long' }),
  toughAsNails: Object.freeze({ group: 'ancestry', ancestry: 'orc', uses: 1, per: 'long' }),
  sneakyGit: Object.freeze({ group: 'ancestry', ancestry: 'goblin' }),
});

/** The talent ids in catalogue order. */
export const TALENT_IDS = Object.freeze(Object.keys(TALENTS));

/**
 * The ancestries (GLAIVE: Ancestries): each starts with its talent and one more of the player's
 * choice; a human starts with any two.
 * @type {Readonly<Record<string, { talent: string|null }>>}
 */
export const ANCESTRIES = Object.freeze({
  human: Object.freeze({ talent: null }),
  dwarf: Object.freeze({ talent: 'rootsOfMountain' }),
  elf: Object.freeze({ talent: 'alert' }),
  halfFoot: Object.freeze({ talent: 'luckOfSmallFolk' }),
  demiOgre: Object.freeze({ talent: 'brickOuthouse' }),
  orc: Object.freeze({ talent: 'toughAsNails' }),
  goblin: Object.freeze({ talent: 'sneakyGit' }),
});

/** The ancestry ids in order. */
export const ANCESTRY_IDS = Object.freeze(Object.keys(ANCESTRIES));

/** @param {unknown} id @returns {id is string} */
export function isTalent(id) {
  return typeof id === 'string' && Object.hasOwn(TALENTS, id);
}

/**
 * The uses of an active talent at level `L` (0: no limited uses).
 * @param {string} id
 * @param {number} L
 */
export function talentUses(id, L) {
  const u = TALENTS[id]?.uses;
  if (u === undefined) return 0;
  if (u === 'HL') return Math.ceil(L / 2);
  if (u === 'HL+1') return Math.ceil(L / 2) + 1;
  return u;
}

/**
 * The talents a character of this ancestry may still take (not the ones it has, not another
 * ancestry's).
 * @param {string[]} have
 * @param {string} ancestry
 * @returns {string[]}
 */
export function talentChoices(have, ancestry) {
  return TALENT_IDS.filter((id) => {
    if (have.includes(id)) return false;
    const a = TALENTS[id].ancestry;
    return !a || a === ancestry;
  });
}
