import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Download, Search, MapPin, Camera } from 'lucide-react';
import { ApiArea, ApiDetection, exportDetections, ExportFormat, getAreas, getDetectionHistory } from '../services/api';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { canExportData } from '../auth/permissions';
import { eppLabel, objectLabel } from '../utils/labels';

export function ViolationsHistoryPage() {
  const { user } = useAuth();
  const allowExport = canExportData(user?.role);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterArea, setFilterArea] = useState('all');
  const [filterEPP, setFilterEPP] = useState('all');
  const [filterObject, setFilterObject] = useState('all');
  const [violations, setViolations] = useState<ApiDetection[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [areas, setAreas] = useState<ApiArea[]>([]);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<ExportFormat | null>(null);

  useEffect(() => {
    getAreas()
      .then((items) => {
        setAreas(items);
        if (filterArea !== 'all' && !items.some((area) => area.name === filterArea)) {
          setFilterArea('all');
        }
      })
      .catch(() => {
        setAreas([]);
        setFilterArea('all');
        toast.error('No se pudieron cargar las áreas');
      });
  }, []);

  useEffect(() => {
    const loadViolations = async () => {
      try {
        setLoading(true);
        const response = await getDetectionHistory({
          page,
          limit: pageSize,
          search: searchTerm.trim() || undefined,
          area: filterArea,
          epp: filterEPP,
          detectedObject: filterObject,
          violationsOnly: true,
        });
        setViolations(response.items);
        setTotal(response.total);
        setTotalPages(response.totalPages);
      } catch {
        toast.error('No se pudo cargar el historial');
      } finally {
        setLoading(false);
      }
    };

    loadViolations();
  }, [page, pageSize, searchTerm, filterArea, filterEPP, filterObject]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, filterArea, filterEPP, filterObject, pageSize]);

  const formatDate = (timestamp?: string) => {
    if (!timestamp) return 'Sin fecha';
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) return 'Fecha inválida';
    return date.toLocaleString('es-PE', {
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

  const handleExport = async (format: ExportFormat) => {
    try {
      setExportingFormat(format);
      setExportMenuOpen(false);
      await exportDetections(format, {
        search: searchTerm.trim() || undefined,
        area: filterArea,
        epp: filterEPP,
        detectedObject: filterObject,
        violationsOnly: true,
      });
      toast.success('Exportación generada correctamente');
    } catch {
      toast.error('No se pudo generar la exportación');
    } finally {
      setExportingFormat(null);
    }
  };

  const detectedObjects = (violation: ApiDetection) => {
    const fromField = violation.detected_objects ?? [];
    if (fromField.length > 0) return fromField;
    const objectLabels = new Set(['persona', 'vehiculo', 'maquinaria', 'cono_seguridad']);
    return Array.from(new Set(violation.detections.map((item) => item.label).filter((label): label is string => Boolean(label && objectLabels.has(label)))));
  };

  const visiblePages = () => {
    const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
    if (page <= 3) {
      pages.add(2);
      pages.add(3);
      pages.add(4);
      pages.add(5);
    }
    if (page >= totalPages - 2) {
      pages.add(totalPages - 4);
      pages.add(totalPages - 3);
      pages.add(totalPages - 2);
      pages.add(totalPages - 1);
    }
    return Array.from(pages).filter(value => value >= 1 && value <= totalPages).sort((a, b) => a - b);
  };

  const firstShown = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastShown = Math.min(page * pageSize, total);

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
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
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
                {areas.map((area) => (
                  <option key={area.id} value={area.name}>
                    {area.name}
                  </option>
                ))}
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
                <option value="mascarilla">Mascarilla</option>
                <option value="botas">Botas</option>
                <option value="guantes">Guantes</option>
                <option value="lentes">Lentes</option>
              </select>
            </div>

            {/* Filter by Object */}
            <div>
              <select
                value={filterObject}
                onChange={(e) => setFilterObject(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors appearance-none cursor-pointer"
              >
                <option value="all">Objetos Detectados: Todos</option>
                <option value="persona">Persona</option>
                <option value="vehiculo">Vehículo</option>
                <option value="maquinaria">Maquinaria</option>
                <option value="cono_seguridad">Cono de Seguridad</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-800">
            <div className="flex items-center gap-4">
              <p className="text-gray-400 text-sm">
                {total} infracciones encontradas
              </p>
              <label className="flex items-center gap-2 text-sm text-gray-400">
                Registros:
                <select
                  value={pageSize}
                  onChange={(event) => setPageSize(Number(event.target.value))}
                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white"
                >
                  {[5, 10, 20, 50].map(size => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
            </div>
            {allowExport && (
              <div className="relative">
                <button
                  onClick={() => setExportMenuOpen((open) => !open)}
                  disabled={Boolean(exportingFormat)}
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 text-white px-4 py-2 rounded-lg text-sm transition-colors"
                >
                  <Download className="w-4 h-4" />
                  {exportingFormat ? 'Exportando...' : 'Exportar'}
                </button>
                {exportMenuOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-gray-900 border border-gray-800 rounded-lg shadow-xl z-20 overflow-hidden">
                    <button onClick={() => handleExport('pdf')} className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-gray-800">
                      Exportar PDF
                    </button>
                    <button onClick={() => handleExport('excel')} className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-gray-800">
                      Exportar Excel
                    </button>
                    <button onClick={() => handleExport('csv')} className="w-full text-left px-4 py-3 text-sm text-gray-200 hover:bg-gray-800">
                      Exportar CSV
                    </button>
                  </div>
                )}
              </div>
            )}
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
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Objetos Detectados</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Severidad</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-400 uppercase">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {!loading && violations.map((violation) => (
                <tr key={violation.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-6 py-4 text-sm text-white font-mono">{violation.id.slice(-8)}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Camera className="w-4 h-4 text-blue-400" />
                      <span className="text-white text-sm">{violation.camera_code ?? violation.camera_id ?? 'N/A'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-500" />
                      <span className="text-gray-300 text-sm">{violation.area_name ?? violation.location ?? 'Sin ubicación'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">{formatDate(violation.created_at ?? violation.timestamp)}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-1">
                      {violation.missing_epps.map((epp, idx) => (
                        <span
                          key={idx}
                          className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded"
                        >
                          {eppLabel(epp)}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">
                    {detectedObjects(violation).map(objectLabel).join(', ') || 'Sin objetos'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${getSeverityColor(severityLabel(violation.severity))}`}>
                      {severityLabel(violation.severity).toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button
                      disabled
                      title="Vista de detalle pendiente"
                      className="text-gray-500 text-sm cursor-not-allowed"
                    >
                      Detalle pendiente
                    </button>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-gray-500">
                    Cargando infracciones...
                  </td>
                </tr>
              )}
              {!loading && violations.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-10 text-center text-gray-500">
                    No hay infracciones registradas
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between mt-4">
          <p className="text-gray-400 text-sm">
            Página {page} de {totalPages}. Mostrando {firstShown}-{lastShown} de {total} infracciones.
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              disabled={page <= 1 || loading}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:hover:bg-gray-800 text-white px-3 py-2 rounded-lg text-sm"
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </button>
            {visiblePages().map((pageNumber, index, pages) => (
              <div key={pageNumber} className="flex items-center gap-2">
                {index > 0 && pageNumber - pages[index - 1] > 1 && (
                  <span className="text-gray-500 px-1">...</span>
                )}
                <button
                  onClick={() => setPage(pageNumber)}
                  disabled={loading}
                  className={`min-w-9 px-3 py-2 rounded-lg text-sm ${
                    pageNumber === page
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 hover:bg-gray-700 text-gray-300'
                  } disabled:opacity-50`}
                >
                  {pageNumber}
                </button>
              </div>
            ))}
            <button
              onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
              disabled={page >= totalPages || loading}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 disabled:hover:bg-gray-800 text-white px-3 py-2 rounded-lg text-sm"
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
