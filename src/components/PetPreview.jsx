// ────────────────────────────────────────────────────────────
//  Pet Preview — admin-only visual reference for all pet artwork.
//  Visit /snibble/?view=pets. Renders every pet at every stage so
//  Rae can scan them in one place.
// ────────────────────────────────────────────────────────────

import { PET_COMPONENTS } from '../lib/pets.jsx'

const ROSTER = [
  { id: 'mossy',   name: 'Mossy',   species: 'snail',           order: 0 },
  { id: 'pip',     name: 'Pip',     species: 'firefly',         order: 1 },
  { id: 'mochi',   name: 'Mochi',   species: 'bunny',           order: 2 },
  { id: 'burrow',  name: 'Burrow',  species: 'mole',            order: 3 },
  { id: 'bramble', name: 'Bramble', species: 'hedgehog',        order: 4 },
  { id: 'honey',   name: 'Honey',   species: 'bee',             order: 5 },
  { id: 'pebble',  name: 'Pebble',  species: 'turtle',          order: 6 },
  { id: 'bobbin',  name: 'Bobbin',  species: 'spider',          order: 7 },
  { id: 'cinder',  name: 'Cinder',  species: 'cat',             order: 8 },
  { id: 'cosmo',   name: 'Cosmo',   species: 'moth',            order: 9 },
  { id: 'quill',   name: 'Quill',   species: 'porcupine',       order: 10 },
  { id: 'kettle',  name: 'Kettle',  species: 'dragon hatchling', order: 11 },
  { id: 'frost',   name: 'Frost',   species: 'arctic fox',      order: 12 },
]

const STAGES = [
  { stage: 'baby', label: 'Baby' },
  { stage: 'adolescent', label: 'Adolescent' },
  { stage: 'adult', label: 'Adult' },
]

export default function PetPreview() {
  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-display text-3xl text-wordy-800 mb-2 text-center">Pet Preview</h1>
        <p className="text-sm text-wordy-600 text-center italic mb-8">
          Admin-only reference · all 13 pets across 3 stages
        </p>

        {ROSTER.map((pet) => {
          const Component = PET_COMPONENTS[pet.id]
          return (
            <section key={pet.id} className="mb-10">
              <h2 className="font-display text-2xl text-wordy-800 mb-1">
                #{pet.order} · {pet.name} <span className="text-base text-wordy-500 font-normal">— the {pet.species}</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {STAGES.map((s) => (
                  <div key={s.stage} className="card p-4 text-center">
                    <div className="bg-gradient-to-b from-pink-100 to-wordy-100 rounded-2xl p-3 mb-2">
                      <Component stage={s.stage} className="w-full h-auto snibble-pet" />
                    </div>
                    <p className="text-sm font-display text-wordy-800">{s.label}</p>
                  </div>
                ))}
              </div>
            </section>
          )
        })}

        {/* Mouth state spot-checks */}
        <h2 className="font-display text-2xl text-wordy-800 mt-12 mb-3">Chomp spot-check</h2>
        <p className="text-xs text-wordy-500 italic mb-3">
          A few pets in their adult stage with mouth states (smile vs open).
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {['mossy', 'kettle', 'cosmo', 'cinder', 'frost', 'bramble'].map((id) => {
            const pet = ROSTER.find((p) => p.id === id)
            const Component = PET_COMPONENTS[id]
            return (
              <div key={id} className="card p-3 text-center">
                <h3 className="font-display text-sm text-wordy-800 mb-2">{pet.name}</h3>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <div className="bg-gradient-to-b from-pink-100 to-wordy-100 rounded-xl p-2">
                      <Component stage="adult" mouth="smile" className="w-full h-auto snibble-pet" />
                    </div>
                    <p className="text-[10px] text-wordy-500 mt-1">smile</p>
                  </div>
                  <div>
                    <div className="bg-gradient-to-b from-pink-100 to-wordy-100 rounded-xl p-2">
                      <Component stage="adult" mouth="open" className="w-full h-auto snibble-pet" />
                    </div>
                    <p className="text-[10px] text-wordy-500 mt-1">chomp</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        <p className="text-center mt-10">
          <a href="/snibble/" className="text-wordy-700 underline text-sm">← back to Snibble</a>
        </p>
      </div>
    </div>
  )
}
