import { noDashes } from './noDashes.js';
import { noEffectInViews } from './noEffectInViews.js';
import { noEffectRunInFacades } from './noEffectRunInFacades.js';
import { noInlineComments } from './noInlineComments.js';
import { noJsxCommentText } from './noJsxCommentText.js';
import { noLiteralGutter } from './noLiteralGutter.js';
import { noRelativeImports } from './noRelativeImports.js';
import { preferViewmodel } from './preferViewmodel.js';
import { stableRowHandlers } from './stableRowHandlers.js';
import { viewmodelReturnShape } from './viewmodelReturnShape.js';

/** Every rule the plugin ships, by rule id. */
export const rules = {
  'no-dashes': noDashes,
  'no-effect-in-views': noEffectInViews,
  'no-effect-run-in-facades': noEffectRunInFacades,
  'no-inline-comments': noInlineComments,
  'no-jsx-comment-text': noJsxCommentText,
  'no-literal-gutter': noLiteralGutter,
  'no-relative-imports': noRelativeImports,
  'prefer-viewmodel': preferViewmodel,
  'stable-row-handlers': stableRowHandlers,
  'viewmodel-return-shape': viewmodelReturnShape,
};
