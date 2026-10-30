import type { StreamDetails } from '@shared/types/media';
import { formatBitRate, formatResolution } from '@shared/utils/format';
import { Icon } from '../../lib/Icon';
import { Badge } from '../ui/Feedback';
import { msg, tp } from '@shared/i18n';
import { useI18n } from '../../state/i18n';
import styles from './MediaInfoCard.module.css';

const TYPE_META = {
  video: { icon: 'Film', label: msg('Video') },
  audio: { icon: 'AudioLines', label: msg('Audio') },
  subtitle: { icon: 'Captions', label: msg('Subtitle') },
  data: { icon: 'Database', label: msg('Data') },
  attachment: { icon: 'Paperclip', label: msg('Attachment') },
  unknown: { icon: 'CircleQuestionMark', label: msg('Stream') },
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
      stream.channelLayout ?? (stream.channels ? tp(stream.channels, '{count} channel', '{count} channels') : null),
    );
  }
  if (stream.bitRate) items.push(formatBitRate(stream.bitRate));
  return items.filter((item): item is string => Boolean(item));
}

export function StreamRow({ stream }: { stream: StreamDetails }): React.JSX.Element {
  const { t } = useI18n();
  const meta = stream.isAttachedPicture ? { icon: 'Image' as const, label: msg('Cover art') } : TYPE_META[stream.type];
  return (
    <div className={styles.stream}>
      <span className={styles.streamIcon}>
        <Icon name={meta.icon} size={15} />
      </span>
      <div className={styles.streamBody}>
        <p className={styles.streamTitle}>
          {t(meta.label)} #{stream.index}
          {stream.title && <span className={styles.streamCodec}>“{stream.title}”</span>}
        </p>
        <p className={styles.streamCodec}>
          {stream.codecLong ?? stream.codec ?? t('Unknown codec')}
          {stream.profile ? ` · ${stream.profile}` : ''}
        </p>
        <div className={styles.chips}>
          {details(stream).map((item) => (
            <Badge key={item}>{item}</Badge>
          ))}
          {stream.language && stream.language !== 'und' && <Badge tone="accent">{stream.language.toUpperCase()}</Badge>}
          {stream.isDefault && <Badge tone="success">{t('Default')}</Badge>}
        </div>
      </div>
    </div>
  );
}
