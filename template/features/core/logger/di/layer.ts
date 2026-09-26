import { ConsoleLogger, NoopLogger } from '@timothyrusso/effect-core';

/**
 * The `Logger` the runtime provides: the console in development. A release build swaps in the
 * crash reporter's Layer here (a Sentry Layer sends `error` calls).
 */
export const LoggerLive = __DEV__ ? ConsoleLogger : NoopLogger;
