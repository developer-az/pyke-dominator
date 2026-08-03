/**
 * After prey is identified, name the ability to bait and the single most
 * important target — so the overlay stays useful past the first glance.
 */

export interface PreyFocus {
  /** Highest-priority kill target name. */
  target: string;
  /** One short line: bait X, then punish. */
  line: string;
}

/** Key spell to bait / track before committing (common engage-support knowledge). */
const BAIT: Record<string, string> = {
  lux: 'bait Lux Q (root) — then walk up',
  morgana: 'bait Morgana Q — E only after it misses',
  blitzcrank: 'bait Blitz Q — stand behind minions',
  thresh: 'bait Thresh Q — don\'t respect hook if he missed',
  nautilus: 'bait Naut Q — sidestep, then all-in',
  leona: 'bait Leona E — disengage, punish long CD',
  rakan: 'bait Rakan W — his engage is the window',
  alistar: 'bait Ali combo — don\'t flash early',
  pyke: 'bait enemy Pyke Q/E — he dies to your R first',
  pantheon: 'bait Panth stun — don\'t eat W for free',
  mel: 'bait Mel root — never stand still in bush',
  brand: 'bait Brand W/Q — all-in on spent poke',
  zyra: 'bait Zyra E — clear plants, then commit',
  xerath: 'bait Xerath stun — gapclose after',
  velkoz: 'bait Vel\'Koz knockup — then dive',
  milio: 'track Milio Q — he\'s peel, kill the ADC',
  lulu: 'bait Lulu W/polymorph — then R the carry',
  janna: 'bait Janna Q — R her ADC in the tornado CD',
  nami: 'bait Nami Q — punish bubble miss',
  soraka: 'silence/gapclose Soraka — she\'s peel not prey',
  karma: 'bait Karma W root — all-in on CD',
  senna: 'bait Senna W root — then R her',
  ezreal: 'bait Ezreal E — R only when E is down',
  caitlyn: 'bait Cait net/E — don\'t flash trap',
  jhin: 'bait Jhin W root — enter on 4th shot reload',
  kaisa: 'bait Kai\'Sa R/E — she\'s slippery until spent',
  xayah: 'bait Xayah R — hold your R until feathers drop',
  smolder: 'dive Smolder when E is down — he kites',
  zeri: 'bait Zeri R/dash — sticky only after',
  ashe: 'bait Ashe R — flash after it lands elsewhere',
  jinx: 'all-in Jinx when chompers are down',
  aphelios: 'track Aphelios weapon — punish short range',
  corki: 'bait Corki package — he\'s soft after',
  yasuo: 'bait Yasuo windwall — Q after it drops',
  yone: 'bait Yone E — R him when spirit is out',
  zed: 'bait Zed W/R — don\'t flash early shadows',
  akali: 'bait Akali shroud — wait it out, then R',
  sylas: 'bait Sylas E2 — he\'s killable after dash',
  ahri: 'bait Ahri E charm — all-in on miss',
  syndra: 'bait Syndra E stun — then gapclose',
  viktor: 'bait Viktor W stun — walk around zone',
  orianna: 'bait Ori ball — don\'t flash into it',
  hwei: 'bait Hwei CC — short trades only',
  leblanc: 'bait LeBlanc W/R — she\'s fake until spent',
  fizz: 'bait Fizz E — R when untargetable ends',
  katarina: 'bait Kat dagger pickup — interrupt R',
  khazix: 'bait Kha isolation leap — group or R him first',
  rengar: 'bait Rengar leap — face him in vision',
  evelynn: 'bait Eve charm — don\'t chase charm',
  naafiri: 'don\'t solo fog — pack up, armor up, R her host',
  graves: 'bait Graves dash — he has no escape after',
  viego: 'bait Viego W stun — peel then reset',
  leeSin: 'bait Lee Q — he\'s one dash',
  jarvaniv: 'bait Jarvan EQ — exit flag before R',
  vi: 'bait Vi R — peel the point-click',
  elise: 'bait Elise stun/rappel — commit after',
  nidalee: 'don\'t eat spear — then invade her',
};

function norm(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

export function buildPreyFocus(
  primaryTargets: string[],
  enemyNames: string[],
  keyCooldowns?: string[]
): PreyFocus | null {
  const target = primaryTargets[0] || enemyNames[0];
  if (!target) return null;

  const bait = BAIT[norm(target)];
  const cdHint = keyCooldowns?.find((k) => norm(k).includes(norm(target)));

  let line: string;
  if (bait) {
    line = `${bait}. Priority: ${target}.`;
  } else if (cdHint) {
    line = `${cdHint} — then R ${target}.`;
  } else {
    line = `Priority kill: ${target}. Bait their escape/CC first, then commit R.`;
  }

  // If second prey exists and is lane partner, mention briefly
  if (primaryTargets[1] && primaryTargets[1] !== target) {
    line = `${line} Next: ${primaryTargets[1]}.`;
  }

  return { target, line: line.slice(0, 160) };
}
