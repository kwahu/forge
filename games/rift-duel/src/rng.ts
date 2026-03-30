/** Deterministyczny RNG: para (seed, counter) jednoznacznie wyznacza wartość. */

export function randomUint32(seed: number, counter: number): { value: number; nextCounter: number } {
  let t = (seed + counter * 0x6d2b79f5) >>> 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = (t ^ (t >>> 14)) >>> 0;
  return { value, nextCounter: counter + 1 };
}

export function randomInt(
  seed: number,
  counter: number,
  maxExclusive: number,
): { value: number; nextCounter: number } {
  if (maxExclusive <= 0) throw new Error("randomInt: maxExclusive must be > 0");
  const { value, nextCounter } = randomUint32(seed, counter);
  return { value: value % maxExclusive, nextCounter };
}

export function shuffle<T>(items: T[], seed: number, startCounter: number): { shuffled: T[]; nextCounter: number } {
  const arr = [...items];
  let c = startCounter;
  for (let i = arr.length - 1; i > 0; i--) {
    const r = randomInt(seed, c, i + 1);
    c = r.nextCounter;
    const j = r.value;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return { shuffled: arr, nextCounter: c };
}
