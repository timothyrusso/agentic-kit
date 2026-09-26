import { peerValue } from '@/features/peer/domain/peerValue';

/** enforce-index-boundary-features-peer: past peer's index.ts (and a tier violation too). */
export const readPeerInternals = () => peerValue;
