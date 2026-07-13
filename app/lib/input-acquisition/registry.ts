import { BLAZEPOSE_ACQUISITION_ADAPTER } from "./adapters/motion/blazepose-acquisition-adapter";
import type { MotionAcquisitionAdapter, MotionAcquisitionSourceKind } from "./contract";

/**
 * Motion-family acquisition adapters, keyed by source kind. Partial by design —
 * only sources with a real, implemented adapter appear here. Reserved source
 * kinds (imu_sensor, reference_sensor, xr_input, depth_camera, phone_camera)
 * are valid `MotionAcquisitionSourceKind` values but have no registry entry
 * until their adapter is implemented in a future sprint.
 */
const MOTION_ACQUISITION_ADAPTERS: Partial<
  Record<MotionAcquisitionSourceKind, MotionAcquisitionAdapter<unknown>>
> = {
  web_camera_pose: BLAZEPOSE_ACQUISITION_ADAPTER,
};

export function listMotionAcquisitionAdapters(): readonly MotionAcquisitionAdapter<unknown>[] {
  return Object.values(MOTION_ACQUISITION_ADAPTERS);
}

export function isRegisteredMotionAcquisitionSourceKind(
  sourceKind: string,
): sourceKind is MotionAcquisitionSourceKind {
  return Object.prototype.hasOwnProperty.call(MOTION_ACQUISITION_ADAPTERS, sourceKind);
}

export function getMotionAcquisitionAdapterOrNull(
  sourceKind: string,
): MotionAcquisitionAdapter<unknown> | null {
  if (!isRegisteredMotionAcquisitionSourceKind(sourceKind)) {
    return null;
  }
  return MOTION_ACQUISITION_ADAPTERS[sourceKind] ?? null;
}

export function getMotionAcquisitionAdapter(
  sourceKind: MotionAcquisitionSourceKind,
): MotionAcquisitionAdapter<unknown> {
  const adapter = MOTION_ACQUISITION_ADAPTERS[sourceKind];
  if (!adapter) {
    throw new Error(
      `No motion acquisition adapter registered for source kind "${sourceKind}". ` +
        `This source kind is reserved but not yet implemented.`,
    );
  }
  return adapter;
}
