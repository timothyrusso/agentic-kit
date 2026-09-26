import { TextDecoder, TextEncoder } from 'node:util';

if (typeof globalThis.TextEncoder === 'undefined') Object.assign(globalThis, { TextEncoder, TextDecoder });
