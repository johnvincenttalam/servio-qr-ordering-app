-- Categories get an optional icon name so admins can pick a visual
-- glyph per category instead of the generic Tag fallback.
--
-- Stored as plain text — the value is a lucide icon component name
-- (e.g. "UtensilsCrossed", "CupSoda"). The client maps that to a
-- React component via a curated allow-list, falling back to Tag
-- when the stored value is null or unknown.

alter table public.categories
  add column if not exists icon text;

-- Back-fill the four originals with sensible defaults so the four
-- seeded categories don't have to be re-edited.
update public.categories set icon = 'UtensilsCrossed' where id = 'meals'    and icon is null;
update public.categories set icon = 'CupSoda'         where id = 'drinks'   and icon is null;
update public.categories set icon = 'IceCream'        where id = 'desserts' and icon is null;
update public.categories set icon = 'Salad'           where id = 'sides'    and icon is null;

notify pgrst, 'reload schema';
