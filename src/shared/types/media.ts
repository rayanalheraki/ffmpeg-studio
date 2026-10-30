export type MediaKind = 'video' | 'audio' | 'image' | 'subtitle' | 'unknown';

/**
 * A probed input file. Produced in the main process by FFprobe and shared
 * with the renderer for display and with operations for argument building.
 */
export interface MediaFile {
  id: string;
  path: string;
  /** File name without extension. */
  name: string;
  /** File name with extension. */
  fileName: string;
  /** Lower-case extension without the dot. */
  ext: string;
  size: number;
  kind: MediaKind;
  duration: number | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  videoCodec: string | null;
  audioCodec: string | null;
  hasVideo: boolean;
  hasAudio: boolean;
  subtitleStreams: number;
  bitRate: number | null;
  formatName: string | null;
  /** Set when FFprobe could not read the file. */
  probeError: string | null;
}

export type StreamType = 'video' | 'audio' | 'subtitle' | 'data' | 'attachment' | 'unknown';

export interface StreamDetails {
  index: number;
  type: StreamType;
  codec: string | null;
  codecLong: string | null;
  profile: string | null;
  width: number | null;
  height: number | null;
  fps: number | null;
  pixelFormat: string | null;
  sampleRate: number | null;
  channels: number | null;
  channelLayout: string | null;
  bitRate: number | null;
  language: string | null;
  title: string | null;
  isDefault: boolean;
  isAttachedPicture: boolean;
}

/** Human-oriented FFprobe output used by the media info viewer. */
export interface MediaDetails {
  path: string;
  fileName: string;
  size: number;
  formatName: string | null;
  formatLongName: string | null;
  duration: number | null;
  bitRate: number | null;
  tags: Record<string, string>;
  streams: StreamDetails[];
  chapters: number;
}
