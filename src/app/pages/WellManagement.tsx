import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Database,
  FilePlus2,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react';
import {
  createWellProfile,
  deleteWellProfile,
  listWellProfiles,
  updateWellProfile,
  type WellProfile,
  type WellProfileMutationRequest,
} from '../api/wellManagementApi';
import { WellProfileFormDialog } from '../components/WellProfileFormDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';

const WELL_TYPE_LABELS: Record<string, string> = {
  unknown: '井型未定',
  vertical: '直井',
  directional: '定向井',
  horizontal: '水平井',
  直井: '直井',
  定向井: '定向井',
  水平井: '水平井',
};

const WELL_STATUS_META: Record<string, { label: string; className: string }> = {
  active: { label: '在用', className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' },
  suspended: { label: '暂停', className: 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300' },
  completed: { label: '完井', className: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300' },
  inactive: { label: '停用', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
};

function statusMeta(status: string) {
  return WELL_STATUS_META[status] || { label: status || '状态未填', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' };
}

function structureCoverage(profile: WellProfile) {
  return [
    { label: '井身', value: profile.sectionCount },
    { label: '测斜', value: profile.trajectoryCount },
    { label: 'BHA', value: profile.bhaIntervalCount },
    { label: '组件', value: profile.bhaComponentCount },
  ];
}

function StatCard({ label, value, description }: { label: string; value: string; description: string }) {
  return <div className="ops-stat-card">
    <div className="text-xs ops-muted">{label}</div>
    <strong>{value}</strong>
    <div className="text-xs ops-muted">{description}</div>
  </div>;
}

export default function WellManagement() {
  const [profiles, setProfiles] = useState<WellProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [feedback, setFeedback] = useState('');
  const [query, setQuery] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<WellProfile | null>(null);
  const [formError, setFormError] = useState('');
  const [pendingDelete, setPendingDelete] = useState<WellProfile | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const reload = async (signal?: AbortSignal) => {
    setLoading(true);
    setLoadError('');
    try {
      setProfiles(await listWellProfiles(signal));
    } catch (reason) {
      if (!signal?.aborted) setLoadError(reason instanceof Error ? reason.message : '井资料读取失败');
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, []);

  const filteredProfiles = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('zh-CN');
    if (!keyword) return profiles;
    return profiles.filter((profile) => [
      profile.wellName,
      profile.wellCode,
      profile.blockName,
      profile.fieldName,
      profile.targetLayer,
      WELL_TYPE_LABELS[profile.wellType] || profile.wellType,
      statusMeta(profile.wellStatus).label,
    ].some((value) => String(value || '').toLocaleLowerCase('zh-CN').includes(keyword)));
  }, [profiles, query]);

  const stats = useMemo(() => ({
    structured: profiles.filter((profile) => profile.sectionCount > 0).length,
    realtime: profiles.filter((profile) => Boolean(profile.realtimeTableName)).length,
    complete: profiles.filter((profile) => profile.sectionCount > 0 && profile.trajectoryCount > 0 && profile.bhaIntervalCount > 0).length,
  }), [profiles]);

  const openCreate = () => {
    setEditingProfile(null);
    setFormError('');
    setFormOpen(true);
  };

  const openEdit = (profile: WellProfile) => {
    setEditingProfile(profile);
    setFormError('');
    setFormOpen(true);
  };

  const save = async (request: WellProfileMutationRequest) => {
    setSaving(true);
    setFormError('');
    setFeedback('');
    try {
      const saved = editingProfile
        ? await updateWellProfile(editingProfile.wellId, request)
        : await createWellProfile(request);
      setProfiles((current) => {
        const next = editingProfile
          ? current.map((profile) => profile.wellId === saved.wellId ? saved : profile)
          : [...current, saved];
        return next.sort((a, b) => a.wellName.localeCompare(b.wellName, 'zh-CN'));
      });
      setFormOpen(false);
      setFeedback(editingProfile ? `已保存“${saved.wellName}”的修改。` : `已创建“${saved.wellName}”。`);
      setEditingProfile(null);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : editingProfile ? '修改井失败' : '新增井失败');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    setFeedback('');
    try {
      await deleteWellProfile(pendingDelete.wellId);
      setProfiles((current) => current.filter((profile) => profile.wellId !== pendingDelete.wellId));
      setFeedback(`已删除“${pendingDelete.wellName}”。`);
      setPendingDelete(null);
    } catch (reason) {
      setLoadError(reason instanceof Error ? reason.message : '删除井失败');
    } finally {
      setDeleting(false);
    }
  };

  return <div className="ops-page space-y-4">
    <div className="ops-page-header">
      <div className="ops-page-header-copy">
        <div className="ops-eyebrow">井管理</div>
        <h1 className="ops-title">井与井筒工程资料</h1>
        <p className="text-sm ops-muted">统一维护井主档案，井身、测斜、BHA、实时数据与算法画像继续复用现有规范表。</p>
      </div>
      <Button onClick={openCreate}><Plus />新增井</Button>
    </div>

    {loadError && <div role="alert" className="flex items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300">
      <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4" />{loadError}</span>
      <Button size="sm" variant="outline" onClick={() => void reload()}><RefreshCw />重试</Button>
    </div>}
    {feedback && <div role="status" className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-300">
      <CheckCircle2 className="h-4 w-4" />{feedback}
    </div>}

    <div className="ops-stat-grid">
      <StatCard label="井主档案" value={`${profiles.length} 口`} description="现有 well_master 记录" />
      <StatCard label="井身已导入" value={`${stats.structured} 口`} description={`${profiles.length ? Math.round(stats.structured / profiles.length * 100) : 0}% 具备井筒结构`} />
      <StatCard label="工程资料完整" value={`${stats.complete} 口`} description="井身、测斜、BHA 均有记录" />
      <StatCard label="实时数据已关联" value={`${stats.realtime} 口`} description={`${profiles.length - stats.realtime} 口待关联`} />
    </div>

    <section className="ops-surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <div className="flex items-center gap-2 text-sm">
          <Database className="h-4 w-4 text-cyan-600" />
          <strong>井档案列表</strong>
          <span className="ops-muted">{query ? `${filteredProfiles.length} / ${profiles.length} 口` : `${profiles.length} 口`}</span>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9" placeholder="搜索井名、井号、区块或目的层" aria-label="搜索井档案" />
        </div>
      </div>

      {loading ? <div className="flex min-h-64 items-center justify-center gap-2 text-sm ops-muted">
        <LoaderCircle className="h-4 w-4 animate-spin" />正在读取井档案…
      </div> : profiles.length === 0 ? <div className="ops-empty-state min-h-64">
        <div className="text-center">
          <FilePlus2 className="mx-auto mb-3 h-8 w-8 text-slate-400" />
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">暂无井档案</p>
          <p className="mt-1 text-xs ops-muted">先创建井主档案，再关联既有工程资料。</p>
          <Button className="mt-4" size="sm" onClick={openCreate}><Plus />新增第一口井</Button>
        </div>
      </div> : filteredProfiles.length === 0 ? <div className="ops-empty-state min-h-56">
        <div className="text-center">
          <Search className="mx-auto mb-3 h-7 w-7 text-slate-400" />
          <p className="text-sm text-slate-700 dark:text-slate-200">没有匹配“{query.trim()}”的井</p>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => setQuery('')}>清除搜索</Button>
        </div>
      </div> : <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-900/60">
            <tr>
              <th className="px-4 py-3 font-medium">井档案</th>
              <th className="px-4 py-3 font-medium">区域与层位</th>
              <th className="px-4 py-3 font-medium">工程资料覆盖</th>
              <th className="px-4 py-3 font-medium">实时数据</th>
              <th className="px-4 py-3 font-medium">状态 / 质量</th>
              <th className="px-4 py-3 text-right font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {filteredProfiles.map((profile) => {
              const status = statusMeta(profile.wellStatus);
              const coverage = structureCoverage(profile);
              return <tr key={profile.wellId} className="border-t border-slate-100 transition-colors hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-900/40">
                <td className="px-4 py-3">
                  <Link to={`/well-management/${profile.wellId}`} className="font-semibold text-slate-900 hover:text-cyan-700 dark:text-slate-100 dark:hover:text-cyan-300">{profile.wellName}</Link>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs ops-muted">
                    <span className="font-mono">{profile.wellCode}</span><span>·</span><span>#{profile.wellId}</span><span>·</span><span>{WELL_TYPE_LABELS[profile.wellType] || profile.wellType}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div>{[profile.blockName, profile.fieldName].filter(Boolean).join(' / ') || '区域信息未填'}</div>
                  <div className="mt-1 text-xs ops-muted">{profile.targetLayer || '目的层未填'}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    {coverage.map((item) => <span key={item.label} className={`rounded px-2 py-1 text-xs ${item.value > 0 ? 'bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>{item.label} {item.value}</span>)}
                    <span className={`rounded px-2 py-1 text-xs ${profile.hasAlgorithmProfile ? 'bg-violet-50 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>算法 {profile.hasAlgorithmProfile ? '已配置' : '未配置'}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="max-w-52 truncate font-mono text-xs" title={profile.realtimeTableName || undefined}>{profile.realtimeTableName || '未关联数据集'}</div>
                  <div className="mt-1 text-xs ops-muted">最大井深 {profile.registeredDepthMax != null ? `${Math.round(profile.registeredDepthMax).toLocaleString()} m` : '—'}</div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <span className={`rounded px-2 py-1 text-xs font-medium ${status.className}`}>{status.label}</span>
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">质量 {profile.qualityGrade || '未评定'}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(profile)} aria-label={`编辑 ${profile.wellName}`}><Pencil />编辑</Button>
                    <Button asChild size="sm" variant="outline"><Link to={`/well-management/${profile.wellId}`}>详情<ChevronRight /></Link></Button>
                    <Button size="icon" variant="ghost" className="text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setPendingDelete(profile)} aria-label={`删除 ${profile.wellName}`}><Trash2 /></Button>
                  </div>
                </td>
              </tr>;
            })}
          </tbody>
        </table>
      </div>}
    </section>

    <WellProfileFormDialog
      open={formOpen}
      profile={editingProfile}
      busy={saving}
      error={formError}
      onOpenChange={(open) => {
        setFormOpen(open);
        if (!open) {
          setEditingProfile(null);
          setFormError('');
        }
      }}
      onSubmit={save}
    />

    <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => !open && !deleting && setPendingDelete(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>确认删除“{pendingDelete?.wellName}”？</AlertDialogTitle>
          <AlertDialogDescription>
            删除井主档案会按现有外键规则一并删除该井关联的实时数据、井身、测斜、BHA 和算法画像记录。此操作不可恢复；如仅暂时停用，建议改为“停用”状态。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>取消</AlertDialogCancel>
          <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={deleting} onClick={(event) => { event.preventDefault(); void remove(); }}>
            {deleting && <LoaderCircle className="animate-spin" />}{deleting ? '删除中…' : '确认永久删除'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}
