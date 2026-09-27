/**
 * The fields of `kit.config.json` the recommended config reads. A `KitConfig` from
 * `@timothyrusso/config-presets` satisfies it, and so does the raw parsed file: every field is
 * optional and takes the schema default.
 */
export interface LintKitConfig {
  /** expo-router app folder. Defaults to `app`. */
  readonly appRoot?: string;
  /** Folder that holds the feature modules. Defaults to `features`. */
  readonly featuresRoot?: string;
  readonly lint?: {
    /** Hooks a view may call besides its own ViewModel hook. */
    readonly allowedHooksInViews?: readonly string[];
    /** `forbid` (the default) turns on `no-dashes`. */
    readonly dashes?: 'forbid' | 'allow';
    /** Turns on `no-literal-gutter` for the app folder and the design system. */
    readonly layoutTokens?: {
      readonly gutterToken: string;
      readonly spacingImport: string;
      readonly allowlistFile: string;
    };
    /** Forbids `ActivityIndicator` in favour of the design system spinner. */
    readonly singleSpinner?: boolean;
  };
}
