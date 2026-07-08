import { createPortal } from 'react-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { BackendLevel, FlowDataPoint, PressureDataPoint, ThresholdSettings } from '../context/WellControlContext';
import { useIsDarkMode } from '../hooks/useChartTheme';

interface VerticalCurveDeckProps {
  flowData: FlowDataPoint[];
  pressureData: PressureDataPoint[];
  thresholds: ThresholdSettings;
  wellDepth?: number;
  currentDepth?: number;
  isStopped?: boolean;
  compact?: boolean;
  fillViewport?: boolean;
}

interface CurvePoint {
  time: string;
  depth: number;
  bitDepth: number;
  level: BackendLevel;
  eventId?: string | null;
  values: Record<string, number>;
}

interface TrackCurve {
  key: string;
  label: string;
  unit: string;
  color: string;
  range: [number, number];
  baseline?: number;
  warning?: number;
  critical?: number;
}

interface TrackConfig {
  title: string;
  subtitle?: string;
  width?: string;
  curves: TrackCurve[];
}

interface TrackHover {
  x: number;
  y: number;
  index: number;
  clientX: number;
  clientY: number;
}

interface AdaptiveRangeOptions {
  paddingRatio?: number;
  minSpan?: number;
  clampMin?: number;
  clampMax?: number;
  referenceValues?: Array<number | undefined>;
}

const AXIS_WIDTH = 108;
const MOBILE_AXIS_WIDTH = 94;
const MAX_RENDER_POINTS = 1800;
const PAD = { top: 10, right: 10, bottom: 12, left: 10 };
const COMPACT_PAD = { top: 8, right: 8, bottom: 8, left: 8 };
const MOBILE_PAD = { top: 7, right: 6, bottom: 7, left: 6 };

const CANVAS_PALETTE = {
  light: {
    bg: '#f6fafc',
    plot: '#fbfdff',
    header: '#eef4f7',
    divider: '#b9c8d4',
    title: '#1f2f46',
    empty: '#64748b',
    grid: 'rgba(148, 163, 184, 0.22)',
    gridMajor: 'rgba(100, 116, 139, 0.24)',
    ruler: '#cbd7e1',
    rulerMajor: '#64748b',
    rulerMinor: '#cbd7e1',
    axisText: '#475569',
    depth: '#0f766e',
    cursor: 'rgba(15, 23, 42, 0.36)',
    pointStroke: '#ffffff',
    underlay: 'transparent',
  },
  dark: {
    bg: '#081120',
    plot: '#081120',
    header: '#111827',
    divider: '#334155',
    title: '#e2e8f0',
    empty: '#64748b',
    grid: 'rgba(148, 163, 184, 0.12)',
    gridMajor: 'rgba(148, 163, 184, 0.18)',
    ruler: '#475569',
    rulerMajor: '#64748b',
    rulerMinor: '#334155',
    axisText: '#94a3b8',
    depth: '#5eead4',
    cursor: 'rgba(226, 232, 240, 0.24)',
    pointStroke: '#020617',
    underlay: 'transparent',
  },
};

function finite(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function fmt(value: number, digits = 1) {
  if (!Number.isFinite(value)) return '--';
  if (Math.abs(value) >= 100) return value.toFixed(0);
  return value.toFixed(digits).replace(/\.?0+$/, '');
}

function fmtWithUnit(value: number, digits: number, unit: string) {
  const formatted = fmt(value, digits);
  return formatted === '--' ? formatted : `${formatted} ${unit}`;
}

function fmtDepth(value: number) {
  return Number.isFinite(value) ? value.toFixed(0) : '--';
}

function fmtDepthWithUnit(value: number) {
  const formatted = fmtDepth(value);
  return formatted === '--' ? formatted : `${formatted}m`;
}

function timeLabel(value: string) {
  const parts = value.split(':');
  return parts.length >= 3 ? `${parts[0]}:${parts[1]}:${parts[2]}` : value;
}

function rangeTicks(range?: [number, number]) {
  if (!range) return [];
  const [min, max] = range;
  return [min, (min + max) / 2, max];
}

function TrackHeader({ config, isAxis, latest }: { config: TrackConfig; isAxis?: boolean; latest?: CurvePoint }) {
  const primaryCurve = config.curves[0];
  const accentColor = isAxis ? '#0f766e' : primaryCurve?.color || '#64748b';

  return (
    <div className={`vertical-lane-header ${isAxis ? 'vertical-lane-header-axis' : ''}`} style={{ borderTopColor: accentColor }}>
      <div className="vertical-lane-title" title={config.title}>{config.title}</div>
      {isAxis ? (
        <div className="vertical-axis-caption">时间向下 · 井深 / 钻头深度</div>
      ) : (
        <div className="vertical-curve-key-list">
          {config.curves.map((curve) => {
            const ticks = rangeTicks(curve.range);
            return (
              <div className="vertical-curve-key" key={curve.key} style={{ borderLeftColor: curve.color }}>
                <div className="vertical-curve-key-main">
                  <span className="vertical-curve-key-name" title={curve.label}>{curve.label}</span>
                  <strong style={{ color: curve.color }}>{latest ? fmt(latest.values[curve.key]) : '--'}</strong>
                  <span className="vertical-curve-key-unit" style={{ color: curve.color }}>{curve.unit}</span>
                </div>
                <div className="vertical-lane-scale" aria-hidden="true">
                  {ticks.map((tick, index) => <span key={index}>{fmt(tick)}</span>)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function niceStep(roughStep: number) {
  if (!Number.isFinite(roughStep) || roughStep <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(roughStep));
  const normalized = roughStep / magnitude;

  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  if (normalized <= 2.5) return 2.5 * magnitude;
  if (normalized <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function niceRange(values: number[], fallback: [number, number], options: AdaptiveRangeOptions = {}): [number, number] {
  const finiteValues = values.filter(Number.isFinite);
  if (finiteValues.length === 0) return fallback;

  let min = Math.min(...finiteValues);
  let max = Math.max(...finiteValues);
  let span = max - min;
  const midpoint = (min + max) / 2;
  const baseMinSpan = options.minSpan ?? Math.max(Math.abs(midpoint) * 0.15, (fallback[1] - fallback[0]) * 0.05, 1);

  if (span < baseMinSpan) {
    const halfSpan = baseMinSpan / 2;
    min = midpoint - halfSpan;
    max = midpoint + halfSpan;
    span = max - min;
  }

  const referenceWindow = Math.max(span, baseMinSpan);
  (options.referenceValues ?? []).forEach((value) => {
    if (!Number.isFinite(value)) return;
    if (value < min - referenceWindow || value > max + referenceWindow) return;
    min = Math.min(min, value);
    max = Math.max(max, value);
  });

  span = Math.max(max - min, baseMinSpan);
  const pad = span * (options.paddingRatio ?? 0.18);
  let paddedMin = min - pad;
  let paddedMax = max + pad;

  if (Number.isFinite(options.clampMin)) paddedMin = Math.max(options.clampMin as number, paddedMin);
  if (Number.isFinite(options.clampMax)) paddedMax = Math.min(options.clampMax as number, paddedMax);
  if (paddedMax - paddedMin < baseMinSpan) {
    const center = (paddedMin + paddedMax) / 2;
    const halfSpan = baseMinSpan / 2;
    paddedMin = center - halfSpan;
    paddedMax = center + halfSpan;
    if (Number.isFinite(options.clampMin)) paddedMin = Math.max(options.clampMin as number, paddedMin);
    if (Number.isFinite(options.clampMax)) paddedMax = Math.min(options.clampMax as number, paddedMax);
  }

  const step = niceStep((paddedMax - paddedMin) / 2);
  const niceMin = Math.floor(paddedMin / step) * step;
  const niceMax = Math.ceil(paddedMax / step) * step;
  return niceMax > niceMin ? [niceMin, niceMax] : fallback;
}

function useNarrowViewport() {
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const update = () => setIsNarrow(window.innerWidth < 640);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return isNarrow;
}

function buildTrackData(flowData: FlowDataPoint[], pressureData: PressureDataPoint[], wellDepth = 3200, currentDepth = 3200): CurvePoint[] {
  const maxLength = Math.max(flowData.length, pressureData.length);
  if (maxLength === 0) return [];
  const startDepth = Math.max(0, wellDepth - maxLength * 0.6);
  const currentBitDepth = Number.isFinite(currentDepth) ? currentDepth : wellDepth;
  return Array.from({ length: maxLength }).map((_, index) => {
    const flow = flowData[Math.max(0, index - (maxLength - flowData.length))];
    const pressure = pressureData[Math.max(0, index - (maxLength - pressureData.length))];
    const flowIn = finite(flow?.flowIn, 0);
    const flowOut = finite(flow?.flowOut, flowIn);
    const pitVolume = finite(flow?.pitVolume, Number.NaN);
    const casingPressure = finite(pressure?.casingPressure, 0);
    const drillPipePressure = finite(pressure?.drillPipePressure, 0);
    const spp = finite(pressure?.spp, drillPipePressure);
    const spm = finite(flow?.spm, 0);
    const totalGas = finite(flow?.totalGas, 0);
    const hookLoad = finite(flow?.hookLoad, 0);
    const wob = finite(flow?.wob, 0);
    const drillTime = finite(flow?.drillTime, 0);
    const rpm = finite(flow?.rpm, 0);
    const torque = finite(flow?.torque, 0);
    const bitDepth = finite(flow?.bitDepth, Math.max(0, currentBitDepth - (maxLength - index - 1) * 0.6));
    const level = (flow?.backendLevel ?? pressure?.backendLevel ?? 0) as BackendLevel;

    return {
      time: flow?.time || pressure?.time || '',
      depth: startDepth + index * 0.6,
      bitDepth,
      level,
      eventId: flow?.eventId ?? pressure?.eventId ?? null,
      values: {
        flowIn,
        flowOut,
        pitVolume: Number.isFinite(pitVolume) ? pitVolume : 0,
        casingPressure,
        drillPipePressure,
        spp,
        spm,
        totalGas,
        hookLoad,
        wob,
        drillTime,
        rpm,
        torque,
      },
    };
  });
}

function curvePointPriority(point: CurvePoint, previous?: CurvePoint) {
  const eventWeight = point.level >= 4 ? 1_000_000 : point.level >= 2 ? 500_000 : point.eventId ? 100_000 : 0;
  if (!previous) return eventWeight;
  const changeWeight = Object.keys(point.values).reduce((sum, key) => {
    const current = point.values[key];
    const prior = previous.values[key];
    return Number.isFinite(current) && Number.isFinite(prior) ? sum + Math.abs(current - prior) : sum;
  }, 0);
  return eventWeight + changeWeight;
}

function downsampleCurvePoints(points: CurvePoint[], maxPoints = MAX_RENDER_POINTS) {
  if (points.length <= maxPoints) return points;
  if (maxPoints < 3) return points.slice(-maxPoints);

  const sampled: CurvePoint[] = [points[0]];
  const bucketCount = maxPoints - 2;
  const bucketSize = (points.length - 2) / bucketCount;

  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = Math.max(1, Math.floor(1 + bucket * bucketSize));
    const end = Math.min(points.length - 1, Math.floor(1 + (bucket + 1) * bucketSize));
    let bestIndex = start;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (let index = start; index < end; index += 1) {
      const score = curvePointPriority(points[index], points[index - 1]);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    }

    const bestPoint = points[bestIndex];
    if (bestPoint && sampled[sampled.length - 1] !== bestPoint) sampled.push(bestPoint);
  }

  const lastPoint = points[points.length - 1];
  if (sampled[sampled.length - 1] !== lastPoint) sampled.push(lastPoint);
  return sampled;
}

function VerticalTrack({
  config,
  points,
  showAxis,
  isDark,
  compact = false,
  mobileDense = false,
  fillViewport = false,
}: {
  config: TrackConfig;
  points: CurvePoint[];
  showAxis?: boolean;
  isDark: boolean;
  compact?: boolean;
  mobileDense?: boolean;
  fillViewport?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sizeTick, setSizeTick] = useState(0);
  const [hover, setHover] = useState<TrackHover | null>(null);
  const isAxis = config.curves.length === 0;
  const palette = isDark ? CANVAS_PALETTE.dark : CANVAS_PALETTE.light;
  const pad = mobileDense ? MOBILE_PAD : compact ? COMPACT_PAD : PAD;

  useEffect(() => {
    const canvas = canvasRef.current;
    const parent = canvas?.parentElement;
    if (!parent || typeof ResizeObserver === 'undefined') return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setSizeTick((tick) => tick + 1));
    });
    observer.observe(parent);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const scaledW = Math.max(1, Math.round(w * dpr));
    const scaledH = Math.max(1, Math.round(h * dpr));
    canvas.width = scaledW;
    canvas.height = scaledH;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(scaledW / w, scaledH / h);
    ctx.clearRect(0, 0, w, h);

    ctx.fillStyle = palette.plot;
    ctx.fillRect(0, 0, w, h);

    if (points.length < 2) {
      ctx.fillStyle = palette.empty;
      ctx.font = `${mobileDense ? '800 10px' : '800 12px'} 'Microsoft YaHei', sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('等待数据', w / 2, h / 2);
      return;
    }

    const plotX = pad.left;
    const plotY = pad.top;
    const plotW = w - pad.left - pad.right;
    const plotH = h - pad.top - pad.bottom;
    const yForIndex = (index: number) => plotY + (index / (points.length - 1)) * plotH;
    const latest = points[points.length - 1];

    const eventBandMap = new Map<string, { start: number; end: number; level: BackendLevel; eventId: string }>();
    points.forEach((point, index) => {
      if (!point.eventId || point.level < 2) return;
      const existing = eventBandMap.get(point.eventId);
      if (existing) {
        existing.start = Math.min(existing.start, index);
        existing.end = Math.max(existing.end, index);
        existing.level = Math.max(existing.level, point.level) as BackendLevel;
        return;
      }
      eventBandMap.set(point.eventId, { start: index, end: index, level: point.level, eventId: point.eventId });
    });
    const eventBands = [...eventBandMap.values()].sort((a, b) => a.start - b.start);
    eventBands.forEach((band) => {
      const y1 = yForIndex(band.start);
      const y2 = yForIndex(Math.min(points.length - 1, band.end + 1));
      const height = Math.max(2, y2 - y1);
      ctx.fillStyle = band.level >= 4
        ? 'rgba(239, 68, 68, 0.075)'
        : band.level >= 3
          ? 'rgba(249, 115, 22, 0.045)'
          : 'rgba(245, 158, 11, 0.032)';
      ctx.fillRect(plotX, y1, plotW, height);
    });

    ctx.lineWidth = 0.7;
    for (let i = 0; i <= 6; i += 1) {
      const y = plotY + (plotH * i) / 6;
      ctx.strokeStyle = i % 3 === 0 ? palette.gridMajor : palette.grid;
      ctx.beginPath();
      ctx.moveTo(plotX, y);
      ctx.lineTo(plotX + plotW, y);
      ctx.stroke();
    }
    for (let i = 0; i <= 4; i += 1) {
      const x = plotX + (plotW * i) / 4;
      ctx.strokeStyle = i % 2 === 0 ? palette.gridMajor : palette.grid;
      ctx.beginPath();
      ctx.moveTo(x, plotY);
      ctx.lineTo(x, plotY + plotH);
      ctx.stroke();
    }

    config.curves.forEach((curve, curveIndex) => {
      const [min, max] = curve.range;
      const inRange = (value?: number) => Number.isFinite(value) && (value as number) >= min && (value as number) <= max;
      const xForValue = (value: number) => {
        const clamped = Math.max(min, Math.min(max, value));
        return plotX + ((clamped - min) / (max - min)) * plotW;
      };

      if (inRange(curve.baseline)) {
        const baseX = xForValue(curve.baseline as number);
        ctx.strokeStyle = curve.color;
        ctx.globalAlpha = 0.3;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(baseX, plotY);
        ctx.lineTo(baseX, plotY + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      if (inRange(curve.warning)) {
        const warnX = xForValue(curve.warning as number);
        ctx.strokeStyle = '#f59e0b';
        ctx.globalAlpha = 0.5;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(warnX, plotY);
        ctx.lineTo(warnX, plotY + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      if (inRange(curve.critical)) {
        const critX = xForValue(curve.critical as number);
        ctx.strokeStyle = '#dc2626';
        ctx.globalAlpha = 0.56;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(critX, plotY);
        ctx.lineTo(critX, plotY + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      points.forEach((point, index) => {
        const x = xForValue(finite(point.values[curve.key], 0));
        const y = yForIndex(index);
        if (index === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.strokeStyle = curve.color;
      ctx.lineWidth = curveIndex === 0 ? 2.15 : 1.8;
      ctx.stroke();

      const latestX = xForValue(finite(latest.values[curve.key], 0));
      const latestY = yForIndex(points.length - 1);
      ctx.fillStyle = curve.color;
      ctx.beginPath();
      ctx.arc(latestX, latestY, curveIndex === 0 ? 3.5 : 2.7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = palette.pointStroke;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    });

    const cursorY = yForIndex(points.length - 1);
    ctx.strokeStyle = palette.cursor;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(0, cursorY);
    ctx.lineTo(w, cursorY);
    ctx.stroke();
    ctx.setLineDash([]);

    if (showAxis) {
      const labelHeight = mobileDense ? 38 : 44;
      const minGap = mobileDense ? 52 : 58;
      const rulerX = w - 10;
      const labelW = Math.max(72, w - 24);
      const tickIndices = [0, 0.25, 0.5, 0.75, 1].map((ratio) =>
        Math.min(points.length - 1, Math.round((points.length - 1) * ratio)),
      );
      const placed: number[] = [];

      ctx.strokeStyle = palette.ruler;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(rulerX, plotY);
      ctx.lineTo(rulerX, plotY + plotH);
      ctx.stroke();

      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';

      tickIndices.forEach((index) => {
        const point = points[index];
        const tickY = yForIndex(index);
        const y = Math.min(plotY + plotH - labelHeight - 4, Math.max(plotY + 4, tickY - labelHeight / 2));
        if (placed.some((previousY) => Math.abs(previousY - y) < minGap)) return;
        placed.push(y);

        ctx.strokeStyle = palette.rulerMinor;
        ctx.lineWidth = 0.9;
        ctx.beginPath();
        ctx.moveTo(rulerX - 8, tickY);
        ctx.lineTo(rulerX, tickY);
        ctx.stroke();

        ctx.fillStyle = palette.axisText;
        ctx.font = `${mobileDense ? '8.5px' : '9.5px'} 'JetBrains Mono', monospace`;
        ctx.fillText(timeLabel(point.time), 14, y + 5);
        ctx.fillStyle = palette.depth;
        ctx.font = `700 ${mobileDense ? '8.5px' : '9.5px'} 'JetBrains Mono', monospace`;
        ctx.fillText(`井深 ${fmtDepthWithUnit(point.depth)}`, 14, y + (mobileDense ? 17 : 19));
        ctx.fillStyle = palette.axisText;
        ctx.font = `700 ${mobileDense ? '8px' : '9px'} 'JetBrains Mono', monospace`;
        ctx.fillText(`钻头 ${fmtDepthWithUnit(point.bitDepth)}`, 14, y + (mobileDense ? 27 : 31));
      });
    }
  }, [config, points, showAxis, palette, compact, mobileDense, pad, sizeTick]);

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || points.length < 1) return;
    const rect = canvas.getBoundingClientRect();
    const y = event.clientY - rect.top;
    const plotH = Math.max(1, rect.height - pad.top - pad.bottom);
    const ratio = Math.max(0, Math.min(1, (y - pad.top) / plotH));
    const index = Math.round(ratio * Math.max(0, points.length - 1));
    setHover({ x: event.clientX - rect.left, y: event.clientY - rect.top, clientX: event.clientX, clientY: event.clientY, index });
  };

  const hoverPoint = hover ? points[hover.index] : null;
  const tooltipX = hover ? Math.min(hover.clientX + 12, window.innerWidth - 190) : 0;
  const tooltipY = hover ? Math.min(hover.clientY + 12, window.innerHeight - 150) : 0;

  const latest = points.at(-1);
  const flexValue = fillViewport
    ? isAxis
      ? `0 0 ${mobileDense ? 76 : 92}px`
      : '1 1 0px'
    : config.width || '1 1 122px';
  const basisMatch = /(\d+(?:\.\d+)?)px$/.exec(flexValue);
  const basisWidth = basisMatch ? Number(basisMatch[1]) : 122;
  const laneMinWidth = fillViewport
    ? isAxis
      ? mobileDense ? 76 : 92
      : mobileDense ? 60 : 88
    : isAxis
      ? mobileDense ? MOBILE_AXIS_WIDTH : AXIS_WIDTH
      : mobileDense ? Math.max(104, basisWidth) : Math.max(118, basisWidth);

  return (
    <div
      className="vertical-lane h-full overflow-hidden"
      data-axis={isAxis ? 'true' : undefined}
      style={{ flex: flexValue, minWidth: `${laneMinWidth}px` }}
    >
      <TrackHeader config={config} isAxis={isAxis} latest={latest} />
      <div className="vertical-lane-canvas relative">
        <canvas
          ref={canvasRef}
          className="block h-full w-full"
          role="img"
          aria-label={`${isAxis ? '时间井深轴' : config.title}，当前样本 ${points.length} 条`}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => setHover(null)}
        />
        {hoverPoint ? createPortal(
          <div className="vertical-lane-tooltip vertical-lane-tooltip-fixed" style={{ left: tooltipX, top: tooltipY }}>
            <div className="font-semibold">{timeLabel(hoverPoint.time)}</div>
            {isAxis ? (
              <>
                <div>井深 {fmtDepthWithUnit(hoverPoint.depth)}</div>
                <div>钻头 {fmtDepthWithUnit(hoverPoint.bitDepth)}</div>
              </>
            ) : config.curves.map((curve) => (
              <div key={curve.key} className="flex items-center justify-between gap-3">
                <span>{curve.label}</span>
                <span className="tabular-nums">{fmtWithUnit(hoverPoint.values[curve.key], 1, curve.unit)}</span>
              </div>
            ))}
          </div>,
          document.body,
        ) : null}
      </div>
    </div>
  );
}

function AxisLane({ points, compact, mobileDense }: { points: CurvePoint[]; compact?: boolean; mobileDense?: boolean }) {
  const isDark = useIsDarkMode();
  return (
    <VerticalTrack
      config={{
        title: '时间/井深',
        width: mobileDense ? `0 0 ${MOBILE_AXIS_WIDTH}px` : `0 0 ${AXIS_WIDTH}px`,
        curves: [],
      }}
      points={points}
      isDark={isDark}
      showAxis
      compact={compact}
      mobileDense={mobileDense}
      fillViewport
    />
  );
}

export function VerticalCurveDeck({
  flowData,
  pressureData,
  thresholds,
  wellDepth,
  currentDepth,
  isStopped = false,
  compact = false,
  fillViewport = false,
}: VerticalCurveDeckProps) {
  const isDark = useIsDarkMode();
  const mobileDense = useNarrowViewport() && compact;
  const fillTracks = fillViewport && !mobileDense;
  const points = useMemo(() => buildTrackData(flowData, pressureData, wellDepth ?? currentDepth ?? 3200, currentDepth), [flowData, pressureData, wellDepth, currentDepth]);
  const renderPoints = useMemo(() => downsampleCurvePoints(points), [points]);
  const latestPoint = points.at(-1);
  const isDownsampled = renderPoints.length < points.length;
  const eventStats = useMemo(() => {
    const byId = new Map<string, BackendLevel>();
    points.forEach((point) => {
      if (!point.eventId || point.level < 2) return;
      byId.set(point.eventId, Math.max(byId.get(point.eventId) || 0, point.level) as BackendLevel);
    });
    const levels = [...byId.values()];
    return {
      warningCount: levels.filter((level) => level === 2 || level === 3).length,
      criticalCount: levels.filter((level) => level >= 4).length,
    };
  }, [points]);
  const pitVolumeValues = points.map((point) => point.values.pitVolume);
  const flowValues = points.flatMap((point) => [point.values.flowIn, point.values.flowOut]);
  const casingValues = points.map((point) => point.values.casingPressure);
  const sppValues = points.map((point) => point.values.spp);
  const spmValues = points.map((point) => point.values.spm);
  const gasValues = points.map((point) => point.values.totalGas);
  const hookValues = points.map((point) => point.values.hookLoad);
  const wobValues = points.map((point) => point.values.wob);
  const drillTimeValues = points.map((point) => point.values.drillTime);
  const rpmValues = points.map((point) => point.values.rpm);
  const torqueValues = points.map((point) => point.values.torque);

  const tracks: TrackConfig[] = [
    {
      title: '流量',
      width: '1.15 1 150px',
      curves: [
        { key: 'flowOut', label: '出口流量', unit: 'L/s', color: '#dc2626', range: niceRange(flowValues, [0, 100], { clampMin: 0 }) },
        { key: 'flowIn', label: '入口流量', unit: 'L/s', color: '#2563eb', range: niceRange(flowValues, [0, 100], { clampMin: 0 }) },
      ],
    },
    {
      title: '池体积',
      width: '1 1 136px',
      curves: [
        { key: 'pitVolume', label: '总池体积', unit: 'm3', color: '#0891b2', range: niceRange(pitVolumeValues, [0, 160], { paddingRatio: 0.08, minSpan: 2, clampMin: 0 }) },
      ],
    },
    {
      title: '压力',
      width: '1 1 142px',
      curves: [
        { key: 'spp', label: '立压', unit: 'MPa', color: '#0f766e', range: niceRange(sppValues, [0, 25], { clampMin: 0 }) },
        { key: 'casingPressure', label: '套压', unit: 'MPa', color: '#ea580c', range: niceRange(casingValues, [0, thresholds.casingPressureWarning + 0.8], { clampMin: 0, referenceValues: [thresholds.casingPressureWarning] }), warning: thresholds.casingPressureWarning },
      ],
    },
    {
      title: '钻进载荷',
      width: '1.08 1 148px',
      curves: [
        { key: 'hookLoad', label: '大钩负荷', unit: 'kN', color: '#475569', range: niceRange(hookValues, [180, 340], { clampMin: 0 }) },
        { key: 'wob', label: '钻压', unit: 'kN', color: '#16a34a', range: niceRange(wobValues, [0, 180], { clampMin: 0 }) },
      ],
    },
    {
      title: '钻进参数',
      width: '1.12 1 154px',
      curves: [
        { key: 'drillTime', label: '钻时', unit: 'min/m', color: '#65a30d', range: niceRange(drillTimeValues, [0, 5], { clampMin: 0, minSpan: 0.5 }) },
        { key: 'rpm', label: '转盘转速', unit: 'rpm', color: '#ca8a04', range: niceRange(rpmValues, [0, 120], { clampMin: 0, minSpan: 5 }) },
        { key: 'torque', label: '扭矩', unit: 'kN·m', color: '#d97706', range: niceRange(torqueValues, [0, 40], { clampMin: 0, minSpan: 2 }) },
      ],
    },
    {
      title: '泵冲',
      width: '0.78 1 104px',
      curves: [
        { key: 'spm', label: '总泵冲', unit: 'spm', color: '#7c3aed', range: niceRange(spmValues, [0, 96], { clampMin: 0, minSpan: 5 }) },
      ],
    },
    {
      title: '气测',
      width: '0.84 1 108px',
      curves: [
        { key: 'totalGas', label: '全烃', unit: '%', color: '#16a34a', range: niceRange(gasValues, [0, 3.6], { clampMin: 0, referenceValues: [1.5, 2.8] }), warning: 1.5, critical: 2.8 },
      ],
    },
  ];

  const displayTracks = mobileDense
    ? tracks
      .filter((track) => ['流量', '池体积', '压力', '钻进载荷', '钻进参数', '泵冲', '气测'].includes(track.title))
      .map((track) => ({ ...track, width: '0 0 128px' }))
    : tracks.map((track) => (fillViewport ? { ...track, width: '1 1 0px' } : track));

  return (
    <div
      className="vertical-curve-deck relative flex h-full min-h-[360px] flex-col overflow-hidden rounded-md border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-950"
      data-fill-viewport={fillTracks ? 'true' : undefined}
    >
      <div className="border-b border-slate-200 px-3 py-1.5 dark:border-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
            <span>样本 {points.length}</span>
            {isDownsampled ? <span>绘制 {renderPoints.length}</span> : null}
            <span>预警事件 {eventStats.warningCount}</span>
            <span>确认事件 {eventStats.criticalCount}</span>
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400">
            {latestPoint?.time ? `最新 ${timeLabel(latestPoint.time)} · ` : ''}30min 窗口 · 时间向下
          </div>
        </div>
      </div>
      <div className={`vertical-curve-body flex min-h-0 flex-1 overflow-y-hidden ${fillTracks ? 'overflow-x-hidden' : 'overflow-x-auto'}`}>
        <AxisLane points={renderPoints} compact={compact} mobileDense={mobileDense} />
        {displayTracks.map((track) => (
          <VerticalTrack
            key={track.title}
            config={track}
            points={renderPoints}
            isDark={isDark}
            compact={compact}
            mobileDense={mobileDense}
            fillViewport={fillTracks}
          />
        ))}
      </div>
      {points.length < 2 && (
        <div
          className="pointer-events-none absolute inset-x-4 bottom-4 rounded-md border border-slate-300 bg-white/96 p-3 text-slate-700 shadow-lg shadow-slate-900/10 backdrop-blur dark:border-slate-700 dark:bg-slate-950/90 dark:text-slate-200"
          role="status"
          aria-live="polite"
        >
          <div className="text-sm">{isStopped ? '监测已停' : '等待采样'}</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {isStopped ? '当前井已手动停止监测；保留历史点位，重新启动后继续刷新趋势曲线。' : '启动监测并收到至少 2 条样本后生成趋势曲线。'}
          </div>
        </div>
      )}
    </div>
  );
}
