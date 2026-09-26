/**
 * @timothyrusso/effect-core/testing. Jest helpers: `itEffect` and `runTest`, an in-memory
 * `node:sqlite` `SqliteClient`, a collecting `Logger` and `TestClock` control. Import it only from
 * tests: it loads `node:sqlite`, which Metro cannot bundle.
 */

/** Effect's `TestClock` and `TestContext`, re-exported for tests that drive time by hand. */
export { TestClock, TestContext } from 'effect';
export { advanceClock } from './clock.js';
export { type CollectedLogs, collectLogs, type LogEntry } from './collectLogs.js';
export {
  makeNodeSqliteDatabase,
  makeNodeSqliteLayer,
  type NodeSqliteDatabase,
  type NodeSqliteOptions,
} from './nodeSqlite.js';
export { type EffectOrThunk, itEffect, runTest } from './runTest.js';
