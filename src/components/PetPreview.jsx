// ────────────────────────────────────────────────────────────
//  Pet Preview — admin-only visual reference for in-progress
//  pet artwork. Shows all three growth stages side by side.
//
//  Visit /snibble/?view=pets to see this. Doesn't ship to
//  end users; just a dev surface while we iterate on SVGs.
// ────────────────────────────────────────────────────────────

import Mossy from './pets/Mossy.jsx'

export default function PetPreview() {
  return (
    <div className="min-h-screen px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <h1 className="font-display text-3xl text-wordy-800 mb-2 text-center">Pet Preview</h1>
        <p className="text-sm text-wordy-600 text-center italic mb-8">
          Admin-only reference page · Mossy across her growth stages
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { stage: 'baby', label: 'Baby', range: 'Sessions 1–10' },
            { stage: 'adolescent', label: 'Adolescent', range: 'Sessions 11–20' },
            { stage: 'adult', label: 'Adult', range: 'Sessions 21–30' },
          ].map((s) => (
            <div key={s.stage} className="card p-5 text-center">
              <div className="bg-gradient-to-b from-pink-100 to-wordy-100 rounded-2xl p-4 mb-3">
                <Mossy stage={s.stage} className="w-full h-auto snibble-pet" />
              </div>
              <h2 className="font-display text-xl text-wordy-800">Mossy — {s.label}</h2>
              <p className="text-xs text-wordy-500">{s.range}</p>
            </div>
          ))}
        </div>

        {/* Mouth state row — to verify chomp animation will look ok */}
        <h2 className="font-display text-2xl text-wordy-800 mt-12 mb-4 text-center">Mouth states (chomp test)</h2>
        <div className="grid grid-cols-2 gap-6 max-w-md mx-auto">
          <div className="card p-5 text-center">
            <div className="bg-gradient-to-b from-pink-100 to-wordy-100 rounded-2xl p-4 mb-2">
              <Mossy stage="adolescent" mouth="smile" className="w-full h-auto snibble-pet" />
            </div>
            <p className="text-xs text-wordy-500">Idle (smile)</p>
          </div>
          <div className="card p-5 text-center">
            <div className="bg-gradient-to-b from-pink-100 to-wordy-100 rounded-2xl p-4 mb-2">
              <Mossy stage="adolescent" mouth="open" className="w-full h-auto snibble-pet" />
            </div>
            <p className="text-xs text-wordy-500">Chomp (mouth open)</p>
          </div>
        </div>

        <p className="text-center mt-10">
          <a href="/snibble/" className="text-wordy-700 underline text-sm">← back to Snibble</a>
        </p>
      </div>
    </div>
  )
}
