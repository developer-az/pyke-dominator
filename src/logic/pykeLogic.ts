export interface Champion {
    id: string;
    key: string; // Numeric ID
    name: string;
    tags: string[]; // Mage, Tank, Fighter, Assassin, Marksman, Support
    damageType?: 'Physical' | 'Magic' | 'Mixed'; // Simplified
}

export interface Item {
    id: string;
    name: string;
    icon: string;
    description?: string;
    reason?: string; // Why this item was chosen
}

export interface Build {
    starter: Item[];
    core: Item[];
    situational: Item[];
    boots: Item;
    buildPath: Item[]; // Linear path
    spells: string[];
}

export interface Rune {
    id: number;
    name: string;
    icon: string;
    reason?: string;
}

export interface RunePage {
    primaryStyleId: number;
    subStyleId: number;
    selectedPerkIds: number[];
    name: string;
    reasons: { [key: number]: string }; // Map rune ID to reason
}

// Static Data for Items
const ITEMS = {
    WORLD_ATLAS: { id: '3867', name: 'World Atlas', icon: 'World_Atlas', reason: 'Support starter — gold + wards on curve.' },
    POTION: { id: '2003', name: 'Health Potion', icon: 'Health_Potion', reason: 'Lane HP buffer for early trades.' },

    MOBILITY_BOOTS: { id: '3117', name: 'Boots of Mobility', icon: 'Boots_of_Mobility', reason: 'Cross-map tempo — convert crashes into mid/jg fights.' },
    MERCURY_TREADS: { id: '3111', name: 'Mercury\'s Treads', icon: 'Mercury_s_Treads', reason: 'Tenacity so CC chains cannot delete your engage window.' },
    PLATED_STEELCAPS: { id: '3047', name: 'Plated Steelcaps', icon: 'Plated_Steelcaps', reason: 'Cut AA DPS from marksmen / fighters in extended fights.' },
    IONIAN_BOOTS: { id: '3158', name: 'Ionian Boots of Lucidity', icon: 'Ionian_Boots_of_Lucidity', reason: 'Ability haste — more Q/E/R cycles per fight.' },

    VOLTAIC_CYCLOSWORD: { id: '6699', name: 'Voltaic Cyclosword', icon: 'Voltaic_Cyclosword', reason: 'Energized burst + slow — fight-deciding lethality spike.' },
    YOUMUUS_GHOSTBLADE: { id: '3142', name: 'Youmuu\'s Ghostblade', icon: 'Youmuu_s_Ghostblade', reason: 'MS active for roam entries and cleanup angles.' },
    HUBRIS: { id: '6697', name: 'Hubris', icon: 'Hubris', reason: 'Takedown AD stacks — snowball when resets are reliable.' },
    AXIOM_ARC: { id: '6696', name: 'Axiom Arc', icon: 'Axiom_Arc', reason: 'R refund — chain resets decide multi-kill fights.' },

    EDGE_OF_NIGHT: { id: '3814', name: 'Edge of Night', icon: 'Edge_of_Night', reason: 'Spell shield eats the one CC that would cancel your R.' },
    MAW_OF_MALMORTIUS: { id: '3156', name: 'Maw of Malmortius', icon: 'Maw_of_Malmortius', reason: 'Lifeline vs AP burst so you finish the execute.' },
    SERYLDAS_GRUDGE: { id: '6694', name: 'Serylda\'s Grudge', icon: 'Serylda_s_Grudge', reason: 'Armor pen + slow vs frontline that soaks your Q.' },
    GUARDIAN_ANGEL: { id: '3026', name: 'Guardian Angel', icon: 'Guardian_Angel', reason: 'Revive insurance for high-risk R angles.' },
    MERCURIAL_SCIMITAR: { id: '3139', name: 'Mercurial Scimitar', icon: 'Mercurial_Scimitar', reason: 'Cleanse suppression — mandatory into Malz/WW/Skarner.' },
    DEATHS_DANCE: { id: '6333', name: 'Death\'s Dance', icon: 'Death_s_Dance', reason: 'Bleed physical burst so AD assassins cannot delete you mid-combo.' },
    UMBRAL_GLAIVE: { id: '3179', name: 'Umbral Glaive', icon: 'Umbral_Glaive', reason: 'Ward delete — fog control is how Pyke picks fights.' },
    SERPENTS_FANG: { id: '6695', name: 'Serpent\'s Fang', icon: 'Serpents_Fang', reason: 'Shield reaver — delete Lulu/Sett/Tahm pads before R.' },
    CHEMPUNK_CHAINSWORD: { id: '6609', name: 'Chempunk Chainsword', icon: 'Chempunk_Chainsword', reason: 'Grievous — stop Soraka/Aatrox from outlasting your burst.' },
};

// --- Comp / matchup scoring primitives ---

interface CompContext {
    ap: number;
    cc: number;
    tanks: number;
    squishies: number;
    healing: number;
    shields: number;
    suppression: number;
    assassins: number;
    burstMages: number;
    poke: number;
    aaHeavy: number;
    laneDifficulty: number; // 0–3
    roamPriority: number;
    midRoamValue: number; // -2 .. +3 — mid gank quality
    hardBot: boolean;
    burstBot: boolean;
    enemyNames: string[];
    allyAdcId: string | null;
    allyMidId: string | null;
    enemyMidId: string | null;
}

const SHIELD_CHAMPS = ['Lulu', 'Janna', 'Karma', 'Sett', 'TahmKench', 'Shen', 'Sion', 'Nautilus', 'Mordekaiser'];
const HEALING_CHAMPS = ['Soraka', 'Yuumi', 'Aatrox', 'Sylas', 'Vladimir', 'DrMundo', 'Warwick', 'Briar', 'Nilah'];
const SUPPRESSION_CHAMPS = ['Malzahar', 'Warwick', 'Skarner'];
const BURST_MAGES = ['Brand', 'Zyra', 'VelKoz', 'Lux', 'Xerath', 'Annie', 'Syndra', 'Veigar', 'Mel', 'Hwei', 'Viktor', 'Swain'];
const BURST_SUPPORTS = ['Brand', 'Zyra', 'VelKoz', 'Lux', 'Xerath', 'Annie', 'Mel', 'Swain', 'Karma', 'Neeko', 'Zoe'];
const HARD_BOT_ADCS = ['Ezreal', 'Lucian', 'Caitlyn', 'Vayne', 'Tristana', 'KaiSa', 'Zeri', 'Smolder'];
const VERY_HARD_BOT_ADCS = ['Xayah', 'Sivir', 'Samira', 'Nilah'];
const EASY_BOT_ADCS = ['Ashe', 'Jinx', 'Varus', 'KogMaw', 'Twitch', 'Aphelios', 'Jhin', 'MissFortune'];

/** Enemy mid mobility / anti-gank tools that negate bot→mid roams. */
const HIGH_MOBILITY_MIDS = [
    'Ahri', 'LeBlanc', 'Zed', 'Yasuo', 'Yone', 'Akali', 'Fizz', 'Kassadin', 'Katarina',
    'Qiyana', 'Talon', 'Ekko', 'Irelia', 'Sylas', 'Vex', 'Riven', 'Diana', 'Naafiri',
];
/** Enemy mids that shove and leave before you arrive. */
const STRONG_WAVECLEAR_MIDS = [
    'Anivia', 'Orianna', 'Viktor', 'Azir', 'Syndra', 'Xerath', 'Ziggs', 'Taliyah',
    'Cassiopeia', 'Malzahar', 'Annie', 'Hwei', 'Mel', 'Ahri', 'Lux',
];
/** Immobile / punishable enemy mids — high roam value. */
const IMMOBILE_MIDS = [
    'Veigar', 'Xerath', 'VelKoz', 'Annie', 'Malzahar', 'Lux', 'Syndra', 'Viktor',
    'Orianna', 'Anivia', 'Heimerdinger', 'Taliyah', 'Swain', 'Mel', 'Hwei',
];
/** Ally mids who can lock targets / set up your R. */
const SETUP_ALLY_MIDS = [
    'Orianna', 'Syndra', 'Ahri', 'Lux', 'Annie', 'Neeko', 'Veigar', 'Malzahar',
    'Viktor', 'Taliyah', 'Anivia', 'Zoe', 'Hwei', 'Mel', 'Galio', 'Swain',
];
/** Ally mids who cannot hold a side alone if you leave. */
const FRAGILE_ALLY_MIDS = [
    'Veigar', 'Xerath', 'VelKoz', 'Ziggs', 'Lux', 'Orianna', 'Anivia', 'Heimerdinger',
];

const DIFFICULTY_SCORE: Record<string, number> = {
    EASY: 0,
    MEDIUM: 1,
    HARD: 2,
    VERY_HARD: 3,
};

function scoreMidRoamValue(enemyMid: Champion | null, allyMid: Champion | null): { score: number; notes: string[] } {
    const notes: string[] = [];
    let score = 1; // baseline: mid is often the highest-tempo convert

    if (!enemyMid) {
        notes.push('Enemy mid unknown — default to river timing after crash.');
        return { score, notes };
    }

    const e = enemyMid.id;
    if (HIGH_MOBILITY_MIDS.includes(e)) {
        score -= 2;
        notes.push(`${enemyMid.name} dashes out — only roam mid on spent mobility or hard CC setup.`);
    }
    if (STRONG_WAVECLEAR_MIDS.includes(e)) {
        score -= 1;
        notes.push(`${enemyMid.name} clears before you arrive — sync with your mid's freeze/crash, not random W.`);
    }
    if (IMMOBILE_MIDS.includes(e) && !HIGH_MOBILITY_MIDS.includes(e)) {
        score += 2;
        notes.push(`${enemyMid.name} is punishable — mid roam is a primary convert.`);
    }

    if (allyMid) {
        const a = allyMid.id;
        if (SETUP_ALLY_MIDS.includes(a)) {
            score += 1;
            notes.push(`${allyMid.name} sets up your R — mid fights are priority.`);
        }
        if (FRAGILE_ALLY_MIDS.includes(a) && HIGH_MOBILITY_MIDS.includes(e)) {
            score -= 1;
            notes.push(`${allyMid.name} vs mobile ${enemyMid.name}: cover mid on their roam timer instead of forcing.`);
        }
    }

    return { score: Math.max(-2, Math.min(3, score)), notes };
}

export function scanCompContext(
    enemyTeam: Champion[],
    yourADC?: Champion | null,
    allyMid?: Champion | null,
    botLane?: BotLaneMatchup | null
): CompContext {
    let ap = 0;
    let cc = 0;
    let tanks = 0;
    let squishies = 0;
    let healing = 0;
    let shields = 0;
    let suppression = 0;
    let assassins = 0;
    let burstMages = 0;
    let poke = 0;
    let aaHeavy = 0;

    const enemyMid =
        enemyTeam.find((c) => {
            // Prefer non-support mage/assassin who isn't the marked bot ADC
            const isMarksman = c.tags.includes('Marksman');
            const isSupport = c.tags.includes('Support');
            return (c.tags.includes('Mage') || c.tags.includes('Assassin')) && !isMarksman && !isSupport;
        }) ||
        enemyTeam.find((c) => c.tags.includes('Mage') && !c.tags.includes('Marksman')) ||
        null;

    enemyTeam.forEach((champ) => {
        if (champ.tags.includes('Mage') || champ.damageType === 'Magic') ap++;
        if (champ.tags.includes('Tank') || champ.tags.includes('Fighter')) tanks++;
        if (champ.tags.includes('Assassin')) assassins++;
        if (champ.tags.includes('Mage') || champ.tags.includes('Marksman')) poke++;
        if (champ.tags.includes('Marksman') || (champ.tags.includes('Fighter') && champ.damageType === 'Physical')) aaHeavy++;

        const isSquishyRole = champ.tags.includes('Marksman') || champ.tags.includes('Assassin') || champ.tags.includes('Mage');
        const isTank = champ.tags.includes('Tank');
        if (isSquishyRole && !isTank) squishies++;
        if (champ.tags.includes('Tank') || champ.tags.includes('Support')) cc++;

        if (SHIELD_CHAMPS.includes(champ.id)) shields++;
        if (HEALING_CHAMPS.includes(champ.id)) healing++;
        if (SUPPRESSION_CHAMPS.includes(champ.id)) suppression++;
        if (BURST_MAGES.includes(champ.id)) burstMages++;
    });

    const laneDifficulty = botLane
        ? DIFFICULTY_SCORE[botLane.matchupDifficulty] ?? 1
        : 1;
    const hardBot = laneDifficulty >= 2;
    const burstBot = !!(
        botLane?.enemySupport && BURST_SUPPORTS.includes(botLane.enemySupport.id)
    ) || enemyTeam.some((c) => BURST_SUPPORTS.includes(c.id) && c.tags.includes('Support'));

    const mid = scoreMidRoamValue(enemyMid, allyMid || null);
    // Roam priority rises when bot 2v2 is low value or tanks clog the lane
    let roamPriority = 0;
    if (hardBot) roamPriority += 2;
    if (burstBot) roamPriority += 1;
    if (tanks >= 2) roamPriority += 2;
    if (squishies >= 3) roamPriority += 1;
    roamPriority += Math.max(0, mid.score);

    return {
        ap,
        cc,
        tanks,
        squishies,
        healing,
        shields,
        suppression,
        assassins,
        burstMages,
        poke,
        aaHeavy,
        laneDifficulty,
        roamPriority,
        midRoamValue: mid.score,
        hardBot,
        burstBot,
        enemyNames: enemyTeam.map((c) => c.name),
        allyAdcId: yourADC?.id ?? null,
        allyMidId: allyMid?.id ?? null,
        enemyMidId: enemyMid?.id ?? null,
    };
}

export const calculateBuild = (
    enemyTeam: Champion[],
    yourADC?: Champion | null,
    allyMid?: Champion | null
): Build => {
    // Lightweight bot read for lane-aware scoring (no circular dep — analyzeBotLaneMatchup is below)
    const botLane = analyzeBotLaneMatchup(enemyTeam, yourADC || null);
    const ctx = scanCompContext(enemyTeam, yourADC, allyMid, botLane);

    const build: Build = {
        starter: [ITEMS.WORLD_ATLAS, ITEMS.POTION, ITEMS.POTION],
        boots: ITEMS.IONIAN_BOOTS,
        core: [ITEMS.UMBRAL_GLAIVE, ITEMS.VOLTAIC_CYCLOSWORD],
        situational: [],
        buildPath: [],
        spells: ['Flash', 'Ignite'],
    };

    // --- Boots: score all options ---
    const bootScores: Array<{ item: Item; score: number; reason: string }> = [
        {
            item: ITEMS.MERCURY_TREADS,
            score: ctx.cc * 12 + ctx.ap * 4 + (ctx.burstBot ? 8 : 0) + (ctx.suppression > 0 ? 15 : 0),
            reason: `Tenacity vs ${ctx.cc} CC threats${ctx.burstBot ? ' + burst bot' : ''}.`,
        },
        {
            item: ITEMS.PLATED_STEELCAPS,
            score: ctx.aaHeavy * 10 + (ctx.assassins > 0 && ctx.ap < 2 ? 6 : 0) - (ctx.ap >= 3 ? 8 : 0),
            reason: `AA damage reduction vs ${ctx.aaHeavy} physical threats.`,
        },
        {
            item: ITEMS.MOBILITY_BOOTS,
            score: ctx.roamPriority * 10 + (ctx.hardBot ? 12 : 0) + (ctx.midRoamValue >= 1 ? 8 : 0) + (ctx.tanks >= 2 ? 10 : 0) - (ctx.cc >= 3 ? 14 : 0),
            reason: ctx.hardBot
                ? 'Hard bot — convert crashes cross-map; Mobility maximizes fight selection.'
                : 'Roam tempo to mid/jg after shove.',
        },
        {
            item: ITEMS.IONIAN_BOOTS,
            score: 28 + ctx.squishies * 3 - (ctx.hardBot ? 4 : 0),
            reason: 'Ability haste for Q/E/R cadence in skirmishes.',
        },
    ];
    bootScores.sort((a, b) => b.score - a.score);
    const bestBoot = bootScores[0];
    build.boots = { ...bestBoot.item, reason: bestBoot.reason };

    // --- Core slot 2 candidates (Umbral is always slot 1 for Pyke identity) ---
    type Scored = { item: Item; score: number; reason: string };
    const core2: Scored[] = [
        {
            item: ITEMS.VOLTAIC_CYCLOSWORD,
            score: 40 + ctx.squishies * 10 - ctx.tanks * 6 + (ctx.burstBot ? 6 : 0) - (ctx.hardBot ? 4 : 0),
            reason: 'Burst + slow — decide fights the moment you land E.',
        },
        {
            item: ITEMS.YOUMUUS_GHOSTBLADE,
            score: 30 + ctx.roamPriority * 12 + ctx.laneDifficulty * 6 + (ctx.midRoamValue >= 1 ? 8 : 0) + (ctx.tanks >= 2 ? 10 : 0),
            reason: ctx.hardBot
                ? 'Hard lane — Youmuu\'s turns every crash into a better fight elsewhere.'
                : 'MS for roam entries and fog flanks.',
        },
        {
            item: ITEMS.AXIOM_ARC,
            score: 18 + ctx.squishies * 7 + (ctx.assassins >= 1 ? 4 : 0) - (ctx.tanks >= 2 ? 8 : 0),
            reason: 'R refund — multi-kill fights are where you cash out.',
        },
        {
            item: ITEMS.HUBRIS,
            score: 10 + ctx.squishies * 8 - ctx.laneDifficulty * 6 - (ctx.hardBot ? 10 : 0) - (ctx.tanks >= 2 ? 12 : 0),
            reason: 'Stack AD on takedowns when resets are the win condition.',
        },
    ];
    core2.sort((a, b) => b.score - a.score);
    const second = core2[0];

    build.core = [
        {
            ...ITEMS.UMBRAL_GLAIVE,
            reason: 'Fog control — delete wards, own bushes, pick the fight you want.',
        },
        { ...second.item, reason: second.reason },
    ];

    // --- Situational: score then take top with threshold ---
    const situationalPool: Scored[] = [
        {
            item: ITEMS.MERCURIAL_SCIMITAR,
            score: ctx.suppression * 40,
            reason: 'Cleanse suppression — keep your R online through Malz/WW/Skarner.',
        },
        {
            item: ITEMS.SERPENTS_FANG,
            score: ctx.shields * 18 + (ctx.shields >= 2 ? 10 : 0),
            reason: `Shield shred vs ${ctx.shields} shield threats — R threshold stays real.`,
        },
        {
            item: ITEMS.CHEMPUNK_CHAINSWORD,
            score: ctx.healing * 16 + (ctx.healing >= 2 ? 10 : 0),
            reason: `Grievous vs ${ctx.healing} healers — finish before they stabilize.`,
        },
        {
            item: ITEMS.EDGE_OF_NIGHT,
            score: ctx.cc * 9 + ctx.laneDifficulty * 8 + (ctx.burstBot ? 10 : 0) + (ctx.hardBot ? 8 : 0),
            reason: 'Spell shield — walk through the one point-click that would cancel you.',
        },
        {
            item: ITEMS.MAW_OF_MALMORTIUS,
            score: ctx.ap * 8 + ctx.burstMages * 10 + (ctx.burstBot ? 12 : 0),
            reason: 'Lifeline vs AP burst so you complete the combo.',
        },
        {
            item: ITEMS.DEATHS_DANCE,
            score: ctx.assassins * 14 + (ctx.aaHeavy >= 2 && ctx.ap < 2 ? 10 : 0),
            reason: 'Bleed physical burst — survive the AD all-in long enough to R.',
        },
        {
            item: ITEMS.SERYLDAS_GRUDGE,
            score: ctx.tanks * 12 + (ctx.tanks >= 2 ? 8 : 0),
            reason: 'Pen + slow — cut tanks that soak your Q line.',
        },
        {
            item: ITEMS.AXIOM_ARC,
            score: second.item.id === ITEMS.AXIOM_ARC.id ? -100 : 22 + ctx.squishies * 4,
            reason: 'R refund for chained resets in mid-game fights.',
        },
        {
            item: ITEMS.YOUMUUS_GHOSTBLADE,
            score: second.item.id === ITEMS.YOUMUUS_GHOSTBLADE.id ? -100 : 12 + ctx.roamPriority * 4,
            reason: 'MS active if you skipped it earlier — still elite for side pressure.',
        },
        {
            item: ITEMS.VOLTAIC_CYCLOSWORD,
            score: second.item.id === ITEMS.VOLTAIC_CYCLOSWORD.id ? -100 : 14 + ctx.squishies * 3,
            reason: 'Burst spike if you went mobility second.',
        },
        {
            item: ITEMS.HUBRIS,
            score: second.item.id === ITEMS.HUBRIS.id ? -100 : 8 + ctx.squishies * 5 - ctx.laneDifficulty * 4,
            reason: 'Snowball AD when you are already chaining takedowns.',
        },
        {
            item: ITEMS.GUARDIAN_ANGEL,
            score: 10 + (ctx.assassins + ctx.burstMages) * 3,
            reason: 'Revive for decisive late R angles.',
        },
    ];

    const coreIds = new Set(build.core.map((i) => i.id));
    const picked = situationalPool
        .filter((s) => s.score >= 18 && !coreIds.has(s.item.id))
        .sort((a, b) => b.score - a.score)
        .slice(0, 4)
        .map((s) => ({ ...s.item, reason: s.reason }));

    build.situational = picked;

    const buildPathItems: Item[] = [
        ITEMS.WORLD_ATLAS,
        { ...ITEMS.POTION, reason: 'Open Atlas + pots — play for your first decisive spike.' },
        { ...build.core[0], reason: 'RUSH: ' + (build.core[0].reason || 'Core.') },
        { ...build.boots, reason: 'BOOTS: ' + (build.boots.reason || 'Tempo.') },
        { ...build.core[1], reason: 'SPIKE: ' + (build.core[1].reason || 'Second core.') },
        ...build.situational,
        { id: '2140', name: 'Elixir of Wrath', icon: 'Elixir_of_Wrath', reason: 'Elixir for the fight that ends the game.' },
    ];
    build.buildPath = buildPathItems;

    return build;
};

export const calculateRunes = (
    enemyTeam: Champion[],
    build?: Build,
    yourADC?: Champion | null,
    allyMid?: Champion | null
): RunePage => {
    const botLane = analyzeBotLaneMatchup(enemyTeam, yourADC || null);
    const ctx = scanCompContext(enemyTeam, yourADC, allyMid, botLane);
    const reasons: { [key: number]: string } = {};

    // Keystone: HoB is the fight opener — three autos into E/R threshold
    reasons[9923] = 'Hail of Blades: three autos into passive/E — opens every all-in.';
    reasons[8143] = 'Sudden Impact: lethality after E/W — your dash is the fight start.';
    reasons[8106] = 'Ultimate Hunter: lower R CD — more execute windows per skirmish.';

    // Vision slot — score Sixth Sense vs Deep Ward vs Grisly
    const visionOptions = [
        {
            id: 8137,
            score: 40 + (build?.core.some((i) => i.id === ITEMS.UMBRAL_GLAIVE.id) ? 12 : 0) + ctx.roamPriority * 2,
            reason: 'Sixth Sense: track wards — Umbral clears what it finds; you own fog.',
        },
        {
            id: 8141,
            score: 28 + ctx.roamPriority * 4 + (ctx.hardBot ? 6 : 0),
            reason: 'Deep Ward: longer river/tri wards for roam and objective setup.',
        },
        {
            id: 8140,
            score: 20 + ctx.tanks * 3,
            reason: 'Grisly Mementos: faster trinket recharge in vision-heavy games.',
        },
    ];
    visionOptions.sort((a, b) => b.score - a.score);
    const vision = visionOptions[0];
    reasons[vision.id] = vision.reason;

    // Secondary tree — score what decides lane + fights
    const resolveScore =
        ctx.poke * 10 +
        ctx.burstMages * 8 +
        (ctx.burstBot ? 16 : 0) +
        ctx.laneDifficulty * 8 +
        ctx.cc * 4 +
        (ctx.hardBot ? 10 : 0);

    const precisionScore =
        36 +
        ctx.squishies * 6 -
        ctx.poke * 3 -
        (ctx.burstBot ? 8 : 0) -
        (ctx.hardBot ? 6 : 0);

    let secondaryStyleId: number;
    let secondaryRune1: number;
    let secondaryRune2: number;

    if (resolveScore > precisionScore) {
        secondaryStyleId = 8400;
        // Bone Plating vs burst bot / Mel-style; Second Wind vs poke
        if (ctx.burstBot || ctx.burstMages >= 2 || ctx.laneDifficulty >= 2) {
            secondaryRune1 = 8473; // Bone Plating
            reasons[8473] = 'Bone Plating: blunt the burst window (Mel/Brand/Zyra) so you still all-in after.';
        } else {
            secondaryRune1 = 8444; // Second Wind
            reasons[8444] = 'Second Wind: refill after poke — stay in lethal range.';
        }
        secondaryRune2 = 8242; // Unflinching
        reasons[8242] = 'Unflinching: tenacity when sums are down — walk through chain CC into R.';
    } else {
        secondaryStyleId = 8000;
        secondaryRune1 = 8009; // Presence of Mind
        secondaryRune2 = 8014; // Coup de Grace
        reasons[8009] = 'Presence of Mind: mana on takedowns — never drop mid-reset.';
        reasons[8014] = 'Coup de Grace: extra damage on low targets — sharpens R threshold.';
    }

    // Stat shards — adaptive / adaptive / health, swap flex to armor/MR when burst is extreme
    let flexShard = 5008; // Adaptive
    let flexReason = 'Flex Adaptive: raw damage for fight spikes.';
    if (ctx.burstBot && ctx.ap >= 2) {
        flexShard = 5003; // MR
        flexReason = 'Flex MR: survive the AP bot burst long enough to cast.';
    } else if (ctx.assassins >= 2 && ctx.ap < 2) {
        flexShard = 5002; // Armor
        flexReason = 'Flex Armor: live the AD assassin all-in into your R.';
    }
    reasons[5008] = 'Offense Adaptive: maximize lethality scaling.';
    reasons[flexShard] = flexReason;
    reasons[5001] = 'Health scaling: HP buffer for engage depth.';

    return {
        name: 'Pyke Dominator',
        primaryStyleId: 8100,
        subStyleId: secondaryStyleId,
        selectedPerkIds: [
            9923, // Hail of Blades
            8143, // Sudden Impact
            vision.id,
            8106, // Ultimate Hunter
            secondaryRune1,
            secondaryRune2,
            5008,
            flexShard,
            5001,
        ],
        reasons,
    };
};

// --- Matchup Strategy Engine ---

export interface MatchupAnalysis {
    title: string;
    description: string;
    winCondition: string;
    aggressionLevel: 'EXTREME' | 'HIGH' | 'MODERATE' | 'LOW';
    primaryTargets: string[];
    majorThreats: string[];
    tips: string[];
    botLaneMatchup?: BotLaneMatchup;
    damageAnalysis?: DamageAnalysis;
    roamAdvice?: string;
}

export interface BotLaneMatchup {
    enemyADC: Champion | null;
    enemySupport: Champion | null;
    matchupDifficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'VERY_HARD';
    lanePhase: string;
    allInPotential: string;
    keyCooldowns: string[];
    damageComparison?: BotLaneDamageComparison;
}

export interface BotLaneDamageComparison {
    enemyCombo: {
        level3: number;
        level6: number;
        description: string;
    };
    yourCombo: {
        level3: number;
        level6: number;
        level6WithUlt: number;
        description: string;
    };
    advantage: string;
    notes: string[];
}

export interface DamageAnalysis {
    level3Combo: number;
    level6Combo: number;
    level6WithUlt: number;
    killThreshold: string;
    notes: string[];
}

const PYKE_HISTORY = {
    Q: {
        base: [85, 135, 185, 235, 285],
        scaling: 0.6,
    },
    E: {
        base: [95, 125, 155, 185, 215],
        scaling: 1.0,
    },
    R: {
        base: [250, 290, 330],
        scaling: 0.8,
    },
};

const calculatePykeDamage = (_level: number, hasUlt: boolean, bonusAd: number = 0): DamageAnalysis => {
    const level3Combo =
        PYKE_HISTORY.Q.base[0] + PYKE_HISTORY.Q.scaling * bonusAd +
        PYKE_HISTORY.E.base[0] + PYKE_HISTORY.E.scaling * bonusAd +
        50;

    const level6Combo =
        PYKE_HISTORY.Q.base[1] + PYKE_HISTORY.Q.scaling * bonusAd +
        PYKE_HISTORY.E.base[2] + PYKE_HISTORY.E.scaling * bonusAd +
        75;

    const level6WithUlt = level6Combo +
        PYKE_HISTORY.R.base[0] + PYKE_HISTORY.R.scaling * bonusAd;

    const killThreshold = hasUlt
        ? `R execute threshold: ~${Math.round(level6WithUlt * 0.25)} HP (25% missing HP)`
        : `Q execute threshold: ~${Math.round(level6Combo * 0.175)} HP (17.5% max HP)`;

    return {
        level3Combo: Math.round(level3Combo),
        level6Combo: Math.round(level6Combo),
        level6WithUlt: Math.round(level6WithUlt),
        killThreshold,
        notes: [
            `Level 3 all-in: ~${Math.round(level3Combo)} (Q + E + autos)`,
            `Level 6 all-in: ~${Math.round(level6Combo)} without ult`,
            `Level 6 with R: ~${Math.round(level6WithUlt)} + execute`,
            'Assumes charged Q + full E; HoB adds ~150–200 from three autos',
        ],
    };
};

const estimateADCDamage = (adcName: string, level: number): number => {
    const adcDamage: { [key: string]: { level3: number; level6: number } } = {
        Jinx: { level3: 180, level6: 320 },
        Caitlyn: { level3: 200, level6: 380 },
        Ezreal: { level3: 220, level6: 400 },
        Lucian: { level3: 250, level6: 450 },
        Vayne: { level3: 200, level6: 380 },
        Ashe: { level3: 180, level6: 320 },
        Varus: { level3: 200, level6: 360 },
        Tristana: { level3: 240, level6: 420 },
        KogMaw: { level3: 190, level6: 340 },
        Twitch: { level3: 200, level6: 360 },
        Draven: { level3: 280, level6: 500 },
        MissFortune: { level3: 230, level6: 400 },
        Jhin: { level3: 210, level6: 380 },
        KaiSa: { level3: 200, level6: 380 },
        Samira: { level3: 240, level6: 450 },
        Kalista: { level3: 210, level6: 360 },
        Xayah: { level3: 220, level6: 390 },
        Sivir: { level3: 190, level6: 340 },
        Aphelios: { level3: 200, level6: 370 },
        Zeri: { level3: 180, level6: 330 },
        Nilah: { level3: 230, level6: 420 },
        Smolder: { level3: 190, level6: 360 },
    };
    const damage = adcDamage[adcName] || { level3: 200, level6: 350 };
    return level <= 3 ? damage.level3 : damage.level6;
};

const estimateSupportDamage = (supportName: string, level: number): number => {
    const supportDamage: { [key: string]: { level3: number; level6: number } } = {
        Lulu: { level3: 120, level6: 200 },
        Janna: { level3: 100, level6: 180 },
        Karma: { level3: 180, level6: 300 },
        Nami: { level3: 150, level6: 250 },
        Soraka: { level3: 80, level6: 140 },
        Thresh: { level3: 200, level6: 350 },
        Blitzcrank: { level3: 220, level6: 380 },
        Nautilus: { level3: 200, level6: 350 },
        Leona: { level3: 180, level6: 320 },
        Pyke: { level3: 250, level6: 450 },
        Senna: { level3: 180, level6: 300 },
        Lux: { level3: 220, level6: 400 },
        Xerath: { level3: 230, level6: 420 },
        Brand: { level3: 250, level6: 450 },
        Zyra: { level3: 240, level6: 430 },
        VelKoz: { level3: 230, level6: 420 },
        Swain: { level3: 200, level6: 380 },
        Morgana: { level3: 190, level6: 350 },
        Rakan: { level3: 160, level6: 280 },
        Braum: { level3: 150, level6: 250 },
        Alistar: { level3: 140, level6: 240 },
        Maokai: { level3: 180, level6: 320 },
        Bard: { level3: 170, level6: 300 },
        Renata: { level3: 140, level6: 250 },
        Yuumi: { level3: 80, level6: 150 },
        Sona: { level3: 120, level6: 220 },
        Seraphine: { level3: 160, level6: 300 },
        Taric: { level3: 150, level6: 250 },
        Rell: { level3: 140, level6: 240 },
        Mel: { level3: 260, level6: 480 },
        Neeko: { level3: 200, level6: 360 },
        Zoe: { level3: 210, level6: 380 },
        Milio: { level3: 100, level6: 180 },
    };
    const damage = supportDamage[supportName] || { level3: 150, level6: 250 };
    return level <= 3 ? damage.level3 : damage.level6;
};

const estimateUltimateDamage = (championName: string, isADC: boolean): number => {
    if (isADC) {
        const adcUltDamage: { [key: string]: number } = {
            Jinx: 300, Caitlyn: 350, Ezreal: 350, Lucian: 400, Vayne: 0, Ashe: 250,
            Varus: 300, Tristana: 300, KogMaw: 280, Twitch: 250, Draven: 350,
            MissFortune: 400, Jhin: 300, KaiSa: 150, Samira: 350, Kalista: 0,
            Xayah: 200, Sivir: 0, Aphelios: 250, Zeri: 200, Nilah: 250, Smolder: 280,
        };
        return adcUltDamage[championName] || 300;
    }
    const supportUltDamage: { [key: string]: number } = {
        Lulu: 0, Janna: 0, Karma: 250, Nami: 200, Soraka: 0, Thresh: 250,
        Blitzcrank: 300, Nautilus: 200, Leona: 200, Pyke: 0, Senna: 250, Lux: 300,
        Xerath: 350, Brand: 350, Zyra: 300, VelKoz: 400, Swain: 200, Morgana: 250,
        Rakan: 150, Braum: 150, Alistar: 0, Maokai: 200, Bard: 0, Renata: 0,
        Yuumi: 150, Sona: 150, Seraphine: 200, Taric: 0, Rell: 100, Mel: 400,
        Neeko: 300, Zoe: 280, Milio: 0,
    };
    return supportUltDamage[championName] || 200;
};

const calculateBotLaneDamage = (
    enemyADC: Champion | null,
    enemySupport: Champion | null,
    yourADC: Champion | null,
    pykeDamage: DamageAnalysis
): BotLaneDamageComparison => {
    const enemyADCLevel3 = enemyADC ? estimateADCDamage(enemyADC.id, 3) : 200;
    const enemySupportLevel3 = enemySupport ? estimateSupportDamage(enemySupport.id, 3) : 150;
    const enemyLevel3 = enemyADCLevel3 + enemySupportLevel3;

    const enemyADCLevel6 = enemyADC ? estimateADCDamage(enemyADC.id, 6) : 350;
    const enemySupportLevel6 = enemySupport ? estimateSupportDamage(enemySupport.id, 6) : 250;
    const enemyLevel6 = enemyADCLevel6 + enemySupportLevel6;

    const enemyADCUlt = enemyADC ? estimateUltimateDamage(enemyADC.id, true) : 300;
    const enemySupportUlt = enemySupport ? estimateUltimateDamage(enemySupport.id, false) : 200;
    const enemyLevel6WithUlt = enemyLevel6 + enemyADCUlt + enemySupportUlt;

    const yourADCLevel3 = yourADC ? estimateADCDamage(yourADC.id, 3) : 200;
    const yourADCLevel6 = yourADC ? estimateADCDamage(yourADC.id, 6) : 350;
    const yourADCUlt = yourADC ? estimateUltimateDamage(yourADC.id, true) : 300;

    const yourLevel3 = pykeDamage.level3Combo + yourADCLevel3;
    const yourLevel6 = pykeDamage.level6Combo + yourADCLevel6;
    const yourLevel6WithUlt = pykeDamage.level6WithUlt + yourADCLevel6 + yourADCUlt;

    const advantageNoUlt = yourLevel6 > enemyLevel6 ? 1 : yourLevel6 < enemyLevel6 ? -1 : 0;
    const advantageWithUlt = yourLevel6WithUlt > enemyLevel6WithUlt ? 1 : yourLevel6WithUlt < enemyLevel6WithUlt ? -1 : 0;
    const totalAdvantage = advantageNoUlt + advantageWithUlt;
    const advantage = totalAdvantage > 0 ? 'FAVORABLE' : totalAdvantage < 0 ? 'UNFAVORABLE' : 'EVEN';

    return {
        enemyCombo: {
            level3: Math.round(enemyLevel3),
            level6: Math.round(enemyLevel6),
            description: `${enemyADC?.name || 'Enemy ADC'} + ${enemySupport?.name || 'Enemy Support'}`,
        },
        yourCombo: {
            level3: Math.round(yourLevel3),
            level6: Math.round(yourLevel6),
            level6WithUlt: Math.round(yourLevel6WithUlt),
            description: `${yourADC?.name || 'Your ADC'} + Pyke`,
        },
        advantage,
        notes: [
            `Enemy 2v2 L3: ~${Math.round(enemyLevel3)} · Yours: ~${Math.round(yourLevel3)}`,
            `Enemy 2v2 L6: ~${Math.round(enemyLevel6)} · Yours: ~${Math.round(yourLevel6)}`,
            `With ults — Enemy: ~${Math.round(enemyLevel6WithUlt)} · Yours: ~${Math.round(yourLevel6WithUlt)}`,
            advantage === 'FAVORABLE'
                ? 'Take extended 2v2s when cooldowns line up'
                : advantage === 'EVEN'
                    ? '2v2 is timing-dependent — punish spent spells only'
                    : 'Skip extended 2v2 — crash and convert cross-map',
        ],
    };
};

const analyzeBotLaneMatchup = (
    enemyTeam: Champion[],
    yourADC: Champion | null,
    pykeDamage?: DamageAnalysis
): BotLaneMatchup | null => {
    const enemyADC = enemyTeam.find((c) => c.tags.includes('Marksman')) || null;
    const enemySupport =
        enemyTeam.find((c) => c.tags.includes('Support')) ||
        enemyTeam.find((c) => BURST_SUPPORTS.includes(c.id)) ||
        null;

    if (!enemyADC && !enemySupport) return null;

    let difficulty: BotLaneMatchup['matchupDifficulty'] = 'MEDIUM';
    let lanePhase = '';
    let allInPotential = '';
    const keyCooldowns: string[] = [];

    if (enemyADC) {
        const adcName = enemyADC.id;
        if (EASY_BOT_ADCS.includes(adcName)) {
            difficulty = 'EASY';
            lanePhase = 'Immobile ADC — bush Q and Flash-E are high percentage.';
            allInPotential = 'HIGH: Level 2–3 all-in is the default plan.';
        } else if (HARD_BOT_ADCS.includes(adcName)) {
            difficulty = 'HARD';
            lanePhase = 'Mobile ADC — hold engage for spent dashes, not speculative hooks.';
            allInPotential = 'TIMED: All-in only after their escape is down.';
            keyCooldowns.push(`${enemyADC.name} dash/escape: 15–20s`);
        } else if (VERY_HARD_BOT_ADCS.includes(adcName)) {
            difficulty = 'VERY_HARD';
            lanePhase = 'Spell shield / windwall ADC — bait the defensive spell, then go.';
            allInPotential = 'SETUP: Force their peel spell first; then commit.';
            keyCooldowns.push(`${enemyADC.name} spell shield: 20–24s`);
        }
    }

    if (enemySupport) {
        const suppName = enemySupport.id;

        // Burst mage supports (Mel, Brand, Zyra…) — scientific route
        if (BURST_SUPPORTS.includes(suppName)) {
            difficulty = difficulty === 'EASY' ? 'HARD' : 'VERY_HARD';
            lanePhase =
                `${enemySupport.name} burst lane — do not stand in their combo pattern. ` +
                'Trade only on spent W/Q; crash wave → leave for mid/jg; return on their long CDs.';
            allInPotential =
                'WINDOWED: Bone Plating + grey health — all-in the second their key spell is down, not before.';
            keyCooldowns.push(`${enemySupport.name} burst spell: 8–14s`);
            if (suppName === 'Mel') {
                lanePhase +=
                    ' Mel specifically: sidestep root, never eat full combo in a bush they warded; convert plates into mid fights.';
            }
        } else if (['Lulu', 'Janna', 'Karma', 'Nami', 'Soraka', 'Yuumi', 'Sona', 'Seraphine', 'Renata', 'Milio'].includes(suppName)) {
            difficulty = difficulty === 'VERY_HARD' ? 'VERY_HARD' : difficulty === 'EASY' ? 'MEDIUM' : difficulty;
            lanePhase += ' Enchanter — burst through shields; Serpent\'s when pads stack.';
            allInPotential = 'MODERATE: Wait for shield/heal CD, then collapse.';
            keyCooldowns.push(`${enemySupport.name} shield/heal: 8–12s`);
        } else if (['Thresh', 'Blitzcrank', 'Nautilus', 'Pyke'].includes(suppName)) {
            difficulty = difficulty === 'EASY' ? 'MEDIUM' : 'HARD';
            lanePhase += ' Hook lane — first hook owns the wave.';
            allInPotential = 'HIGH: Bait theirs, then your E is free.';
            keyCooldowns.push(`${enemySupport.name} hook: 12–16s`);
        } else if (
            ['Leona', 'Braum', 'Taric', 'Alistar', 'Rell', 'Shen'].includes(suppName) ||
            (enemySupport.tags.includes('Tank') && !enemySupport.tags.includes('Mage'))
        ) {
            difficulty = difficulty === 'EASY' ? 'MEDIUM' : difficulty === 'MEDIUM' ? 'HARD' : difficulty;
            lanePhase += ' Tank support — ignore them in all-ins; delete ADC.';
            allInPotential = 'FOCUS ADC: Tank is not the kill target.';
            keyCooldowns.push(`${enemySupport.name} engage: 12–18s`);
        } else if (enemySupport.tags.includes('Mage') && enemySupport.tags.includes('Support')) {
            difficulty = difficulty === 'EASY' ? 'MEDIUM' : 'HARD';
            lanePhase += ' Mage support — high damage, low HP; punish spent spells.';
            allInPotential = 'HIGH on CD windows.';
            keyCooldowns.push(`${enemySupport.name} main spell: 8–12s`);
        }
    }

    const matchup: BotLaneMatchup = {
        enemyADC,
        enemySupport,
        matchupDifficulty: difficulty,
        lanePhase: lanePhase || 'Standard lane — take the highest-percentage fight available.',
        allInPotential: allInPotential || 'MODERATE: Standard all-in timing.',
        keyCooldowns,
    };

    if (pykeDamage) {
        matchup.damageComparison = calculateBotLaneDamage(enemyADC, enemySupport, yourADC, pykeDamage);
    }

    return matchup;
};

export const analyzeMatchup = (
    enemyTeam: Champion[],
    build?: Build,
    yourADC?: Champion | null,
    allyMid?: Champion | null
): MatchupAnalysis => {
    const squishies: string[] = [];
    const tanks: string[] = [];
    const ccHeavy: string[] = [];
    const pokeHeavy: string[] = [];

    // Attach enchanters aren't prey themselves — you R the host. Yuumi only
    // matters as a soft target if she's forced off a squishy (rare); otherwise
    // exclude her so prey chips point at real kill angles.
    const ATTACH_ENCHANTERS = new Set(['Yuumi']);

    enemyTeam.forEach((c) => {
        if (ATTACH_ENCHANTERS.has(c.id) || ATTACH_ENCHANTERS.has(c.name)) {
            // Prefer the squishy she's likely attached to (ADC / soft mid)
            return;
        }
        if (c.tags.includes('Marksman') || c.tags.includes('Mage') || c.tags.includes('Assassin')) {
            if (!c.tags.includes('Tank') && !c.tags.includes('Fighter')) squishies.push(c.name);
        }
        if (c.tags.includes('Tank')) tanks.push(c.name);
        if (c.tags.includes('Support') && (c.tags.includes('Tank') || c.tags.includes('Mage'))) ccHeavy.push(c.name);
        if (c.tags.includes('Mage') && c.tags.includes('Support')) pokeHeavy.push(c.name);
    });

    // If Yuumi is in and we still have no prey, only then consider her when
    // her likely host is already a squishy (she's peel, not the execute).
    const hasYuumi = enemyTeam.some((c) => c.id === 'Yuumi' || c.name === 'Yuumi');
    if (hasYuumi && squishies.length === 0) {
        // No other soft targets — don't invent Yuumi as prey; look at supports with HP
    }

    const pykeDamage = calculatePykeDamage(6, true, 0);
    const botLaneMatchup = analyzeBotLaneMatchup(enemyTeam, yourADC || null, pykeDamage);
    const ctx = scanCompContext(enemyTeam, yourADC, allyMid, botLaneMatchup);
    const midNotes = scoreMidRoamValue(
        enemyTeam.find((c) => c.id === ctx.enemyMidId) || null,
        allyMid || null
    ).notes;

    const analysis: MatchupAnalysis = {
        title: 'SKIRMISH CONDUCTOR',
        description: 'Take hooks on mispositioned carries. Play your cooldowns — every fight should be one you chose.',
        winCondition: 'Catch rotations in fog; cash R resets into objectives.',
        aggressionLevel: 'MODERATE',
        primaryTargets: squishies.slice(0, 3),
        majorThreats: tanks.slice(0, 2),
        tips: ['W for safe vision entries.', 'Hold E if Q misses — reset the angle.'],
        damageAnalysis: pykeDamage,
        roamAdvice: '',
    };

    if (botLaneMatchup) analysis.botLaneMatchup = botLaneMatchup;

    // Hard / burst bot — optimal route (not "play scared")
    if (ctx.burstBot || (botLaneMatchup && DIFFICULTY_SCORE[botLaneMatchup.matchupDifficulty] >= 2)) {
        const threatName =
            botLaneMatchup?.enemySupport?.name ||
            botLaneMatchup?.enemyADC?.name ||
            'their bot';
        analysis.title = 'TEMPO ROUTE: CONVERT, DON\'T TUNNEL';
        analysis.description =
            `${threatName} owns extended 2v2 patterns. Optimal path: thin trades on spent spells, ` +
            'crash the wave, leave for a better fight (mid/jg/river), return on their long CDs.';
        analysis.winCondition =
            'Cross-map converts > bot plates. Stack tempo mid/jg until bot becomes a short-trade or pick lane.';
        analysis.aggressionLevel = ctx.midRoamValue >= 1 ? 'HIGH' : 'MODERATE';
        analysis.tips = [
            'Level 1–2: only punish if their burst spell is visibly down — otherwise thin with Q poke.',
            'On crash: leave. Mid/river/jg invade is the high-percentage play, not sitting in their combo range.',
            'Buy Edge / Maw / Mercs on the spike that keeps you alive through one rotation into R.',
            'When their key CD is down: full commit with ADC — that is the 2v2 you take.',
            botLaneMatchup?.enemySupport?.id === 'Mel'
                ? 'Mel: never eat root + full combo; side-step, then convert the wave into mid.'
                : 'Track their summoners — Flash-down windows are free R angles.',
            // High-elo: R is execute-only; R-E-recast-R chains multi-kills (LoL Sensei)
            'R is an execute, not a gap-closer — wait for the white X. Practice R→E→recast R to chain resets.',
        ];
    } else if (squishies.length >= 3 && tanks.length <= 1) {
        analysis.title = 'ASSASSIN MODE: KILL ON SIGHT';
        analysis.description = 'Fragile comp — you dictate every skirmish. Flash-E is a default tool, not a panic button.';
        analysis.winCondition = 'Snowball early; force R-reset fights before they scale tank items.';
        analysis.aggressionLevel = 'EXTREME';
        analysis.tips = [
            'Contest level 1–2 for the first all-in.',
            'Level 2 Q→E is your highest-percentage opener.',
            'If bot is stable, chain mid camps — soft mids are free gold.',
            // Expert: hold charged Q in fog — channel telegraph is free info for them
            'Charge Q from fog, not in vision — the channel animation tells them the hook is coming.',
            'Hook the support on CD when soft — they die faster than the ADC and fund your roam timer.',
        ];
    } else if (tanks.length >= 2 || ccHeavy.length >= 2) {
        analysis.title = 'MAP DISRUPTOR';
        analysis.description =
            'Frontline soaks bot 2v2 damage. Optimal plan: deny vision, roam for soft targets, peel carries in fights.';
        analysis.winCondition = 'Umbral fog + mid/jg picks. Peel ADC; R cleans up, it does not open.';
        analysis.aggressionLevel = 'LOW';
        const hasUmbral =
            build?.core.some((i) => i.id === ITEMS.UMBRAL_GLAIVE.id) ||
            build?.situational.some((i) => i.id === ITEMS.UMBRAL_GLAIVE.id);
        analysis.tips = [
            hasUmbral
                ? 'Rush Umbral — vision denial is the engage.'
                : 'Vision + roam tempo until your damage item lands.',
            'Q peels divers off your ADC — that wins teamfights.',
            'R executes leftovers after the frontline is occupied.',
            'Crash bot → leave for mid/jg soft targets.',
            // Expert roam timing: never leave on a slow push
            'Roam only after crash / freeze — leaving on a slow push donates plates and your ADC\'s wave.',
        ];
    } else if (pokeHeavy.length >= 1 || ctx.burstBot) {
        analysis.title = 'PUNISH WINDOWS';
        analysis.description = 'They want to chip you. Stay in lethal range with grey health; go the instant a key spell misses.';
        analysis.winCondition = 'Survive poke with Resolve tools, then Flash-E the overstep.';
        analysis.aggressionLevel = 'HIGH';
        analysis.tips = [
            'Bushes + grey health keep you in kill range.',
            'Missed poke spell = immediate engage.',
            'Hexflash (if taken) is elite in this pattern.',
            // Passive regen only out of vision — W into brush between trades
            'W into brush between trades — passive grey-health regen requires fog, not standing in lane.',
        ];
    }

    // Universal high-elo Pyke quirks (always surface 1–2)
    const expertQuirks = [
        'Post-6: roam mid when R is up and bot wave is crashed — not during a slow push (LoL Sensei).',
        'Mid-game leave bot: your job is fog picks + objectives; ADC scales while you hunt.',
    ];
    analysis.tips = [...analysis.tips, ...expertQuirks].slice(0, 7);

    // Roam advice — always mid-mobility aware
    const roamParts: string[] = [];
    if (ctx.midRoamValue >= 2) {
        roamParts.push('MID PRIORITY: enemy mid is punishable — shove bot and W river on their crash.');
    } else if (ctx.midRoamValue <= 0) {
        roamParts.push(
            'MID LOW VALUE: mobile/waveclear mid negates blind roams — sync with ally CC or take jg/top instead.'
        );
    } else {
        roamParts.push('MID TIMED: roam mid only on spent dashes or with ally setup.');
    }
    if (midNotes[0]) roamParts.push(midNotes[0]);
    if (ctx.hardBot) {
        roamParts.push('Hard bot: every crash is a leave timer — do not donate free time in their pattern.');
    }
    analysis.roamAdvice = roamParts.join(' ');

    // Surface roam as a tip
    if (analysis.roamAdvice) {
        analysis.tips = [analysis.roamAdvice, ...analysis.tips].slice(0, 6);
    }

    return analysis;
};

// --- Dominance Factor Engine ---

export interface DominanceMetrics {
    score: number; // 0-100
    grade: 'S+' | 'S' | 'A' | 'B' | 'C' | 'D';
    title: string;
    summary: string;
    earlyGameScore: number;
    midGameScore: number;
    lateGameScore: number;
}

export const calculateDominanceFactor = (enemyTeam: Champion[], build: Build): DominanceMetrics => {
    let score = 50;
    let squishies = 0;
    let tanks = 0;
    let hardCC = 0;
    let easyTargets = 0;

    enemyTeam.forEach((c) => {
        const isSquishy =
            c.tags.includes('Marksman') ||
            c.tags.includes('Mage') ||
            c.tags.includes('Assassin') ||
            c.tags.includes('Support');
        const isTank = c.tags.includes('Tank') || c.tags.includes('Fighter');

        if (isSquishy && !isTank) {
            squishies++;
            if (['Ashe', 'Jinx', 'Varus', 'KogMaw', 'Twitch', 'VelKoz', 'Xerath', 'Lux', 'Soraka', 'Sona'].includes(c.id)) {
                easyTargets++;
            }
        }
        if (isTank) tanks++;
        if (c.tags.includes('Tank') || (c.tags.includes('Support') && c.tags.includes('Mage'))) hardCC++;
    });

    score += squishies * 10;
    score += easyTargets * 5;
    score -= tanks * 8;
    score -= hardCC * 5;

    if (build.core.some((i) => i.id === '3179') && enemyTeam.some((c) => c.tags.includes('Support'))) {
        score += 5;
    }
    if (build.situational.some((i) => i.id === '6695') && enemyTeam.some((c) => ['Lulu', 'Janna', 'Karma', 'Sett'].includes(c.id))) {
        score += 10;
    }

    score = Math.min(100, Math.max(0, score));

    let grade: DominanceMetrics['grade'] = 'C';
    if (score >= 95) grade = 'S+';
    else if (score >= 85) grade = 'S';
    else if (score >= 70) grade = 'A';
    else if (score >= 55) grade = 'B';
    else if (score >= 40) grade = 'C';
    else grade = 'D';

    let early = 80;
    let mid = 70;
    let late = 40;
    if (squishies >= 3) {
        early += 10;
        mid += 15;
        late += 10;
    }
    if (tanks >= 2) {
        early -= 10;
        mid -= 10;
        late -= 20;
    }

    return {
        score,
        grade,
        title: getDominanceTitle(grade),
        summary: getDominanceSummary(grade, squishies, tanks),
        earlyGameScore: Math.min(100, early),
        midGameScore: Math.min(100, mid),
        lateGameScore: Math.min(100, late),
    };
};

const getDominanceTitle = (grade: string): string => {
    switch (grade) {
        case 'S+': return 'ABSOLUTE PREDATOR';
        case 'S': return 'DOMINANT FORCE';
        case 'A': return 'FAVORABLE MATCHUP';
        case 'B': return 'SKILL MATCHUP';
        case 'C': return 'PRECISION ROUTE';
        case 'D': return 'HIGH-VARIANCE HUNT';
        default: return 'UNKNOWN';
    }
};

const getDominanceSummary = (grade: string, squishies: number, tanks: number): string => {
    if (grade === 'S+' || grade === 'S') {
        return `${squishies} soft targets — reset fights are the default plan. Take every high-percentage angle.`;
    }
    if (grade === 'A' || grade === 'B') {
        return 'Balanced fight selection — delete backline, ignore tank absorbs, convert fog picks.';
    }
    return `Frontline/CC density (${tanks} tanks) — win via vision, roam converts, and peel. Force the fights you choose.`;
};
