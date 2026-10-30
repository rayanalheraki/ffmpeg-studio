import type { StreamDetails } from '@shared/types/media';
import { formatBitRate, formatResolution } from '@shared/utils/format';
import { Icon } from '../../lib/Icon';
import { Badge } from '../ui/Feedback';
import styles from './MediaInfoCard.module.css';

const TYPE_META = {
  video: { icon: 'Film', label: 'Video' },
  audio: { icon: 'AudioLines', label: 'Audio' },
  subtitle: { icon: 'Captions', label: 'Subtitle' },
  data: { icon: 'Database', label: 'Data' },
  attachment: { icon: 'Paperclip', label: 'Attachment' },
  unknown: { icon: 'CircleQuestionMark', label: 'Stream' },
} as const;

function details(stream: StreamDetails): string[] {
  const items: (string | null)[] = [];
  if (stream.type === 'video') {
    items.push(
      formatResolution(stream.width, stream.height),
      stream.fps && !stream.isAttachedPicture ? `${stream.fps} fps` : null,
      stream.pixelFormat,
    );
  }
  if (stream.type === 'audio') {
    items.push(
      stream.sampleRate ? `${(stream.sampleRate / 1000).toFixed(1)} kHz` : null,
      stream.channelLayout ?? (stream.channels ? `${stream.channels} channels` : null),
    );
  }
  if (stream.bitRate) items.push(formatBitRate(stream.bitRate));
  return items.filter((item): item is string => Boolean(item));
}

export function StreamRow({ stream }: { stream: StreamDetails }): React.JSX.Element {
  const meta = stream.isAttachedPicture ? { icon: 'Image' as const, label: 'Cover art' } : TYPE_META[stream.type];
  return (
    <div className={styles.stream}>
      <span className={styles.streamIcon}>
        <Icon name={meta.icon} size={15} />
      </span>
      <div className={styles.streamBody}>
        <p className={styles.streamTitle}>
          {meta.label} #{stream.index}
          {stream.title && <span className={styles.streamCodec}>“{stream.title}”</span>}
        </p>
        <p className={styles.streamCodec}>
          {stream.codecLong ?? stream.codec ?? 'Unknown codec'}
          {stream.profile ? ` · ${stream.profile}` : ''}
        </p>
        <div className={styles.chips}>
          {details(stream).map((item) => (
            <Badge key={item}>{item}</Badge>
          ))}
          {stream.language && stream.language !== 'und' && <Badge tone="accent">{stream.language.toUpperCase()}</Badge>}
          {stream.isDefault && <Badge tone="success">Default</Badge>}
        </div>
      </div>
    </div>
  );
}
