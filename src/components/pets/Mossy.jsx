// ────────────────────────────────────────────────────────────
//  Mossy — the starter snail.
//
//  Three visible stages over her ~30-session growth arc.
//
//    baby         (sessions 1–10):  small, round, single eye-pair,
//                                  one little sprout on her shell
//    adolescent   (sessions 11–20): mid-size, full spiral shell,
//                                  a tiny mushroom buddy + mossy patch
//    adult        (sessions 21–30): full size, decorated shell with
//                                  flower, mushroom, moss tufts;
//                                  ready to graduate
//
//  All three share viewBox 0 0 220 170 so they scale identically.
//  Animations live in CSS — pass `chomp`/`happy` props to trigger.
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
    <radialGradient id="mossyMushroom" cx="50%" cy="35%">
      <stop offset="0%" stopColor="#fecaca" />
      <stop offset="100%" stopColor="#dc2626" />
    </radialGradient>
  </defs>
)

const Eyes = ({ leftStalk, rightStalk, leftEye, rightEye, isClosed = false }) => (
  <>
    <path
      d={leftStalk}
      stroke="#581c87"
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
    />
    <path
      d={rightStalk}
      stroke="#581c87"
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
    />
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
  if (mouth === 'open') {
    return <ellipse cx={x} cy={y} rx="7" ry="9" fill="#581c87" />
  }
  // smile (default)
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

// ───────── Baby Mossy ─────────
function MossyBaby({ mouth, className }) {
  return (
    <svg className={className} viewBox="0 0 220 170" xmlns="http://www.w3.org/2000/svg">
      <SharedDefs />

      {/* Body — small, round, plump */}
      <ellipse cx="110" cy="135" rx="70" ry="18" fill="url(#mossyBody)" stroke="#581c87" strokeWidth="3" />
      <path
        d="M 45 135 Q 45 108 60 100 Q 80 92 92 105 L 92 135 Z"
        fill="url(#mossyBody)"
        stroke="#581c87"
        strokeWidth="3"
      />

      {/* Shell — small, single loose spiral */}
      <circle cx="130" cy="105" r="38" fill="url(#mossyShell)" stroke="#581c87" strokeWidth="3" />
      <circle cx="130" cy="105" r="22" fill="none" stroke="#581c87" strokeWidth="2" />
      <circle cx="130" cy="105" r="9" fill="none" stroke="#581c87" strokeWidth="2" />
      <ellipse cx="116" cy="92" rx="10" ry="6" fill="rgba(255,255,255,0.4)" />

      {/* Tiny sprout on top of shell */}
      <path
        d="M 130 67 Q 128 59 132 56"
        stroke="#65a844"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <ellipse cx="133" cy="56" rx="3" ry="2" fill="#65a844" transform="rotate(20 133 56)" />

      {/* Eyes — bigger relative to head, baby-cute */}
      <Eyes
        leftStalk="M 60 105 Q 53 78 55 65"
        rightStalk="M 78 102 Q 82 70 86 60"
        leftEye={{ cx: 55, cy: 62, r: 9 }}
        rightEye={{ cx: 86, cy: 57, r: 9 }}
      />

      {/* Mouth */}
      <Mouth x={71} y={115} mouth={mouth} />

      {/* Cheek blush */}
      <ellipse cx="78" cy="123" rx="6" ry="3" fill="#f9a8d4" opacity="0.55" />
    </svg>
  )
}

// ───────── Adolescent Mossy ─────────
function MossyAdolescent({ mouth, className }) {
  return (
    <svg className={className} viewBox="0 0 220 170" xmlns="http://www.w3.org/2000/svg">
      <SharedDefs />

      {/* Body — slightly elongated */}
      <ellipse cx="110" cy="135" rx="82" ry="20" fill="url(#mossyBody)" stroke="#581c87" strokeWidth="3" />
      <path
        d="M 30 135 Q 30 102 48 92 Q 70 82 86 96 L 86 135 Z"
        fill="url(#mossyBody)"
        stroke="#581c87"
        strokeWidth="3"
      />

      {/* Shell — medium, fuller spiral */}
      <circle cx="125" cy="98" r="44" fill="url(#mossyShell)" stroke="#581c87" strokeWidth="3" />
      <circle cx="125" cy="98" r="32" fill="none" stroke="#581c87" strokeWidth="2.2" />
      <circle cx="125" cy="98" r="20" fill="none" stroke="#581c87" strokeWidth="2.2" />
      <circle cx="125" cy="98" r="9" fill="none" stroke="#581c87" strokeWidth="2.2" />
      <ellipse cx="110" cy="83" rx="12" ry="8" fill="rgba(255,255,255,0.4)" />

      {/* Mossy patch on shell */}
      <ellipse cx="148" cy="80" rx="11" ry="5" fill="#65a844" opacity="0.7" />
      <ellipse cx="151" cy="78" rx="3" ry="2" fill="#3d7a25" />
      <ellipse cx="144" cy="82" rx="2.5" ry="1.5" fill="#3d7a25" />

      {/* Tiny mushroom buddy */}
      <ellipse cx="100" cy="60" rx="7" ry="4" fill="url(#mossyMushroom)" stroke="#581c87" strokeWidth="1.5" />
      <rect x="98" y="60" width="4" height="7" fill="#fef3c7" stroke="#581c87" strokeWidth="1.2" />
      <circle cx="98" cy="58" r="1.2" fill="white" />
      <circle cx="103" cy="59" r="1" fill="white" />

      {/* Eyes — normal size */}
      <Eyes
        leftStalk="M 42 96 Q 35 65 38 50"
        rightStalk="M 64 92 Q 68 60 72 46"
        leftEye={{ cx: 38, cy: 47, r: 9 }}
        rightEye={{ cx: 72, cy: 43, r: 9 }}
      />

      {/* Mouth */}
      <Mouth x={55} y={108} mouth={mouth} />

      {/* Cheek blush */}
      <ellipse cx="60" cy="116" rx="7" ry="3.5" fill="#f9a8d4" opacity="0.55" />
    </svg>
  )
}

// ───────── Adult Mossy ─────────
function MossyAdult({ mouth, className }) {
  return (
    <svg className={className} viewBox="0 0 220 170" xmlns="http://www.w3.org/2000/svg">
      <SharedDefs />

      {/* Body — full extended */}
      <ellipse cx="110" cy="135" rx="92" ry="22" fill="url(#mossyBody)" stroke="#581c87" strokeWidth="3" />
      <path
        d="M 18 135 Q 18 100 38 88 Q 62 76 80 90 L 80 135 Z"
        fill="url(#mossyBody)"
        stroke="#581c87"
        strokeWidth="3"
      />

      {/* Shell — large with deep spiral */}
      <circle cx="125" cy="92" r="50" fill="url(#mossyShellAdult)" stroke="#581c87" strokeWidth="3" />
      <circle cx="125" cy="92" r="38" fill="none" stroke="#581c87" strokeWidth="2.5" />
      <circle cx="125" cy="92" r="26" fill="none" stroke="#581c87" strokeWidth="2.5" />
      <circle cx="125" cy="92" r="15" fill="none" stroke="#581c87" strokeWidth="2.5" />
      <circle cx="125" cy="92" r="6" fill="none" stroke="#581c87" strokeWidth="2.5" />
      <ellipse cx="108" cy="75" rx="14" ry="10" fill="rgba(255,255,255,0.35)" />

      {/* Mossy tuft on shell */}
      <ellipse cx="155" cy="72" rx="14" ry="6" fill="#65a844" opacity="0.8" />
      <ellipse cx="160" cy="69" rx="4" ry="2.5" fill="#3d7a25" />
      <ellipse cx="148" cy="74" rx="3" ry="2" fill="#3d7a25" />
      <ellipse cx="152" cy="73" rx="2" ry="1.2" fill="#3d7a25" />

      {/* Mushroom — bigger */}
      <ellipse cx="92" cy="48" rx="11" ry="6" fill="url(#mossyMushroom)" stroke="#581c87" strokeWidth="1.8" />
      <rect x="89" y="48" width="6" height="10" fill="#fef3c7" stroke="#581c87" strokeWidth="1.5" />
      <circle cx="88" cy="46" r="1.6" fill="white" />
      <circle cx="95" cy="47" r="1.3" fill="white" />
      <circle cx="92" cy="44" r="1" fill="white" />

      {/* Tiny flower */}
      <circle cx="135" cy="48" r="3" fill="#f9a8d4" stroke="#581c87" strokeWidth="1.2" />
      <circle cx="139" cy="46" r="3" fill="#f9a8d4" stroke="#581c87" strokeWidth="1.2" />
      <circle cx="137" cy="51" r="3" fill="#f9a8d4" stroke="#581c87" strokeWidth="1.2" />
      <circle cx="133" cy="49" r="3" fill="#f9a8d4" stroke="#581c87" strokeWidth="1.2" />
      <circle cx="136" cy="49" r="2" fill="#fde68a" />
      <path d="M 136 53 Q 134 60 130 65" stroke="#65a844" strokeWidth="2" fill="none" strokeLinecap="round" />

      {/* Eyes — same scale, taller stalks */}
      <Eyes
        leftStalk="M 38 92 Q 30 60 32 48"
        rightStalk="M 60 90 Q 65 55 70 44"
        leftEye={{ cx: 32, cy: 44, r: 9 }}
        rightEye={{ cx: 70, cy: 40, r: 9 }}
      />

      {/* Mouth */}
      <Mouth x={46} y={104} mouth={mouth} />

      {/* Cheek blush */}
      <ellipse cx="50" cy="115" rx="8" ry="4" fill="#f9a8d4" opacity="0.6" />
    </svg>
  )
}
