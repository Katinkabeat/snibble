-- Snibble — year-2 pet roster (unlock_order 13-24).
--
-- 12 new pets added after year 1's 13. Each fills a gap in the
-- original roster: aquatic (Marlow, Lily, Pearl), twilight (Hush,
-- Velvet, Crumble), spring garden (Sprig, Petal, Acorn), and slow
-- comfort pets (Marmalade, Wander, Whirr-as-fast-counterweight).
--
-- Art for these is not yet wired into PET_COMPONENTS; the catalog
-- entries land first so unlock ordering is stable. Pets become
-- visible in the sanctuary as `?` placeholders until art ships.

insert into public.sn_pets (id, name, species, unlock_order, affinity_tags, description) values
  ('marlow',    'Marlow',    'river otter',     13, array['water-themes','double-letters'],   'Holds your hand and yours alone.'),
  ('hush',      'Hush',      'owlet',           14, array['long-words','-tion','-ous'],        'Awake when the rest of the world isn''t.'),
  ('acorn',     'Acorn',     'squirrel',        15, array['hoarder','prefixes','re-','un-'],   'Hoards letters. Some of them are even useful.'),
  ('lily',      'Lily',      'frog',            16, array['short-suffix','-op','-og'],         'A pond, a sigh, a small green hello.'),
  ('crumble',   'Crumble',   'dormouse',        17, array['soft-letters','double-letters'],    'Mostly asleep, mostly content.'),
  ('pearl',     'Pearl',     'axolotl',         18, array['water-themes','rare-letters'],      'Smiles by accident. Floats with intent.'),
  ('velvet',    'Velvet',    'bat',             19, array['night-themes','-ight'],             'Hangs upside-down in the soft hour.'),
  ('whirr',     'Whirr',     'hummingbird',     20, array['short-words','double-letters'],     'Smaller than a thought, faster than one.'),
  ('petal',     'Petal',     'ladybug',         21, array['garden-themes','-y'],               'Garden-warden. Collects sunlight.'),
  ('sprig',     'Sprig',     'robin',           22, array['spring-themes','short-suffix'],     'The first to notice spring.'),
  ('marmalade', 'Marmalade', 'capybara',        23, array['long-words','warm-letters'],        'Reluctantly social. Chronically warm.'),
  ('wander',    'Wander',    'sloth',           24, array['long-words','-ing','-ed'],          'Will get there. Eventually. Probably.')
on conflict (id) do nothing;
