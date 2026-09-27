import { peerValue } from '@/features/peer';

/** no-tier-violation-features-high: a Tier 2 feature importing its Tier 2 peer. */
export const readPeer = () => peerValue;
