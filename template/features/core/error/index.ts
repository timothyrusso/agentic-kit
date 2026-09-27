import type { FeatureTier } from '@timothyrusso/arch-rules';

export const FEATURE_TIER: FeatureTier = 0;

export {
  AppErrorBase,
  ConfigError,
  isAppError,
  SqlError,
  toAppError,
  UnexpectedError,
} from '@timothyrusso/effect-core';
export type { AppError, AppErrorRegistry } from '@/features/core/error/appError';
export { reportBootFailure } from '@/features/core/error/boot/reportBootFailure';
export { useAppErrorMessage } from '@/features/core/error/hooks/useAppErrorMessage';
export { errorTagToMessageKey } from '@/features/core/error/mappers/errorTagToMessageKey';
