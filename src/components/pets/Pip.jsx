// ────────────────────────────────────────────────────────────
//  Pip — the firefly. Second pet (unlocks after Mossy graduates).
//
//  Designed as a grounded creature so she fits into the sanctuary
//  meadow scene next to Mossy. Distinct head + body, visible feet,
//  antennae cleanly attached to the top of the head, wings tucked
//  behind the body.
//
//  v1 ships baby stage only. Adolescent/adult arrive in v2.
// ────────────────────────────────────────────────────────────

export default function Pip({ stage = 'baby', mouth = 'smile', className = '' }) {
  return <PipBaby mouth={mouth} className={className} />
}

function PipBaby({ mouth, className }) {
  return (
    <svg className={className} viewBox="0 0 220 170" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="pipBody" cx="50%" cy="35%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="55%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#7e22ce" />
        </radialGradient>
        <radialGradient id="pipHead" cx="50%" cy="35%">
          <stop offset="0%" stopColor="#fef3c7" />
          <stop offset="100%" stopColor="#c084fc" />
        </radialGradient>
        <radialGradient id="pipGlow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#fef9c3" stopOpacity="1" />
          <stop offset="60%" stopColor="#fde047" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#fde047" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="pipWing" cx="50%" cy="35%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#e9d5ff" stopOpacity="0.55" />
        </radialGradient>
      </defs>

      {/* Glow halo from the tail lantern (lowest layer) */}
      <circle cx="115" cy="142" r="28" fill="url(#pipGlow)" />

      {/* Wings — tucked behind the body, peeking out either side */}
      <ellipse
        cx="80" cy="100" rx="20" ry="26"
        fill="url(#pipWing)" stroke="#7e22ce" strokeWidth="2"
        transform="rotate(-15 80 100)"
      />
      <ellipse
        cx="150" cy="100" rx="20" ry="26"
        fill="url(#pipWing)" stroke="#7e22ce" strokeWidth="2"
        transform="rotate(15 150 100)"
      />

      {/* Six little legs at the bottom — Pip is grounded */}
      <path d="M 92 132 Q 88 142 84 148" stroke="#581c87" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 105 134 Q 103 144 101 152" stroke="#581c87" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 115 134 L 115 152" stroke="#581c87" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 125 134 Q 127 144 129 152" stroke="#581c87" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 138 132 Q 142 142 146 148" stroke="#581c87" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* tiny foot dots */}
      <circle cx="84" cy="148" r="2.2" fill="#581c87" />
      <circle cx="101" cy="152" r="2.2" fill="#581c87" />
      <circle cx="115" cy="152" r="2.2" fill="#581c87" />
      <circle cx="129" cy="152" r="2.2" fill="#581c87" />
      <circle cx="146" cy="148" r="2.2" fill="#581c87" />

      {/* Body — round abdomen */}
      <ellipse
        cx="115" cy="115" rx="35" ry="30"
        fill="url(#pipBody)" stroke="#581c87" strokeWidth="3"
      />

      {/* Glowing tail lantern — sits at the bottom-back of the abdomen */}
      <circle cx="115" cy="138" r="11" fill="#fde047" stroke="#a16207" strokeWidth="2" />
      <circle cx="112" cy="135" r="3" fill="#fef9c3" />

      {/* Body segment line (subtle, runs vertically) */}
      <path d="M 100 95 Q 100 115 100 132" stroke="#581c87" strokeWidth="1.4" fill="none" opacity="0.35" />
      <path d="M 130 95 Q 130 115 130 132" stroke="#581c87" strokeWidth="1.4" fill="none" opacity="0.35" />

      {/* Head — distinct round head sitting on top of the body */}
      <circle
        cx="115" cy="80" r="22"
        fill="url(#pipHead)" stroke="#581c87" strokeWidth="3"
      />

      {/* Antennae — clearly emerging from the very top of the head */}
      <path
        d="M 102 64 Q 92 50 88 38"
        stroke="#581c87" strokeWidth="2.5" fill="none" strokeLinecap="round"
      />
      <path
        d="M 128 64 Q 138 50 142 38"
        stroke="#581c87" strokeWidth="2.5" fill="none" strokeLinecap="round"
      />
      <circle cx="88" cy="38" r="3" fill="#581c87" />
      <circle cx="142" cy="38" r="3" fill="#581c87" />

      {/* Eyes — on the head, big and bright. Use the shared .snibble-eye
          class so they blink in sync with Mossy and Mochi. */}
      <g className="snibble-eye" style={{ '--eye-cx': '105px', '--eye-cy': '78px' }}>
        <circle cx="105" cy="78" r="7" fill="white" stroke="#581c87" strokeWidth="2" />
        <circle cx="106" cy="79" r="3.5" fill="#581c87" />
        <circle cx="107" cy="76" r="1.4" fill="white" />
      </g>
      <g className="snibble-eye" style={{ '--eye-cx': '125px', '--eye-cy': '78px' }}>
        <circle cx="125" cy="78" r="7" fill="white" stroke="#581c87" strokeWidth="2" />
        <circle cx="126" cy="79" r="3.5" fill="#581c87" />
        <circle cx="127" cy="76" r="1.4" fill="white" />
      </g>

      {/* Mouth */}
      {mouth === 'open' ? (
        <ellipse cx="115" cy="92" rx="5" ry="6" fill="#581c87" />
      ) : (
        <path
          d="M 108 91 Q 115 96 122 91"
          stroke="#581c87" strokeWidth="2.2" fill="none" strokeLinecap="round"
        />
      )}

      {/* Cheek blush */}
      <ellipse cx="98" cy="86" rx="4.5" ry="2.5" fill="#f9a8d4" opacity="0.55" />
      <ellipse cx="132" cy="86" rx="4.5" ry="2.5" fill="#f9a8d4" opacity="0.55" />
    </svg>
  )
}
