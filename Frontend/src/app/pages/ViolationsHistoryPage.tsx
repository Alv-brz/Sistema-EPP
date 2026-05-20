import { useEffect, useState } from 'react';
import { Download, Search, MapPin, Camera } from 'lucide-react';
import { ApiDetection, getDetectionHistory } from '../services/api';
import { toast } from 'sonner';

export function ViolationsHistoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterArea, setFilterArea] = useState('all');
  const [filterEPP, setFilterEPP] = useState('all');
  const [violations, setViolations] = useState<ApiDetection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadViolations = async () => {
      try {
        setLoading(true);
        const response = await getDetectionHistory();
        setViolations(response.items.filter(item => item.missing_epps.length > 0));
      } catch {
        toast.error('No se pudo cargar el historial');
      } finally {
        setLoading(false);
      }
    };

    loadViolations();
  }, []);

  const filteredViolations = violations.filter((violation) => {
    const haystack = [
      violation.id,
      violation.camera_id ?? '',
      violation.area_name ?? '',
      violation.location ?? '',
      violation.missing_epps.join(' '),
    ].join(' ').toLowerCase();
    const matchesSearch = haystack.includes(searchTerm.toLowerCase());
    const matchesArea = filterArea === 'all' || (violation.area_name ?? violation.location ?? '').toLowerCase().includes(filterArea);
    const matchesEPP = filterEPP === 'all' || violation.missing_epps.some(epp => epp.toLowerCase().includes(filterEPP));
    return matchesSearch && matchesArea && matchesEPP;
  });

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'alta': return 'text-red-400 bg-red-500/20';
      case 'media': return 'text-orange-400 bg-orange-500/20';
      case 'baja': return 'text-yellow-400 bg-yellow-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const severityLabel = (severity: string) => {
    switch (severity) {
      case 'high': return 'alta';
      case 'medium': return 'media';
      case 'low': return 'baja';
      default: return severity;
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-8 py-6">
        <h1 className="text-2xl font-bold text-white mb-2">Historial de Infracciones</h1>
        <p className="text-gray-400">Registro completo de todas las violaciones detectadas</p>
      </div>

      <div className="p-8">
        {/* Filters Bar */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Search */}
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar por cámara, área, EPP..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>
            </div>

            {/* Filter by Area */}
            <div>
              <select
                value={filterArea}
                onChange={(e) => setFilterArea(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer"
              >
                <option value="all">Todas las áreas</option>
                <option value="produccion">Producción</option>
                <option value="almacen">Almacén</option>
                <option value="construccion">Construcción</option>
                <option value="taller">Taller</option>
              </select>
            </div>

            {/* Filter by EPP */}
            <div>
              <select
                value={filterEPP}
                onChange={(e) => setFilterEPP(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer"
              >
                <option value="all">Todos los EPPs</option>
                <option value="casco">Casco</option>
                <option value="chaleco">Chaleco</option>
                <option value="botas">Botas</option>
                <option value="guantes">Guantes</option>
                <option value="lentes">Lentes</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
            <p className="text-gray-400 text-sm">
              {filteredViolations.length} infracciones encontradas
            </p>
            <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm transition-colors">
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Violations Table */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-800 border-b border-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">ID</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Cámara</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Ubicación</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Fecha/Hora</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">EPPs Faltantes</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Severidad</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {!loading && filteredViolations.map((violation) => (
                <tr key={violation.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-white font-mono">{violation.id.slice(-8)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-blue-400" />
                      <span className="text-white text-sm">{violation.camera_id ?? 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-300 text-sm">{violation.area_name ?? violation.location ?? 'Sin ubicación'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">{formatDate(violation.created_at)}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {violation.missing_epps.map((epp, idx) => (
                        <span
                          key={idx}
                          className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded"
                        >
                          {epp.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${getSeverityColor(severityLabel(violation.severity))}`}>
                      {severityLabel(violation.severity).toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button className="text-blue-400 hover:text-blue-300 text-sm">
                      Ver detalles
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && filteredViolations.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-gray-500">
                    No hay infracciones registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
