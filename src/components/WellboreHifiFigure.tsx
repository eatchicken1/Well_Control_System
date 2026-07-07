import React from 'react';
import wellboreBaseUrl from '@/assets/wellbore-left-hifi-base.svg';

export type BackendLevel = 0 | 1 | 2 | 3 | 4;

interface WellboreHifiFigureProps {
  backendLevel: BackendLevel;
  className?: string;
}

/**
 * 高保真井筒剖面基底组件。
 *
 * 说明：
 * 1. wellbore-left-hifi-base.svg 是高保真静态视觉基底。
 * 2. 如果只需要和设计稿一致，直接 img 渲染即可。
 * 3. 如果需要动态异常路径，请在外层追加绝对定位 overlay-svg。
 */
export function WellboreHifiFigure({ backendLevel, className = '' }: WellboreHifiFigureProps) {
  const showKick = backendLevel >= 2;
  const showNormal = backendLevel === 0;

  return (
    <div className={`relative w-full overflow-hidden rounded-xl bg-white ${className}`}>
      <img
        src={wellboreBaseUrl}
        alt="井筒状态剖面图"
        className="block h-full w-full object-contain select-none"
        draggable={false}
      />

      {/* 可选：动态覆盖层。坐标基于 crop 后 SVG viewBox: 1030 x 820 */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 1030 820"
        preserveAspectRatio="xMidYMid meet"
      >
        {showNormal && (
          <g>
            <rect x="715" y="575" width="220" height="38" rx="8" fill="#F0FDF4" stroke="#BBF7D0" />
            <circle cx="734" cy="594" r="5" fill="#10B981" />
            <text x="748" y="599" fontFamily="Microsoft YaHei, PingFang SC, Arial" fontSize="13" fontWeight="700" fill="#166534">
              未触发异常侵入证据
            </text>
          </g>
        )}

        {showKick && (
          <g>
            <path
              d="M520 590 C500 540 500 480 512 420"
              stroke="#DC2626"
              strokeWidth="3"
              strokeDasharray="8 6"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M640 590 C660 540 660 480 648 420"
              stroke="#DC2626"
              strokeWidth="3"
              strokeDasharray="8 6"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="585" cy="590" r="7" fill="#DC2626" />
          </g>
        )}
      </svg>
    </div>
  );
}

export default WellboreHifiFigure;
