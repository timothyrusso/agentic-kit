import { QueryClientProvider } from '@tanstack/react-query';
import { EffectRuntimeProvider } from '@timothyrusso/effect-core/react';
import { type ErrorBoundaryProps, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { FatalScreen } from '@/features/core/design-system';
import { reportBootFailure } from '@/features/core/error';
import { queryClient } from '@/features/core/query';
import { runtime } from '@/features/core/runtime';
import { useT } from '@/features/core/translations';

/** The root: boots the runtime once, then mounts the query client, the runtime and the stack. */
export default function RootLayout() {
  const { t } = useT();
  const [bootError, setBootError] = useState<unknown>(null);
  useEffect(() => {
    runtime.boot().catch(error => {
      reportBootFailure(error);
      setBootError(error);
    });
  }, []);
  if (bootError !== null) return <FatalScreen message={t('errors.boot')} title={t('errors.bootTitle')} />;
  return (
    <QueryClientProvider client={queryClient}>
      <EffectRuntimeProvider runtime={runtime}>
        <Stack />
      </EffectRuntimeProvider>
    </QueryClientProvider>
  );
}

/** The root error boundary: any render error nothing below caught. */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const { t } = useT();
  return (
    <FatalScreen
      action={{ label: t('errors.retry'), onPress: retry }}
      message={t('errors.unexpected')}
      title={t('errors.crashTitle')}
    />
  );
}
