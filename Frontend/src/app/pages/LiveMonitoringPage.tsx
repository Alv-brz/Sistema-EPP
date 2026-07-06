import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { CameraFeed } from '../components/CameraFeed';
import { ViolationAlert } from '../components/ViolationAlert';
import {
  AlertTriangle,
  Bell,
  Camera,
  Circle,
  Grid3x3,
  Grid2x2,
  Loader2,
  MonitorPlay,
  Play,
  Settings,
  Square,
  X,
} from 'lucide-react';
import { GlobalAlert, useAlerts } from '../contexts/AlertContext';
import { canControlCameras, canManageCameras } from '../auth/permissions';
import { useAuth } from '../contexts/AuthContext';
import { ApiCamera, getCameraStreamUrl, listCameras, startCamera, stopCamera } from '../services/api';
import { toast } from 'sonner';
import { formatEppList } from '../utils/labels';

type CameraSignal = 'streaming' | 'stopped' | 'error' | 'no-signal';

function getCameraSignal(camera: ApiCamera, error?: string): CameraSignal {
  if (error) return 'error';
  if (camera.is_streaming) return 'streaming';
  if (camera.status === 'offline') return 'no-signal';
  return 'stopped';
}

function getSignalLabel(signal: CameraSignal) {
  switch (signal) {
    case 'streaming':
      return 'Transmitiendo';
    case 'error':
      return 'Error';
    case 'no-signal':
      return 'Sin señal';
    default:
      return 'Detenida';
  }
}

function getSignalClasses(signal: CameraSignal) {
  switch (signal) {
    case 'streaming':
      return 'bg-green-500/20 text-green-300 border-green-500/40';
    case 'error':
      return 'bg-red-500/20 text-red-300 border-red-500/40';
    case 'no-signal':
      return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40';
    default:
      return 'bg-gray-700 text-gray-300 border-gray-600';
  }
}

function alertMatchesCamera(alert: GlobalAlert, camera: ApiCamera) {
  return alert.cameraId === camera.code || alert.cameraId === camera.id;
}

export function LiveMonitoringPage() {
  const [gridView, setGridView] = useState<'2x2' | '3x3'>('2x2');
  const [cameras, setCameras] = useState<ApiCamera[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const [cameraErrors, setCameraErrors] = useState<Record<string, string>>({});
  const [cameraActionId, setCameraActionId] = useState<string | null>(null);
  const [alertPulse, setAlertPulse] = useState(false);
  const { activeAlerts, notifications, dismissActiveAlert } = useAlerts();
  const { user } = useAuth();
  const navigate = useNavigate();
  const allowCameraControl = canControlCameras(user?.role);
  const allowCameraConfig = canManageCameras(user?.role);

  useEffect(() => {
    listCameras()
      .then(setCameras)
      .catch(() => toast.error('No se pudieron cargar las cámaras'));
  }, []);

  const selectedCamera = cameras.find((camera) => camera.id === selectedCameraId) ?? null;
  const selectedAlerts = selectedCamera
    ? notifications.filter((alert) => alertMatchesCamera(alert, selectedCamera)).slice(0, 5)
    : [];
  const lastSelectedAlert = selectedAlerts[0];

  useEffect(() => {
    if (!selectedCamera || !lastSelectedAlert) return;
    setAlertPulse(true);
    const timeout = window.setTimeout(() => setAlertPulse(false), 1800);
    return () => window.clearTimeout(timeout);
  }, [lastSelectedAlert?.lastDetectedAt, selectedCamera?.id]);

  const refreshCameras = async () => {
    const next = await listCameras();
    setCameras(next);
    return next;
  };

  const handleToggleCamera = async (camera: ApiCamera) => {
    setCameraActionId(camera.id);
    setCameraErrors((prev) => {
      const next = { ...prev };
      delete next[camera.id];
      return next;
    });

    try {
      const updated = camera.is_streaming ? await stopCamera(camera.id) : await startCamera(camera.id);
      setCameras((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      await refreshCameras().catch(() => undefined);
      toast.success(updated.is_streaming ? 'Cámara iniciada' : 'Cámara detenida');
    } catch (error) {
      const fallback = camera.is_streaming ? 'No se pudo detener la cámara' : 'No se pudo iniciar la cámara';
      const message = error instanceof Error ? error.message || fallback : fallback;
      setCameraErrors((prev) => ({ ...prev, [camera.id]: message }));
      toast.error(fallback);
    } finally {
      setCameraActionId(null);
    }
  };

  const closeCameraModal = () => {
    setSelectedCameraId(null);
    setAlertPulse(false);
  };

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Monitoreo en Vivo</h1>
            <p className="text-gray-400">Visualización en tiempo real de todas las cámaras</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg p-1">
              <button
                onClick={() => setGridView('2x2')}
                className={`p-2 rounded transition-colors ${
                  gridView === '2x2' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Grid2x2 className="w-5 h-5" />
              </button>
              <button
                onClick={() => setGridView('3x3')}
                className={`p-2 rounded transition-colors ${
                  gridView === '3x3' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Grid3x3 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Cameras Grid */}
          <div className="lg:col-span-3">
            <div className={`grid grid-cols-1 ${
              gridView === '3x3' ? 'md:grid-cols-3' : 'md:grid-cols-2'
            } gap-4`}>
              {cameras.map(camera => (
                <CameraFeed
                  key={camera.id}
                  cameraId={camera.code}
                  location={camera.location}
                  isStreaming={camera.is_streaming}
                  streamUrl={selectedCameraId ? undefined : getCameraStreamUrl(camera.id)}
                  onExpand={() => setSelectedCameraId(camera.id)}
                />
              ))}
            </div> 
          </div>

          {/* Alerts Sidebar */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Bell className="w-5 h-5 text-red-500" />
              Alertas Activas
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              Mostrando únicamente alertas recientes. El historial completo está disponible en Infracciones.
            </p>
            <div className="space-y-3">
              {activeAlerts.length === 0 ? (
                <div className="bg-gray-900 rounded-lg p-6 text-center text-gray-500 border border-gray-800">
                  <Bell className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No hay alertas activas</p>
                </div>
              ) : (
                activeAlerts.map(alert => (
                  <ViolationAlert
                    key={alert.id}
                    violation={alert}
                    onDismiss={() => dismissActiveAlert(alert.id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedCamera && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-7xl h-[88vh] bg-gray-950 border border-gray-800 rounded-lg shadow-2xl overflow-hidden flex flex-col">
            <div className="bg-gray-900 border-b border-gray-800 px-5 py-4 flex items-center justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-semibold text-white truncate">{selectedCamera.name}</h2>
                  <span className={`text-xs border px-2 py-1 rounded ${getSignalClasses(getCameraSignal(selectedCamera, cameraErrors[selectedCamera.id]))}`}>
                    {getSignalLabel(getCameraSignal(selectedCamera, cameraErrors[selectedCamera.id]))}
                  </span>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  {selectedCamera.code} · {selectedCamera.location} · {selectedCamera.area_name ?? 'Sin área'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {allowCameraControl && (
                  <button
                    type="button"
                    onClick={() => handleToggleCamera(selectedCamera)}
                    disabled={cameraActionId === selectedCamera.id}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 disabled:opacity-60 text-white rounded-lg transition-colors text-sm"
                  >
                    {cameraActionId === selectedCamera.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : selectedCamera.is_streaming ? (
                      <Square className="w-4 h-4" />
                    ) : (
                      <Play className="w-4 h-4" />
                    )}
                    {selectedCamera.is_streaming ? 'Detener' : 'Iniciar'}
                  </button>
                )}
                {allowCameraConfig && (
                  <button
                    type="button"
                    onClick={() => navigate('/cameras')}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
                  >
                    <Settings className="w-4 h-4" />
                    Configurar en Cámaras
                  </button>
                )}
                <button
                  type="button"
                  onClick={closeCameraModal}
                  className="p-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
                  title="Cerrar"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-[1fr_320px]">
              <div className="min-h-0 p-5 flex flex-col gap-4">
                <div className={`relative flex-1 min-h-[360px] bg-black rounded-lg border overflow-hidden ${
                  alertPulse ? 'border-red-500 shadow-[0_0_28px_rgba(239,68,68,0.45)]' : 'border-gray-800'
                }`}>
                  {selectedCamera.is_streaming ? (
                    <img
                      key={selectedCamera.id}
                      src={getCameraStreamUrl(selectedCamera.id)}
                      alt={selectedCamera.name}
                      className="absolute inset-0 h-full w-full object-contain bg-black"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
                      <Camera className="w-16 h-16 text-gray-600 mb-4" />
                      <p className="text-white font-semibold">
                        {getSignalLabel(getCameraSignal(selectedCamera, cameraErrors[selectedCamera.id]))}
                      </p>
                      <p className="text-sm text-gray-500 mt-2 max-w-md">
                        {cameraErrors[selectedCamera.id] ?? 'La cámara no está transmitiendo. Puedes iniciarla desde los controles rápidos.'}
                      </p>
                    </div>
                  )}

                  <div className="absolute top-4 left-4 flex items-center gap-2 bg-black/70 px-3 py-2 rounded text-sm text-white">
                    <MonitorPlay className="w-4 h-4" />
                    Vista ampliada
                  </div>
                  {alertPulse && (
                    <div className="absolute inset-0 bg-red-500/10 animate-pulse pointer-events-none" />
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Código</p>
                    <p className="text-sm text-white font-medium mt-1">{selectedCamera.code}</p>
                  </div>
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Ubicación</p>
                    <p className="text-sm text-white font-medium mt-1 truncate">{selectedCamera.location}</p>
                  </div>
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Área</p>
                    <p className="text-sm text-white font-medium mt-1 truncate">{selectedCamera.area_name ?? 'Sin área'}</p>
                  </div>
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-3">
                    <p className="text-xs text-gray-500">Última detección</p>
                    <p className="text-sm text-white font-medium mt-1">
                      {lastSelectedAlert ? new Date(lastSelectedAlert.lastDetectedAt).toLocaleTimeString() : 'Sin alertas recientes'}
                    </p>
                  </div>
                </div>
              </div>

              <aside className="min-h-0 bg-gray-900 border-l border-gray-800 flex flex-col">
                <div className="p-4 border-b border-gray-800">
                  <h3 className="text-white font-semibold mb-3">Cámaras</h3>
                  <div className="space-y-2 max-h-64 xl:max-h-[38vh] overflow-y-auto pr-1">
                    {cameras.map((camera) => {
                      const signal = getCameraSignal(camera, cameraErrors[camera.id]);
                      const isSelected = camera.id === selectedCamera.id;
                      return (
                        <button
                          key={camera.id}
                          type="button"
                          onClick={() => setSelectedCameraId(camera.id)}
                          className={`w-full text-left rounded-lg border p-2 transition-colors ${
                            isSelected ? 'border-blue-500 bg-blue-500/10' : 'border-gray-800 bg-gray-950 hover:bg-gray-800'
                          }`}
                        >
                          <div className="aspect-video bg-gray-800 rounded flex items-center justify-center mb-2">
                            <Camera className="w-7 h-7 text-gray-600" />
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm text-white font-medium truncate">{camera.code}</p>
                            <Circle className={`w-3 h-3 fill-current ${
                              signal === 'streaming'
                                ? 'text-green-400'
                                : signal === 'error'
                                  ? 'text-red-400'
                                  : signal === 'no-signal'
                                    ? 'text-yellow-400'
                                    : 'text-gray-500'
                            }`} />
                          </div>
                          <p className="text-xs text-gray-500 truncate">{camera.name}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-4 flex-1 min-h-0 overflow-y-auto">
                  <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    Últimas alertas
                  </h3>
                  {selectedAlerts.length === 0 ? (
                    <div className="border border-gray-800 rounded-lg p-4 text-center text-sm text-gray-500">
                      Sin alertas recientes para esta cámara
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedAlerts.map((alert) => (
                        <div key={`${alert.id}-${alert.lastDetectedAt}`} className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm text-white font-medium">{formatEppList(alert.missingEpps)}</p>
                            {alert.repetitions > 1 && <span className="text-xs text-red-300">x{alert.repetitions}</span>}
                          </div>
                          <p className="text-xs text-gray-400 mt-1">{alert.location}</p>
                          <p className="text-xs text-gray-500 mt-1">{new Date(alert.lastDetectedAt).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
