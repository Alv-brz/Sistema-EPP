import { AlertTriangle, X, MapPin, Clock } from 'lucide-react';
import { eppLabel } from '../utils/labels';

interface Violation {
  id: string;
  cameraId: string;
  location: string;
  timestamp: string;
  lastDetectedAt?: string;
  missingEpps: string[];
  frame: string;
  read?: boolean;
  repetitions?: number;
}

interface ViolationAlertProps {
  violation: Violation;
  onDismiss: () => void;
}

export function ViolationAlert({ violation, onDismiss }: ViolationAlertProps) {
  const timeAgo = () => {
    const seconds = Math.floor((Date.now() - new Date(violation.lastDetectedAt ?? violation.timestamp).getTime()) / 1000);
    if (seconds < 60) return `Hace ${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `Hace ${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `Hace ${hours}h`;
  };

  return (
    <div className={`${violation.read ? 'bg-gray-900 border-gray-700' : 'bg-red-500/10 border-red-500'} border rounded-lg p-4 animate-[slideIn_0.3s_ease-out]`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="bg-red-500 p-2 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-white font-semibold">
              {violation.read ? 'Infracción leída' : '¡INFRACCIÓN DETECTADA!'}
              {(violation.repetitions ?? 1) > 1 && <span className="ml-2 text-sm text-red-300">x{violation.repetitions}</span>}
            </h3>
            <p className="text-red-400 text-sm">{violation.cameraId}</p>
          </div>
        </div>
        <button
          onClick={onDismiss}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <MapPin className="w-4 h-4" />
          <span>{violation.location}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-300">
          <Clock className="w-4 h-4" />
          <span>{timeAgo()}</span>
        </div>
      </div>

      <div className="bg-black/30 rounded p-3">
        <p className="text-xs text-gray-400 mb-2">EPPs Faltantes:</p>
        <div className="flex flex-wrap gap-2">
          {violation.missingEpps.map((epp, idx) => (
            <span
              key={idx}
              className="bg-red-500 text-white text-xs px-3 py-1 rounded-full font-medium"
            >
              {eppLabel(epp)}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-3 pt-3 border-t border-red-500/30">
        <p className="text-xs text-gray-500 font-mono">Frame: {violation.frame}</p>
      </div>
    </div>
  );
}
