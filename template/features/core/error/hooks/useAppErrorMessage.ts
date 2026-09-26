import { useErrorMessage } from '@timothyrusso/effect-core/react';
import type { AppError } from '@/features/core/error/appError';
import { errorTagToMessageKey } from '@/features/core/error/mappers/errorTagToMessageKey';
import { useT } from '@/features/core/translations';

/** The translated message for an app error, or `undefined` when there is none. */
export const useAppErrorMessage = (error: AppError | null | undefined) =>
  useErrorMessage(error, errorTagToMessageKey, useT().t);
