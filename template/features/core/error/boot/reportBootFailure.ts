/**
 * Reports a runtime that failed to build. No `Logger` exists then, since it is part of the Layer
 * that failed, so this writes to the console; a release build sends it to the crash reporter.
 */
export function reportBootFailure(error: unknown): void {
  // biome-ignore lint/suspicious/noConsole: the one place that logs before a Logger exists
  console.error('The app runtime failed to boot', error);
}
