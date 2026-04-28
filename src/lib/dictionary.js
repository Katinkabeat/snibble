// ────────────────────────────────────────────────────────────
//  Word dictionaries — TWL Scrabble list (173,144 words) for
//  validation, plus a "common words" list (top ~5000 most-frequent
//  English words intersected with TWL → 4355 words) used to
//  compute the daily par line.
// ────────────────────────────────────────────────────────────

let wordSet = null
let wordList = null
let loadPromise = null
let commonSet = null
let commonLoadPromise = null

function urlFor(filename) {
  try {
    const base = import.meta.env?.BASE_URL ?? '/'
    return `${base}${filename}`
  } catch {
    return `/${filename}`
  }
}

async function loadWordList() {
  if (wordSet) return { wordSet, wordList }
  if (loadPromise) return loadPromise

  if (typeof globalThis !== 'undefined' && globalThis.__SNIBBLE_DICTIONARY__) {
    wordList = globalThis.__SNIBBLE_DICTIONARY__
    wordSet = new Set(wordList)
    return { wordSet, wordList }
  }

  loadPromise = fetch(urlFor('words.txt'))
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

async function loadCommonWords() {
  if (commonSet) return commonSet
  if (commonLoadPromise) return commonLoadPromise

  if (typeof globalThis !== 'undefined' && globalThis.__SNIBBLE_COMMON_WORDS__) {
    commonSet = new Set(globalThis.__SNIBBLE_COMMON_WORDS__)
    return commonSet
  }

  commonLoadPromise = fetch(urlFor('common-words.txt'))
    .then((res) => {
      if (!res.ok) throw new Error(`Failed to load common-words list: ${res.status}`)
      return res.text()
    })
    .then((text) => {
      const list = text.split('\n').map((w) => w.trim()).filter(Boolean)
      commonSet = new Set(list)
      return commonSet
    })

  return commonLoadPromise
}

export async function isValidWord(word) {
  const w = (word || '').toUpperCase().trim()
  if (!w) return false
  if (w.length === 1) return w === 'A' || w === 'I'
  const { wordSet } = await loadWordList()
  return wordSet.has(w)
}

export async function getDictionary() {
  const { wordList } = await loadWordList()
  return wordList
}

export async function getCommonWordSet() {
  return loadCommonWords()
}

export function preloadDictionary() {
  return Promise.all([loadWordList(), loadCommonWords()])
}
