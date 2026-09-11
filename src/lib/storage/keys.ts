// localStorage / sessionStorage / IDB key names (§5.4). One place, so nothing hardcodes a key.
export const KEY_IDENTITY = "wardogs:identity";
export const KEY_PREFS = "wardogs:prefs";
export const KEY_ROOMS = "wardogs:rooms";
export const KEY_RELAY = "wardogs:relay";
export const roomKey = (code: string): string => `wardogs:room:${code}`;
export const roomBadKey = (code: string): string => `wardogs:room:${code}:bad`;
export const IDB_NAME = "wardogs";
export const IDB_STORE_MAPS = "maps";
export const MAX_RECENT_ROOMS = 5;
