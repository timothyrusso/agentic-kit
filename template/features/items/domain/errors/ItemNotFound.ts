import { AppErrorBase } from '@/features/core/error';
import type { ItemId } from '@/features/items/domain/entities/Item';

export class ItemNotFound extends AppErrorBase('ItemNotFound', 'errors.itemNotFound')<{
  readonly itemId: ItemId;
}> {}
