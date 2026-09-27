import { defineAppErrors } from '@timothyrusso/effect-core';
import type { AppError } from '@/features/core/error/appError';
import type { MessageKey } from '@/features/core/translations';

const appErrors = defineAppErrors<AppError>();

/**
 * The catalog key of every error tag. A tag missing here, or a key that is not a tag, fails to
 * compile; each key equals the class's own `messageKey`.
 */
export const errorTagToMessageKey = appErrors.assertExhaustiveMessageKeys<MessageKey>({
  UnexpectedError: 'errors.unexpected',
  SqlError: 'errors.sql',
  ConfigError: 'errors.config',
  ItemCorrupt: 'errors.itemCorrupt',
  ItemNameEmpty: 'errors.itemNameEmpty',
  ItemNotFound: 'errors.itemNotFound',
});
