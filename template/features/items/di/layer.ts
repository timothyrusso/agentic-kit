import { Layer } from 'effect';
import { ItemRepositoryLive } from '@/features/items/data/repositories/itemRepositoryLive';

/** Every Live Layer of the feature. `SqliteClient` is left open: `core/runtime` provides it. */
export const ItemsLive = Layer.mergeAll(ItemRepositoryLive);
