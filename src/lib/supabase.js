import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '⚠️  Missing Supabase credentials.\n' +
    'Copy .env.example → .env and fill in your project URL and anon key.'
  )
}

// Default storage key (no override) so the auth session is shared with the
// SQ hub, Wordy, and Rungles — they're all same-origin under
// katinkabeat.github.io and read the same localStorage entry. Snibble
// inherits whatever session the hub created.
export const supabase = createClient(supabaseUrl, supabaseKey)
