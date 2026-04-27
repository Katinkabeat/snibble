// ────────────────────────────────────────────────────────────
//  Mochi — the bunny. Third pet (unlocks after Pip graduates).
//
//  v1 ships baby stage only. Adolescent/adult arrive in v2 before
//  any player reaches them (~61+ days in).
// ────────────────────────────────────────────────────────────

export default function Mochi({ stage = 'baby', mouth = 'smile', className = '' }) {
  return <MochiBaby mouth={mouth} className={className} />
}

function MochiBaby({ mouth, className }) {
  return (
    <svg className={className} viewBox="0 0 220 170" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="mochiBody" cx="50%" cy="35%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="80%" stopColor="#fce7f3" />
          <stop offset="100%" stopColor="#f9a8d4" />
        </radialGradient>
        <radialGradient id="mochiEar" cx="50%" cy="35%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#f9a8d4" />
        </radialGradient>
      </defs>

      {/* Ears (back layer) */}
      <ellipse
        cx="92" cy="55" rx="13" ry="34"
        fill="url(#mochiEar)" stroke="#581c87" strokeWidth="3"
        transform="rotate(-12 92 55)"
      />
      <ellipse
        cx="138" cy="55" rx="13" ry="34"
        fill="url(#mochiEar)" stroke="#581c87" strokeWidth="3"
        transform="rotate(12 138 55)"
      />
      {/* Inner ear (pink) */}
      <ellipse
        cx="92" cy="58" rx="6" ry="22"
        fill="#fbcfe8" opacity="0.85"
        transform="rotate(-12 92 58)"
      />
      <ellipse
        cx="138" cy="58" rx="6" ry="22"
        fill="#fbcfe8" opacity="0.85"
        transform="rotate(12 138 58)"
      />

      {/* Body — round and dumpling-shaped */}
      <ellipse
        cx="115" cy="118" rx="58" ry="40"
        fill="url(#mochiBody)" stroke="#581c87" strokeWidth="3"
      />

      {/* Eyes — closed-bean-shape "happy eyes", a la cute kawaii.
          But the blink animation needs the same shared mechanism, so
          we use the same .snibble-eye group with white circles for now.
          Might restyle later if she wants a closer-eyed look. */}
      <g className="snibble-eye" style={{ '--eye-cx': '92px', '--eye-cy': '108px' }}>
        <circle cx="92" cy="108" r="9" fill="white" stroke="#581c87" strokeWidth="2.2" />
        <circle cx="93" cy="109" r="5" fill="#581c87" />
        <circle cx="94" cy="106" r="1.6" fill="white" />
      </g>
      <g className="snibble-eye" style={{ '--eye-cx': '138px', '--eye-cy': '108px' }}>
        <circle cx="138" cy="108" r="9" fill="white" stroke="#581c87" strokeWidth="2.2" />
        <circle cx="139" cy="109" r="5" fill="#581c87" />
        <circle cx="140" cy="106" r="1.6" fill="white" />
      </g>

      {/* Pink nose */}
      <path
        d="M 110 122 Q 115 127 120 122 Q 117 130 115 130 Q 113 130 110 122 Z"
        fill="#f9a8d4" stroke="#581c87" strokeWidth="2"
      />

      {/* Mouth */}
      {mouth === 'open' ? (
        <ellipse cx="115" cy="138" rx="7" ry="8" fill="#581c87" />
      ) : (
        <>
          <path
            d="M 115 130 Q 115 134 109 136"
            stroke="#581c87" strokeWidth="2.2" fill="none" strokeLinecap="round"
          />
          <path
            d="M 115 130 Q 115 134 121 136"
            stroke="#581c87" strokeWidth="2.2" fill="none" strokeLinecap="round"
          />
        </>
      )}

      {/* Whiskers (subtle) */}
      <path d="M 78 130 L 65 128" stroke="#581c87" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.6" />
      <path d="M 78 134 L 64 136" stroke="#581c87" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.6" />
      <path d="M 152 130 L 165 128" stroke="#581c87" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.6" />
      <path d="M 152 134 L 166 136" stroke="#581c87" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity="0.6" />

      {/* Cheek blush */}
      <ellipse cx="78" cy="124" rx="7" ry="3.5" fill="#f9a8d4" opacity="0.7" />
      <ellipse cx="152" cy="124" rx="7" ry="3.5" fill="#f9a8d4" opacity="0.7" />
    </svg>
  )
}
