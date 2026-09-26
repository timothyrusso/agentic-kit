import { QueryClient } from '@tanstack/react-query';
import { isAppError } from '@timothyrusso/effect-core';

/**
 * The app's query client. An app error already went through the Effect (its retries included) and
 * was logged once, so TanStack retries only errors from plain `useQuery` calls.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: (failureCount, error) => !isAppError(error) && failureCount < 3 },
  },
});
