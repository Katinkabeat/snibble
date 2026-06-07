// ────────────────────────────────────────────────────────────
//  BuiltWordRow — the dashed "word being built" tray, shared by the
//  daily (GameView) and multiplayer (MatchView) loops.
//
//  Tiles always fit on ONE line: tile size shrinks to fit the word in
//  the available container width (ResizeObserver pattern), so a long
//  word (>7 letters) no longer wraps to a second row. Short words keep
//  the base 40×44 size — we only ever shrink, never grow.
// ────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from 'react'

const MAX_TILE_W = 40 // matches the old w-10 (2.5rem)
const TILE_RATIO = 11 / 10 // old h-11 / w-10
const GAP = 6 // gap-1.5 = 0.375rem
const PAD_X = 24 // px-3 left + right (12px each)

export default function BuiltWordRow({ built, setBuilt, placeholder, className = '' }) {
  const ref = useRef(null)
  const [boxWidth, setBoxWidth] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setBoxWidth(el.clientWidth)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const n = built.length
  // clientWidth includes padding (border excluded), so subtract px-3 to get
  // the usable inner width for the tile row.
  const avail = Math.max(0, boxWidth - PAD_X)
  const tileW =
    n > 0 && avail > 0
      ? Math.min(MAX_TILE_W, Math.floor((avail - GAP * (n - 1)) / n))
      : MAX_TILE_W
  const tileH = Math.round(tileW * TILE_RATIO)
  const fontSize = Math.max(10, Math.round(tileW * 0.45))

  return (
    <div
      ref={ref}
      className={`bg-white/70 border-2 border-dashed border-wordy-400 rounded-2xl px-3 py-3 min-h-[64px] flex flex-nowrap items-center justify-center gap-1.5 mb-2 ${className}`}
    >
      {n === 0 ? (
        <span className="italic text-wordy-500 text-sm">{placeholder}</span>
      ) : (
        built.map((letter, i) => (
          <button
            key={i}
            onClick={() => setBuilt(built.filter((_, j) => j !== i))}
            title="Tap to remove this letter"
            className="tile tile-placed font-display"
            style={{ width: tileW, height: tileH, fontSize }}
          >
            {letter}
          </button>
        ))
      )}
    </div>
  )
}
