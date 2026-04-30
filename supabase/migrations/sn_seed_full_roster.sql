-- Snibble — seed the full year-1 pet roster (10 more pets) so the
-- Sanctuary screen can show 13 silhouettes from day one. Hints for
-- locked pets are hardcoded client-side in src/lib/petHints.js.

insert into public.sn_pets (id, name, species, unlock_order, affinity_tags, description) values
  ('burrow',  'Burrow',  'mole',                3, array['long-words','dense-letters'], 'Quiet, methodical, lives just out of sight.'),
  ('bramble', 'Bramble', 'hedgehog',            4, array['patterns','palindromes'],     'Prickly outside, gentle once she trusts you.'),
  ('honey',   'Honey',   'bee',                 5, array['vowel-rich','a-e-only'],      'Sweet-toothed and warm.'),
  ('pebble',  'Pebble',  'turtle',              6, array['6-plus','contains-oo'],       'Slow, patient, has seen things.'),
  ('bobbin',  'Bobbin',  'spider',              7, array['repeating-letters'],          'A weaver of small things.'),
  ('cinder',  'Cinder',  'cat',                 8, array['theme-cravings'],             'Autumn-colored, mostly indifferent.'),
  ('cosmo',   'Cosmo',   'moth',                9, array['rare-suffix','-ion','-ate'],  'Drawn to lamps and quiet rooms.'),
  ('quill',   'Quill',   'porcupine',          10, array['rare-letters','q-x-z'],       'A connoisseur of difficult letters.'),
  ('kettle',  'Kettle',  'dragon hatchling',   11, array['7-plus','prefix-heavy'],      'Small, hot, a little dramatic.'),
  ('frost',   'Frost',   'arctic fox',         12, array['z-w-heavy','double-cons'],    'A year-end visitor.')
on conflict (id) do nothing;
