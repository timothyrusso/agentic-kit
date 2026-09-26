import { en } from '@/features/core/translations/catalog/en';
import { it } from '@/features/core/translations/catalog/it';
import type { Catalog, Language, MessageKey } from '@/features/core/translations/catalog/types';

const catalogs: Readonly<Record<Language, Catalog>> = { en, it };

/** The text of `key` in `language`. */
export function translate(language: Language, key: MessageKey): string {
  let node: unknown = catalogs[language];
  for (const part of key.split('.')) node = (node as Record<string, unknown>)[part];
  return typeof node === 'string' ? node : key;
}
