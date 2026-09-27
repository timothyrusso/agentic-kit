import { useCallback } from 'react';
import { translate } from '@/features/core/translations/catalog';
import type { MessageKey } from '@/features/core/translations/catalog/types';
import { useLanguageStore } from '@/features/core/translations/state/languageStore';

/** The translation function for the current language; it changes when the language does. */
export const useT = () => {
  const language = useLanguageStore.use.language();
  const t = useCallback((key: MessageKey) => translate(language, key), [language]);
  return { t, language };
};

/** The text of `key` in the current language, for code that cannot call a hook. */
export const tr = (key: MessageKey): string => translate(useLanguageStore.getState().language, key);
