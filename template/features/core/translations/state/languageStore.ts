import { createSelectors, createStore } from '@/features/core/state';
import type { Language } from '@/features/core/translations/catalog/types';

interface LanguageState {
  readonly language: Language;
  readonly setLanguage: (language: Language) => void;
}

const languageStore = createStore<LanguageState>(set => ({
  language: 'en',
  setLanguage: language => set({ language }),
}));

/** The app language. */
export const useLanguageStore = createSelectors(languageStore);
