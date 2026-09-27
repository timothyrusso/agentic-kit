/** The slice of `.claude/settings.json` that `init` merges. Other fields are kept as they are. */
export interface ClaudeSettings {
  permissions?: { allow?: string[]; deny?: string[]; ask?: string[]; [field: string]: unknown };
  extraKnownMarketplaces?: Record<string, unknown>;
  enabledPlugins?: Record<string, boolean>;
  [field: string]: unknown;
}

const union = (current: readonly string[] | undefined, extra: readonly string[] | undefined) => [
  ...new Set([...(current ?? []), ...(extra ?? [])]),
];

/**
 * Adds the template's permissions, marketplace and plugin to an app's existing settings. Nothing
 * the app already has is removed or overridden: permission lists are unions, and a marketplace or
 * plugin entry the app already names is kept as it is.
 */
export function mergeClaudeSettings(current: ClaudeSettings, template: ClaudeSettings): ClaudeSettings {
  const permissions = { ...(current.permissions ?? {}) };
  for (const list of ['allow', 'deny'] as const) {
    const merged = union(current.permissions?.[list], template.permissions?.[list]);
    if (merged.length > 0) permissions[list] = merged;
  }
  return {
    ...current,
    extraKnownMarketplaces: { ...(template.extraKnownMarketplaces ?? {}), ...(current.extraKnownMarketplaces ?? {}) },
    enabledPlugins: { ...(template.enabledPlugins ?? {}), ...(current.enabledPlugins ?? {}) },
    permissions,
  };
}
