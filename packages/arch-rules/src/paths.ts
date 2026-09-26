import type { IRegularForbiddenRuleType } from 'dependency-cruiser';

/** A generated dependency-cruiser `forbidden` rule. Every rule has a name and an error severity. */
export type ArchRule = IRegularForbiddenRuleType & { name: string; comment: string; severity: 'error' };

/**
 * The fields of `kit.config.json` the generators read. A `KitConfig` from
 * `@timothyrusso/config-presets` satisfies it.
 */
export interface ArchKitConfig {
  /** Folder that holds the feature modules, relative to the app root. */
  readonly featuresRoot: string;
  /** expo-router app folder, relative to the app root. */
  readonly appRoot: string;
}

/** Escapes a literal path for use inside a regular expression. Hyphens and slashes stay as they are. */
export function escapeRegex(path: string): string {
  return path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Turns a feature path such as `features/core/navigation` into a rule name suffix. */
export function slug(featurePath: string): string {
  return featurePath.replace(/\//g, '-');
}

/**
 * Builds one regex alternation for a list of paths relative to a folder, grouping siblings:
 * `['core/navigation', 'core/design-system']` becomes `core/(navigation|design-system)`.
 */
export function alternation(paths: readonly string[]): string {
  const groups = new Map<string, string[]>();
  for (const path of paths) {
    const cut = path.lastIndexOf('/');
    const parent = cut === -1 ? '' : path.slice(0, cut + 1);
    const leaf = path.slice(cut + 1);
    const leaves = groups.get(parent) ?? [];
    leaves.push(escapeRegex(leaf));
    groups.set(parent, leaves);
  }
  const parts = [...groups].map(([parent, leaves]) =>
    leaves.length === 1 ? `${escapeRegex(parent)}${leaves[0]}` : `${escapeRegex(parent)}(${leaves.join('|')})`,
  );
  return parts.length === 1 ? (parts[0] ?? '') : `(${parts.join('|')})`;
}
