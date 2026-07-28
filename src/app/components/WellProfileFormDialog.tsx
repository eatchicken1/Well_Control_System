import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import type { WellProfile, WellProfileMutationRequest } from '../api/wellManagementApi';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';

const EMPTY_FORM: WellProfileMutationRequest = {
  wellName: '',
  wellCode: '',
  blockName: '',
  fieldName: '',
  targetLayer: '',
  wellType: 'unknown',
  wellStatus: 'active',
  qualityGrade: 'unknown',
};

const WELL_TYPES = [
  { value: 'unknown', label: '未定' },
  { value: 'vertical', label: '直井' },
  { value: 'directional', label: '定向井' },
  { value: 'horizontal', label: '水平井' },
];

const WELL_STATUSES = [
  { value: 'active', label: '在用' },
  { value: 'suspended', label: '暂停' },
  { value: 'completed', label: '完井' },
  { value: 'inactive', label: '停用' },
];

const QUALITY_GRADES = [
  { value: 'A', label: 'A · 完整' },
  { value: 'B', label: 'B · 基本完整' },
  { value: 'C', label: 'C · 待补充' },
  { value: 'unknown', label: '未评定' },
];

function toForm(profile: WellProfile | null): WellProfileMutationRequest {
  if (!profile) return { ...EMPTY_FORM };
  return {
    wellName: profile.wellName,
    wellCode: profile.wellCode,
    blockName: profile.blockName || '',
    fieldName: profile.fieldName || '',
    targetLayer: profile.targetLayer || '',
    wellType: profile.wellType || 'unknown',
    wellStatus: profile.wellStatus || 'active',
    qualityGrade: profile.qualityGrade || 'unknown',
  };
}

function normalized(form: WellProfileMutationRequest): WellProfileMutationRequest {
  return {
    ...form,
    wellName: form.wellName.trim(),
    wellCode: form.wellCode.trim(),
    blockName: form.blockName?.trim(),
    fieldName: form.fieldName?.trim(),
    targetLayer: form.targetLayer?.trim(),
  };
}

function OptionList({ options, value }: { options: { value: string; label: string }[]; value: string }) {
  const hasCurrent = options.some((option) => option.value === value);
  return <>
    {!hasCurrent && value && <option value={value}>{value}（现有值）</option>}
    {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
  </>;
}

interface WellProfileFormDialogProps {
  open: boolean;
  profile?: WellProfile | null;
  busy?: boolean;
  error?: string;
  onOpenChange: (open: boolean) => void;
  onSubmit: (request: WellProfileMutationRequest) => Promise<void> | void;
}

export function WellProfileFormDialog({
  open,
  profile = null,
  busy = false,
  error = '',
  onOpenChange,
  onSubmit,
}: WellProfileFormDialogProps) {
  const [form, setForm] = useState<WellProfileMutationRequest>(() => toForm(profile));
  const [touched, setTouched] = useState({ wellName: false, wellCode: false });
  const isEditing = Boolean(profile);

  useEffect(() => {
    if (open) {
      setForm(toForm(profile));
      setTouched({ wellName: false, wellCode: false });
    }
  }, [open, profile]);

  const validationMessage = useMemo(() => {
    if (!form.wellName.trim()) return '请填写井名。';
    if (!form.wellCode.trim()) return '请填写规范井号。';
    if (form.wellName.trim().length > 128 || form.wellCode.trim().length > 128) return '井名和井号不能超过 128 个字符。';
    return '';
  }, [form.wellCode, form.wellName]);

  const visibleValidationMessage = !form.wellName.trim() && touched.wellName
    ? '请填写井名。'
    : !form.wellCode.trim() && touched.wellCode
      ? '请填写规范井号。'
      : '';

  const unchanged = isEditing
    && JSON.stringify(normalized(form)) === JSON.stringify(normalized(toForm(profile)));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (validationMessage) {
      setTouched({ wellName: true, wellCode: true });
      return;
    }
    if (unchanged || busy) return;
    await onSubmit(normalized(form));
  };

  const update = <K extends keyof WellProfileMutationRequest>(key: K, value: WellProfileMutationRequest[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  return <Dialog open={open} onOpenChange={(nextOpen) => !busy && onOpenChange(nextOpen)}>
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{isEditing ? `编辑 ${profile?.wellName}` : '新增井'}</DialogTitle>
        <DialogDescription>
          维护井主表中的基础属性。井身结构、测斜、BHA 和实时数据仍使用现有规范表，不会创建平行数据表。
        </DialogDescription>
      </DialogHeader>
      <form className="space-y-5" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="well-name">井名 <span className="text-red-500">*</span></Label>
            <Input
              id="well-name"
              value={form.wellName}
              maxLength={128}
              autoFocus
              placeholder="例如：川渝 1 井"
              aria-invalid={!form.wellName.trim() && touched.wellName}
              onChange={(event) => update('wellName', event.target.value)}
              onBlur={() => setTouched((current) => ({ ...current, wellName: true }))}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="well-code">规范井号 <span className="text-red-500">*</span></Label>
            <Input
              id="well-code"
              value={form.wellCode}
              maxLength={128}
              placeholder="用于系统匹配，需保持唯一"
              aria-invalid={!form.wellCode.trim() && touched.wellCode}
              onChange={(event) => update('wellCode', event.target.value)}
              onBlur={() => setTouched((current) => ({ ...current, wellCode: true }))}
            />
            <p className="text-xs ops-muted">{isEditing ? '修改井号会同步更新井主表标识，已有从表关联仍按井 ID 保持不变。' : '井号用于系统匹配且必须唯一，创建后仍可在井档案中修改。'}</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="block-name">区块</Label>
            <Input id="block-name" value={form.blockName || ''} maxLength={128} placeholder="例如：川中区块" onChange={(event) => update('blockName', event.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="field-name">油气田 / 作业区</Label>
            <Input id="field-name" value={form.fieldName || ''} maxLength={128} placeholder="例如：龙岗气田" onChange={(event) => update('fieldName', event.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="target-layer">目的层</Label>
            <Input id="target-layer" value={form.targetLayer || ''} maxLength={128} placeholder="例如：须家河组" onChange={(event) => update('targetLayer', event.target.value)} />
          </div>
        </div>
        <div className="grid gap-4 border-t border-slate-200 pt-4 dark:border-slate-800 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="well-type">井型</Label>
            <select id="well-type" className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm" value={form.wellType} onChange={(event) => update('wellType', event.target.value)}>
              <OptionList options={WELL_TYPES} value={form.wellType} />
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="well-status">井状态</Label>
            <select id="well-status" className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm" value={form.wellStatus} onChange={(event) => update('wellStatus', event.target.value)}>
              <OptionList options={WELL_STATUSES} value={form.wellStatus} />
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="quality-grade">资料质量</Label>
            <select id="quality-grade" className="h-9 w-full rounded-md border border-input bg-input-background px-3 text-sm" value={form.qualityGrade} onChange={(event) => update('qualityGrade', event.target.value)}>
              <OptionList options={QUALITY_GRADES} value={form.qualityGrade} />
            </select>
          </div>
        </div>
        {(error || visibleValidationMessage) && <div role="alert" className="flex gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-950 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error || visibleValidationMessage}</span>
        </div>}
        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>取消</Button>
          <Button type="submit" disabled={busy || Boolean(validationMessage) || unchanged}>
            {busy && <LoaderCircle className="animate-spin" />}
            {busy ? '保存中…' : isEditing ? '保存修改' : '创建井'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
