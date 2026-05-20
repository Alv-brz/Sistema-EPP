import { TrendingUp, TrendingDown, Users, AlertTriangle, Shield, Activity } from 'lucide-react';

interface StatsPanelProps {
  totalViolations: number;
  activeViolations: number;
  totalPeople: number;
  complianceRate: number;
}

export function StatsPanel({ totalViolations, activeViolations, totalPeople, complianceRate }: StatsPanelProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg p-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <AlertTriangle className="w-8 h-8 opacity-80" />
          <div className="bg-white/20 rounded-full px-2 py-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" />
            <span className="text-xs">+12%</span>
          </div>
        </div>
        <p className="text-2xl font-bold mb-1">{totalViolations}</p>
        <p className="text-sm text-red-100">Infracciones Totales</p>
      </div>

      <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <Activity className="w-8 h-8 opacity-80" />
          <div className="bg-white/20 rounded-full px-2 py-1">
            <span className="text-xs font-semibold">ACTIVAS</span>
          </div>
        </div>
        <p className="text-2xl font-bold mb-1">{activeViolations}</p>
        <p className="text-sm text-orange-100">Alertas Activas</p>
      </div>

      <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <Users className="w-8 h-8 opacity-80" />
          <div className="bg-white/20 rounded-full px-2 py-1 flex items-center gap-1">
            <Activity className="w-3 h-3" />
            <span className="text-xs">En vivo</span>
          </div>
        </div>
        <p className="text-2xl font-bold mb-1">{totalPeople}</p>
        <p className="text-sm text-blue-100">Personal Detectado</p>
      </div>

      <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-4 text-white">
        <div className="flex items-center justify-between mb-2">
          <Shield className="w-8 h-8 opacity-80" />
          <div className="bg-white/20 rounded-full px-2 py-1 flex items-center gap-1">
            <TrendingDown className="w-3 h-3" />
            <span className="text-xs">-5%</span>
          </div>
        </div>
        <p className="text-2xl font-bold mb-1">{complianceRate}%</p>
        <p className="text-sm text-green-100">Cumplimiento EPPs</p>
      </div>
    </div>
  );
}
