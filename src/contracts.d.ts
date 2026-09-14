/** Assets are precomputed; these contracts make no online inference promise. */
export type Protocol = 'continuation' | 'prefix' | 'inbetween' | 'keyframe';
export type MotionPath = string;
export interface MeshMetadata {
  version: 1;
  encoding: 'uint16-le';
  frames: number;
  fps: number;
  verticesPerFrame: number;
  faceCount: number;
  vertices: string;
  faces: string;
  offset: [number, number, number];
  scale: [number, number, number];
  upAxis: 'Y';
  units: 'meters';
  quantizationMaxErrorMeters?: number;
}
export interface StructuralResult {
  output: MotionPath;
  /** One entry per OUTPUT frame. True means a conditioning frame. */
  knownMask: boolean[];
}
export interface EditResult {
  source: MotionPath;
  output: MotionPath;
  instruction: string;
}
export interface MotionSample {
  id: string;
  label: string;
  fileName?: string;
  numFrames?: number;
  fps?: number;
  prompt: string;
  provenance: string;
  sourceDataset: string;
  thumbnail?: string;
  reference: MotionPath | null;
  generated: MotionPath | null;
  comparison?: {models: Array<{motion: MotionPath; label: string; fileName: string;
    fps: number; numFrames: number; seed: number | null; checkpoint: string | null}>};
  predictedCaption: string | null;
  structures: Partial<Record<Protocol, StructuralResult>>;
  edit: EditResult | null;
  checkpoint: string | null;
  seed: number | null;
  sourceIndex?: number;
  selection?: string;
  generation?: {weights: string; mode: string; num_timesteps: number; guidance_scale: number; fps: number};
}
export interface Catalog {
  version: 1;
  title: string;
  samples: MotionSample[];
  directoryPreview?: boolean;
  comparisonMode?: boolean;
  compareDirectories?: string[];
  directory?: string;
  skipped?: Array<{file: string; reason: string}>;
  /** Ordered, independent sample IDs for each section. */
  tasks?: Record<'t2m' | 'm2t' | 'structure' | 'edit', string[]>;
}
