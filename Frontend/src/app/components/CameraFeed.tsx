import { AlertTriangle, Camera, CheckCircle, Maximize2 } from 'lucide-react';

interface Detection {
  type: 'casco' | 'chaleco' | 'mascarilla' | 'botas' | 'guantes' | 'lentes';
  status: 'correcto' | 'faltante';
  confidence: number;
}

interface CameraFeedProps {
  cameraId: string;
  location: string;
  streamUrl?: string;
  isStreaming?: boolean;
  onExpand?: () => void;
}

export function CameraFeed({ cameraId, location, streamUrl, isStreaming = false, onExpand }: CameraFeedProps) {
  const detections: Detection[] = [];
  const hasViolation = false;
  const people = 0;

  return (
    <div
      onDoubleClick={onExpand}
      className={`bg-gray-900 rounded-lg overflow-hidden border-2 transition-all ${
      hasViolation ? 'border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)]' : 'border-gray-700'
    }`}
    >
      <div className="relative aspect-video bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
        {isStreaming && streamUrl ? (
          <img
            src={streamUrl}
            alt={cameraId}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Camera className="w-16 h-16 text-gray-600" />
          </div>
        )}

        {/* Overlay de detección */}
        <div className="absolute inset-0 pointer-events-none">
          {people > 0 && (
            <div className="absolute top-4 left-4 flex gap-2 flex-wrap">
              {Array.from({ length: people }).map((_, i) => (
                <div key={i} className="bg-blue-500/80 px-2 py-1 rounded text-xs text-white backdrop-blur-sm">
                  Persona {i + 1}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Alarma visual */}
        {hasViolation && (
          <div className="absolute inset-0 bg-red-500/20 animate-pulse pointer-events-none" />
        )}

        {/* Timestamp */}
        <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-1 rounded text-xs text-white font-mono">
          {new Date().toLocaleTimeString()}
        </div>

        <div className="absolute top-4 right-4 flex items-center gap-2 bg-black/70 px-3 py-1 rounded">
          <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-red-500 animate-pulse' : 'bg-gray-500'}`} />
          <span className="text-xs text-white">{isStreaming ? 'LIVE' : 'OFF'}</span>
        </div>

        <button
          type="button"
          onClick={onExpand}
          className="absolute top-4 left-4 p-2 bg-black/70 hover:bg-black/90 rounded text-white transition-colors"
          title="Ampliar cámara"
        >
          <Maximize2 className="w-4 h-4" />
        </button>

        {detections.length === 0 && (
          <div className="absolute bottom-4 right-4 bg-black/70 px-3 py-1 rounded text-xs text-gray-300">
            Sin eventos recientes
          </div>
        )}
      </div>

      {/* Info de cámara */}
      <div className="p-3 bg-gray-800">
        <div className="flex items-center justify-between mb-2">
          <div>
            <h3 className="text-white text-sm font-semibold">{cameraId}</h3>
            <p className="text-gray-400 text-xs">{location}</p>
          </div>
          {hasViolation ? (
            <AlertTriangle className="w-5 h-5 text-red-500" />
          ) : (
            <CheckCircle className="w-5 h-5 text-green-500" />
          )}
        </div>

        {/* Estado de EPPs */}
        <div className="flex flex-wrap gap-1">
          {detections.map((detection, idx) => (
            <div
              key={idx}
              className={`text-xs px-2 py-1 rounded ${
                detection.status === 'correcto'
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
              }`}
            >
              {detection.type.toUpperCase()}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
