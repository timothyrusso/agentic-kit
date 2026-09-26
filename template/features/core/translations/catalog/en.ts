/** The reference catalog: every other language has exactly these keys. */
export const en = {
  items: {
    title: 'Items',
    placeholder: 'New item',
    add: 'Add',
    remove: 'Remove',
    empty: 'Nothing here yet. Add the first item above.',
  },
  errors: {
    unexpected: 'Something went wrong. Please try again.',
    sql: 'Your data could not be saved or read.',
    config: 'The app is not configured correctly.',
    itemCorrupt: 'An item could not be read.',
    itemNameEmpty: 'Give the item a name.',
    itemNotFound: 'That item no longer exists.',
    bootTitle: 'The app could not start',
    boot: 'Close the app and open it again. If this keeps happening, reinstall it.',
    crashTitle: 'The app ran into a problem',
    retry: 'Try again',
  },
} as const;
