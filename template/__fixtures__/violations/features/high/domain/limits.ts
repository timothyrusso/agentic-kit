import { useState } from 'react';
import { source } from '@/features/high/data/source';
import { lowValue } from '@/features/low';

/**
 * domain-pure-except-effect (react), domain-no-outer-layer-import (data/) and
 * domain-no-cross-feature-runtime-import (another feature's index.ts).
 */
export const HIGH_LIMIT = lowValue + source.length + String(useState).length;
