import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CircleOff,
  Database,
  Gauge,
  Layers3,
  LoaderCircle,
  Pencil,
  Route,
  Ruler,
  Wrench,
} from 'lucide-react';
import {
  getManagedWellbore,
  getWellProfile,
  updateWellProfile,
  type WellProfile,
  type WellProfileMutationRequest,
} from '../api/wellManagementApi';
import type {
  BhaIntervalProfile,
  TrajectorySurveyProfile,
  WellboreProfile,
} from '../api/wellboreProfileApi';
import { WellProfileFormDialog } from '../components/WellProfileFormDialog';
import { WellboreSchemaFigure } from '../components/WellboreSchemaFigure';
import { Button } from '../components/ui/button';
import { normalizeWellboreStructureSections } from '../lib/wellboreSimulation';

const WELL_TYPE_LABELS: Record<string, string> = {
  unknown: '井型未定',
  vertical: '直井',
  directional: '定向井',
  horizontal: '水平井',
  直井: '直井',
  定向井: '定向井',
  水平井: '水平井',
};

const STATUS_LABELS: Record<string, string> = {
  active: '在用',
  suspended: '暂停',
  completed: '完井',
  inactive: '停用',
};

function emptyProfile(): WellboreProfile {
  return { wellId: 0, wellKey: '', targetLayer: '', sections: [], trajectory: [], bhaIntervals: [], bhaComponents: [] };
}

function valueOrDash(value?: string | null) {
  return value?.trim() || '—';
}

function formatNumber(value?: number | null, digits = 0, unit = '') {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits })}${unit ? ` ${unit}` : ''}`;
}

function latestTrajectory(items: TrajectorySurveyProfile[]) {
  return items.reduce<TrajectorySurveyProfile | undefined>((latest, item) => !latest || item.measuredDepthM > latest.measuredDepthM ? item : latest, undefined);
}

function latestBha(items: BhaIntervalProfile[]) {
  return items.reduce<BhaIntervalProfile | undefined>((latest, item) => (item.endDepthM || item.startDepthM || 0) > (latest?.endDepthM || latest?.startDepthM || 0) ? item : latest, undefined);
}

function SummaryCard({ icon: Icon, label, value, hint }: { icon: typeof Database; label: string; value: string; hint: string }) {
  return <div className="ops-stat-card">
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs ops-muted">{label}</span>
      <Icon className="h-4 w-4 text-cyan-600" />
    </div>
    <strong>{value}</strong>
    <div className="text-xs ops-muted">{hint}</div>
  </div>;
}

function InfoItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return <div className="ops-inline-tile min-w-0 p-3">
    <div className="text-[11px] ops-muted">{label}</div>
    <div className={`mt-1 break-words text-sm font-medium text-slate-900 dark:text-slate-100 ${mono ? 'font-mono' : ''}`}>{value}</div>
  </div>;
}

export default function WellManagementDetail() {
  const { id } = useParams();
  const [profile, setProfile] = useState<WellProfile | null>(null);
  const [wellbore, setWellbore] = useState<WellboreProfile>(emptyProfile);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [structureError, setStructureError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!id) {
      setError('井 ID 无效。');
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setStructureError('');
    getWellProfile(id, controller.signal)
      .then((well) => {
        setProfile(well);
        return getManagedWellbore(id, controller.signal)
          .then(setWellbore)
          .catch((reason) => {
            if (!controller.signal.aborted) setStructureError(reason instanceof Error ? reason.message : '工程结构读取失败');
          });
      })
      .catch((reason) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '井档案读取失败');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [id]);

  const sections = useMemo(() => normalizeWellboreStructureSections(wellbore.sections), [wellbore.sections]);
  const trajectory = useMemo(() => latestTrajectory(wellbore.trajectory), [wellbore.trajectory]);
  const bha = useMemo(() => latestBha(wellbore.bhaIntervals), [wellbore.bhaIntervals]);
  const activeComponents = useMemo(() => {
    if (!bha) return wellbore.bhaComponents;
    const matching = wellbore.bhaComponents.filter((item) => item.bhaIntervalId === bha.bhaIntervalId);
    return matching.length ? matching : wellbore.bhaComponents;
  }, [bha, wellbore.bhaComponents]);

  const depth = Math.max(
    profile?.registeredDepthMax || 0,
    ...sections.map((section) => section.bottomDepthM || 0),
    ...wellbore.trajectory.map((item) => item.measuredDepthM || 0),
  );
  const casingShoeDepth = Math.max(0, ...sections.filter((section) => section.kind === 'casing').map((section) => section.bottomDepthM || 0));
  const bit = activeComponents.find((item) => /钻头|\bbit\b/i.test(`${item.componentName} ${item.specModel}`));
  const drillPipe = activeComponents.find((item) => /钻杆|drill\s*pipe|\bdp\b/i.test(`${item.componentName} ${item.specModel}`));
  const bhaOd = activeComponents
    .filter((item) => item !== bit && item !== drillPipe)
    .reduce((max, item) => Math.max(max, item.outerDiameterMm || 0), 0);

  const save = async (request: WellProfileMutationRequest) => {
    if (!profile) return;
    setSaving(true);
    setEditError('');
    setFeedback('');
    try {
      const updated = await updateWellProfile(profile.wellId, request);
      setProfile(updated);
      setEditOpen(false);
      setFeedback('井基础信息已更新。');
    } catch (reason) {
      setEditError(reason instanceof Error ? reason.message : '保存井信息失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="ops-page flex min-h-80 items-center justify-center gap-2 ops-muted">
    <LoaderCircle className="h-4 w-4 animate-spin" />正在读取井档案与工程资料…
  </div>;

  if (error || !profile) return <div className="ops-page space-y-4">
    <Button asChild variant="ghost" size="sm"><Link to="/well-management"><ArrowLeft />返回井管理</Link></Button>
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300">
      <div className="flex items-center gap-2 font-medium"><AlertCircle className="h-4 w-4" />无法打开井详情</div>
      <p className="mt-1 text-sm">{error || '未找到该井。'}</p>
    </div>
  </div>;

  const coverageCount = [
    wellbore.sections.length > 0,
    wellbore.trajectory.length > 0,
    wellbore.bhaIntervals.length > 0,
    wellbore.bhaComponents.length > 0,
    profile.hasAlgorithmProfile,
    Boolean(profile.realtimeTableName),
  ].filter(Boolean).length;

  return <div className="ops-page space-y-4">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2"><Link to="/well-management"><ArrowLeft />返回井管理</Link></Button>
        <div className="ops-eyebrow">井档案详情</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="ops-title">{profile.wellName}</h1>
          <span className="font-mono text-sm ops-muted">{profile.wellCode} · #{profile.wellId}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2 text-xs">
          <span className="rounded bg-emerald-50 px-2 py-1 font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">{STATUS_LABELS[profile.wellStatus] || profile.wellStatus || '状态未填'}</span>
          <span className="ops-inline-tile px-2 py-1">{WELL_TYPE_LABELS[profile.wellType] || profile.wellType}</span>
          <span className="ops-inline-tile px-2 py-1">资料质量 {profile.qualityGrade || '未评定'}</span>
          <span className="ops-inline-tile px-2 py-1">资料覆盖 {coverageCount}/6</span>
        </div>
      </div>
      <Button variant="outline" onClick={() => { setEditError(''); setEditOpen(true); }}><Pencil />编辑基础信息</Button>
    </div>

    {feedback && <div role="status" className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-300">
      <CheckCircle2 className="h-4 w-4" />{feedback}
    </div>}
    {structureError && <div role="alert" className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-950 dark:bg-amber-950/30 dark:text-amber-300">
      <AlertCircle className="h-4 w-4" />基础档案已读取，但工程结构加载失败：{structureError}
    </div>}

    <div className="ops-stat-grid">
      <SummaryCard icon={Ruler} label="登记最大井深" value={formatNumber(depth || null, 0, 'm')} hint={profile.realtimeTableName ? '综合实时数据与工程资料' : '依据现有工程资料'} />
      <SummaryCard icon={Layers3} label="井身结构" value={`${sections.length} 段`} hint={casingShoeDepth > 0 ? `最深套管鞋 ${formatNumber(casingShoeDepth, 0, 'm')}` : '尚无有效套管段'} />
      <SummaryCard icon={Route} label="轨迹测点" value={`${wellbore.trajectory.length} 个`} hint={trajectory ? `末测点 MD ${formatNumber(trajectory.measuredDepthM, 0, 'm')}` : '尚未导入测斜数据'} />
      <SummaryCard icon={Wrench} label="BHA 资料" value={`${wellbore.bhaIntervals.length} 段`} hint={`${wellbore.bhaComponents.length} 件组件`} />
    </div>

    <section className="ops-surface p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Database className="h-4 w-4 text-cyan-600" />基础信息与数据关联</div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <InfoItem label="区块" value={valueOrDash(profile.blockName)} />
        <InfoItem label="油气田 / 作业区" value={valueOrDash(profile.fieldName)} />
        <InfoItem label="目的层" value={valueOrDash(profile.targetLayer)} />
        <InfoItem label="实时数据集" value={valueOrDash(profile.realtimeTableName)} mono />
      </div>
    </section>

    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_380px]">
      <section className="ops-surface overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <div className="text-sm font-medium">井筒结构</div>
            <div className="mt-0.5 text-xs ops-muted">按现有 wellbore_section 数据等比例渲染</div>
          </div>
          {sections.length > 0 && <span className="rounded bg-cyan-50 px-2 py-1 text-xs text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300">{sections.length} 个有效结构段</span>}
        </div>
        {sections.length > 0 ? <div className="h-[560px] p-3">
          <WellboreSchemaFigure
            mode="detail"
            backendLevel={0}
            wellDepth={Math.max(depth, 1)}
            bitDepth={Math.max(depth, 1)}
            casingShoeDepth={casingShoeDepth || undefined}
            drillPipeOD={drillPipe?.outerDiameterMm}
            bhaOD={bhaOd || undefined}
            bitOD={bit?.outerDiameterMm}
            openHoleDiameter={bha?.holeSizeMm || sections.at(-1)?.holeSizeMm}
            formation={sections.at(-1)?.formation || profile.targetLayer || ''}
            wellboreSections={sections}
            inclination={trajectory?.inclinationDeg}
            highSideDirection={trajectory?.azimuthDeg}
            flowIn={0}
            flowOut={0}
            spm={0}
            casingPressure={0}
            drillPipePressure={0}
            pitGain={0}
            pitVolume={0}
            totalGas={0}
            returnResponse={0}
            mudWeight={0}
            hasSamples={false}
            isStopped
          />
        </div> : <div className="ops-empty-state m-3 min-h-[360px]">
          <div className="text-center">
            <CircleOff className="mx-auto mb-3 h-8 w-8 text-slate-400" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200">暂无可渲染的井身结构</p>
            <p className="mt-1 max-w-sm text-xs ops-muted">基础档案可以继续编辑；导入现有 wellbore_section 数据后，此处会自动生成井筒结构图。</p>
          </div>
        </div>}
      </section>

      <aside className="space-y-4">
        <section className="ops-surface p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Route className="h-4 w-4 text-cyan-600" />末测斜点</div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <InfoItem label="测深 MD / 垂深 TVD" value={`${formatNumber(trajectory?.measuredDepthM, 0)} / ${formatNumber(trajectory?.verticalDepthM, 0)} m`} />
            <InfoItem label="井斜角 / 方位角" value={`${formatNumber(trajectory?.inclinationDeg, 1)}° / ${formatNumber(trajectory?.azimuthDeg, 1)}°`} />
            <InfoItem label="狗腿度" value={`${formatNumber(trajectory?.doglegSeverityDeg30m, 2)} °/30m`} />
          </div>
        </section>

        <section className="ops-surface p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Wrench className="h-4 w-4 text-cyan-600" />当前最深 BHA 区间</div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <InfoItem label="BHA 编号" value={valueOrDash(bha?.bhaNo)} />
            <InfoItem label="深度范围" value={`${formatNumber(bha?.startDepthM, 0)} – ${formatNumber(bha?.endDepthM, 0)} m`} />
            <InfoItem label="组合类型 / 用途" value={`${valueOrDash(bha?.assemblyType)} / ${valueOrDash(bha?.assemblyPurpose)}`} />
            <InfoItem label="井眼尺寸 / 组件" value={`${formatNumber(bha?.holeSizeMm, 1)} mm / ${activeComponents.length} 件`} />
          </div>
        </section>

        <section className="ops-surface p-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium"><Gauge className="h-4 w-4 text-cyan-600" />规范表覆盖</div>
          <div className="space-y-2">
            {[
              ['井身结构', 'wellbore_section', wellbore.sections.length],
              ['轨迹测斜', 'well_trajectory_survey', wellbore.trajectory.length],
              ['BHA 区间', 'bha_interval', wellbore.bhaIntervals.length],
              ['BHA 组件', 'bha_component', wellbore.bhaComponents.length],
            ].map(([label, table, count]) => <div key={String(table)} className="ops-inline-tile flex items-center justify-between gap-3 px-3 py-2">
              <div className="min-w-0">
                <div className="text-sm">{label}</div>
                <div className="truncate font-mono text-[10px] ops-muted">{table}</div>
              </div>
              <span className={`rounded px-2 py-1 text-xs ${Number(count) > 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{count} 条</span>
            </div>)}
          </div>
        </section>
      </aside>
    </div>

    {sections.length > 0 && <section className="ops-surface overflow-hidden">
      <div className="border-b border-slate-200 px-4 py-3 text-sm font-medium dark:border-slate-800">井身结构明细</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-900/60">
            <tr><th className="px-4 py-3 font-medium">序号</th><th className="px-4 py-3 font-medium">结构类型</th><th className="px-4 py-3 font-medium">底深</th><th className="px-4 py-3 font-medium">井眼尺寸</th><th className="px-4 py-3 font-medium">地层</th></tr>
          </thead>
          <tbody>{sections.map((section, index) => <tr key={`${section.kind}-${section.bottomDepthM}-${index}`} className="border-t border-slate-100 dark:border-slate-800">
            <td className="px-4 py-3 text-xs ops-muted">{index + 1}</td>
            <td className="px-4 py-3 font-medium">{section.label || (section.kind === 'casing' ? '套管段' : '裸眼段')}</td>
            <td className="px-4 py-3 tabular-nums">{formatNumber(section.bottomDepthM, 0, 'm')}</td>
            <td className="px-4 py-3 tabular-nums">{formatNumber(section.holeSizeMm, 1, 'mm')}</td>
            <td className="px-4 py-3">{valueOrDash(section.formation)}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>}

    <WellProfileFormDialog
      open={editOpen}
      profile={profile}
      busy={saving}
      error={editError}
      onOpenChange={(open) => {
        setEditOpen(open);
        if (!open) setEditError('');
      }}
      onSubmit={save}
    />
  </div>;
}
