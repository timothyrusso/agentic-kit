import type { en } from '@/features/core/translations/catalog/en';

type Widen<T> = { readonly [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };

type Paths<T, Prefix extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${Prefix}${K}` : Paths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

/** The shape every language's catalog has: the English one, with any string as a value. */
export type Catalog = Widen<typeof en>;

/** A dotted key into the catalog, such as `items.title`. */
export type MessageKey = Paths<typeof en>;

/** A language the app ships. */
export type Language = 'en' | 'it';
