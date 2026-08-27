import { useState } from 'react';
import PlanSemanal from './PlanSemanal';
import PlanMensual from './PlanMensual';
import PlanDashboard from './PlanDashboard';
import PlanTecnicos from './PlanTecnicos';
import { CalendarDays, CalendarRange, LayoutDashboard, HardHat } from 'lucide-react';

const TABS = [
  { key: 'semanal',   label: 'Semanal',    icon: CalendarDays },
  { key: 'mensual',   label: 'Mensual',    icon: CalendarRange },
  { key: 'dashboard', label: 'Dashboard',  icon: LayoutDashboard },
  { key: 'tecnicos',  label: 'Técnicos',   icon: HardHat },
] as const;

type Tab = typeof TABS[number]['key'];

export default function Planificacion() {
  const [tab, setTab] = useState<Tab>('semanal');

  return (
    <div className="flex flex-col h-full">
      {/* Sub-navegación */}
      <div className="border-b border-slate-200 bg-white px-6">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === key
                  ? 'border-brand text-brand'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Contenido */}
      <div className="flex-1 overflow-auto">
        {tab === 'semanal'   && <PlanSemanal />}
        {tab === 'mensual'   && <PlanMensual />}
        {tab === 'dashboard' && <PlanDashboard />}
        {tab === 'tecnicos'  && <PlanTecnicos />}
      </div>
    </div>
  );
}
