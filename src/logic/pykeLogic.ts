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
    reason?: string; // [NEW] Why this item was chosen
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
    reason?: string; // [NEW] Why this rune was chosen
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
    // Starters
    WORLD_ATLAS: { id: '3867', name: 'World Atlas', icon: 'World_Atlas', reason: 'Standard support starter for gold generation.' },
    POTION: { id: '2003', name: 'Health Potion', icon: 'Health_Potion', reason: 'Sustain in lane.' },

    // Boots
    MOBILITY_BOOTS: { id: '3117', name: 'Boots of Mobility', icon: 'Boots_of_Mobility', reason: 'Maximum roaming potential to impact other lanes.' },
    MERCURY_TREADS: { id: '3111', name: 'Mercury\'s Treads', icon: 'Mercury_s_Treads', reason: 'Essential against heavy CC or magic damage threats.' },
    PLATED_STEELCAPS: { id: '3047', name: 'Plated Steelcaps', icon: 'Plated_Steelcaps', reason: 'Reduces damage from auto-attack heavy compositions.' },
    IONIAN_BOOTS: { id: '3158', name: 'Ionian Boots of Lucidity', icon: 'Ionian_Boots_of_Lucidity', reason: 'Cheap ability haste for more frequent hooks and stuns.' },

    // Core / Lethality
    VOLTAIC_CYCLOSWORD: { id: '6699', name: 'Voltaic Cyclosword', icon: 'Voltaic_Cyclosword', reason: 'Burst damage and slow on energized attacks, perfect for Pyke\'s engage.' },
    YOUMUUS_GHOSTBLADE: { id: '3142', name: 'Youmuu\'s Ghostblade', icon: 'Youmuu_s_Ghostblade', reason: 'High mobility for roaming and escaping.' },
    OPPORTUNITY: { id: '6701', name: 'Opportunity', icon: 'Opportunity', reason: 'Grants lethality and movement speed after kills, snowballing leads.' },
    HUBRIS: { id: '6697', name: 'Hubris', icon: 'Hubris', reason: 'Snowball item: gain massive AD bonuses from takedowns.' },
    AXIOM_ARC: { id: '6696', name: 'Axiom Arc', icon: 'Axiom_Arc', reason: 'Ultimate cooldown refund allows for multi-kill resets in teamfights.' },

    // Situational / Defensive / Counter
    EDGE_OF_NIGHT: { id: '3814', name: 'Edge of Night', icon: 'Edge_of_Night', reason: 'Spell shield blocks critical CC (e.g., hooks, stuns) allowing safer engages.' },
    MAW_OF_MALMORTIUS: { id: '3156', name: 'Maw of Malmortius', icon: 'Maw_of_Malmortius', reason: 'Lifeline shield prevents being one-shot by heavy magic burst.' },
    SERYLDAS_GRUDGE: { id: '6694', name: 'Serylda\'s Grudge', icon: 'Serylda_s_Grudge', reason: 'Armor penetration and slow to deal with tankier enemies.' },
    GUARDIAN_ANGEL: { id: '3026', name: 'Guardian Angel', icon: 'Guardian_Angel', reason: 'Revive passive allows for aggressive plays without giving up shutdowns.' },
    MERCURIAL_SCIMITAR: { id: '3139', name: 'Mercurial Scimitar', icon: 'Mercurial_Scimitar', reason: 'Cleanse active is mandatory against suppression (Malzahar/Warwick/Skarner).' },
    DEATHS_DANCE: { id: '6333', name: 'Death\'s Dance', icon: 'Death_s_Dance', reason: 'Delays incoming damage, preventing instant burst from physical assassins.' },
    UMBRAL_GLAIVE: { id: '3179', name: 'Umbral Glaive', icon: 'Umbral_Glaive', reason: 'Vision control dominance; clear wards instantly.' },
    SERPENTS_FANG: { id: '6695', name: 'Serpent\'s Fang', icon: 'Serpents_Fang', reason: 'Shield Reaver passive destroys enemy shields (Lulu, Sett, Tahm Kench).' },
    CHEMPUNK_CHAINSWORD: { id: '6609', name: 'Chempunk Chainsword', icon: 'Chempunk_Chainsword', reason: 'Applies Grievous Wounds to counter heavy healing (Soraka, Aatrox, Sylas).' },
};

export const calculateBuild = (enemyTeam: Champion[]): Build => {
    // Analyze Enemy Team
    let apThreats = 0;
    let ccThreats = 0;
    let tankThreats = 0;
    let squishyThreats = 0;
    let healingThreats = 0;
    let shieldThreats = 0;
    let suppressionThreats = 0;

    // Specific Champion Counters
    const shieldChamps = ['Lulu', 'Janna', 'Karma', 'Sett', 'TahmKench', 'Shen', 'Sion', 'Nautilus'];
    const healingChamps = ['Soraka', 'Yuumi', 'Aatrox', 'Sylas', 'Vladimir', 'DrMundo', 'Warwick'];
    const suppressionChamps = ['Malzahar', 'Warwick', 'Skarner'];

    enemyTeam.forEach(champ => {
        if (champ.tags.includes('Mage') || champ.damageType === 'Magic') apThreats++;
        if (champ.tags.includes('Tank') || champ.tags.includes('Fighter')) tankThreats++;

        // Refined Squishy Logic: Only count if NOT a Tank
        const isSquishyRole = champ.tags.includes('Marksman') || champ.tags.includes('Assassin') || champ.tags.includes('Mage');
        const isTank = champ.tags.includes('Tank');
        if (isSquishyRole && !isTank) squishyThreats++;

        if (champ.tags.includes('Tank') || champ.tags.includes('Support')) ccThreats++;

        // Granular checks
        if (shieldChamps.includes(champ.id)) shieldThreats++;
        if (healingChamps.includes(champ.id)) healingThreats++;
        if (suppressionChamps.includes(champ.id)) suppressionThreats++;
    });

    // Default Carry Build
    const build: Build = {
        starter: [ITEMS.WORLD_ATLAS, ITEMS.POTION, ITEMS.POTION],
        boots: ITEMS.MOBILITY_BOOTS,
        core: [ITEMS.VOLTAIC_CYCLOSWORD, ITEMS.OPPORTUNITY],
        situational: [],
        buildPath: [],
        spells: ['Flash', 'Ignite']
    };

    // Logic Adjustments & Reasoning

    // 1. Boots
    if (ccThreats >= 3) {
        build.boots = { ...ITEMS.MERCURY_TREADS, reason: `Chosen due to ${ccThreats} heavy CC threats on the enemy team.` };
    } else if (enemyTeam.some(c => c.tags.includes('Marksman') && c.damageType === 'Physical') && tankThreats >= 2) {
        build.boots = { ...ITEMS.PLATED_STEELCAPS, reason: 'Chosen to mitigate heavy auto-attack damage from enemy Marksmen/Fighters.' };
    } else {
        build.boots = { ...ITEMS.IONIAN_BOOTS, reason: 'Default choice for ability haste to maximize hook frequency.' };
    }

    // 2. Core Adjustments
    // Strategy: Determine Win Condition
    // - Snowball: Vs Squishies -> Hubris / Axiom Arc
    // - Control: Vs Tanks/Safe -> Umbral / Youmuu's

    // Initialize situational items array here, as core logic might add to it.
    const situational: Item[] = [];

    if (squishyThreats >= 3) {
        // SNOWBALL MODE
        build.core = [
            { ...ITEMS.HUBRIS, reason: 'Snowball Mode: Enemy team is squishy. Stack AD and take over the game.' },
            { ...ITEMS.AXIOM_ARC, reason: 'PLAYABILITY: Rushing Axiom Arc 2nd ensures your Ultimate is ALWAYS up for resets, maximizing early snowball.' }
        ];
        // Add Voltaic as a strong situational follow-up
        situational.push({ ...ITEMS.VOLTAIC_CYCLOSWORD, reason: 'Burst damage to one-shot the squishy targets.' });
    } else {
        // CONTROL MODE (Vs Tanks or Harder Comps)
        build.core = [
            { ...ITEMS.UMBRAL_GLAIVE, reason: 'Control Mode: Enemy team is tanky/safe. Focus on vision control and map pressure.' },
            { ...ITEMS.YOUMUUS_GHOSTBLADE, reason: 'Mobility to roam and impact other lanes since you cannot one-shot tanks.' }
        ];
    }

    // 3. Situational / Counter Items

    // Critical Counters (Priority 1)
    if (suppressionThreats > 0) {
        situational.push({ ...ITEMS.MERCURIAL_SCIMITAR, reason: 'CRITICAL: Enemy has suppression (e.g., Malzahar/Warwick). You MUST buy this to cleanse it.' });
    }
    if (shieldThreats >= 2) {
        situational.push({ ...ITEMS.SERPENTS_FANG, reason: `Enemy has ${shieldThreats} shield-heavy champions. This item reduces their shielding power significantly.` });
    }
    if (healingThreats >= 2) {
        situational.push({ ...ITEMS.CHEMPUNK_CHAINSWORD, reason: `Enemy has ${healingThreats} heavy healers. Anti-heal is required to secure kills.` });
    }

    // Defensive / Utility (Priority 2)
    if (apThreats >= 2) {
        situational.push({ ...ITEMS.MAW_OF_MALMORTIUS, reason: `Enemy has ${apThreats} magic damage threats. The magic shield will save your life.` });
    }
    if (ccThreats >= 2) {
        situational.push({ ...ITEMS.EDGE_OF_NIGHT, reason: 'Spell shield is vital to block engage tools from the enemy team.' });
    }
    if (tankThreats >= 2) {
        situational.push({ ...ITEMS.SERYLDAS_GRUDGE, reason: 'Armor penetration is needed to damage the multiple tanks on the enemy team.' });
    }

    // General Good Items (Priority 3)
    // Axiom Arc is now potentially a core item in snowball builds, so only add if not already core.
    if (!build.core.some(item => item.id === ITEMS.AXIOM_ARC.id)) {
        situational.push({ ...ITEMS.AXIOM_ARC, reason: 'More ultimate resets = more gold for your team.' });
    }
    situational.push({ ...ITEMS.GUARDIAN_ANGEL, reason: 'Late game insurance. Allows you to make risky plays to end the game.' });

    build.situational = situational.slice(0, 3);

    // Construct Full Build Path (Pacing Engine)
    // Logic: Starter -> Rush Core 1 -> Boots -> Core 2 -> Situational
    build.buildPath = [
        ITEMS.WORLD_ATLAS,
        { ...build.core[0], reason: 'RUSH ITEM: ' + (build.core[0].reason || 'Core power spike.') },
        { ...build.boots, reason: 'TIER 2 BOOTS: ' + (build.boots.reason || 'Mobility.') },
        { ...build.core[1], reason: 'SECOND CORE: ' + (build.core[1].reason || 'Follow up damage.') },
        ...build.situational
    ];

    return build;
};

export const calculateRunes = (enemyTeam: Champion[], build?: Build): RunePage => {
    const reasons: { [key: number]: string } = {};

    // Default Reasons
    reasons[9923] = "Hail of Blades: Essential for Pyke. Allows 3 quick autos to proc passive/execute range.";
    reasons[8143] = "Sudden Impact: Grants lethality after using E (dash) or W (stealth).";
    reasons[8106] = "Ultimate Hunter: Reduces R cooldown. More R's = More Gold.";

    // Vision Rune Logic (Synergy with Build)
    let visionRuneId = 8120; // Default to Ghost Poro (Safe)
    let visionRuneReason = "Ghost Poro: Provides extra vision duration. Good since we don't have Umbral Glaive to clear wards aggressively.";

    const hasUmbral = build?.core.some(i => i.id === ITEMS.UMBRAL_GLAIVE.id) || build?.situational.some(i => i.id === ITEMS.UMBRAL_GLAIVE.id);

    if (hasUmbral) {
        visionRuneId = 8136; // Zombie Ward
        visionRuneReason = "Zombie Ward: SYNERGY! You have Umbral Glaive, so you will clear many wards. This turns them into vision for your team.";
    }

    reasons[visionRuneId] = visionRuneReason;

    const page: RunePage = {
        name: "Pyke Dominator",
        primaryStyleId: 8100,
        subStyleId: 8400,
        selectedPerkIds: [
            9923, // Hail of Blades
            8143, // Sudden Impact
            visionRuneId, // Dynamic Vision Rune
            8106, // Ultimate Hunter
            8444, // Second Wind
            8424, // Unflinching
            5008, // Offense: Adaptive Force
            5008, // Flex: Adaptive Force
            5001  // Defense: Health Scaling
        ],
        reasons: reasons
    };

    let pokeThreats = 0;
    enemyTeam.forEach(c => {
        if (c.tags.includes('Mage') || c.tags.includes('Marksman')) pokeThreats++;
    });

    if (pokeThreats >= 3) {
        page.subStyleId = 8400; // Resolve
        page.selectedPerkIds[4] = 8444; // Second Wind
        page.selectedPerkIds[5] = 8424; // Unflinching

        page.reasons[8444] = `Second Wind: Chosen because enemy has ${pokeThreats} poke threats. Regenerates health after taking damage.`;
        page.reasons[8424] = "Unflinching: Grants tenacity when your summoner spells are down.";
    } else {
        page.subStyleId = 8000; // Precision
        page.selectedPerkIds[4] = 8009; // Presence of Mind (Replaces Triumph)
        page.selectedPerkIds[5] = 8014; // Coup de Grace

        page.reasons[8009] = "Presence of Mind: MANA SUSTAIN. Restores mana on takedowns, ensuring you never run dry during reset chains.";
        page.reasons[8014] = "Coup de Grace: Deal more damage to low health enemies. Synergizes with Pyke's R execute threshold.";
    }

    return page;
};

// --- NEW: Matchup Strategy Engine ---

export interface MatchupAnalysis {
    title: string;
    description: string;
    winCondition: string;
    aggressionLevel: 'EXTREME' | 'HIGH' | 'MODERATE' | 'LOW';
    primaryTargets: string[];
    majorThreats: string[];
    tips: string[];
}

export const analyzeMatchup = (enemyTeam: Champion[]): MatchupAnalysis => {
    let squishies: string[] = [];
    let tanks: string[] = [];
    let ccHeavy: string[] = [];
    let pokeHeavy: string[] = [];

    enemyTeam.forEach(c => {
        if (c.tags.includes('Marksman') || c.tags.includes('Mage') || c.tags.includes('Assassin')) {
            if (!c.tags.includes('Tank') && !c.tags.includes('Fighter')) squishies.push(c.name);
        }
        if (c.tags.includes('Tank')) tanks.push(c.name);
        if (c.tags.includes('Support') && (c.tags.includes('Tank') || c.tags.includes('Mage'))) ccHeavy.push(c.name);
        if (c.tags.includes('Mage') && c.tags.includes('Support')) pokeHeavy.push(c.name);
    });

    // Determine Strategy
    let analysis: MatchupAnalysis = {
        title: "Balanced Skirmisher",
        description: "Look for hooks on mispositioned carries. Play around your cooldowns.",
        winCondition: "Catch enemies rotating through the jungle.",
        aggressionLevel: "MODERATE",
        primaryTargets: squishies.slice(0, 3),
        majorThreats: tanks.slice(0, 2),
        tips: ["Use W to scout for vision safely.", "Hold E for escape if you miss Q."]
    };

    // Scenario 1: Squishy Feast (Snowball)
    if (squishies.length >= 3 && tanks.length <= 1) {
        analysis.title = "ASSASSIN MODE: KILL ON SIGHT";
        analysis.description = "The enemy team is extremely fragile. You are the main character. Look for aggressive Flash-E engages.";
        analysis.winCondition = "Snowball early. End the game before 25 minutes.";
        analysis.aggressionLevel = "EXTREME";
        analysis.tips = [
            "Invade level 1 if possible.",
            "Look for a Level 2 All-in (Q -> E). They cannot survive your burst.",
            "Camp the enemy mid-laner if bot is safe."
        ];
    }
    // Scenario 2: Tank/CC Hell (Control)
    else if (tanks.length >= 2 || ccHeavy.length >= 2) {
        analysis.title = "ROAMING DISRUPTOR";
        analysis.description = "You cannot kill their frontline. Do NOT force fights 2v2 bot lane against tanks.";
        analysis.winCondition = "Abandon lane (roam) to get your Mid/Jungle ahead. Peel for your Carry in fights.";
        analysis.aggressionLevel = "LOW";
        analysis.tips = [
            "Rush Umbral Glaive to deny vision.",
            "Use Q to peel divers off your ADC, not just to engage.",
            "Your R is for executing low targets, not starting fights."
        ];
    }
    // Scenario 3: Poke Lane (Sustain)
    else if (pokeHeavy.length >= 1) {
        analysis.title = "SUSTAIN & PUNISH";
        analysis.description = "They will try to poke you out. Give up CS to stay healthy. Wait for them to miss a key spell.";
        analysis.winCondition = "Survive lane with Second Wind. Flash-E when they overstep to poke.";
        analysis.aggressionLevel = "HIGH"; // Once you go in, you MUST kill them.
        analysis.tips = [
            "Stay in bushes to regenerate Grey Health.",
            "If they miss their CC/Poke spell, ENGAGE IMMEDIATELY.",
            "Hexflash (if taken) is deadly here."
        ];
    }

    return analysis;
};
