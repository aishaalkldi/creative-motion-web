export {
  MOTION_ACQUISITION_SOURCE_KINDS,
  PHYSIOLOGICAL_ACQUISITION_SOURCE_KINDS,
  isMotionAcquisitionSourceKind,
  isPhysiologicalAcquisitionSourceKind,
  type InputAcquisitionContext,
  type InputAcquisitionFamily,
  type InputAcquisitionSourceKind,
  type KineticAcquisitionAdapter,
  type MotionAcquisitionAdapter,
  type MotionAcquisitionSourceKind,
  type NormalizedPhysiologicalSample,
  type PhysiologicalAcquisitionAdapter,
  type PhysiologicalAcquisitionSourceKind,
} from "./contract";

export {
  getMotionAcquisitionAdapter,
  getMotionAcquisitionAdapterOrNull,
  isRegisteredMotionAcquisitionSourceKind,
  listMotionAcquisitionAdapters,
} from "./registry";

export {
  BLAZEPOSE_ACQUISITION_ADAPTER,
  normalizeBlazePoseLandmarks,
} from "./adapters/motion/blazepose-acquisition-adapter";
