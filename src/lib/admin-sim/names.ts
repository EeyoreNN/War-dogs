import { hash32 } from "./rng";

/*
 * Invented callsigns. Two syllable banks are combined into pseudo-words ("Vantor", "Kelrux")
 * that read like handles and belong to nobody. Every (seed, i) pair maps to a distinct name
 * for i < HEADS × TAILS; beyond that a numeric tag keeps them unique.
 */
const HEADS = [
  "Van",
  "Kel",
  "Mor",
  "Ras",
  "Sti",
  "Lom",
  "Dra",
  "Fen",
  "Gri",
  "Hal",
  "Jun",
  "Kor",
  "Lex",
  "Mav",
  "Nor",
  "Oz",
  "Pral",
  "Quen",
  "Rux",
  "Sav",
  "Tor",
  "Ul",
  "Vex",
  "Wol",
  "Yar",
  "Zed",
  "Bram",
  "Cas",
  "Dun",
  "Esk",
  "Fal",
  "Gor",
] as const;
const TAILS = [
  "ta",
  "so",
  "ren",
  "quin",
  "dor",
  "ix",
  "lo",
  "mar",
  "nex",
  "os",
  "pel",
  "rick",
  "sen",
  "tan",
  "ur",
  "vik",
  "wen",
  "yx",
  "zar",
  "bo",
  "cair",
  "den",
  "eth",
  "fir",
] as const;

const POOL = HEADS.length * TAILS.length;

/** A pronounceable invented callsign, unique per (seed, i). Never a real name. */
export function botName(seed: number, i: number): string {
  const offset = hash32(seed, 0x4e414d45) % POOL; // "NAME"
  // 197 is coprime with POOL (768), so i -> idx is a bijection for i < POOL.
  const idx = (offset + i * 197) % POOL;
  const head = HEADS[Math.floor(idx / TAILS.length)];
  const tail = TAILS[idx % TAILS.length];
  const base = `${head}${tail}`;
  // Every fourth handle carries a short tag, the way real rosters mix styles.
  const styled =
    hash32(seed, i, 0x5354) % 4 === 0 ? `${base}${(hash32(seed, i, 7) % 90) + 10}` : base;
  return i < POOL ? styled : `${styled}_${Math.floor(i / POOL)}`;
}

/** A SteamID64-shaped id (17 digits) for bot `i`; stable per seed. */
export function botSteamId(seed: number, i: number): string {
  const tail = 8_000_000_000 + (hash32(seed, i, 0x5354454d) % 1_000_000_000);
  return `7656119${tail}`;
}
