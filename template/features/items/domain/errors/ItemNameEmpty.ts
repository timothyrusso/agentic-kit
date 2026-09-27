import { AppErrorBase } from '@/features/core/error';

/** A new item's name is empty once trimmed. */
export class ItemNameEmpty extends AppErrorBase('ItemNameEmpty', 'errors.itemNameEmpty') {}
