// ────────────────────────────────────────────────────────────
//  Deterministic seeded RNG.
//
//  Used to derive the daily puzzle from the calendar date so
//  every player sees the same craving + tray today. Uses
//  mulberry32 — small, fast, decent distribution for our needs.
// ────────────────────────────────────────────────────────────

/** FNV-1a hash → 32-bit unsigned int. */
function hashString(str) {
  let h = 2166136261 >>> 0
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  return h
}

/** mulberry32 — returns a (state) → number-in-[0,1) generator. */
function mulberry32(seed) {
  let a = seed >>> 0
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Build a deterministic RNG from a string seed. Same string → same
 * sequence forever. Used for daily puzzles ("snibble:2026-04-27") and
 * (in v2) for matches ("snibble:match:abc123").
 */
export function rngFromSeed(seedString) {
  const hash = hashString(seedString)
  const next = mulberry32(hash)
  return {
    next,
    /** Random integer in [0, n). */
    int(n) {
      return Math.floor(next() * n)
    },
    /** Pick a random element from an array. */
    pick(arr) {
      return arr[Math.floor(next() * arr.length)]
    },
    /** Fisher-Yates shuffle (returns a new array, doesn't mutate). */
    shuffle(arr) {
      const out = arr.slice()
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out
    },
    /** Pick `n` distinct elements from an array. */
    sample(arr, n) {
      return this.shuffle(arr).slice(0, n)
    },
  }
}

/**
 * Build the canonical daily seed string for a given Date.
 * Uses the date's YYYY-MM-DD in **Atlantic time** so all players globally
 * roll over together at the same moment (midnight America/Halifax).
 *
 * The Atlantic date is computed by formatting the UTC instant in the
 * America/Halifax timezone — that way DST shifts are handled by the
 * Intl machinery, not by us.
 */
export function dailySeedString(date = new Date()) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Halifax',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  // en-CA gives us "YYYY-MM-DD" exactly.
  const ymd = fmt.format(date)
  return `snibble:daily:${ymd}`
}
