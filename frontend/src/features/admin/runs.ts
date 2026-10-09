export interface Run {
  id: string;
  trigger: string;
  startedAt: string;
  finishedAt: string | null;
  studentsSynced: number;
  changesCount: number;
  status: string;
}

export interface Badge { label: string; classes: string; dot: string }

const BADGES: Record<string, Badge> = {
  OK: { label: 'OK', classes: 'bg-[#E6F4EA] text-[#1E7E34] border-[#CEEAD6]', dot: 'bg-[#1E7E34]' },
  PARTIAL: { label: 'Parcial', classes: 'bg-[#FEF7E0] text-[#9A5B00] border-[#FEEFC3]', dot: 'bg-[#9A5B00]' },
  FAILED: { label: 'Fallido', classes: 'bg-[#FCE8E6] text-[#B3261E] border-[#FAD2CF]', dot: 'bg-[#B3261E]' },
  RUNNING: { label: 'En curso', classes: 'bg-surface-container-high text-primary border-outline-variant/60', dot: 'bg-primary' },
};

export function statusBadge(status: string): Badge {
  return BADGES[status] ?? {
    label: status,
    classes: 'bg-surface-container text-on-surface-variant border-outline-variant/60',
    dot: 'bg-outline',
  };
}

export function triggerLabel(trigger: string): string {
  if (trigger === 'MANUAL') return 'Manual';
  if (trigger === 'CRON') return 'Automática';
  return trigger;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('es-CO');
}
