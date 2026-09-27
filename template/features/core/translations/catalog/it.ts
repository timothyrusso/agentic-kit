import type { Catalog } from '@/features/core/translations/catalog/types';

export const it: Catalog = {
  items: {
    title: 'Elementi',
    placeholder: 'Nuovo elemento',
    add: 'Aggiungi',
    remove: 'Rimuovi',
    empty: 'Ancora niente. Aggiungi il primo elemento qui sopra.',
  },
  errors: {
    unexpected: 'Qualcosa è andato storto. Riprova.',
    sql: 'Non è stato possibile salvare o leggere i tuoi dati.',
    config: "L'app non è configurata correttamente.",
    itemCorrupt: 'Non è stato possibile leggere un elemento.',
    itemNameEmpty: "Dai un nome all'elemento.",
    itemNotFound: 'Questo elemento non esiste più.',
    bootTitle: "Non è stato possibile avviare l'app",
    boot: "Chiudi l'app e riaprila. Se succede ancora, reinstallala.",
    crashTitle: "L'app ha avuto un problema",
    retry: 'Riprova',
  },
};
