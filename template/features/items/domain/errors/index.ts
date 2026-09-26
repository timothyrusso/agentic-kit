import type { ItemCorrupt } from '@/features/items/domain/errors/ItemCorrupt';
import type { ItemNameEmpty } from '@/features/items/domain/errors/ItemNameEmpty';
import type { ItemNotFound } from '@/features/items/domain/errors/ItemNotFound';

declare module '@/features/core/error' {
  interface AppErrorRegistry {
    items: ItemCorrupt | ItemNameEmpty | ItemNotFound;
  }
}
