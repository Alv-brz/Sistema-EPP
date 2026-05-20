import { useEffect, useState } from 'react';
import { CameraFeed } from '../components/CameraFeed';
import { ViolationAlert } from '../components/ViolationAlert';
import { AlarmSystem } from '../components/AlarmSystem';
import { Bell, Grid3x3, Grid2x2 } from 'lucide-react';
import { ApiCamera, getCameraStreamUrl, listCameras } from '../services/api';
import { toast } from 'sonner';

interface Violation {
  id: string;
  cameraId: string;
  location: string;
  timestamp: string;
  missingEpps: string[];
  frame: string;
}

export function LiveMonitoringPage() {
  const [activeAlerts, setActiveAlerts] = useState<Violation[]>([]);
  const [alarmActive, setAlarmActive] = useState(false);
  const [alarmLocation, setAlarmLocation] = useState('');
  const [gridView, setGridView] = useState<'2x2' | '3x3'>('2x2');
  const [cameras, setCameras] = useState<ApiCamera[]>([]);

  useEffect(() => {
    listCameras()
      .then(setCameras)
      .catch(() => toast.error('No se pudieron cargar las cámaras'));
  }, []);

  useEffect(() => {
    const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';
    const wsUrl = apiUrl.replace(/^http/, 'ws').replace(/\/api\/v1$/, '/api/v1/ws/detections');
    const socket = new WebSocket(wsUrl);

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.event !== 'detection.created' || !message.data?.missing_epps?.length) return;
      handleViolation({
        id: message.data.id,
        cameraId: message.data.camera_id ?? 'N/A',
        location: message.data.area_name ?? message.data.location ?? 'Sin ubicación',
        timestamp: message.data.created_at,
        missingEpps: message.data.missing_epps,
        frame: message.data.annotated_image_path ?? message.data.image_path ?? '',
      });
    };

    return () => socket.close();
  }, []);

  const handleViolation = (violationData: Violation) => {
    const newViolation: Violation = {
      ...violationData
    };

    setActiveAlerts(prev => [newViolation, ...prev].slice(0, 5));
    setAlarmActive(true);
    setAlarmLocation(violationData.location);

    setTimeout(() => setAlarmActive(false), 5000);
  };

  const handleDismissAlert = (id: string) => {
    setActiveAlerts(prev => prev.filter(alert => alert.id !== id));
  };

  return (
    <div className="flex-1 overflow-auto">
      <AlarmSystem isActive={alarmActive} location={alarmLocation} />

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
            <button className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors relative">
              <Bell className="w-5 h-5 text-white" />
              {activeAlerts.length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {activeAlerts.length}
                </span>
              )}
            </button>
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
                  streamUrl={getCameraStreamUrl(camera.id)}
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
                    onDismiss={() => handleDismissAlert(alert.id)}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
