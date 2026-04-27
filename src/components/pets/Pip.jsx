// ────────────────────────────────────────────────────────────
//  Pip — the firefly. Second pet (unlocks after Mossy graduates).
//
//  v1 ships baby stage only. Adolescent/adult arrive in v2 before
//  any player reaches them (~31+ days in).
//
//  Same viewBox as Mossy (0 0 220 170) so the pet slot in the UI
//  doesn't shift when pets swap.
// ────────────────────────────────────────────────────────────

export default function Pip({ stage = 'baby', mouth = 'smile', className = '' }) {
  // For v1 only baby is implemented. Other stages fall back to baby.
  return <PipBaby mouth={mouth} className={className} />
}

function PipBaby({ mouth, className }) {
  return (
    <svg className={className} viewBox="0 0 220 170" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="pipBody" cx="50%" cy="40%">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="60%" stopColor="#a855f7" />
          <stop offset="100%" stopColor="#7e22ce" />
        </radialGradient>
        <radialGradient id="pipGlow" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#fef9c3" stopOpacity="1" />
          <stop offset="60%" stopColor="#fde047" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#fde047" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="pipWing" cx="50%" cy="40%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#e9d5ff" stopOpacity="0.55" />
        </radialGradient>
      </defs>

      {/* Tail glow halo (sits under everything) */}
      <circle cx="158" cy="105" r="32" fill="url(#pipGlow)" />

      {/* Wings — back wings first so they sit behind the body */}
      <ellipse
        cx="92" cy="78" rx="28" ry="20"
        fill="url(#pipWing)" stroke="#7e22ce" strokeWidth="2"
        transform="rotate(-20 92 78)"
      />
      <ellipse
        cx="138" cy="78" rx="28" ry="20"
        fill="url(#pipWing)" stroke="#7e22ce" strokeWidth="2"
        transform="rotate(20 138 78)"
      />

      {/* Body — chubby oval */}
      <ellipse
        cx="115" cy="105" rx="48" ry="34"
        fill="url(#pipBody)" stroke="#581c87" strokeWidth="3"
      />

      {/* Glowing tail tip — bright yellow lantern */}
      <circle cx="158" cy="105" r="12" fill="#fde047" stroke="#a16207" strokeWidth="2" />
      <circle cx="155" cy="101" r="3" fill="#fef9c3" />

      {/* Body segment lines (subtle) */}
      <path d="M 100 90 Q 100 105 100 122" stroke="#581c87" strokeWidth="1.5" fill="none" opacity="0.4" />
      <path d="M 130 88 Q 130 105 130 122" stroke="#581c87" strokeWidth="1.5" fill="none" opacity="0.4" />

      {/* Antennae */}
      <path d="M 92 80 Q 78 60 76 48" stroke="#581c87" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d="M 108 78 Q 102 58 102 44" stroke="#581c87" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <circle cx="76" cy="48" r="3" fill="#581c87" />
      <circle cx="102" cy="44" r="3" fill="#581c87" />

      {/* Eyes — big and bright, blink class for shared CSS */}
      <g className="snibble-eye" style={{ '--eye-cx': '90px', '--eye-cy': '95px' }}>
        <circle cx="90" cy="95" r="11" fill="white" stroke="#581c87" strokeWidth="2.2" />
        <circle cx="91" cy="96" r="5" fill="#581c87" />
        <circle cx="92" cy="93" r="2" fill="white" />
      </g>
      <g className="snibble-eye" style={{ '--eye-cx': '120px', '--eye-cy': '95px' }}>
        <circle cx="120" cy="95" r="11" fill="white" stroke="#581c87" strokeWidth="2.2" />
        <circle cx="121" cy="96" r="5" fill="#581c87" />
        <circle cx="122" cy="93" r="2" fill="white" />
      </g>

      {/* Mouth */}
      {mouth === 'open' ? (
        <ellipse cx="105" cy="118" rx="6" ry="7" fill="#581c87" />
      ) : (
        <path
          d="M 95 117 Q 105 124 115 117"
          stroke="#581c87" strokeWidth="2.5" fill="none" strokeLinecap="round"
        />
      )}

      {/* Cheek blush */}
      <ellipse cx="80" cy="110" rx="6" ry="3" fill="#f9a8d4" opacity="0.5" />
      <ellipse cx="130" cy="110" rx="6" ry="3" fill="#f9a8d4" opacity="0.5" />
    </svg>
  )
}
