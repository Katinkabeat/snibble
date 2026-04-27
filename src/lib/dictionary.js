// ────────────────────────────────────────────────────────────
//  Word dictionary — TWL Scrabble list (173,144 words).
//  Same source as Wordy's `words.txt`. Copied into Snibble's
//  /public so the bundle stays self-contained.
// ────────────────────────────────────────────────────────────

let wordSet = null
let wordList = null
let loadPromise = null

// Tests/scripts running in Node can pre-populate the dictionary by
// setting `globalThis.__SNIBBLE_DICTIONARY__` to an array of words
// before importing this module. In the browser, we fetch words.txt.
function dictionaryUrl() {
  // import.meta.env exists in Vite; fall back to '/' for non-Vite contexts.
  try {
    const base = import.meta.env?.BASE_URL ?? '/'
    return `${base}words.txt`
  } catch {
    return '/words.txt'
  }
}

async function loadWordList() {
  if (wordSet) return { wordSet, wordList }
  if (loadPromise) return loadPromise

  // Test/script override: pre-loaded words array on globalThis.
  if (typeof globalThis !== 'undefined' && globalThis.__SNIBBLE_DICTIONARY__) {
    wordList = globalThis.__SNIBBLE_DICTIONARY__
    wordSet = new Set(wordList)
    return { wordSet, wordList }
  }

  loadPromise = fetch(dictionaryUrl())
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load word list: ${res.status}`)
      return res.text()
    })
    .then((text) => {
      wordList = text.split('\n').map((w) => w.trim()).filter(Boolean)
      wordSet = new Set(wordList)
      return { wordSet, wordList }
    })

  return loadPromise
}

/** Returns true if word is a valid TWL word. Case-insensitive. */
export async function isValidWord(word) {
  const w = (word || '').toUpperCase().trim()
  if (!w) return false
  if (w.length === 1) return w === 'A' || w === 'I'
  const { wordSet } = await loadWordList()
  return wordSet.has(w)
}

/** Returns the underlying dictionary array (for the craving generator's solvability check). */
export async function getDictionary() {
  const { wordList } = await loadWordList()
  return wordList
}

/** Eager load — call early so the first puzzle doesn't pay the load cost. */
export function preloadDictionary() {
  return loadWordList()
}
