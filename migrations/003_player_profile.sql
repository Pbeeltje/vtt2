-- Each player's colour (portrait ring, name, map pings, default drawing colour) and avatar picture.
-- Colour is assigned on first sight (lib/player-profile.ts); a NULL avatar shows the default silhouette.
ALTER TABLE user ADD COLUMN Color TEXT;
ALTER TABLE user ADD COLUMN AvatarUrl TEXT;
