/**
 * @timothyrusso/effect-core. Shared Effect layer: AppError, Logger, Config, runtime, SqliteClient,
 * React hooks (`/react`) and testing helpers (`/testing`).
 */

/** Effect's `Clock` service, re-exported so use cases read time through it and tests control it. */
export { Clock } from 'effect';
export { type AppConfig, type ConfigDefinition, ConfigError, makeConfig } from './config/makeConfig.js';
export {
  type AnyAppError,
  type AppErrorArgs,
  AppErrorBase,
  type AppErrorClass,
  type AppErrorInstance,
  isAppError,
} from './errors/appError.js';
export { type AppErrors, defineAppErrors, type MessageKeyMapper, resolveMessageKey } from './errors/messageKeys.js';
export { toAppError, UnexpectedError } from './errors/unexpected.js';
export { ConsoleLogger, type LogContext, Logger, type LoggerService, NoopLogger } from './logger/logger.js';
export { type AppRuntime, type AppServicesOf, makeAppRuntime, type RunOptions } from './runtime/makeAppRuntime.js';
export { type Migration, type MigrationReport, runMigrations } from './sqlite/migrations.js';
export {
  SqlError,
  SqliteClient,
  type SqliteDatabase,
  type SqlParams,
  type SqlRunResult,
  type SqlValue,
  trySql,
  withSqlite,
} from './sqlite/sqliteClient.js';
