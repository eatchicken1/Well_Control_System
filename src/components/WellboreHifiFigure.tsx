import baseSvg from '@/assets/wellbore-left-hifi-base.svg';

export type BackendLevel = 0 | 1 | 2 | 3 | 4;

type HintTone = 'normal' | 'watch' | 'warning' | 'critical';

interface WellboreHifiFigureProps {
  backendLevel: BackendLevel;
  className?: string;
}

const VIEW_BOX = '0 0 1200 820';
const CENTER_X = 592;
const TOP_Y = 150;
const BIT_Y = 700;
const WATCH_POINT = { x: 632, y: 556 };
const KICK_POINT = { x: 632, y: 596 };

const TEXT = {
  alt: '\u4e95\u7b52\u7ed3\u6784\u4e0e\u72b6\u6001\u56fe',
  figure: '\u4e95\u7b52\u72b6\u6001\u5de6\u4fa7\u5de5\u7a0b\u5256\u9762',
  bit: '\u94bb\u5934\u4f4d\u7f6e',
  normalPath: '\u6b63\u5e38\u5faa\u73af\u8def\u5f84',
  watchPath: '\u89c2\u5bdf\u8def\u5f84',
  kickPath: '\u7591\u4f3c\u4e0a\u8fd4\u8def\u5f84',
  evidence: '\u5f02\u5e38\u8bc1\u636e',
};

const STATUS_META: Record<BackendLevel, { title: string; copy: string; tone: HintTone; width: number }> = {
  0: { title: 'L0 \u6b63\u5e38', copy: '\u672a\u89e6\u53d1\u5f02\u5e38\u4fb5\u5165\u8bc1\u636e', tone: 'normal', width: 244 },
  1: { title: 'L1 \u5f02\u5e38\u89c2\u5bdf', copy: '\u8fd4\u51fa\u54cd\u5e94\u8f7b\u5fae\u504f\u79bb', tone: 'watch', width: 210 },
  2: { title: 'L2 \u6ea2\u6d41\u9884\u8b66', copy: '\u8fd4\u51fa\u4e0e\u6c60\u589e\u5f00\u59cb\u504f\u79bb', tone: 'warning', width: 230 },
  3: { title: 'L3 \u7591\u4f3c\u6ea2\u6d41', copy: '\u7591\u4f3c\u4e0a\u8fd4\u8def\u5f84\u6301\u7eed\u589e\u5f3a', tone: 'warning', width: 230 },
  4: { title: 'L4 \u6ea2\u6d41\u786e\u8ba4', copy: '\u4fb5\u5165\u8bc1\u636e\u5df2\u5f62\u6210\u95ed\u73af', tone: 'critical', width: 220 },
};

function StatusHint({ backendLevel }: { backendLevel: BackendLevel }) {
  const meta = STATUS_META[backendLevel];
  const colors = {
    normal: { fill: '#F0FDFA', stroke: '#99F6E4', dot: '#14B8A6', text: '#0F766E' },
    watch: { fill: '#FFF7ED', stroke: '#FDBA74', dot: '#F97316', text: '#C2410C' },
    warning: { fill: '#FEF2F2', stroke: '#FCA5A5', dot: '#EF4444', text: '#B91C1C' },
    critical: { fill: '#FEF2F2', stroke: '#F87171', dot: '#DC2626', text: '#991B1B' },
  }[meta.tone];

  return (
    <g className="wellbore-status-breathe" aria-label={meta.title}>
      <rect x="184" y="262" width={meta.width} height="34" rx="8" fill={colors.fill} stroke={colors.stroke} />
      <circle cx="201" cy="279" r="4.5" fill={colors.dot} />
      <text x="215" y="275" fontFamily="Microsoft YaHei, PingFang SC, Arial" fontSize="11.2" fontWeight="700" fill={colors.text}>
        {meta.title}
      </text>
      <text x="215" y="287" fontFamily="Microsoft YaHei, PingFang SC, Arial" fontSize="9.5" fill="#475569">
        {meta.copy}
      </text>
    </g>
  );
}

function BitDepthMarker({ backendLevel }: { backendLevel: BackendLevel }) {
  const stroke = backendLevel >= 2 ? '#DC2626' : backendLevel === 1 ? '#F97316' : '#14B8A6';

  return (
    <g className="wellbore-bit-pulse" aria-label={TEXT.bit}>
      <circle cx={CENTER_X} cy={BIT_Y} r="18" fill={stroke} opacity="0.12" />
      <circle cx={CENTER_X} cy={BIT_Y} r="8" fill="none" stroke={stroke} strokeWidth="2" opacity="0.76" />
      <circle cx={CENTER_X} cy={BIT_Y} r="3.4" fill={stroke} opacity="0.78" />
    </g>
  );
}

function NormalOverlay() {
  return (
    <g aria-label={TEXT.normalPath}>
      <path className="wellbore-flow-path wellbore-flow-path-normal wellbore-flow-path-subtle" d={`M${CENTER_X} 684 C${CENTER_X} 624 ${CENTER_X} 536 ${CENTER_X} 424 C${CENTER_X} 328 ${CENTER_X} 244 ${CENTER_X} ${TOP_Y + 6}`} />
      <path className="wellbore-flow-path wellbore-flow-path-normal" d={`M572 682 C560 630 560 552 566 474 C570 384 571 278 572 ${TOP_Y + 4}`} />
      <path className="wellbore-flow-path wellbore-flow-path-normal" d={`M612 682 C624 630 624 552 618 474 C614 384 613 278 612 ${TOP_Y + 4}`} />
    </g>
  );
}

function WatchOverlay() {
  return (
    <g aria-label={TEXT.watchPath}>
      <path className="wellbore-flow-path wellbore-flow-path-warning wellbore-flow-path-subtle" d={`M612 684 C624 632 626 556 621 486 C617 406 615 322 614 ${TOP_Y + 70}`} />
      <path className="wellbore-flow-path wellbore-flow-path-warning" d="M632 556 C622 550 616 544 612 532 C609 520 612 502 618 478" />
      <circle cx={WATCH_POINT.x} cy={WATCH_POINT.y} r="6" fill="#F97316" opacity="0.88" />
      <circle className="wellbore-kick-pulse" cx={WATCH_POINT.x} cy={WATCH_POINT.y} r="13" fill="#F97316" opacity="0.20" />
    </g>
  );
}

function KickOverlay({ backendLevel }: { backendLevel: BackendLevel }) {
  const isConfirmed = backendLevel >= 4;
  const pathClass = isConfirmed
    ? 'wellbore-flow-path wellbore-flow-path-critical'
    : 'wellbore-flow-path wellbore-flow-path-critical wellbore-flow-path-warning-level';
  const title = isConfirmed ? '\u4fb5\u5165\u8bc1\u636e\u5df2\u5f62\u6210' : '\u7591\u4f3c\u4e0a\u8fd4\u8def\u5f84';
  const copy = isConfirmed
    ? '\u8fd4\u51fa / \u6c60\u589e / \u6c14\u4f53\u6307\u5f81\u5df2\u8054\u52a8'
    : '\u8fd4\u51fa\u54cd\u5e94\u4e0e\u6c60\u4f53\u79ef\u6301\u7eed\u504f\u79bb';

  return (
    <g aria-label={TEXT.kickPath}>
      <path className={pathClass} d={`M572 684 C556 648 554 612 560 560 C566 490 570 398 572 304 C572 244 572 202 572 ${TOP_Y + 4}`} />
      <path className={pathClass} d={`M612 684 C628 648 630 612 624 560 C618 490 614 398 612 304 C612 244 612 202 612 ${TOP_Y + 4}`} />
      <path className={pathClass} d="M632 596 C622 590 614 584 609 572 C606 560 608 546 613 530" />
      <circle className="wellbore-kick-pulse" cx={KICK_POINT.x} cy={KICK_POINT.y} r="16" fill="#DC2626" opacity="0.22" />
      <circle cx={KICK_POINT.x} cy={KICK_POINT.y} r="6.5" fill="#DC2626" />
      <g className="wellbore-evidence-callout" aria-label={TEXT.evidence}>
        <path d="M650 596 H684" fill="none" stroke="#DC2626" strokeWidth="1.5" strokeDasharray="4 4" />
        <rect x="688" y="542" width="174" height="50" rx="8" fill="#FFF7F7" stroke="#FCA5A5" />
        <text x="700" y="561" fontFamily="Microsoft YaHei, PingFang SC, Arial" fontSize="11" fontWeight="700" fill="#B91C1C">
          {title}
        </text>
        <text x="700" y="579" fontFamily="Microsoft YaHei, PingFang SC, Arial" fontSize="9.4" fill="#7F1D1D">
          {copy}
        </text>
      </g>
    </g>
  );
}

export function WellboreHifiFigure({ backendLevel, className = '' }: WellboreHifiFigureProps) {
  return (
    <div className={`wellbore-hifi-figure ${className}`}>
      <img className="wellbore-hifi-base" src={baseSvg} alt={TEXT.alt} draggable={false} />
      <svg className="wellbore-hifi-overlay" viewBox={VIEW_BOX} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${TEXT.figure} L${backendLevel}`}>
        <BitDepthMarker backendLevel={backendLevel} />
        {backendLevel === 0 ? <NormalOverlay /> : null}
        {backendLevel === 1 ? <WatchOverlay /> : null}
        {backendLevel >= 2 ? <KickOverlay backendLevel={backendLevel} /> : null}
        <StatusHint backendLevel={backendLevel} />
      </svg>
    </div>
  );
}

export default WellboreHifiFigure;
