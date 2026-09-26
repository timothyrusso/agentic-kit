import type { Item } from '@/features/items/domain/entities/Item';

/** A name as it is stored: trimmed, with inner runs of whitespace collapsed to one space. */
export const normalizeItemName = (name: string): string => name.trim().replace(/\s+/g, ' ');

/** Newest first; on the same millisecond, the higher id first. */
export const byNewestFirst = (a: Item, b: Item): number => b.createdAt - a.createdAt || b.id - a.id;
