// ────────────────────────────────────────────────────────────
//  pets — pet id → image component.
//
//  Each pet has a single PNG in /public/pets/<id>.png. Backgrounds
//  removed, padded to 512×512 transparent square. We don't render
//  per-stage art any more — same image for baby, adolescent, adult.
//  The growth bar in the lobby still tracks progress; the picture
//  just doesn't change.
//
//  Consumers (LobbyView, GameView, PetCard, PetModal, PetPreview)
//  use these components like the old SVG ones — they accept any
//  props and forward className to the img.
// ────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL // '/snibble/'

function makePetImage(id) {
  function PetImage({ className = '', alt }) {
    return (
      <img
        src={`${BASE}pets/${id}.png`}
        alt={alt ?? id}
        className={`object-contain ${className}`}
        draggable={false}
      />
    )
  }
  PetImage.displayName = `Pet(${id})`
  return PetImage
}

const PET_IDS = [
  'mossy', 'pip', 'mochi',
  'burrow', 'bramble', 'honey', 'pebble',
  'bobbin', 'cinder', 'cosmo', 'quill',
  'kettle', 'frost',
  'marlow', 'hush', 'acorn', 'lily', 'crumble',
  'pearl', 'velvet', 'whirr', 'petal', 'sprig',
  'marmalade', 'wander',
]

export const PET_COMPONENTS = Object.fromEntries(
  PET_IDS.map((id) => [id, makePetImage(id)])
)
