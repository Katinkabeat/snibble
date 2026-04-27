// ────────────────────────────────────────────────────────────
//  Mossy — the starter snail.
//
//  Three visible stages over her ~30-session growth arc:
//    baby         (sessions 1–10)
//    adolescent   (sessions 11–20)
//    adult        (sessions 21–30)
//
//  All three share viewBox 0 0 220 170 so they scale identically.
//  Animations live in CSS — pass `mouth="open"` to trigger chomp.
//
//  Construction notes:
//   - The body+head are rendered as TWO sibling paths instead of one
//     closed path: a fill-only closed shape (gives the silhouette its
//     interior colour) plus a stroke-only open path that traces just
//     the visible curves. This avoids a visible vertical "seam" line
//     where the head extension meets the body, which the closing
//     L-segment of a single closed path would otherwise draw.
// ────────────────────────────────────────────────────────────

export default function Mossy({ stage = 'baby', mouth = 'smile', className = '' }) {
  if (stage === 'adult') return <MossyAdult mouth={mouth} className={className} />
  if (stage === 'adolescent') return <MossyAdolescent mouth={mouth} className={className} />
  return <MossyBaby mouth={mouth} className={className} />
}

// ───────── Shared bits ─────────

const SharedDefs = () => (
  <defs>
    <radialGradient id="mossyShell" cx="40%" cy="35%">
      <stop offset="0%" stopColor="#f3e8ff" />
      <stop offset="60%" stopColor="#c084fc" />
      <stop offset="100%" stopColor="#9333ea" />
    </radialGradient>
    <radialGradient id="mossyShellAdult" cx="40%" cy="35%">
      <stop offset="0%" stopColor="#f3e8ff" />
      <stop offset="55%" stopColor="#a855f7" />
      <stop offset="100%" stopColor="#6b21a8" />
    </radialGradient>
    <radialGradient id="mossyBody" cx="50%" cy="40%">
      <stop offset="0%" stopColor="#fef3c7" />
      <stop offset="100%" stopColor="#fcd9b8" />
    </radialGradient>
  </defs>
)

const Eyes = ({ leftStalk, rightStalk, leftEye, rightEye, isClosed = false }) => (
  <>
    <path d={leftStalk} stroke="#581c87" strokeWidth="3" fill="none" strokeLinecap="round" />
    <path d={rightStalk} stroke="#581c87" strokeWidth="3" fill="none" strokeLinecap="round" />
    <circle cx={leftEye.cx} cy={leftEye.cy} r={leftEye.r} fill="white" stroke="#581c87" strokeWidth="2.2" />
    <circle cx={rightEye.cx} cy={rightEye.cy} r={rightEye.r} fill="white" stroke="#581c87" strokeWidth="2.2" />
    {!isClosed && (
      <>
        <circle className="snibble-pupil" cx={leftEye.cx + 1} cy={leftEye.cy + 1} r={leftEye.r * 0.42} fill="#581c87" />
        <circle className="snibble-pupil" cx={rightEye.cx + 1} cy={rightEye.cy + 1} r={rightEye.r * 0.42} fill="#581c87" />
        <circle cx={leftEye.cx + 1.2} cy={leftEye.cy - 0.6} r={leftEye.r * 0.18} fill="white" />
        <circle cx={rightEye.cx + 1.2} cy={rightEye.cy - 0.6} r={rightEye.r * 0.18} fill="white" />
      </>
    )}
  </>
)

const Mouth = ({ x, y, mouth = 'smile' }) => {
  if (mouth === 'open') return <ellipse cx={x} cy={y} rx="7" ry="9" fill="#581c87" />
  return (
    <path
      d={`M ${x - 14} ${y - 6} Q ${x - 1} ${y + 4} ${x + 14} ${y - 4}`}
      stroke="#581c87"
      strokeWidth="2.5"
      fill="none"
      strokeLinecap="round"
    />
  )
}

/** Body silhouette helper. Renders a fill-only neck/head bulge (closed
 *  for the interior fill) plus a stroke-only open outline that traces
 *  just the visible curves — no seam line where the head meets body.
 *  The body ellipse's own outline takes over from there. */
const NeckExtension = ({ d, openD }) => (
  <>
    <path d={d} fill="url(#mossyBody)" stroke="none" />
    <path d={openD} stroke="#581c87" strokeWidth="3" fill="none" strokeLinecap="round" />
  </>
)

// ───────── Baby Mossy ─────────
function MossyBaby({ mouth, className }) {
  return (
    <svg className={className} viewBox="0 0 220 170" xmlns="http://www.w3.org/2000/svg">
      <SharedDefs />

      {/* Body — small, round */}
      <ellipse cx="110" cy="135" rx="70" ry="18" fill="url(#mossyBody)" stroke="#581c87" strokeWidth="3" />
      <NeckExtension
        d="M 45 135 Q 45 108 60 100 Q 80 92 92 105 L 92 135 Z"
        openD="M 45 135 Q 45 108 60 100 Q 80 92 92 105"
      />

      {/* Shell — small, single loose spiral, undecorated */}
      <circle cx="130" cy="105" r="38" fill="url(#mossyShell)" stroke="#581c87" strokeWidth="3" />
      <circle cx="130" cy="105" r="22" fill="none" stroke="#581c87" strokeWidth="2" />
      <circle cx="130" cy="105" r="9" fill="none" stroke="#581c87" strokeWidth="2" />
      <ellipse cx="116" cy="92" rx="10" ry="6" fill="rgba(255,255,255,0.4)" />

      {/* Eyes — bigger relative to head */}
      <Eyes
        leftStalk="M 60 105 Q 53 78 55 65"
        rightStalk="M 78 102 Q 82 70 86 60"
        leftEye={{ cx: 55, cy: 62, r: 9 }}
        rightEye={{ cx: 86, cy: 57, r: 9 }}
      />

      <Mouth x={71} y={115} mouth={mouth} />
      <ellipse cx="78" cy="123" rx="6" ry="3" fill="#f9a8d4" opacity="0.55" />
    </svg>
  )
}

// ───────── Adolescent Mossy ─────────
function MossyAdolescent({ mouth, className }) {
  return (
    <svg className={className} viewBox="0 0 220 170" xmlns="http://www.w3.org/2000/svg">
      <SharedDefs />

      <ellipse cx="110" cy="135" rx="82" ry="20" fill="url(#mossyBody)" stroke="#581c87" strokeWidth="3" />
      <NeckExtension
        d="M 30 135 Q 30 102 48 92 Q 70 82 86 96 L 86 135 Z"
        openD="M 30 135 Q 30 102 48 92 Q 70 82 86 96"
      />

      {/* Shell — medium, fuller spiral, undecorated */}
      <circle cx="125" cy="98" r="44" fill="url(#mossyShell)" stroke="#581c87" strokeWidth="3" />
      <circle cx="125" cy="98" r="32" fill="none" stroke="#581c87" strokeWidth="2.2" />
      <circle cx="125" cy="98" r="20" fill="none" stroke="#581c87" strokeWidth="2.2" />
      <circle cx="125" cy="98" r="9" fill="none" stroke="#581c87" strokeWidth="2.2" />
      <ellipse cx="110" cy="83" rx="12" ry="8" fill="rgba(255,255,255,0.4)" />

      <Eyes
        leftStalk="M 42 96 Q 35 65 38 50"
        rightStalk="M 64 92 Q 68 60 72 46"
        leftEye={{ cx: 38, cy: 47, r: 9 }}
        rightEye={{ cx: 72, cy: 43, r: 9 }}
      />

      <Mouth x={55} y={108} mouth={mouth} />
      <ellipse cx="60" cy="116" rx="7" ry="3.5" fill="#f9a8d4" opacity="0.55" />
    </svg>
  )
}

// ───────── Adult Mossy ─────────
function MossyAdult({ mouth, className }) {
  return (
    <svg className={className} viewBox="0 0 220 170" xmlns="http://www.w3.org/2000/svg">
      <SharedDefs />

      <ellipse cx="110" cy="135" rx="92" ry="22" fill="url(#mossyBody)" stroke="#581c87" strokeWidth="3" />
      <NeckExtension
        d="M 18 135 Q 18 100 38 88 Q 62 76 80 90 L 80 135 Z"
        openD="M 18 135 Q 18 100 38 88 Q 62 76 80 90"
      />

      {/* Shell — large, deep spiral, undecorated. Adult uses a slightly
          deeper purple gradient so growth still reads visually. */}
      <circle cx="125" cy="92" r="50" fill="url(#mossyShellAdult)" stroke="#581c87" strokeWidth="3" />
      <circle cx="125" cy="92" r="38" fill="none" stroke="#581c87" strokeWidth="2.5" />
      <circle cx="125" cy="92" r="26" fill="none" stroke="#581c87" strokeWidth="2.5" />
      <circle cx="125" cy="92" r="15" fill="none" stroke="#581c87" strokeWidth="2.5" />
      <circle cx="125" cy="92" r="6" fill="none" stroke="#581c87" strokeWidth="2.5" />
      <ellipse cx="108" cy="75" rx="14" ry="10" fill="rgba(255,255,255,0.35)" />

      <Eyes
        leftStalk="M 38 92 Q 30 60 32 48"
        rightStalk="M 60 90 Q 65 55 70 44"
        leftEye={{ cx: 32, cy: 44, r: 9 }}
        rightEye={{ cx: 70, cy: 40, r: 9 }}
      />

      <Mouth x={46} y={104} mouth={mouth} />
      <ellipse cx="50" cy="115" rx="8" ry="4" fill="#f9a8d4" opacity="0.6" />
    </svg>
  )
}
