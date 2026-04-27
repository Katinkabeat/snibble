// ────────────────────────────────────────────────────────────
//  Pet Preview — admin-only visual reference for in-progress
//  pet artwork. Visit /snibble/?view=pets.
// ────────────────────────────────────────────────────────────

import Mossy from './pets/Mossy.jsx'
import Pip from './pets/Pip.jsx'
import Mochi from './pets/Mochi.jsx'

export default function PetPreview() {
  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-display text-3xl text-wordy-800 mb-2 text-center">Pet Preview</h1>
        <p className="text-sm text-wordy-600 text-center italic mb-8">
          Admin-only reference page · v1 pet roster
        </p>

        {/* Mossy — full progression */}
        <h2 className="font-display text-2xl text-wordy-800 mb-3">Mossy — the snail (starter)</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
          {[
            { stage: 'baby', label: 'Baby', range: 'Sessions 1–10' },
            { stage: 'adolescent', label: 'Adolescent', range: 'Sessions 11–20' },
            { stage: 'adult', label: 'Adult', range: 'Sessions 21–30' },
          ].map((s) => (
            <div key={s.stage} className="card p-5 text-center">
              <div className="bg-gradient-to-b from-pink-100 to-wordy-100 rounded-2xl p-4 mb-3">
                <Mossy stage={s.stage} className="w-full h-auto snibble-pet" />
              </div>
              <h3 className="font-display text-lg text-wordy-800">Mossy — {s.label}</h3>
              <p className="text-xs text-wordy-500">{s.range}</p>
            </div>
          ))}
        </div>

        {/* Pip + Mochi — baby only for v1 */}
        <h2 className="font-display text-2xl text-wordy-800 mb-3">Pip & Mochi (baby stage only for v1)</h2>
        <p className="text-xs text-wordy-500 italic mb-3">
          Adolescent + adult stages arrive in v2 before any tester reaches them (~31+ days in).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-12">
          <div className="card p-5 text-center">
            <div className="bg-gradient-to-b from-pink-100 to-wordy-100 rounded-2xl p-4 mb-3">
              <Pip stage="baby" className="w-full h-auto snibble-pet" />
            </div>
            <h3 className="font-display text-lg text-wordy-800">Pip — the firefly</h3>
            <p className="text-xs text-wordy-500">2nd pet · unlocks after Mossy graduates</p>
          </div>
          <div className="card p-5 text-center">
            <div className="bg-gradient-to-b from-pink-100 to-wordy-100 rounded-2xl p-4 mb-3">
              <Mochi stage="baby" className="w-full h-auto snibble-pet" />
            </div>
            <h3 className="font-display text-lg text-wordy-800">Mochi — the bunny</h3>
            <p className="text-xs text-wordy-500">3rd pet · unlocks after Pip graduates</p>
          </div>
        </div>

        {/* Chomp tests across all three */}
        <h2 className="font-display text-2xl text-wordy-800 mt-4 mb-3">Chomp test (mouth states)</h2>
        <div className="grid grid-cols-3 gap-6 max-w-3xl mx-auto">
          <ChompPair name="Mossy" Component={Mossy} stage="adolescent" />
          <ChompPair name="Pip" Component={Pip} />
          <ChompPair name="Mochi" Component={Mochi} />
        </div>

        <p className="text-center mt-10">
          <a href="/snibble/" className="text-wordy-700 underline text-sm">← back to Snibble</a>
        </p>
      </div>
    </div>
  )
}

function ChompPair({ name, Component, stage = 'baby' }) {
  return (
    <div className="card p-3 text-center">
      <h3 className="font-display text-sm text-wordy-800 mb-2">{name}</h3>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="bg-gradient-to-b from-pink-100 to-wordy-100 rounded-xl p-2">
            <Component stage={stage} mouth="smile" className="w-full h-auto snibble-pet" />
          </div>
          <p className="text-[10px] text-wordy-500 mt-1">smile</p>
        </div>
        <div>
          <div className="bg-gradient-to-b from-pink-100 to-wordy-100 rounded-xl p-2">
            <Component stage={stage} mouth="open" className="w-full h-auto snibble-pet" />
          </div>
          <p className="text-[10px] text-wordy-500 mt-1">chomp</p>
        </div>
      </div>
    </div>
  )
}
