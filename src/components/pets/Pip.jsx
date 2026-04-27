// ────────────────────────────────────────────────────────────
//  Pip — the firefly. Second pet (unlocks after Mossy graduates).
//
//  Posed in 3/4 side view facing left, matching Mossy's orientation
//  in the sanctuary scene. Head + face on the left, body extends to
//  the right, GLOWING LANTERN at the rear tip of the abdomen — like
//  a real firefly, not a dot in the belly. Legs visible underneath
//  so she reads as grounded.
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
        <radialGradient id="pipBody" cx="40%" cy="35%">
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

      {/* Glow halo from the tail lantern (sits behind the abdomen) */}
      <circle cx="178" cy="115" r="32" fill="url(#pipGlow)" />

      {/* Wings — tucked above the body. Two on each side, layered. */}
      <ellipse
        cx="105" cy="78" rx="22" ry="12"
        fill="url(#pipWing)" stroke="#7e22ce" strokeWidth="2"
        transform="rotate(-25 105 78)"
      />
      <ellipse
        cx="135" cy="78" rx="22" ry="12"
        fill="url(#pipWing)" stroke="#7e22ce" strokeWidth="2"
        transform="rotate(-15 135 78)"
      />

      {/* Body — elongated oval extending to the right. Head will sit
          on the left end of this. */}
      <ellipse
        cx="120" cy="115" rx="48" ry="28"
        fill="url(#pipBody)" stroke="#581c87" strokeWidth="3"
      />

      {/* Body segment lines — gently curved, evoke insect segmentation */}
      <path d="M 110 90 Q 108 115 110 140" stroke="#581c87" strokeWidth="1.4" fill="none" opacity="0.4" />
      <path d="M 135 89 Q 133 115 135 141" stroke="#581c87" strokeWidth="1.4" fill="none" opacity="0.4" />

      {/* GLOWING LANTERN — at the rear tip of the abdomen (the butt) */}
      <circle cx="172" cy="118" r="14" fill="#fde047" stroke="#a16207" strokeWidth="2.5" />
      <circle cx="168" cy="114" r="4" fill="#fef9c3" />

      {/* Six little legs underneath the body */}
      <path d="M 92 138 Q 88 148 86 154" stroke="#581c87" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 110 142 Q 108 152 106 158" stroke="#581c87" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 130 142 Q 130 152 130 158" stroke="#581c87" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 148 140 Q 150 150 152 156" stroke="#581c87" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="86" cy="154" r="2.2" fill="#581c87" />
      <circle cx="106" cy="158" r="2.2" fill="#581c87" />
      <circle cx="130" cy="158" r="2.2" fill="#581c87" />
      <circle cx="152" cy="156" r="2.2" fill="#581c87" />

      {/* Head — sits on the FRONT (left end) of the body */}
      <circle
        cx="78" cy="100" r="26"
        fill="url(#pipHead)" stroke="#581c87" strokeWidth="3"
      />

      {/* Antennae — emerge cleanly from the top of the head */}
      <path
        d="M 64 82 Q 56 64 52 50"
        stroke="#581c87" strokeWidth="2.5" fill="none" strokeLinecap="round"
      />
      <path
        d="M 88 78 Q 92 60 92 44"
        stroke="#581c87" strokeWidth="2.5" fill="none" strokeLinecap="round"
      />
      <circle cx="52" cy="50" r="3" fill="#581c87" />
      <circle cx="92" cy="44" r="3" fill="#581c87" />

      {/* Eyes — on the head, both visible (3/4 view). Use shared
          .snibble-eye class for blink. */}
      <g className="snibble-eye" style={{ '--eye-cx': '70px', '--eye-cy': '98px' }}>
        <circle cx="70" cy="98" r="8" fill="white" stroke="#581c87" strokeWidth="2.2" />
        <circle cx="71" cy="99" r="4" fill="#581c87" />
        <circle cx="72" cy="96" r="1.5" fill="white" />
      </g>
      <g className="snibble-eye" style={{ '--eye-cx': '90px', '--eye-cy': '96px' }}>
        <circle cx="90" cy="96" r="8" fill="white" stroke="#581c87" strokeWidth="2.2" />
        <circle cx="91" cy="97" r="4" fill="#581c87" />
        <circle cx="92" cy="94" r="1.5" fill="white" />
      </g>

      {/* Mouth */}
      {mouth === 'open' ? (
        <ellipse cx="78" cy="115" rx="5" ry="6" fill="#581c87" />
      ) : (
        <path
          d="M 70 113 Q 78 119 86 113"
          stroke="#581c87" strokeWidth="2.2" fill="none" strokeLinecap="round"
        />
      )}

      {/* Cheek blush */}
      <ellipse cx="60" cy="108" rx="5" ry="2.8" fill="#f9a8d4" opacity="0.55" />
      <ellipse cx="96" cy="106" rx="5" ry="2.8" fill="#f9a8d4" opacity="0.55" />
    </svg>
  )
}
