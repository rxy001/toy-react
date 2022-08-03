export const NoTimestamp = -1;
export const TotalLanes = 31;

export const NoLaness = /*                        */ 0b0000000000000000000000000000000;
export const NoLane = /*                          */ 0b0000000000000000000000000000000;

export const SyncLane = /*                        */ 0b0000000000000000000000000000001;

export const InputContinuousHydrationLane = /*    */ 0b0000000000000000000000000000010;
export const InputContinuousLane = /*             */ 0b0000000000000000000000000000100;

export const DefaultHydrationLane = /*            */ 0b0000000000000000000000000001000;
export const DefaultLane = /*                     */ 0b0000000000000000000000000010000;

export const SelectiveHydrationLane = /*          */ 0b0001000000000000000000000000000;

const NonIdleLaness = /*                          */ 0b0001111111111111111111111111111;

export const IdleHydrationLane = /*               */ 0b0010000000000000000000000000000;
export const IdleLane = /*                        */ 0b0100000000000000000000000000000;

export const OffscreenLane = /*                   */ 0b1000000000000000000000000000000;
