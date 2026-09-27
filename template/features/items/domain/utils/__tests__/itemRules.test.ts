import type { Item, ItemId } from '@/features/items/domain/entities/Item';
import { byNewestFirst, normalizeItemName } from '@/features/items/domain/utils/itemRules';

const item = (id: number, createdAt: number): Item => ({ id: id as ItemId, name: `Item ${id}`, createdAt });

describe('normalizeItemName', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeItemName('  Buy \t  milk \n')).toBe('Buy milk');
  });

  it('leaves nothing of a blank name', () => {
    expect(normalizeItemName(' \n ')).toBe('');
  });
});

describe('byNewestFirst', () => {
  it('orders by creation time, then by id', () => {
    const sorted = [item(1, 10), item(3, 5), item(2, 10)].sort(byNewestFirst);
    expect(sorted.map(i => i.id)).toEqual([2, 1, 3]);
  });
});
