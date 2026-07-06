import { Calendar, Download, MapPin, Camera } from 'lucide-react';
import { eppLabel } from '../utils/labels';

interface ViolationRecord {
  id: string;
  cameraId: string;
  location: string;
  timestamp: string;
  missingEpps: string[];
  frame: string;
}

interface ViolationHistoryProps {
  violations: ViolationRecord[];
}

export function ViolationHistory({ violations }: ViolationHistoryProps) {
  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-white font-bold text-lg">Historial de Infracciones</h2>
        <button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm transition-colors">
          <Download className="w-4 h-4" />
          Exportar
        </button>
      </div>

      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {violations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Calendar className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No hay infracciones registradas</p>
          </div>
        ) : (
          violations.map((violation) => (
            <div
              key={violation.id}
              className="bg-gray-900 rounded-lg p-3 border border-gray-700 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-blue-400" />
                  <span className="text-white font-medium text-sm">
                    {violation.cameraId}
                  </span>
                </div>
                <span className="text-xs text-gray-500">
                  {formatDate(violation.timestamp)}
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-400 mb-2">
                <MapPin className="w-3 h-3" />
                <span>{violation.location}</span>
              </div>

              <div className="flex flex-wrap gap-1 mb-2">
                {violation.missingEpps.map((epp, idx) => (
                  <span
                    key={idx}
                    className="bg-red-500/20 text-red-400 text-xs px-2 py-1 rounded"
                  >
                    {eppLabel(epp)}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-gray-800">
                <span className="text-xs text-gray-600 font-mono">
                  {violation.frame}
                </span>
                <button className="text-xs text-blue-400 hover:text-blue-300">
                  Ver detalles
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
