import { AppErrorBase } from '@/features/core/error';

/** A stored item failed to decode: the data is wrong, not the code. `cause` is the parse error. */
export class ItemCorrupt extends AppErrorBase('ItemCorrupt', 'errors.itemCorrupt') {}
