import { b } from '@/features/high/domain/cycleB';

/** no-circular: cycleA and cycleB import each other. */
export const highValue = 2;
export const a = () => b();
