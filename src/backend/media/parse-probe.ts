import { extensionOf, kindFromExtension } from '@shared/media/kinds';
import type { MediaDetails, MediaFile, MediaKind, StreamDetails, StreamType } from '@shared/types/media';
import { basename, stripExtension } from '@shared/utils/path';

/** The subset of FFprobe's JSON output that the app reads. */
interface RawStream {
  index?: number;
  codec_type?: string;
  codec_name?: string;
  codec_long_name?: string;
  profile?: string;
  width?: number;
  height?: number;
  avg_frame_rate?: string;
  r_frame_rate?: string;
  pix_fmt?: string;
  sample_rate?: string;
  channels?: number;
  channel_layout?: string;
  bit_rate?: string;
  disposition?: Record<string, number>;
  tags?: Record<string, string>;
}

interface RawFormat {
  format_name?: string;
  format_long_name?: string;
  duration?: string;
  bit_rate?: string;
  tags?: Record<string, string>;
}

export interface RawProbe {
  streams?: RawStream[];
  format?: RawFormat;
  chapters?: unknown[];
}

function toNumber(value: string | number | undefined): number | null {
  if (value === undefined || value === 'N/A') return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseFrameRate(value: string | undefined): number | null {
  if (!value) return null;
  const [num, den] = value.split('/').map(Number);
  if (num === undefined || !Number.isFinite(num) || num <= 0) return null;
  const rate = den ? num / den : num;
  return Number.isFinite(rate) && rate > 0 && rate < 1000 ? Math.round(rate * 1000) / 1000 : null;
}

function streamType(value: string | undefined): StreamType {
  return value === 'video' || value === 'audio' || value === 'subtitle' || value === 'data' || value === 'attachment' ? value : 'unknown';
}

export function parseStream(raw: RawStream): StreamDetails {
  const tags = raw.tags ?? {};
  return {
    index: raw.index ?? 0,
    type: streamType(raw.codec_type),
    codec: raw.codec_name ?? null,
    codecLong: raw.codec_long_name ?? null,
    profile: raw.profile ?? null,
    width: raw.width ?? null,
    height: raw.height ?? null,
    fps: parseFrameRate(raw.avg_frame_rate) ?? parseFrameRate(raw.r_frame_rate),
    pixelFormat: raw.pix_fmt ?? null,
    sampleRate: toNumber(raw.sample_rate),
    channels: raw.channels ?? null,
    channelLayout: raw.channel_layout ?? null,
    bitRate: toNumber(raw.bit_rate),
    language: tags.language ?? tags.LANGUAGE ?? null,
    title: tags.title ?? tags.TITLE ?? null,
    isDefault: raw.disposition?.default === 1,
    isAttachedPicture: raw.disposition?.attached_pic === 1,
  };
}

function refineKind(extensionKind: MediaKind, hasVideo: boolean, hasAudio: boolean): MediaKind {
  if (extensionKind !== 'unknown') return extensionKind;
  if (hasVideo) return 'video';
  if (hasAudio) return 'audio';
  return 'unknown';
}

export function toMediaFile(id: string, filePath: string, size: number, raw: RawProbe): MediaFile {
  const streams = (raw.streams ?? []).map(parseStream);
  const video = streams.find((stream) => stream.type === 'video' && !stream.isAttachedPicture);
  const audio = streams.find((stream) => stream.type === 'audio');
  const ext = extensionOf(filePath);
  const kind = refineKind(kindFromExtension(ext), Boolean(video), Boolean(audio));
  const fileName = basename(filePath);
  const isStill = kind === 'image';

  return {
    id,
    path: filePath,
    name: stripExtension(fileName),
    fileName,
    ext,
    size,
    kind,
    duration: isStill ? null : toNumber(raw.format?.duration),
    width: video?.width ?? null,
    height: video?.height ?? null,
    fps: isStill ? null : (video?.fps ?? null),
    videoCodec: video?.codec ?? null,
    audioCodec: audio?.codec ?? null,
    hasVideo: Boolean(video) && !isStill,
    hasAudio: Boolean(audio),
    subtitleStreams: streams.filter((stream) => stream.type === 'subtitle').length,
    bitRate: toNumber(raw.format?.bit_rate),
    formatName: raw.format?.format_name ?? null,
    probeError: null,
  };
}

export function toMediaDetails(filePath: string, size: number, raw: RawProbe): MediaDetails {
  return {
    path: filePath,
    fileName: basename(filePath),
    size,
    formatName: raw.format?.format_name ?? null,
    formatLongName: raw.format?.format_long_name ?? null,
    duration: toNumber(raw.format?.duration),
    bitRate: toNumber(raw.format?.bit_rate),
    tags: { ...(raw.format?.tags ?? {}) },
    streams: (raw.streams ?? []).map(parseStream),
    chapters: raw.chapters?.length ?? 0,
  };
}

/** Placeholder for files FFprobe could not read, so they can still be listed and removed. */
export function unreadableFile(id: string, filePath: string, size: number, reason: string): MediaFile {
  const fileName = basename(filePath);
  const ext = extensionOf(filePath);
  return {
    id,
    path: filePath,
    name: stripExtension(fileName),
    fileName,
    ext,
    size,
    kind: kindFromExtension(ext),
    duration: null,
    width: null,
    height: null,
    fps: null,
    videoCodec: null,
    audioCodec: null,
    hasVideo: false,
    hasAudio: false,
    subtitleStreams: 0,
    bitRate: null,
    formatName: null,
    probeError: reason,
  };
}
