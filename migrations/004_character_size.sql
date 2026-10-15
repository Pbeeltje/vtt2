-- A creature's size on the map: Small 0.5x, Medium 1x, Large 1.5x, Huge 2x, Massive 3x (app/lib/tokens.ts).
ALTER TABLE character ADD COLUMN Size TEXT NOT NULL DEFAULT 'Medium';
