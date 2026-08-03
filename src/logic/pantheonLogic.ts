/**
 * Pantheon Support profile — the off-champ when Pyke is banned.
 *
 * Pantheon support is a snowball engage/roam pick: extremely strong when the
 * lane goes his way, and genuinely difficult once he is behind (no scaling, no
 * range, no escape). That asymmetry is encoded here — build, runes, summoners
 * and fight selection all change on the behind / even / ahead read.
 */
import {
  analyzeBotLaneMatchup,
  type Build,
  type Champion,
  type DominanceMetrics,
  type Item,
  type MatchupAnalysis,
  type RunePage,
} from './pykeLogic';
import { activeThreats, applyThreatScoring, threatTips } from './counters';
import { evaluateCrossMap } from './crossMap';
import { buildPreyFocus } from './preyFocus';
import { EVEN_SITUATION, type ProfileSituation } from './situation';

const ITEMS = {
  // 3865 = purchasable World Atlas. 3867 Bounty of Worlds is NOT a starter (quest mid-step).
  WORLD_ATLAS: { id: '3865', name: 'World Atlas', icon: 'World_Atlas', reason: 'Support starter — gold curve + free wards for the roam route.' },
  BLOODSONG: { id: '3877', name: 'Bloodsong', icon: 'Bloodsong', reason: 'Atlas finish — AD + execute amp when you are the engage threat.' },
  POTION: { id: '2003', name: 'Health Potion', icon: 'Health_Potion', reason: 'HP buffer so a lost trade is not a lost lane.' },
  CONTROL_WARD: { id: '2055', name: 'Control Ward', icon: 'Control_Ward', reason: 'Buy every back — hold 1–2. Pit pink before objectives.' },
  ORACLE_LENS: { id: '3364', name: 'Oracle Lens', icon: 'Oracle_Lens', reason: 'Sweeper — swap ~9 min; clear the bush you engage from.' },

  // Finished Noxian upgrades (shop chain: Boots → mid → upgrade).
  MERCURY_TREADS: { id: '3173', name: 'Chainlaced Crushers', icon: 'Chainlaced_Crushers', reason: 'Finish Mercs → Crushers. Tenacity upgrade.' },
  PLATED_STEELCAPS: { id: '3174', name: 'Armored Advance', icon: 'Armored_Advance', reason: 'Finish Steelcaps → Armored Advance.' },
  IONIAN_BOOTS: { id: '3171', name: 'Crimson Lucidity', icon: 'Crimson_Lucidity', reason: 'Finish Ionian → Crimson Lucidity. Haste upgrade.' },
  SWIFTMARCH: { id: '3170', name: 'Swiftmarch', icon: 'Swiftmarch', reason: 'Finish Swiftness → Swiftmarch. Roam MS path.' },

  SUNDERED_SKY: { id: '6610', name: 'Sundered Sky', icon: 'Sundered_Sky', reason: 'Heal on the first strike — the item that lets you fight from behind.' },
  ECLIPSE: { id: '6692', name: 'Eclipse', icon: 'Eclipse', reason: 'Shield + %HP on your two-hit pattern — survivable spike.' },
  PROFANE_HYDRA: { id: '6698', name: 'Profane Hydra', icon: 'Profane_Hydra', reason: 'Burst + wave control when you are allowed to play forward.' },
  BLACK_CLEAVER: { id: '3071', name: 'Black Cleaver', icon: 'The_Black_Cleaver', reason: 'HP + shred — the front-to-back item when your team needs you alive.' },
  YOUMUUS_GHOSTBLADE: { id: '3142', name: "Youmuu's Ghostblade", icon: 'Youmuu_s_Ghostblade', reason: 'MS active — turn a crashed wave into a mid/jg kill.' },
  // Opportunity (6701) removed patch 26.9 — Voltaic fills the upfront lethality slot.
  VOLTAIC_CYCLOSWORD: { id: '6699', name: 'Voltaic Cyclosword', icon: 'Voltaic_Cyclosword', reason: 'Energized burst on abilities — the snowball lethality item after Opportunity\'s removal.' },
  HUBRIS: { id: '6697', name: 'Hubris', icon: 'Hubris', reason: 'Takedown AD stacking — only when you are already winning.' },
  UMBRAL_GLAIVE: { id: '3179', name: 'Umbral Glaive', icon: 'Umbral_Glaive', reason: 'Ward clear — engage from fog they think is warded.' },

  STERAKS: { id: '3053', name: "Sterak's Gage", icon: 'Sterak_s_Gage', reason: 'Shield on burst — stay standing long enough for E to matter.' },
  DEATHS_DANCE: { id: '6333', name: "Death's Dance", icon: 'Death_s_Dance', reason: 'Bleed physical burst — survive AD assassin all-ins.' },
  MAW_OF_MALMORTIUS: { id: '3156', name: 'Maw of Malmortius', icon: 'Maw_of_Malmortius', reason: 'Lifeline vs AP burst so your engage still lands.' },
  RANDUINS: { id: '3143', name: "Randuin's Omen", icon: 'Randuin_s_Omen', reason: 'Armor + crit reduction — blunt the ADC/diver that deletes you.' },
  LOCKET: { id: '3190', name: 'Locket of the Iron Solari', icon: 'Locket_of_the_Iron_Solari', reason: 'Team shield — value that does not depend on you being ahead.' },
  KNIGHTS_VOW: { id: '3109', name: "Knight's Vow", icon: 'Knight_s_Vow', reason: 'Bind to a fed ADC — best behind-item when your carry is the win condition.' },
  GUARDIAN_ANGEL: { id: '3026', name: 'Guardian Angel', icon: 'Guardian_Angel', reason: 'Revive — an engage support who is allowed one mistake.' },
  SERPENTS_FANG: { id: '6695', name: "Serpent's Fang", icon: 'Serpents_Fang', reason: 'Shield reaver — cut Lulu/Sett/Karma pads before you commit.' },
  CHEMPUNK: { id: '6609', name: 'Chempunk Chainsword', icon: 'Chempunk_Chainsword', reason: 'Grievous — stop healers outlasting your burst window.' },
  SERYLDAS: { id: '6694', name: "Serylda's Grudge", icon: 'Serylda_s_Grudge', reason: 'Pen + slow vs the frontline that soaks your combo.' },
  MERCURIAL: { id: '3139', name: 'Mercurial Scimitar', icon: 'Mercurial_Scimitar', reason: 'Cleanse suppression/chain CC that deletes you mid-engage.' },
  ELIXIR: { id: '2140', name: 'Elixir of Wrath', icon: 'Elixir_of_Wrath', reason: 'Elixir for the fight that closes the game.' },
};

/** Enemy bot lanes that make Pantheon support miserable (ranged disengage / poke). */
const HARD_LANE_SUPPORTS = ['Morgana', 'Janna', 'Lulu', 'Karma', 'Milio', 'Zilean', 'Nami', 'Soraka'];
const POKE_SUPPORTS = ['Brand', 'Zyra', 'VelKoz', 'Lux', 'Xerath', 'Mel', 'Swain', 'Senna', 'Zoe'];
/** ADCs that can simply walk away from a Pantheon W. */
const ESCAPE_ADCS = ['Ezreal', 'Lucian', 'Tristana', 'Zeri', 'KaiSa', 'Nilah', 'Corki', 'Vayne'];
/** Allies who make Pantheon's engage free (lockdown + follow-up damage). */
const SETUP_ALLY_MIDS = [
  'Orianna', 'Syndra', 'Ahri', 'Lux', 'Annie', 'Neeko', 'Veigar', 'Malzahar', 'Viktor', 'Taliyah',
  'Anivia', 'Zoe', 'Hwei', 'Mel', 'Galio', 'Swain', 'Lissandra',
];

interface PantheonCtx {
  ap: number;
  ad: number;
  cc: number;
  tanks: number;
  squishies: number;
  shields: number;
  healing: number;
  assassins: number;
  crit: number;
  suppression: number;
  hardLane: boolean;
  pokeLane: boolean;
  escapeAdc: boolean;
  enemyADC: Champion | null;
  enemySupport: Champion | null;
  enemyMid: Champion | null;
  allyAdc: Champion | null;
  allyMid: Champion | null;
  allySetup: boolean;
  situation: ProfileSituation;
}

const SHIELD_CHAMPS = ['Lulu', 'Janna', 'Karma', 'Sett', 'TahmKench', 'Shen', 'Sion', 'Nautilus', 'Mordekaiser', 'Milio'];
const HEALING_CHAMPS = ['Soraka', 'Yuumi', 'Aatrox', 'Sylas', 'Vladimir', 'DrMundo', 'Warwick', 'Briar', 'Nilah', 'Senna'];
const SUPPRESSION_CHAMPS = ['Malzahar', 'Warwick', 'Skarner'];
const CRIT_CARRIES = ['Jhin', 'Caitlyn', 'Tristana', 'Xayah', 'Sivir', 'MissFortune', 'Draven', 'Jinx', 'Yasuo', 'Yone', 'Tryndamere'];

function scanPantheon(
  enemyTeam: Champion[],
  yourADC?: Champion | null,
  allyMid?: Champion | null,
  situation?: ProfileSituation | null
): PantheonCtx {
  let ap = 0;
  let ad = 0;
  let cc = 0;
  let tanks = 0;
  let squishies = 0;
  let shields = 0;
  let healing = 0;
  let assassins = 0;
  let crit = 0;
  let suppression = 0;

  enemyTeam.forEach((c) => {
    if (c.tags.includes('Mage') || c.damageType === 'Magic') ap++;
    if (c.tags.includes('Marksman') || (c.tags.includes('Fighter') && c.damageType !== 'Magic')) ad++;
    if (c.tags.includes('Tank') || c.tags.includes('Fighter')) tanks++;
    if (c.tags.includes('Tank') || c.tags.includes('Support')) cc++;
    if (c.tags.includes('Assassin')) assassins++;
    const soft = c.tags.includes('Marksman') || c.tags.includes('Mage') || c.tags.includes('Assassin');
    if (soft && !c.tags.includes('Tank')) squishies++;
    if (SHIELD_CHAMPS.includes(c.id)) shields++;
    if (HEALING_CHAMPS.includes(c.id)) healing++;
    if (SUPPRESSION_CHAMPS.includes(c.id)) suppression++;
    if (CRIT_CARRIES.includes(c.id)) crit++;
  });

  const enemyADC = enemyTeam.find((c) => c.tags.includes('Marksman')) || null;
  const enemySupport =
    enemyTeam.find((c) => c.tags.includes('Support')) ||
    enemyTeam.find((c) => POKE_SUPPORTS.includes(c.id)) ||
    null;
  const enemyMid =
    enemyTeam.find(
      (c) =>
        (c.tags.includes('Mage') || c.tags.includes('Assassin')) &&
        !c.tags.includes('Marksman') &&
        c.id !== enemySupport?.id
    ) || null;

  return {
    ap,
    ad,
    cc,
    tanks,
    squishies,
    shields,
    healing,
    assassins,
    crit,
    suppression,
    hardLane: !!enemySupport && HARD_LANE_SUPPORTS.includes(enemySupport.id),
    pokeLane: !!enemySupport && POKE_SUPPORTS.includes(enemySupport.id),
    escapeAdc: !!enemyADC && ESCAPE_ADCS.includes(enemyADC.id),
    enemyADC,
    enemySupport,
    enemyMid,
    allyAdc: yourADC || null,
    allyMid: allyMid || null,
    allySetup: !!allyMid && SETUP_ALLY_MIDS.includes(allyMid.id),
    situation: situation || EVEN_SITUATION,
  };
}

type Scored = { item: Item; score: number; reason: string };

export function calculatePantheonBuild(
  enemyTeam: Champion[],
  yourADC?: Champion | null,
  allyMid?: Champion | null,
  situation?: ProfileSituation | null
): Build {
  const ctx = scanPantheon(enemyTeam, yourADC, allyMid, situation);
  const threats = activeThreats(enemyTeam);
  const behind = ctx.situation.state === 'behind';
  const ahead = ctx.situation.state === 'ahead';

  const starter: Item[] = [ITEMS.WORLD_ATLAS, ITEMS.POTION, ITEMS.POTION];

  // --- Boots ---
  let bootPool: Scored[] = [
    {
      item: ITEMS.MERCURY_TREADS,
      score: ctx.cc * 12 + ctx.ap * 5 + (ctx.suppression > 0 ? 18 : 0) + (behind ? 12 : 0),
      reason: behind
        ? 'Behind: tenacity is survival — you cannot afford to be CC-chained off one engage.'
        : `Tenacity vs ${ctx.cc} CC threats so W→Q→auto actually completes.`,
    },
    {
      item: ITEMS.PLATED_STEELCAPS,
      score: ctx.ad * 9 + ctx.crit * 6 + (ctx.assassins > 0 ? 8 : 0) + (behind ? 10 : 0) - (ctx.ap >= 3 ? 10 : 0),
      reason: `Physical damage reduction vs ${ctx.ad} AD threats.`,
    },
    {
      item: ITEMS.IONIAN_BOOTS,
      score: 26 + (ahead ? 8 : 0) - (behind ? 6 : 0),
      reason: 'Haste — more W stuns and E blocks per skirmish.',
    },
    {
      item: ITEMS.SWIFTMARCH,
      score: 20 + (ahead ? 16 : 0) + (ctx.hardLane ? 10 : 0) - (behind ? 14 : 0) - (ctx.cc >= 3 ? 10 : 0),
      reason: ctx.hardLane
        ? 'Unwinnable 2v2 — Swiftmarch turns every crash into a mid/jg fight instead.'
        : 'Roam tempo while you are the strongest thing on the map.',
    },
  ];
  bootPool = applyThreatScoring(bootPool, threats);
  bootPool.sort((a, b) => b.score - a.score);
  const boots: Item = { ...bootPool[0].item, reason: bootPool[0].reason };

  // --- First legendary: this is where behind/ahead really diverges ---
  let firstPool: Scored[] = [
    {
      item: ITEMS.SUNDERED_SKY,
      score: 34 + (behind ? 30 : 0) + ctx.ad * 3 + (ctx.hardLane ? 8 : 0),
      reason: behind
        ? 'Behind: the heal on first strike is the only way a losing Pantheon takes a trade and lives.'
        : 'Heal + guaranteed crit on the first strike — your Q opener always pays.',
    },
    {
      item: ITEMS.ECLIPSE,
      score: 30 + (behind ? 16 : 0) + ctx.squishies * 3,
      reason: 'Shield + %max HP on the two-hit pattern — damage that survives the counter-engage.',
    },
    {
      item: ITEMS.PROFANE_HYDRA,
      score: 26 + (ahead ? 20 : 0) + ctx.squishies * 4 - (behind ? 24 : 0),
      reason: 'Burst + wave clear when you are allowed to be the aggressor.',
    },
    {
      item: ITEMS.BLACK_CLEAVER,
      score: 18 + ctx.tanks * 8 + (behind ? 12 : 0),
      reason: 'HP + armor shred — stay alive in front while the team does the killing.',
    },
    {
      item: ITEMS.YOUMUUS_GHOSTBLADE,
      score: 16 + (ahead ? 22 : 0) - (behind ? 18 : 0),
      reason: 'MS active — convert crashes cross-map before they can respond.',
    },
    {
      item: ITEMS.UMBRAL_GLAIVE,
      score: 14 + (ahead ? 10 : 0) - (behind ? 8 : 0),
      reason: 'Ward clear — engage out of a bush they believe is covered.',
    },
  ];
  firstPool = applyThreatScoring(firstPool, threats);
  firstPool.sort((a, b) => b.score - a.score);
  const first = firstPool[0];

  // --- Second item ---
  let secondPool: Scored[] = [
    {
      item: ITEMS.STERAKS,
      score: (behind ? 34 : 12) + ctx.assassins * 6 + ctx.ad * 3,
      reason: behind
        ? 'Behind: Sterak\'s keeps you standing long enough for E to be worth casting.'
        : 'Shield on burst — hold the front through the first rotation.',
    },
    {
      item: ITEMS.DEATHS_DANCE,
      score: ctx.assassins * 14 + ctx.ad * 5 + (behind ? 10 : 0),
      reason: 'Bleed the physical burst — outlive AD assassins mid-combo.',
    },
    {
      item: ITEMS.MAW_OF_MALMORTIUS,
      score: ctx.ap * 11 + (ctx.pokeLane ? 12 : 0),
      reason: 'Lifeline vs AP burst so your engage completes.',
    },
    {
      item: ITEMS.RANDUINS,
      score: ctx.crit * 12 + (ctx.ad >= 3 ? 10 : 0) + (behind ? 8 : 0),
      reason: 'Armor + crit reduction — blunt the carry that punishes every engage.',
    },
    {
      item: ITEMS.LOCKET,
      score: (behind ? 30 : 10) + ctx.ap * 4 + (ctx.pokeLane ? 10 : 0),
      reason: behind
        ? 'Behind: Locket is value that does not require you to be the one who wins the fight.'
        : 'Team shield for the objective fight you set up.',
    },
    {
      item: ITEMS.KNIGHTS_VOW,
      score: (behind ? 24 : 6) + (ctx.allyAdc ? 8 : 0),
      reason: ctx.allyAdc
        ? `Behind: bind ${ctx.allyAdc.name} — if they are the win condition, keep them alive instead of chasing kills.`
        : 'Bind your carry when they are the win condition.',
    },
    {
      item: ITEMS.VOLTAIC_CYCLOSWORD,
      score: (ahead ? 30 : 6) - (behind ? 30 : 0) + ctx.squishies * 4,
      reason: 'Snowball lethality burst (Opportunity removed) — only correct while you are the threat.',
    },
    {
      item: ITEMS.HUBRIS,
      score: (ahead ? 26 : 4) - (behind ? 40 : 0),
      reason: 'Stack AD on takedowns — pure "already winning" item.',
    },
    {
      item: ITEMS.SERPENTS_FANG,
      score: ctx.shields * 18 + (ctx.shields >= 2 ? 10 : 0),
      reason: `Shield reaver vs ${ctx.shields} shield threats.`,
    },
    {
      item: ITEMS.CHEMPUNK,
      score: ctx.healing * 15 + (ctx.healing >= 2 ? 10 : 0),
      reason: `Grievous vs ${ctx.healing} healers.`,
    },
    {
      item: ITEMS.SERYLDAS,
      score: ctx.tanks * 10,
      reason: 'Pen + slow so the frontline cannot just walk out of your combo.',
    },
    {
      item: ITEMS.MERCURIAL,
      score: ctx.suppression * 40,
      reason: 'QSS — suppression ends a Pantheon engage instantly.',
    },
    {
      item: ITEMS.GUARDIAN_ANGEL,
      score: 12 + ctx.assassins * 4 + (ahead ? 6 : 0),
      reason: 'Revive — insurance on the flank that decides a fight.',
    },
  ];
  secondPool = applyThreatScoring(secondPool, threats);
  secondPool.sort((a, b) => b.score - a.score);

  const core: Item[] = [
    { ...first.item, reason: first.reason },
    { ...secondPool[0].item, reason: secondPool[0].reason },
  ];

  const coreIds = new Set([...core.map((i) => i.id), boots.id]);
  const situational = secondPool
    .filter((s) => s.score >= 14 && !coreIds.has(s.item.id))
    .slice(0, 5)
    .map((s) => ({ ...s.item, reason: s.reason }));

  const buildPath: Item[] = [
    ITEMS.WORLD_ATLAS,
    { ...ITEMS.POTION, reason: 'Open Atlas + pots — level 1–2 is your best window on this champion.' },
    { ...ITEMS.CONTROL_WARD, reason: 'VISION: first back pink — hold 1–2 every recall.' },
    { ...core[0], reason: 'RUSH: ' + (core[0].reason || '') },
    { ...boots, reason: 'BOOTS: ' + (boots.reason || 'Buy the full chain to the upgrade.') },
    { ...ITEMS.ORACLE_LENS, reason: 'SWEEP: swap Oracle ~9 min — clear before you W in.' },
    { ...ITEMS.BLOODSONG, reason: 'QUEST: finish Atlas into Bloodsong when you are the engage threat.' },
    { ...core[1], reason: 'SPIKE: ' + (core[1].reason || '') },
    ...situational,
    ITEMS.ELIXIR,
  ];

  // Exhaust over Ignite once you are behind or facing an assassin you must survive.
  const spells = behind || ctx.assassins >= 2 || threats.length > 0
    ? ['Flash', 'Exhaust']
    : ['Flash', 'Ignite'];

  return { starter, boots, core, situational, buildPath, spells };
}

export function calculatePantheonRunes(
  enemyTeam: Champion[],
  yourADC?: Champion | null,
  allyMid?: Champion | null,
  situation?: ProfileSituation | null
): RunePage {
  const ctx = scanPantheon(enemyTeam, yourADC, allyMid, situation);
  const threats = activeThreats(enemyTeam);
  const behind = ctx.situation.state === 'behind';
  const reasons: { [key: number]: string } = {};

  // Aftershock is the "this lane/game is hard" page: it converts your W stun into
  // survivability instead of a damage gamble you can no longer win.
  const defensiveScore =
    (behind ? 30 : 0) +
    (ctx.hardLane ? 14 : 0) +
    (ctx.pokeLane ? 10 : 0) +
    ctx.cc * 4 +
    ctx.assassins * 5 +
    (threats.length > 0 ? 10 : 0);
  const snowballScore = 26 + ctx.squishies * 5 + (ctx.situation.state === 'ahead' ? 20 : 0) - (ctx.escapeAdc ? 6 : 0);

  if (defensiveScore > snowballScore) {
    reasons[8439] = behind
      ? 'Aftershock: behind, your W has to buy survival — resist spike + burst on the stun target.'
      : 'Aftershock: hard lane — armour/MR spike on every W so trades stop being a coin flip.';
    reasons[8463] = 'Font of Life: heal your ADC off every W — value that does not need you to be ahead.';
    reasons[8473] = 'Bone Plating: blunt their opening combo so you can still walk out of the trade.';
    reasons[8242] = 'Unflinching: tenacity when sums are down — finish the engage instead of being kited.';
    reasons[8126] = 'Cheap Shot: true damage on your own stun — cheapest damage a defensive page can carry.';
    reasons[8106] = 'Ultimate Hunter: lower R CD — more cross-map fights you did not have to walk to.';
    reasons[5007] = 'Ability haste: more W stuns and E blocks per fight.';
    // Shards 26.x+: Flex is Adaptive/MS/HP-scaling; Defense is flat HP/Tenacity/HP-scaling.
    const flex = 5001;
    let defense = 5011;
    if (threats.length > 0 && threats[0].preferDefenseShard) {
      defense = threats[0].preferDefenseShard;
    } else if (ctx.cc >= 3) {
      defense = 5013;
    }
    reasons[5001] = 'Flex HP scaling: engage depth without glass-cannon shards.';
    reasons[5011] = 'Flat Health: the AD/AP threat is what actually kills you.';
    reasons[5013] = 'Tenacity: finish W→Q through chain CC.';

    return {
      name: 'One Trick',
      primaryStyleId: 8400,
      subStyleId: 8100,
      selectedPerkIds: [8439, 8463, 8473, 8242, 8126, 8106, 5007, flex, defense],
      reasons,
    };
  }

  reasons[8112] = 'Electrocute: Q→W→auto procs instantly — the level 2 all-in that defines the lane.';
  reasons[8143] = 'Sudden Impact: lethality the moment W lands — your engage is the trigger.';
  reasons[8137] = 'Sixth Sense: find the ward, engage from fog they think is covered.';
  reasons[8106] = 'Ultimate Hunter: lower R CD — R is your cross-map presence.';
  reasons[8473] = 'Bone Plating: survive the return combo after you commit.';
  reasons[8242] = 'Unflinching: tenacity so the engage finishes.';
  reasons[5008] = 'Adaptive: raw damage on the burst pattern.';
  reasons[5001] = 'Health scaling: engage depth.';
  reasons[5011] = 'Flat Health: live the return damage after you commit.';
  reasons[5013] = 'Tenacity: finish the engage through CC.';

  let flex = 5008;
  let defense = 5001;
  if (threats.length > 0 && threats[0].preferDefenseShard) {
    flex = 5001;
    defense = threats[0].preferDefenseShard;
  } else if (ctx.ap >= 2 || ctx.assassins >= 1) {
    defense = 5011;
  } else if (ctx.cc >= 3) {
    defense = 5013;
  }

  return {
    name: 'One Trick',
    primaryStyleId: 8100,
    subStyleId: 8400,
    selectedPerkIds: [8112, 8143, 8137, 8106, 8473, 8242, 5008, flex, defense],
    reasons,
  };
}

export function analyzePantheonMatchup(
  enemyTeam: Champion[],
  build?: Build,
  yourADC?: Champion | null,
  allyMid?: Champion | null,
  situation?: ProfileSituation | null
): MatchupAnalysis {
  const ctx = scanPantheon(enemyTeam, yourADC, allyMid, situation);
  const threats = activeThreats(enemyTeam);
  const behind = ctx.situation.state === 'behind';
  const ahead = ctx.situation.state === 'ahead';
  const botLaneMatchup = analyzeBotLaneMatchup(enemyTeam, yourADC || null);

  const primaryTargets = enemyTeam
    .filter((c) => c.id !== 'Yuumi')
    .filter((c) => c.tags.includes('Marksman') || c.tags.includes('Mage') || c.tags.includes('Assassin'))
    .filter((c) => !c.tags.includes('Tank'))
    .map((c) => c.name)
    .slice(0, 3);

  const majorThreats = [
    ...threats.map((t) => t.name),
    ...enemyTeam.filter((c) => c.tags.includes('Tank')).map((c) => c.name),
  ].slice(0, 3);

  const crossMap = evaluateCrossMap({
    target: ctx.enemyMid,
    allies: [ctx.allyMid, ctx.allyAdc],
    homeCarry: ctx.allyAdc,
    enemyTeam,
    hardBot: ctx.hardLane || ctx.pokeLane,
    state: ctx.situation.state,
    hasUlt: true,
  });

  const analysis: MatchupAnalysis = {
    title: 'SPEAR TEMPO',
    description:
      'Level 1–2 is your peak: Q poke into W stun, and your ADC only has to follow. Every minute after that you are trading power for map presence.',
    winCondition: 'Convert the early lead into R fights on other lanes before the enemy carries come online.',
    aggressionLevel: 'HIGH',
    primaryTargets,
    majorThreats,
    tips: [],
    roamAdvice: crossMap.detail,
  };

  if (botLaneMatchup) analysis.botLaneMatchup = botLaneMatchup;

  const focus = buildPreyFocus(primaryTargets, enemyTeam.map((c) => c.name), botLaneMatchup?.keyCooldowns);
  if (focus) analysis.preyFocus = focus.line;

  if (behind) {
    analysis.title = 'BEHIND: BECOME UTILITY';
    analysis.description =
      'A losing Pantheon has no scaling and no escape — stop looking for solo kills. Your job is now E blocks, W peel, and R arriving where the team already has numbers.';
    analysis.winCondition =
      'Keep your carry alive and cash your R into fights your team is already winning. Do not create the fight yourself.';
    analysis.aggressionLevel = 'LOW';
    analysis.tips = [
      'Behind: never take the first engage. Let their diver commit, then W the diver and E-block the follow-up.',
      'Buy for the losing pattern: Sundered Sky / Sterak\'s / Locket or Knight\'s Vow beat any lethality item when you are down.',
      'E blocks damage from the direction you face — face the AD carry, not the tank.',
      'Exhaust > Ignite once you are behind: you save a carry, you do not need to finish one.',
      'Ward defensively and take a slower path back to lane — a fourth death makes them unkillable, not you.',
      ...(ctx.allyAdc ? [`Play through ${ctx.allyAdc.name}: shield/peel first, kills second.`] : []),
    ];
  } else if (ahead) {
    analysis.title = 'SNOWBALL WINDOW';
    analysis.description =
      'You are the strongest body on the map right now. Crash, then spend every wave on a fight somewhere else — your power curve only goes down from here.';
    analysis.winCondition = 'Turn tempo into objectives before their carries reach two items.';
    analysis.aggressionLevel = 'EXTREME';
    analysis.tips = [
      'Ahead: every crashed wave is a leave timer — mid, jungle invade, or river vision before objectives.',
      'Voltaic / Youmuu\'s over defensive items while you still outrange their power curve.',
      'Use R on the far lane while your ADC holds bot — arriving with a stun is worth more than the CS you lose.',
      'Do not walk into their jungle without vision — your death here gives back the whole lead.',
    ];
  } else {
    analysis.tips = [
      'Level 2 (Q + W) is your biggest single power spike in the entire game — force it the moment you hit it.',
      'Q max for poke lanes, W max only when you have a follow-up ally who can actually convert the stun.',
      'E blocks everything from the front, including tower shots — cover your ADC on a dive with it.',
      'Empowered Q from the fog is free damage that costs nothing; do not open with W into a full-health enemy support.',
    ];
  }

  // Lane-specific reads
  if (ctx.hardLane && ctx.enemySupport) {
    analysis.tips.unshift(
      `${ctx.enemySupport.name} disengages your all-in — hold W for after their shield/binding is spent, or leave lane and let the wave push.`
    );
  } else if (ctx.pokeLane && ctx.enemySupport) {
    analysis.tips.unshift(
      `${ctx.enemySupport.name} out-ranges you — stand in the bush, take grey health trades only, and go the instant their key spell misses.`
    );
  }
  if (ctx.escapeAdc && ctx.enemyADC) {
    analysis.tips.unshift(`${ctx.enemyADC.name} can dash out of W — engage only when their escape is on cooldown.`);
  }

  // Named threat answers (Naafiri etc.)
  if (threats.length > 0) {
    analysis.tips = [...threatTips(threats), ...analysis.tips];
  }

  // Cross-map quality gate
  analysis.tips.unshift(
    crossMap.quality === 'strong'
      ? `ROAM: ${crossMap.headline}. ${crossMap.detail}`
      : crossMap.quality === 'avoid'
        ? `HOLD: ${crossMap.detail}`
        : `ROAM (timed): ${crossMap.detail}`
  );
  if (crossMap.notes[0]) analysis.tips.push(crossMap.notes[0]);

  if (build?.spells.includes('Exhaust')) {
    analysis.tips.push('Exhaust is loaded — it is a defensive cooldown for your carry, not a kill tool.');
  }

  analysis.tips = analysis.tips.slice(0, 8);
  return analysis;
}

export function calculatePantheonDominance(
  enemyTeam: Champion[],
  build: Build,
  yourADC?: Champion | null,
  allyMid?: Champion | null,
  situation?: ProfileSituation | null
): DominanceMetrics {
  const ctx = scanPantheon(enemyTeam, yourADC, allyMid, situation);
  let score = 56;

  score += ctx.squishies * 6;
  score -= ctx.tanks * 6;
  if (ctx.hardLane) score -= 12;
  if (ctx.pokeLane) score -= 8;
  if (ctx.escapeAdc) score -= 6;
  if (ctx.allySetup) score += 8;
  if (activeThreats(enemyTeam).length > 0) score -= 6;
  if (ctx.situation.state === 'behind') score -= 14;
  if (ctx.situation.state === 'ahead') score += 10;
  if (build.core.some((i) => i.id === '6610' || i.id === '6692')) score += 3;

  score = Math.min(100, Math.max(0, score));

  let grade: DominanceMetrics['grade'] = 'C';
  if (score >= 90) grade = 'S+';
  else if (score >= 80) grade = 'S';
  else if (score >= 68) grade = 'A';
  else if (score >= 54) grade = 'B';
  else if (score >= 40) grade = 'C';
  else grade = 'D';

  const titles: Record<string, string> = {
    'S+': 'SPEAR OF THE MAP',
    S: 'LANE TYRANT',
    A: 'TEMPO FAVORED',
    B: 'STANDARD PANTHEON',
    C: 'UTILITY ROUTE',
    D: 'SURVIVE AND ENABLE',
  };

  const summary =
    ctx.situation.state === 'behind'
      ? 'Behind: no scaling and no escape — build survivability/utility, peel your carry, and only cash R into fights your team already leads.'
      : ctx.hardLane
        ? 'Disengage lane — your 2v2 window is level 2 only. Crash and spend the map instead of forcing bot.'
        : ctx.squishies >= 3
          ? 'Soft comp — level 2 all-in, then cross-map every crashed wave while you are still the strongest body.'
          : 'Standard Pantheon: early windows, then convert to objectives before their carries scale.';

  const earlyBase = ctx.hardLane ? 60 : ctx.squishies >= 3 ? 92 : 82;
  const stateShift = ctx.situation.state === 'behind' ? -22 : ctx.situation.state === 'ahead' ? 8 : 0;

  return {
    score,
    grade,
    title: titles[grade] || 'PANTHEON',
    summary,
    earlyGameScore: Math.max(0, Math.min(100, earlyBase + stateShift)),
    midGameScore: Math.max(0, Math.min(100, 70 + stateShift)),
    lateGameScore: Math.max(0, Math.min(100, 38 + stateShift)),
  };
}
