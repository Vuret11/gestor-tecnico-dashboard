import clsx from 'clsx';

const variants: Record<string, string> = {
  programada: 'bg-blue-100 text-blue-700',
  en_curso:   'bg-yellow-100 text-yellow-700',
  completada: 'bg-green-100 text-green-700',
  cancelada:  'bg-slate-100 text-slate-500',
  abierta:    'bg-red-100 text-red-700',
  en_progreso:'bg-orange-100 text-orange-700',
  resuelta:   'bg-green-100 text-green-700',
  cerrada:    'bg-slate-100 text-slate-500',
  baja:       'bg-slate-100 text-slate-600',
  media:      'bg-yellow-100 text-yellow-700',
  alta:       'bg-orange-100 text-orange-700',
  critica:    'bg-red-100 text-red-700',
  admin:      'bg-purple-100 text-purple-700',
  oficina:    'bg-blue-100 text-blue-700',
  tecnico:    'bg-slate-100 text-slate-700',
};

export default function Badge({ value }: { value: string }) {
  return (
    <span className={clsx('px-2 py-0.5 rounded text-xs font-medium', variants[value] ?? 'bg-slate-100 text-slate-600')}>
      {value.replace('_', ' ')}
    </span>
  );
}
