import React from 'react';
import baseSvg from '@/assets/wellbore-left-hifi-base.svg';

export type BackendLevel = 0 | 1 | 2 | 3 | 4;

interface WellboreHifiFigureProps {
  backendLevel: BackendLevel;
  className?: string;
}

const VIEW_BOX = '0 0 1200 820';

function StatusHint({ backendLevel }: { backendLevel: BackendLevel }) {
  const isKick = backendLevel >= 2;
  const hint = backendLevel === 0
    ? { text: 'L0 正常 · 未触发异常侵入证据', x: 704, y: 574, width: 276, tone: 'normal' as const }
    : backendLevel === 1
      ? { text: 'L1 异常观察中', x: 728, y: 574, width: 172, tone: 'watch' as const }
      : { text: backendLevel >= 4 ? 'L4 溢流证据确认' : backendLevel === 3 ? 'L3 疑似溢流证据' : 'L2 溢流预警证据', x: 708, y: 574, width: 190, tone: 'kick' as const };
  const colors = {
    normal: { fill: '#F0FDFA', stroke: '#99F6E4', dot: '#14B8A6', text: '#0F766E' },
    watch: { fill: '#FFF7ED', stroke: '#FDBA74', dot: '#F97316', text: '#C2410C' },
    kick: { fill: '#FEF2F2', stroke: '#FCA5A5', dot: '#DC2626', text: '#B91C1C' },
  }[hint.tone];

  return (
    <g className="wellbore-status-breathe" aria-label={hint.text}>
      <rect x={hint.x} y={hint.y} width={hint.width} height="40" rx="9" fill={colors.fill} stroke={colors.stroke} />
      <circle cx={hint.x + 19} cy={hint.y + 20} r={isKick ? 5.5 : 5} fill={colors.dot} />
      <text x={hint.x + 34} y={hint.y + 25} fontFamily="Microsoft YaHei, PingFang SC, Arial" fontSize="13" fontWeight="700" fill={colors.text}>
        {hint.text}
      </text>
    </g>
  );
}

function BitDepthMarker({ backendLevel }: { backendLevel: BackendLevel }) {
  const stroke = backendLevel >= 2 ? '#DC2626' : backendLevel === 1 ? '#F97316' : '#14B8A6';
  return (
    <g className="wellbore-bit-pulse" aria-label="钻头当前位置高亮">
      <circle cx="585" cy="592" r="17" fill={stroke} opacity="0.12" />
      <circle cx="585" cy="592" r="8" fill="none" stroke={stroke} strokeWidth="2" opacity="0.72" />
    </g>
  );
}

function NormalOverlay() {
  return (
    <g aria-label="正常循环路径">
      <path className="wellbore-flow-path wellbore-flow-path-normal" d="M522 592 C502 538 502 475 514 417" />
      <path className="wellbore-flow-path wellbore-flow-path-normal" d="M648 592 C668 538 668 475 656 417" />
      <path className="wellbore-flow-path wellbore-flow-path-normal wellbore-flow-path-subtle" d="M585 592 C585 545 585 492 585 430" />
    </g>
  );
}

function WatchOverlay() {
  return (
    <g aria-label="异常观察路径">
      <path className="wellbore-flow-path wellbore-flow-path-warning" d="M526 592 C509 545 510 488 521 430" />
      <path className="wellbore-flow-path wellbore-flow-path-warning wellbore-flow-path-subtle" d="M644 592 C661 545 660 488 649 430" />
      <circle cx="585" cy="592" r="7" fill="#F97316" opacity="0.8" />
      <circle className="wellbore-kick-pulse" cx="585" cy="592" r="13" fill="#F97316" opacity="0.22" />
    </g>
  );
}

function KickOverlay({ backendLevel }: { backendLevel: BackendLevel }) {
  const criticalClass = backendLevel >= 4 ? 'wellbore-flow-path-critical' : 'wellbore-flow-path-critical wellbore-flow-path-warning-level';
  return (
    <g aria-label="疑似返出路径与异常侵入点">
      <path className={`wellbore-flow-path ${criticalClass}`} d="M520 594 C500 542 500 480 512 420" />
      <path className={`wellbore-flow-path ${criticalClass}`} d="M650 594 C670 542 670 480 658 420" />
      <path className={`wellbore-flow-path ${criticalClass}`} d="M541 608 C557 592 570 588 585 592 C602 596 616 591 632 608" />
      <circle className="wellbore-kick-pulse" cx="585" cy="592" r="18" fill="#DC2626" opacity="0.24" />
      <circle cx="585" cy="592" r="7" fill="#DC2626" />
      <g className="wellbore-evidence-callout">
        <path d="M604 592 H706" fill="none" stroke="#DC2626" strokeWidth="1.6" strokeDasharray="4 4" />
        <rect x="710" y="550" width="188" height="48" rx="8" fill="#FFF7F7" stroke="#FCA5A5" />
        <text x="724" y="570" fontFamily="Microsoft YaHei, PingFang SC, Arial" fontSize="12" fontWeight="700" fill="#B91C1C">
          异常侵入点
        </text>
        <text x="724" y="587" fontFamily="Microsoft YaHei, PingFang SC, Arial" fontSize="10.5" fill="#7F1D1D">
          返出 / 池体积证据持续
        </text>
      </g>
    </g>
  );
}

export function WellboreHifiFigure({ backendLevel, className = '' }: WellboreHifiFigureProps) {
  return (
    <div className={`wellbore-hifi-figure ${className}`}>
      <img className="wellbore-hifi-base" src={baseSvg} alt="井筒状态剖面图静态基底" draggable={false} />
      <svg className="wellbore-hifi-overlay" viewBox={VIEW_BOX} preserveAspectRatio="xMidYMid meet" role="img" aria-label={`井筒动态状态覆盖层，报警等级 L${backendLevel}`}>
        <g transform="translate(85 0)">
          <BitDepthMarker backendLevel={backendLevel} />
          {backendLevel === 0 ? <NormalOverlay /> : null}
          {backendLevel === 1 ? <WatchOverlay /> : null}
          {backendLevel >= 2 ? <KickOverlay backendLevel={backendLevel} /> : null}
          <StatusHint backendLevel={backendLevel} />
        </g>
      </svg>
    </div>
  );
}

export default WellboreHifiFigure;
