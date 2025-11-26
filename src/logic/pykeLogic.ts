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

    // Pro play logic: Analyze bot lane matchup for item priority
    const enemySupport = enemyTeam.find(c => c.tags.includes('Support'));
    const isEnchanterSupport = enemySupport && ['Lulu', 'Janna', 'Karma', 'Nami', 'Soraka', 'Yuumi'].includes(enemySupport.id);
    const isTankSupport = enemySupport && enemySupport.tags.includes('Tank');
    
    if (squishyThreats >= 3) {
        // SNOWBALL MODE - Pro play: Voltaic Cyclosword is often first item for burst
        build.core = [
            { ...ITEMS.VOLTAIC_CYCLOSWORD, reason: 'PRO PLAY: Voltaic Cyclosword first for maximum burst. Energized slow sets up guaranteed Q hits.' },
            { ...ITEMS.AXIOM_ARC, reason: 'PRO PLAY: Axiom Arc 2nd ensures Ultimate resets. Critical for snowballing teamfights.' }
        ];
        // Hubris is situational in pro play - only if you're confident you can stack it
        situational.push({ ...ITEMS.HUBRIS, reason: 'Snowball item: Gain massive AD from takedowns. Only if you can reliably get kills.' });
        situational.push({ ...ITEMS.OPPORTUNITY, reason: 'Movement speed and lethality after kills. Great for cleanup and resets.' });
    } else {
        // CONTROL MODE (Vs Tanks or Harder Comps)
        // Pro play: Umbral Glaive is almost always first item for vision control
        const shouldRushUmbral = isTankSupport || isEnchanterSupport || tankThreats >= 2;
        
        if (shouldRushUmbral) {
            build.core = [
                { ...ITEMS.UMBRAL_GLAIVE, reason: 'PRO PLAY: Umbral Glaive first for vision control. Essential against tank/enchanter supports.' },
                { ...ITEMS.YOUMUUS_GHOSTBLADE, reason: 'PRO PLAY: Youmuu\'s 2nd for roaming potential. Mobility to impact other lanes.' }
            ];
        } else {
            // Standard control build
            build.core = [
                { ...ITEMS.VOLTAIC_CYCLOSWORD, reason: 'Control Mode: Burst damage for picks. Slows help secure kills.' },
                { ...ITEMS.YOUMUUS_GHOSTBLADE, reason: 'Mobility to roam and impact other lanes since you cannot one-shot tanks.' }
            ];
            // Add Umbral as situational for vision control
            situational.push({ ...ITEMS.UMBRAL_GLAIVE, reason: 'Vision control dominance. Consider if enemy has good vision setup.' });
        }
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
    // Pro play pacing: Usually complete first item before boots, or get tier 1 boots early
    // Logic: Starter -> Core 1 -> Boots -> Core 2 -> Situational
    const buildPathItems: Item[] = [
        ITEMS.WORLD_ATLAS,
        { ...build.core[0], reason: 'RUSH ITEM: ' + (build.core[0].reason || 'Core power spike.') }
    ];
    
    // Boots timing: Usually after first item, but can be earlier if needed
    buildPathItems.push({ ...build.boots, reason: 'TIER 2 BOOTS: ' + (build.boots.reason || 'Mobility.') });
    
    // Second core item
    buildPathItems.push({ ...build.core[1], reason: 'SECOND CORE: ' + (build.core[1].reason || 'Follow up damage.') });
    
    // Situational items
    buildPathItems.push(...build.situational);
    
    build.buildPath = buildPathItems;

    return build;
};

export const calculateRunes = (enemyTeam: Champion[], build?: Build): RunePage => {
    const reasons: { [key: number]: string } = {};

    // Default Reasons
    reasons[9923] = "Hail of Blades: Essential for Pyke. Allows 3 quick autos to proc passive/execute range.";
    reasons[8143] = "Sudden Impact: Grants lethality after using E (dash) or W (stealth).";
    reasons[8106] = "Ultimate Hunter: Reduces R cooldown. More R's = More Gold.";

    // Vision Rune Logic (Synergy with Build) - Slot 3 runes
    // Updated for Season 15: Zombie Ward (8136) and Ghost Poro (8120) removed
    // New options: Sixth Sense (8137), Grisly Mementos (8140), Deep Ward (8141)
    // Sixth Sense is the direct replacement for Zombie Ward
    let visionRuneId = 8137; // Sixth Sense (replaces Zombie Ward)
    let visionRuneReason = "Sixth Sense: Automatically senses nearby untracked and unseen wards, tracking them for your team. At level 11, reveals wards for 10 seconds. Perfect synergy with vision control.";

    const hasUmbral = build?.core.some(i => i.id === ITEMS.UMBRAL_GLAIVE.id) || build?.situational.some(i => i.id === ITEMS.UMBRAL_GLAIVE.id);

    if (hasUmbral) {
        visionRuneId = 8137; // Sixth Sense - best synergy with Umbral Glaive (same as default)
        visionRuneReason = "Sixth Sense: SYNERGY! With Umbral Glaive, you'll clear many wards. Sixth Sense tracks and reveals them for your team, maximizing vision control.";
    }

    reasons[visionRuneId] = visionRuneReason;

    // Determine secondary tree based on enemy composition
    let pokeThreats = 0;
    enemyTeam.forEach(c => {
        if (c.tags.includes('Mage') || c.tags.includes('Marksman')) pokeThreats++;
    });

    // Initialize secondary tree runes based on composition
    let secondaryStyleId: number;
    let secondaryRune1: number;
    let secondaryRune2: number;

    if (pokeThreats >= 3) {
        // Resolve tree for poke-heavy teams
        secondaryStyleId = 8400; // Resolve
        secondaryRune1 = 8444; // Second Wind
        secondaryRune2 = 8242; // Unflinching (ID updated for Season 15)
        
        reasons[8444] = `Second Wind: Chosen because enemy has ${pokeThreats} poke threats. Regenerates health after taking damage.`;
        reasons[8242] = "Unflinching: Grants tenacity when your summoner spells are down.";
    } else {
        // Precision tree for standard builds
        secondaryStyleId = 8000; // Precision
        secondaryRune1 = 8009; // Presence of Mind
        secondaryRune2 = 8014; // Coup de Grace
        
        reasons[8009] = "Presence of Mind: MANA SUSTAIN. Restores mana on takedowns, ensuring you never run dry during reset chains.";
        reasons[8014] = "Coup de Grace: Deal more damage to low health enemies. Synergizes with Pyke's R execute threshold.";
    }

    const page: RunePage = {
        name: "Pyke Dominator",
        primaryStyleId: 8100, // Domination
        subStyleId: secondaryStyleId,
        selectedPerkIds: [
            9923, // Hail of Blades (Keystone)
            8143, // Sudden Impact (Primary)
            visionRuneId, // Dynamic Vision Rune (Primary)
            8106, // Ultimate Hunter (Primary)
            secondaryRune1, // Secondary Rune 1
            secondaryRune2, // Secondary Rune 2
            5008, // Offense: Adaptive Force (Stat Shard)
            5008, // Flex: Adaptive Force (Stat Shard)
            5001  // Defense: Health Scaling (Stat Shard)
        ],
        reasons: reasons
    };

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
    botLaneMatchup?: BotLaneMatchup;
    damageAnalysis?: DamageAnalysis;
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

// Pyke ability damage data (base + scaling per level)
const PYKE_ABILITIES = {
    Q: {
        base: [85, 135, 185, 235, 285],
        scaling: 0.6, // 60% bonus AD
        executeThreshold: [0.15, 0.175, 0.2, 0.225, 0.25] // % max HP execute
    },
    E: {
        base: [95, 125, 155, 185, 215],
        scaling: 1.0 // 100% bonus AD
    },
    R: {
        base: [250, 290, 330],
        scaling: 0.8, // 80% bonus AD
        executeThreshold: [0.25, 0.275, 0.3] // % missing HP execute
    },
    Passive: {
        greyHealth: 0.3, // 30% of damage taken becomes grey health
        regen: [25, 30, 35, 40, 45] // per level
    }
};

// Calculate damage for Pyke combo
const calculatePykeDamage = (_level: number, hasUlt: boolean, bonusAd: number = 0): DamageAnalysis => {
    const level3Combo = 
        PYKE_ABILITIES.Q.base[0] + (PYKE_ABILITIES.Q.scaling * bonusAd) + // Q damage
        PYKE_ABILITIES.E.base[0] + (PYKE_ABILITIES.E.scaling * bonusAd) + // E damage
        50; // Auto attack estimate
    
    const level6Combo = 
        PYKE_ABILITIES.Q.base[1] + (PYKE_ABILITIES.Q.scaling * bonusAd) + // Q level 2
        PYKE_ABILITIES.E.base[2] + (PYKE_ABILITIES.E.scaling * bonusAd) + // E level 3
        75; // Auto attacks
    
    const level6WithUlt = level6Combo + 
        PYKE_ABILITIES.R.base[0] + (PYKE_ABILITIES.R.scaling * bonusAd); // R level 1
    
    // Execute thresholds
    let killThreshold = '';
    if (hasUlt) {
        killThreshold = `R execute threshold: ~${Math.round(level6WithUlt * 0.25)} HP (25% missing HP)`;
    } else {
        killThreshold = `Q execute threshold: ~${Math.round(level6Combo * 0.175)} HP (17.5% max HP)`;
    }
    
    return {
        level3Combo: Math.round(level3Combo),
        level6Combo: Math.round(level6Combo),
        level6WithUlt: Math.round(level6WithUlt),
        killThreshold,
        notes: [
            `Level 3 all-in: ~${Math.round(level3Combo)} damage (Q + E + autos)`,
            `Level 6 all-in: ~${Math.round(level6Combo)} damage without ult`,
            `Level 6 with R: ~${Math.round(level6WithUlt)} damage + execute`,
            'Damage assumes Q is fully charged and E hits both targets',
            'Hail of Blades adds ~150-200 extra damage from 3 quick autos'
        ]
    };
};

// Estimate damage for common ADC abilities (simplified)
const estimateADCDamage = (adcName: string, level: number): number => {
    // Base damage estimates for common ADCs at different levels
    const adcDamage: { [key: string]: { level3: number; level6: number } } = {
        'Jinx': { level3: 180, level6: 320 },
        'Caitlyn': { level3: 200, level6: 380 },
        'Ezreal': { level3: 220, level6: 400 },
        'Lucian': { level3: 250, level6: 450 },
        'Vayne': { level3: 200, level6: 380 },
        'Ashe': { level3: 180, level6: 320 },
        'Varus': { level3: 200, level6: 360 },
        'Tristana': { level3: 240, level6: 420 },
        'KogMaw': { level3: 190, level6: 340 },
        'Twitch': { level3: 200, level6: 360 },
    };
    
    const damage = adcDamage[adcName] || { level3: 200, level6: 350 };
    return level <= 3 ? damage.level3 : damage.level6;
};

// Estimate damage for common support abilities
const estimateSupportDamage = (supportName: string, level: number): number => {
    const supportDamage: { [key: string]: { level3: number; level6: number } } = {
        'Lulu': { level3: 120, level6: 200 },
        'Janna': { level3: 100, level6: 180 },
        'Karma': { level3: 180, level6: 300 },
        'Nami': { level3: 150, level6: 250 },
        'Soraka': { level3: 80, level6: 140 },
        'Thresh': { level3: 200, level6: 350 },
        'Blitzcrank': { level3: 220, level6: 380 },
        'Nautilus': { level3: 200, level6: 350 },
        'Leona': { level3: 180, level6: 320 },
        'Pyke': { level3: 250, level6: 450 },
    };
    
    const damage = supportDamage[supportName] || { level3: 150, level6: 250 };
    return level <= 3 ? damage.level3 : damage.level6;
};

// Calculate bot lane damage comparison
const calculateBotLaneDamage = (
    enemyADC: Champion | null,
    enemySupport: Champion | null,
    yourADC: Champion | null,
    pykeDamage: DamageAnalysis
): BotLaneDamageComparison => {
    // Enemy combo: Enemy Bot + Enemy Support
    const enemyLevel3 = (enemyADC ? estimateADCDamage(enemyADC.id, 3) : 0) + 
                        (enemySupport ? estimateSupportDamage(enemySupport.id, 3) : 0);
    const enemyLevel6 = (enemyADC ? estimateADCDamage(enemyADC.id, 6) : 0) + 
                        (enemySupport ? estimateSupportDamage(enemySupport.id, 6) : 0);
    
    // Your combo: Your Bot + Pyke (Support)
    const yourADCLevel3 = yourADC ? estimateADCDamage(yourADC.id, 3) : 180; // Default if not selected
    const yourADCLevel6 = yourADC ? estimateADCDamage(yourADC.id, 6) : 320; // Default if not selected
    
    const yourLevel3 = pykeDamage.level3Combo + yourADCLevel3;
    const yourLevel6 = pykeDamage.level6Combo + yourADCLevel6;
    const yourLevel6Ult = pykeDamage.level6WithUlt + yourADCLevel6;
    
    const advantage = yourLevel6Ult > enemyLevel6 ? 'FAVORABLE' : 
                     yourLevel6 > enemyLevel6 ? 'EVEN' : 'UNFAVORABLE';
    
    return {
        enemyCombo: {
            level3: Math.round(enemyLevel3),
            level6: Math.round(enemyLevel6),
            description: `${enemyADC?.name || 'Enemy ADC'} + ${enemySupport?.name || 'Enemy Support'}`
        },
        yourCombo: {
            level3: Math.round(yourLevel3),
            level6: Math.round(yourLevel6),
            level6WithUlt: Math.round(yourLevel6Ult),
            description: `${yourADC?.name || 'Your ADC'} + Pyke`
        },
        advantage,
        notes: [
            `Enemy 2v2 damage at level 3: ~${Math.round(enemyLevel3)}`,
            `Your 2v2 damage at level 3: ~${Math.round(yourLevel3)}`,
            `Enemy 2v2 damage at level 6: ~${Math.round(enemyLevel6)}`,
            `Your 2v2 damage at level 6: ~${Math.round(yourLevel6)}`,
            `Your 2v2 damage at level 6 with ult: ~${Math.round(yourLevel6Ult)}`,
            advantage === 'FAVORABLE' ? 'You win extended 2v2 trades' :
            advantage === 'EVEN' ? '2v2 trades are skill-dependent' :
            'Avoid extended 2v2 trades, look for picks'
        ]
    };
};

// Analyze bot lane matchup specifically
const analyzeBotLaneMatchup = (enemyTeam: Champion[], yourADC: Champion | null, pykeDamage?: DamageAnalysis): BotLaneMatchup | null => {
    const enemyADC = enemyTeam.find(c => c.tags.includes('Marksman')) || null;
    const enemySupport = enemyTeam.find(c => c.tags.includes('Support')) || null;
    
    if (!enemyADC && !enemySupport) return null;
    
    let difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'VERY_HARD' = 'MEDIUM';
    let lanePhase = '';
    let allInPotential = '';
    const keyCooldowns: string[] = [];
    
    // Analyze ADC matchup
    if (enemyADC) {
        const adcName = enemyADC.id;
        
        // Easy matchups (immobile ADCs)
        if (['Ashe', 'Jinx', 'Varus', 'KogMaw', 'Twitch'].includes(adcName)) {
            difficulty = 'EASY';
            lanePhase = 'Favorable: These ADCs lack mobility. Look for Q hooks from bushes and Flash-E engages.';
            allInPotential = 'HIGH: Can easily all-in at level 2-3. Their immobility makes them easy targets.';
        }
        // Hard matchups (mobile/self-peel ADCs)
        else if (['Ezreal', 'Lucian', 'Caitlyn', 'Vayne', 'Tristana'].includes(adcName)) {
            difficulty = 'HARD';
            lanePhase = 'Difficult: High mobility makes hooks harder to land. Wait for them to use dashes.';
            allInPotential = 'MODERATE: Only engage when their escape abilities are on cooldown.';
            keyCooldowns.push(`${enemyADC.name} dash/escape: 15-20s`);
        }
        // Very hard (strong self-peel)
        else if (['Xayah', 'Sivir', 'Samira'].includes(adcName)) {
            difficulty = 'VERY_HARD';
            lanePhase = 'Extremely Difficult: Spell shields and windwalls counter your Q. Bait their abilities first.';
            allInPotential = 'LOW: Must bait their defensive abilities before engaging.';
            keyCooldowns.push(`${enemyADC.name} spell shield: 20-24s`);
        }
    }
    
    // Analyze Support matchup - Check specific champions FIRST before tags
    if (enemySupport) {
        const suppName = enemySupport.id;
        
        // Enchanter supports (check by name first to avoid tag confusion)
        if (['Lulu', 'Janna', 'Karma', 'Nami', 'Soraka', 'Yuumi', 'Sona', 'Seraphine', 'Renata'].includes(suppName)) {
            difficulty = difficulty === 'VERY_HARD' ? 'VERY_HARD' : difficulty === 'EASY' ? 'MEDIUM' : difficulty;
            lanePhase += ' Enchanter support - they will shield/heal. Burst is key.';
            allInPotential = 'MODERATE: Need to burst through shields. Consider Serpent\'s Fang.';
            keyCooldowns.push(`${enemySupport.name} shield/heal: 8-12s`);
        }
        // Hook supports (skill matchup)
        else if (['Thresh', 'Blitzcrank', 'Nautilus', 'Pyke'].includes(suppName)) {
            difficulty = difficulty === 'EASY' ? 'MEDIUM' : 'HARD';
            lanePhase += ' Hook vs Hook matchup - whoever lands hook first wins.';
            allInPotential = 'HIGH: Skill matchup. Bait their hook, then engage.';
            keyCooldowns.push(`${enemySupport.name} hook: 12-16s`);
        }
        // Tank supports (check by name for common tanks, then fallback to tags)
        else if (['Leona', 'Braum', 'Taric', 'Alistar', 'Rell', 'Shen'].includes(suppName) || 
                 (enemySupport.tags.includes('Tank') && !enemySupport.tags.includes('Mage'))) {
            difficulty = difficulty === 'EASY' ? 'MEDIUM' : difficulty === 'MEDIUM' ? 'HARD' : difficulty;
            lanePhase += ' Enemy support is tanky - avoid extended trades.';
            allInPotential = 'Focus ADC, ignore tank support in all-ins.';
            keyCooldowns.push(`${enemySupport.name} engage tool: 12-18s`);
        }
        // Mage supports (like Brand, Zyra, Vel'Koz)
        else if (enemySupport.tags.includes('Mage') && enemySupport.tags.includes('Support')) {
            difficulty = difficulty === 'EASY' ? 'MEDIUM' : 'MEDIUM';
            lanePhase += ' Mage support - high damage but squishy. Look for all-ins.';
            allInPotential = 'HIGH: They are squishy. All-in when their key spells are down.';
            keyCooldowns.push(`${enemySupport.name} main spell: 8-12s`);
        }
    }
    
    const matchup: BotLaneMatchup = {
        enemyADC,
        enemySupport,
        matchupDifficulty: difficulty,
        lanePhase: lanePhase || 'Standard lane phase. Look for opportunities.',
        allInPotential: allInPotential || 'MODERATE: Standard all-in potential.',
        keyCooldowns
    };
    
    // Add damage comparison if we have Pyke damage data
    if (pykeDamage) {
        matchup.damageComparison = calculateBotLaneDamage(enemyADC, enemySupport, yourADC, pykeDamage);
    }
    
    return matchup;
};

export const analyzeMatchup = (enemyTeam: Champion[], build?: Build, yourADC?: Champion | null): MatchupAnalysis => {
    const squishies: string[] = [];
    const tanks: string[] = [];
    const ccHeavy: string[] = [];
    const pokeHeavy: string[] = [];

    enemyTeam.forEach(c => {
        if (c.tags.includes('Marksman') || c.tags.includes('Mage') || c.tags.includes('Assassin')) {
            if (!c.tags.includes('Tank') && !c.tags.includes('Fighter')) squishies.push(c.name);
        }
        if (c.tags.includes('Tank')) tanks.push(c.name);
        if (c.tags.includes('Support') && (c.tags.includes('Tank') || c.tags.includes('Mage'))) ccHeavy.push(c.name);
        if (c.tags.includes('Mage') && c.tags.includes('Support')) pokeHeavy.push(c.name);
    });

    // Determine Strategy
    const analysis: MatchupAnalysis = {
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
        
        // Only suggest Umbral Glaive if it's actually in the build
        const hasUmbral = build?.core.some(i => i.id === ITEMS.UMBRAL_GLAIVE.id) || 
                         build?.situational.some(i => i.id === ITEMS.UMBRAL_GLAIVE.id) ||
                         build?.buildPath.some(i => i.id === ITEMS.UMBRAL_GLAIVE.id);
        
        const tips = [];
        if (hasUmbral) {
            tips.push("Rush Umbral Glaive to deny vision and control the map.");
        } else {
            tips.push("Focus on roaming and vision control with your support item.");
        }
        tips.push("Use Q to peel divers off your ADC, not just to engage.");
        tips.push("Your R is for executing low targets, not starting fights.");
        tips.push("Look for roams mid when bot lane is pushed in.");
        
        analysis.tips = tips;
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

    // Add damage analysis first
    const hasUmbral = build?.core.some(i => i.id === ITEMS.UMBRAL_GLAIVE.id);
    const bonusAd = hasUmbral ? 0 : 0; // No items at level 6 typically
    const pykeDamage = calculatePykeDamage(6, true, bonusAd);
    analysis.damageAnalysis = pykeDamage;
    
    // Add bot lane specific analysis (with damage comparison)
    const botLaneMatchup = analyzeBotLaneMatchup(enemyTeam, yourADC || null, pykeDamage);
    if (botLaneMatchup) {
        analysis.botLaneMatchup = botLaneMatchup;
    }
    
    return analysis;
};
