-- SERVIO seed data
-- Run after 0001_init.sql to populate tables, menu items, and banners.
-- All upserts so it's idempotent — re-running won't duplicate rows.

-- ─────────────────────────────────────────────────────────────────────────────
-- Tables T1–T10
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.tables (id, label) values
  ('T1', 'Table 1'),
  ('T2', 'Table 2'),
  ('T3', 'Table 3'),
  ('T4', 'Table 4'),
  ('T5', 'Table 5'),
  ('T6', 'Table 6'),
  ('T7', 'Table 7'),
  ('T8', 'Table 8'),
  ('T9', 'Table 9'),
  ('T10', 'Table 10')
on conflict (id) do update set label = excluded.label;

-- ─────────────────────────────────────────────────────────────────────────────
-- Menu items
-- ─────────────────────────────────────────────────────────────────────────────

-- Meals
insert into public.menu_items (id, name, price, image, category, description, top_pick, in_stock, options, position) values
  (
    'meal-1', 'Grilled Chicken Bowl', 249,
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop',
    'meals',
    'Tender grilled chicken served over steamed rice with fresh vegetables and our signature sauce.',
    true, true, null, 10
  ),
  (
    'meal-2', 'Beef Sinigang', 299,
    'https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?w=400&h=300&fit=crop',
    'meals',
    'Classic Filipino sour soup with tender beef short ribs, vegetables, and tamarind broth.',
    true, true, null, 20
  ),
  (
    'meal-3', 'Pork Adobo', 229,
    'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop',
    'meals',
    'Braised pork in soy sauce and vinegar with garlic and bay leaves. Served with steamed rice.',
    true, true,
    '[
      {
        "id": "rice", "name": "Add Rice", "type": "single",
        "choices": [
          {"id": "plain-rice", "name": "Plain rice", "priceDelta": 15},
          {"id": "garlic-rice", "name": "Garlic rice", "priceDelta": 20}
        ]
      }
    ]'::jsonb,
    30
  ),

-- Drinks
  (
    'drink-1', 'Mango Shake', 99,
    'https://images.unsplash.com/photo-1623065422902-30a2d299bbe4?w=400&h=300&fit=crop',
    'drinks',
    'Fresh Philippine mango blended with ice and milk for a creamy tropical treat.',
    false, true,
    '[
      {
        "id": "size", "name": "Size", "type": "single", "required": true,
        "choices": [
          {"id": "regular", "name": "Regular"},
          {"id": "large", "name": "Large", "priceDelta": 30}
        ]
      }
    ]'::jsonb,
    10
  ),
  (
    'drink-2', 'Iced Coffee', 89,
    'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&h=300&fit=crop',
    'drinks',
    'Locally roasted coffee served over ice with your choice of milk or black.',
    true, true, null, 20
  ),
  (
    'drink-3', 'Calamansi Juice', 69,
    'https://images.unsplash.com/photo-1621263764928-df1444c5e859?w=400&h=300&fit=crop',
    'drinks',
    'Freshly squeezed calamansi with a touch of honey. Refreshing and vitamin-packed.',
    false, true, null, 30
  ),

-- Desserts
  (
    'dessert-1', 'Leche Flan', 89,
    'https://images.unsplash.com/photo-1528975604071-b4dc52a2d18c?w=400&h=300&fit=crop',
    'desserts',
    'Silky smooth caramel custard, a classic Filipino dessert made with egg yolks and condensed milk.',
    false, true, null, 10
  ),
  (
    'dessert-2', 'Halo-Halo', 129,
    '/images/halo-halo.png',
    'desserts',
    'Shaved ice with sweet beans, jellies, fruits, leche flan, ube ice cream, and evaporated milk.',
    false, true, null, 20
  ),
  (
    'dessert-3', 'Ube Cheesecake', 149,
    'https://images.unsplash.com/photo-1565958011703-44f9829ba187?w=400&h=300&fit=crop',
    'desserts',
    'Creamy cheesecake infused with purple yam, topped with a vibrant ube glaze.',
    false, true, null, 30
  ),

-- Sides
  (
    'side-1', 'Garlic Rice', 49,
    'https://images.unsplash.com/photo-1536304929831-ee1ca9d44906?w=400&h=300&fit=crop',
    'sides',
    'Fragrant fried rice with crispy garlic bits. The perfect companion to any meal.',
    false, true, null, 10
  ),
  (
    'side-2', 'Lumpia Shanghai', 99,
    'https://images.unsplash.com/photo-1544025162-d76694265947?w=400&h=300&fit=crop',
    'sides',
    'Crispy fried spring rolls filled with seasoned ground pork and vegetables. Served with sweet chili sauce.',
    false, false, null, 20
  ),
  (
    'side-3', 'Fresh Garden Salad', 79,
    'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=400&h=300&fit=crop',
    'sides',
    'Mixed greens with cherry tomatoes, cucumber, and a light vinaigrette dressing.',
    false, true, null, 30
  )
on conflict (id) do update set
  name        = excluded.name,
  price       = excluded.price,
  image       = excluded.image,
  category    = excluded.category,
  description = excluded.description,
  top_pick    = excluded.top_pick,
  in_stock    = excluded.in_stock,
  options     = excluded.options,
  position    = excluded.position;

-- ─────────────────────────────────────────────────────────────────────────────
-- Promo banners
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.banners (id, image, title, subtitle, position, active) values
  (
    'welcome',
    'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=900&h=506&fit=crop',
    'Welcome to SERVIO',
    'Cooked fresh, served straight to your table.',
    10, true
  ),
  (
    'halo-halo-week',
    'https://images.unsplash.com/photo-1563805042-7684c019e1cb?w=900&h=506&fit=crop',
    'Halo-Halo Week',
    'Save ₱30 on our signature dessert all week long.',
    20, true
  ),
  (
    'brewed-daily',
    'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=900&h=506&fit=crop',
    'Brewed Daily',
    'Locally roasted coffee, served over hand-cut ice.',
    30, true
  )
on conflict (id) do update set
  image    = excluded.image,
  title    = excluded.title,
  subtitle = excluded.subtitle,
  position = excluded.position,
  active   = excluded.active;
