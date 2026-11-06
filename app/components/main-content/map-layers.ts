// Shared by the map's renderers (GameGrid, TokenRenderer) and its mouse handling (MainContent).

/** Marks the root element of a token or map image; its value is the item id. */
export const MAP_ITEM_ATTR = "data-map-item"
export const MAP_ITEM_SELECTOR = `[${MAP_ITEM_ATTR}]`

/** The id of the token or map image an event happened on, if any. */
export function mapItemIdAt(target: EventTarget | null): string | null {
  return (target as Element | null)?.closest?.(MAP_ITEM_SELECTOR)?.getAttribute(MAP_ITEM_ATTR) ?? null
}

/**
 * Stacking order on the map, bottom to top. Equal values stack in the order they are rendered:
 * images < selection box; tokens < drawings; fog < pings.
 */
export const MAP_Z = {
  background: 3,
  gridLines: 5,
  border: 10,
  image: 35,
  selectionBox: 35,
  token: 40,
  drawings: 40,
  fog: 45,
  pings: 45,
  fileDropHint: 50,
} as const
