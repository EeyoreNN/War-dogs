/**
 * Terrain barrel. Server components and the map app import from here; anything that must stay
 * off the marketing first-load (the generator) is only pulled in when its export is used.
 */
export * from "./types";
export { generateTerrain, mapModel, specFor } from "./generate";
export { terrainToSvg, terrainToDataUri, biomePalette, type SvgOptions } from "./draw-svg";
export { drawTerrain, terrainBitmap } from "./draw-canvas";
export { terrainUrl, type TerrainSize, type TerrainUrlOptions } from "./url";
export { hashString, mulberry32 } from "./rng";
export { valueNoise2D, fbm } from "./noise";
