/**
 * Enemy jungler pathing / gank-angle heuristics.
 * Live Client has no camp timers — we use clock templates + level/CS + champ identity.
 */

export interface JungleThreat {
  junglerName: string;
  sideBias: 'bot' | 'top' | 'unknown';
  gankRisk: 'low' | 'medium' | 'high';
  label: string;
  detail: string;
}

/** Early gank specialists — expect bot presence on first clear. */
const EARLY_GANKERS = new Set(
  ['LeeSin', 'XinZhao', 'Elise', 'RekSai', 'JarvanIV', 'Pantheon', 'Nidalee', 'Graves', 'Kindred', 'Vi', 'Warwick', 'Rengar', 'Ekko', 'Shaco', 'Evelyn', 'Evelynn'].map(
    (n) => n.toLowerCase()
  )
);

/** Full-clear / farm-first — later first gank. */
const FARM_JG = new Set(
  ['MasterYi', 'Master Yi', 'Kayn', 'Karthus', 'MasterYi', 'BelVeth', "Bel'veth", 'Lillia', 'Amumu', 'Fiddlesticks', 'Ivern', 'Skarner', 'Udyr', 'Volibear'].map(
    (n) => n.toLowerCase().replace(/[^a-z]/g, '')
  )
);

function norm(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

/**
 * Estimate whether enemy jg is threatening bot based on game clock + clear style.
 * Side bias is weak without leash info — we rotate expected sides by clear tempo.
 */
export function assessJungleThreat(
  gameTime: number,
  enemies: Array<{ championName: string; level?: number; position?: string; scores?: { creepScore?: number } }>
): JungleThreat | null {
  const jg =
    enemies.find((e) => {
      const p = (e.position || '').toUpperCase();
      return p === 'JUNGLE' || p === 'JNG';
    }) ||
    enemies.find((e) => EARLY_GANKERS.has(norm(e.championName)) || FARM_JG.has(norm(e.championName)));

  if (!jg) return null;

  const minutes = gameTime / 60;
  const name = jg.championName;
  const n = norm(name);
  const early = EARLY_GANKERS.has(n);
  const farm = FARM_JG.has(n);
  const cs = jg.scores?.creepScore ?? 0;
  const level = jg.level ?? 1;

  // Template windows (standard SR):
  // ~2:15–2:45 first scuttle contest; 3:00–4:00 first gank wave; 5:30–7:00 second clear gank;
  // 8:00–9:30 crab/herald path; dragon setups later.
  let sideBias: JungleThreat['sideBias'] = 'unknown';
  let gankRisk: JungleThreat['gankRisk'] = 'low';
  let label = 'Track jg';
  let detail = `${name} — watch river / pixel.`;

  if (minutes >= 2.1 && minutes <= 3.2) {
    sideBias = 'bot';
    gankRisk = early ? 'high' : 'medium';
    label = early ? 'Jg bot crab' : 'Scuttle window';
    detail = early
      ? `${name} early ganker — pixel + tri before crab. Expect bot river.`
      : `${name} toward first crab — ward pixel ~2:15, don't overextend.`;
  } else if (minutes > 3.2 && minutes <= 4.5) {
    sideBias = early ? 'bot' : 'unknown';
    gankRisk = early ? 'high' : farm ? 'low' : 'medium';
    label = 'First gank timing';
    detail = early
      ? `${name} classic first gank bot — hold flash angles, ward tri/river.`
      : farm
        ? `${name} full-clear — low bot threat until ~5–6.`
        : `${name} can appear bot after first clear — play fog edges.`;
  } else if (minutes > 5.5 && minutes <= 7.5) {
    sideBias = 'bot';
    gankRisk = 'medium';
    label = 'Second clear gank';
    detail = `${name} Lv${level} — bot gank / dive angle after second clear. Deep ward raptors if pushing.`;
  } else if (minutes >= 7.5 && minutes <= 9.5) {
    sideBias = 'bot';
    gankRisk = 'medium';
    label = 'Grub / river';
    detail = `${name} objective path — track from river ward; leave on crash if missing.`;
  } else if (minutes >= 12 && minutes <= 16) {
    sideBias = 'bot';
    gankRisk = 'high';
    label = 'Dragon setup jg';
    detail = `${name} lives on dragon side — Umbral clear + pick before spawn.`;
  }

  // CS heuristic: very low CS for clock → already ganking (higher risk)
  const expectedCs = minutes * 4.2;
  if (minutes >= 3 && minutes <= 8 && cs < expectedCs * 0.55 && cs > 0) {
    gankRisk = 'high';
    label = 'Jg missing farms';
    detail = `${name} CS ${cs} low for ${minutes.toFixed(1)}m — assume on the map (bot/mid).`;
  }

  if (gankRisk === 'low' && minutes > 1 && minutes < 12) {
    detail = `${name} — standard path. Re-ward river when crash-shoving.`;
  }

  return { junglerName: name, sideBias, gankRisk, label, detail };
}
