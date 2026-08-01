/**
 * Cannon-wave schedule for Summoner's Rift.
 * Minions spawn at 65s; waves every 30s. Cannon on every 3rd wave until 15:00,
 * then every 2nd wave until 25:00, then every wave.
 */

export interface CannonWindow {
  /** Game time (s) when this cannon wave spawns at nexus */
  spawnAt: number;
  /** Seconds until spawn (negative = already spawned) */
  eta: number;
  /** True if this is the active "shove this cannon" window */
  isActionWindow: boolean;
}

/** Wave index 0 spawns at 65s, then +30s each. */
function waveSpawnTime(waveIndex: number): number {
  return 65 + waveIndex * 30;
}

function waveHasCannon(waveIndex: number): boolean {
  const t = waveSpawnTime(waveIndex);
  if (t < 15 * 60) {
    // Waves 0,1,2 → cannon on 2; 3,4,5 → cannon on 5; …
    return waveIndex % 3 === 2;
  }
  if (t < 25 * 60) {
    // Every other wave after 15:00
    return waveIndex % 2 === 1;
  }
  return true;
}

/** Next cannon spawn at or after `gameTime`. */
export function nextCannon(gameTime: number): CannonWindow | null {
  if (gameTime <= 0) return null;
  for (let i = 0; i < 120; i++) {
    if (!waveHasCannon(i)) continue;
    const spawnAt = waveSpawnTime(i);
    if (spawnAt + 25 < gameTime) continue; // already long past
    const eta = spawnAt - gameTime;
    // Action window: ~20s before spawn through ~35s after (crash timing)
    const isActionWindow = eta <= 20 && eta >= -35;
    return { spawnAt, eta, isActionWindow };
  }
  return null;
}

export function formatCannonEta(eta: number): string {
  if (eta <= 0) return 'now';
  const s = Math.ceil(eta);
  return s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
}
