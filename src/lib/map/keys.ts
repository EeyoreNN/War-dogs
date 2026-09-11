/** Rev keys (§3.3 RoomState.revs). Node and request ids never contain ":" (base32), so keys cannot collide. */
export const nodeKey = (id: string): string => id;
export const requestKey = (id: string): string => id;
export const rosterKey = (client: string): string => `roster:${client}`;
export const fieldKey = (entityKey: string, field: string): string => `${entityKey}:${field}`;
export const settingKey = (field: string): string => `settings:${field}`;
export const isFieldKeyOf = (entityKey: string, key: string): boolean => key.startsWith(entityKey + ":");
