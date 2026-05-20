import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';

import {
  TrendingUp, TrendingDown,
  Download, FileText, AlertTriangle
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { getReportSummary, ReportSummary } from '../services/api';
import { toast } from 'sonner';

export function ReportsPage() {
  const [summary, setSummary] = useState<ReportSummary>({
    stats: [],
    violations_by_day: [],
    violations_by_epp: [],
    compliance_by_area: [],
  });

  useEffect(() => {
    getReportSummary()
      .then(setSummary)
      .catch(() => toast.error('No se pudieron cargar los reportes'));
  }, []);

  return (
    <div className="flex-1 overflow-auto">

      {/* HEADER */}
      <div className="bg-gray-900 border-b border-gray-800 px-10 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Seguridad en Obra y Almacén
            </h1>
            <p className="text-gray-400 text-sm">
              Monitoreo inteligente del uso de EPP
            </p>
          </div>

          <div className="flex items-center gap-4">
            <select className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm">
              <option>Últimos 7 días</option>
              <option>Últimos 30 días</option>
              <option>Últimos 3 meses</option>
            </select>

            <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg text-white text-sm">
              <Download className="w-4 h-4" />
              Exportar
            </button>
          </div>
        </div>
      </div>

      <div className="p-10">

        {/* STATS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          {summary.stats.map((stat, idx) => (
            <div key={idx} className="bg-gray-900 border border-gray-800 rounded-xl p-8">
              <div className="flex justify-between mb-4">
                <span className="text-gray-400 text-sm leading-relaxed">
                  {stat.label}
                </span>

                <div className={`flex items-center gap-1 text-sm ${
                  stat.trend === 'up' ? 'text-green-400' : 'text-red-400'
                }`}>
                  {stat.trend === 'up'
                    ? <TrendingUp className="w-4 h-4" />
                    : <TrendingDown className="w-4 h-4" />
                  }
                  {stat.change}
                </div>
              </div>

              <p className="text-4xl font-bold text-white">
                {stat.value}
              </p>
            </div>
          ))}
        </div>

        {/* GRÁFICOS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">

          {/* Infracciones por día */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
            <h2 className="text-lg font-semibold text-white mb-6">
              Infracciones por Día
            </h2>

            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={summary.violations_by_day}>
                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                <XAxis dataKey="day" stroke="#9ca3af" />
                <YAxis stroke="#9ca3af" />
                <Tooltip />
                <Bar dataKey="violations" fill="#ef4444" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Infracciones por EPP */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
            <h2 className="text-lg font-semibold text-white mb-6">
              Infracciones por EPP
            </h2>

            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie
                  data={summary.violations_by_epp}
                  dataKey="value"
                  outerRadius={110}
                  label={({ name, percent }) =>
                    `${name} ${(percent * 100).toFixed(0)}%`
                  }
                >
                  {summary.violations_by_epp.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CUMPLIMIENTO */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 mb-8">
          <h2 className="text-lg font-semibold text-white mb-6">
            Cumplimiento por Zona
          </h2>

          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={summary.compliance_by_area} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              
              <XAxis type="number" domain={[0, 100]} stroke="#9ca3af" />
              
              <YAxis
                type="category"
                dataKey="area"
                stroke="#9ca3af"
                width={180} // 🔥 CLAVE para que no se corte el texto
                tick={{ fontSize: 12 }}
              />

              <Tooltip />
              <Bar dataKey="compliance" fill="#10b981" radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* REPORTES */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

          <button className="bg-gray-900 border border-gray-800 rounded-xl p-8 hover:border-gray-700 text-left">
            <AlertTriangle className="w-10 h-10 text-red-500 mb-4" />
            <h3 className="text-white font-semibold mb-2">
              Incumplimientos
            </h3>
            <p className="text-gray-400 text-sm">
              Personal sin EPP detectado
            </p>
          </button>

          <button className="bg-gray-900 border border-gray-800 rounded-xl p-8 hover:border-gray-700 text-left">
            <FileText className="w-10 h-10 text-yellow-500 mb-4" />
            <h3 className="text-white font-semibold mb-2">
              Zonas Críticas
            </h3>
            <p className="text-gray-400 text-sm">
              Áreas con mayor riesgo
            </p>
          </button>

          <button className="bg-gray-900 border border-gray-800 rounded-xl p-8 hover:border-gray-700 text-left">
            <FileText className="w-10 h-10 text-green-500 mb-4" />
            <h3 className="text-white font-semibold mb-2">
              Cumplimiento
            </h3>
            <p className="text-gray-400 text-sm">
              Uso correcto de EPP
            </p>
          </button>

        </div>

      </div>
    </div>
  );
}
