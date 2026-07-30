// ────────────────────────────────────────────────────────────
//  HowToPlayModal — opened from the cog dropdown's "How to play"
//  row. Cozy/conversational tone matching Snibble's voice.
//
//  Pop-in animation + escape/click-outside dismiss, same pattern
//  as PetModal and StatsModal.
// ────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react'

export default function HowToPlayModal({ onClose }) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className={`fixed inset-0 z-50 grid place-items-center p-4 bg-black/40 transition-opacity duration-200 ${open ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`relative card p-0 w-full max-w-sm flex flex-col max-h-[85vh] overflow-hidden transition-all duration-300 ease-out ${
          open ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
        }`}
        style={{ transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 grid place-items-center rounded-full bg-wordy-100 text-wordy-700 hover:bg-wordy-200 transition-colors"
          aria-label="Close"
        >
          ×
        </button>

        <div className="px-5 pt-5 pb-2">
          <h2 className="font-display text-2xl text-wordy-800 dark:text-wordy-100">
            How to play
          </h2>
          <p className="text-xs text-wordy-500 italic mt-1">A cozy daily word pet.</p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-5 text-sm text-wordy-700 dark:text-wordy-200 leading-relaxed">
          <Section title="🌅 The daily craving">
            <p>
              Each day your pet has <b>one craving</b> — a rule that today's words must follow,
              like <i>"end in -OW"</i> or <i>"contain -CH-"</i>.
            </p>
            <p>
              You're given <b>7 letters</b> as a hint. Treat them like a hint, not a rack —
              <b> any letter is reusable</b> as many times as you like.
            </p>
            <p>
              Tap a tray letter to add it to your word, tap a built tile to remove it.
              Hit <b>Feed 🍃</b> to send it to your pet.
            </p>
            <p className="text-xs text-wordy-500 italic mt-2">
              When a craving mentions vowels, the vowels are A, E, I, O, U. <b>Y always
              counts as a consonant.</b> So CRYBABY opens with three consonants in a row
              (C, R, Y), and RHYTHM has no vowels at all.
            </p>
          </Section>

          <Section title="🥕 What counts">
            <ul className="list-disc list-inside space-y-1 ml-1">
              <li>4 letters or longer</li>
              <li>Any real word in the dictionary — common or unusual, they all count</li>
              <li>Has to fit today's craving</li>
            </ul>
            <p className="text-xs text-wordy-500 italic mt-2">
              If your pet turns away, the word's real but doesn't fit the rule.
              No penalty — try another.
            </p>
          </Section>

          <Section title="📊 Scoring">
            <p>
              <b>1 point per letter</b>. GROW = 4, GLOWING = 7. No fancy multipliers, so
              everyone's daily score is comparable no matter what letters today's craving lands on.
            </p>
            <p>
              The fullness bar fills as you feed, with a <b>par tick</b> around 60%
              — crossing it means you've fed your pet well today. The bar is sized to
              the <b>everyday words</b> for today's craving, but every valid word counts
              toward it — so knowing an unusual one just gives you another way to fill it.
            </p>
          </Section>

          <Section title="🌙 Done for today">
            <p>
              Tap <b>Done for today</b> when you're done. Feeding even one word counts as
              a session — your pet grows <b>+1</b>, and your daily streak ticks up.
            </p>
            <p>
              Each pet graduates after <b>30 successful sessions</b>, then a new one adopts
              you the next day. Mossy is your starter.
            </p>
            <p className="text-xs text-wordy-500 italic">
              Daily reset is midnight Atlantic Time — shared by everyone.
            </p>
          </Section>

          <Section title="🌿 Sanctuary">
            <p>
              Your collection lives in the <b>Sanctuary</b> card on the lobby. Graduated
              pets get a gold ribbon. Locked pets stay as silhouettes with a vague hint
              — figure them out as they show up.
            </p>
          </Section>

          <Section title="🎮 Two-player match">
            <p>
              Tap <b>Start a match</b> on the lobby. Make it <b>🌍 Open</b> (anyone signed
              in can join from their lobby) or play <b>👥 With a friend</b> (only the friend
              you pick can join).
            </p>
            <p>
              Both players get the <b>same craving and same letters</b>, and it's a
              <b> single round</b> — one rule, just like the daily, so it's the head-to-head
              that makes it exciting, not a harder puzzle. You play on your own time, no clock.
            </p>
            <p>
              <b>Highest total score wins.</b> You'll see your opponent's score once you've
              both submitted.
            </p>
            <p className="text-xs text-wordy-500 italic">
              Open matches auto-cancel after 7 days, friend invites after 24 hours if unaccepted.
              If your opponent goes quiet, nudge them with a 🔔 reminder after 12 hours, or
              claim the win from the match screen after 7 days.
            </p>
          </Section>

          <Section title="🏆 Stats &amp; leaderboard">
            <p>
              Tap your avatar → <b>📊 Stats</b> to open the leaderboard and your stats.
            </p>
            <p>
              The <b>daily leaderboard</b> unlocks once you've submitted today's puzzle.
              Tap any row to see that player's word list — sorted A–Z so it's easy to spot
              ones you missed. Open as many rows as you like to compare.
            </p>
            <p>
              <b>My Stats</b> shows your streak, lifetime words, your favorite word, your
              match record, and pets graduated.
            </p>
          </Section>

          <p className="text-center text-xs text-wordy-500 italic pt-2">
            That's it. Have fun feeding 💜
          </p>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <section>
      <h3 className="font-display text-base text-wordy-800 dark:text-wordy-100 mb-1">
        {title}
      </h3>
      <div className="space-y-2">{children}</div>
    </section>
  )
}
