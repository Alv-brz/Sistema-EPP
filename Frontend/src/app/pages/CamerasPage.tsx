import { useEffect, useState } from 'react';
import { Camera, Plus, Edit, Trash2, Power, Settings, Search, X, MapPin, Wifi } from 'lucide-react';
import { toast } from 'sonner';
import { ApiArea, ApiCamera, createCamera, deleteCamera, getAreas, getCameraStreamUrl, listCameras, startCamera, stopCamera, updateCamera } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { canControlCameras, canManageCameras } from '../auth/permissions';

interface CameraData {
  id: string;
  name: string;
  location: string;
  areaId: string;
  areaName: string;
  ip: string;
  status: 'online' | 'offline';
  sourceType: 'webcam' | 'rtsp';
  sourceUrl: string;
  isStreaming: boolean;
  resolution: string;
  fps: number;
}

function fromApiCamera(camera: ApiCamera): CameraData {
  return {
    id: camera.id,
    name: camera.name,
    location: camera.location,
    areaId: camera.area_id ?? '',
    areaName: camera.area_name ?? camera.location,
    ip: camera.ip,
    status: camera.status,
    sourceType: camera.source_type,
    sourceUrl: camera.source_url ?? '',
    isStreaming: camera.is_streaming,
    resolution: camera.resolution,
    fps: camera.fps,
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error) || !error.message) {
    return fallback;
  }
  try {
    const parsed = JSON.parse(error.message);
    if (typeof parsed.detail === 'string') {
      return parsed.detail;
    }
  } catch {
    return error.message;
  }
  return fallback;
}

export function CamerasPage() {
  const { user } = useAuth();
  const allowManageCameras = canManageCameras(user?.role);
  const allowControlCameras = canControlCameras(user?.role);
  const [cameras, setCameras] = useState<CameraData[]>([]);
  const [areas, setAreas] = useState<ApiArea[]>([]);
  const [cameraCodes, setCameraCodes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCamera, setEditingCamera] = useState<CameraData | null>(null);
  const [cameraToDelete, setCameraToDelete] = useState<CameraData | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    areaId: '',
    areaName: '',
    ip: '',
    status: 'online' as const,
    sourceType: 'webcam' as const,
    sourceUrl: '0',
    resolution: '1920x1080',
    fps: 30
  });

  const loadAreas = async (): Promise<ApiArea[]> => {
    const response = await getAreas();
    setAreas(response);
    return response;
  };

  const loadCameras = async () => {
    try {
      setLoading(true);
      const apiCameras = await listCameras();
      if (allowManageCameras) {
        await loadAreas();
      }
      setCameras(apiCameras.map(fromApiCamera));
      setCameraCodes(Object.fromEntries(apiCameras.map(camera => [camera.id, camera.code])));
    } catch {
      toast.error('No se pudieron cargar las cámaras');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCameras();
  }, [allowManageCameras]);

  const handleCreate = () => {
    if (!allowManageCameras) return;
    setEditingCamera(null);
    loadAreas().catch(() => toast.error('No se pudieron cargar las áreas'));
    setFormData({ name: '', location: '', areaId: '', areaName: '', ip: '', status: 'online', sourceType: 'webcam', sourceUrl: '0', resolution: '1920x1080', fps: 30 });
    setShowModal(true);
  };

  const handleEdit = (camera: CameraData) => {
    if (!allowManageCameras) return;
    setEditingCamera(camera);
    loadAreas().catch(() => toast.error('No se pudieron cargar las áreas'));
    setFormData({
      name: camera.name,
      location: camera.location,
      areaId: camera.areaId,
      areaName: camera.areaName,
      ip: camera.ip,
      status: camera.status,
      sourceType: camera.sourceType,
      sourceUrl: camera.sourceUrl,
      resolution: camera.resolution,
      fps: camera.fps,
    });
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!allowManageCameras) return;
    if (!formData.name || !formData.areaId || !formData.ip) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    const selectedArea = areas.find(area => area.id === formData.areaId);
    const areaName = selectedArea?.name ?? formData.areaName;

    try {
      if (editingCamera) {
        const updated = await updateCamera(editingCamera.id, {
          name: formData.name,
          location: areaName,
          area_id: formData.areaId,
          area_name: areaName,
          ip: formData.ip,
          status: formData.status,
          source_type: formData.sourceType,
          source_url: formData.sourceUrl,
          resolution: formData.resolution,
          fps: formData.fps,
        });
        setCameras(cameras.map(c => c.id === editingCamera.id ? fromApiCamera(updated) : c));
        setCameraCodes({ ...cameraCodes, [updated.id]: updated.code });
        toast.success('Cámara actualizada correctamente');
      } else {
        const created = await createCamera({
          name: formData.name,
          location: areaName,
          area_id: formData.areaId,
          area_name: areaName,
          ip: formData.ip,
          status: formData.status,
          source_type: formData.sourceType,
          source_url: formData.sourceUrl,
          resolution: formData.resolution,
          fps: formData.fps,
        });
        setCameras([...cameras, fromApiCamera(created)]);
        setCameraCodes({ ...cameraCodes, [created.id]: created.code });
        toast.success('Cámara creada correctamente');
      }
      setShowModal(false);
    } catch {
      toast.error('No se pudo guardar la cámara');
    }
  };

  const handleDelete = async () => {
    if (!allowManageCameras || !cameraToDelete) return;
    try {
      await deleteCamera(cameraToDelete.id);
      setCameras(cameras.filter(c => c.id !== cameraToDelete.id));
      setCameraToDelete(null);
      toast.success('Cámara eliminada correctamente');
    } catch {
      toast.error('No se pudo eliminar la cámara');
    }
  };

  const toggleStatus = async (camera: CameraData) => {
    if (!allowControlCameras) return;
    try {
      const updated = camera.isStreaming ? await stopCamera(camera.id) : await startCamera(camera.id);
      setCameras(cameras.map(c => c.id === camera.id ? fromApiCamera(updated) : c));
      toast.success(camera.isStreaming ? 'Cámara detenida' : 'Cámara iniciada');
    } catch (error) {
      toast.error(getErrorMessage(error, 'No se pudo cambiar el estado de la cámara'));
    }
  };

  const filteredCameras = cameras.filter(camera =>
    camera.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    camera.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    camera.areaName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cameraCodes[camera.id] ?? camera.id).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-auto">
      <div className="bg-gray-900 border-b border-gray-800 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Gestión de Cámaras</h1>
            <p className="text-gray-400">Configurar y administrar dispositivos de vigilancia</p>
          </div>
          {allowManageCameras && (
            <button
              onClick={handleCreate}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <Plus className="w-5 h-5" />
              Agregar Cámara
            </button>
          )}
        </div>
      </div>

      <div className="p-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <Camera className="w-10 h-10 text-blue-500 mb-3 opacity-80" />
            <p className="text-3xl font-bold text-white">{cameras.length}</p>
            <p className="text-gray-400 text-sm">Total de Cámaras</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <Wifi className="w-10 h-10 text-green-500 mb-3 opacity-80" />
            <p className="text-3xl font-bold text-green-500">{cameras.filter(c => c.isStreaming).length}</p>
            <p className="text-gray-400 text-sm">Transmitiendo</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <Power className="w-10 h-10 text-red-500 mb-3 opacity-80" />
            <p className="text-3xl font-bold text-red-500">{cameras.filter(c => !c.isStreaming).length}</p>
            <p className="text-gray-400 text-sm">Detenidas</p>
          </div>
        </div>

        {/* Search */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por ID, nombre o ubicación..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Cameras Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {!loading && filteredCameras.map((camera) => (
            <div
              key={camera.id}
              className={`bg-gray-900 border-2 rounded-xl p-6 transition-all ${
                camera.isStreaming
                  ? 'border-gray-800 hover:border-gray-700'
                  : 'border-red-500/30 hover:border-red-500/50'
              }`}
            >
              {/* Camera Preview */}
              <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-lg mb-4 flex items-center justify-center relative overflow-hidden">
                {camera.isStreaming ? (
                  <img
                    src={getCameraStreamUrl(camera.id)}
                    alt={camera.name}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                ) : (
                  <Camera className="w-12 h-12 text-gray-600" />
                )}
                {camera.isStreaming && (
                  <div className="absolute top-2 right-2 flex items-center gap-2 bg-green-500/90 px-2 py-1 rounded text-xs text-white">
                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                    LIVE
                  </div>
                )}
              </div>

              {/* Camera Info */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-white font-semibold">{cameraCodes[camera.id] ?? camera.id}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    camera.isStreaming
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-red-500/20 text-red-400'
                  }`}>
                  {camera.isStreaming ? 'STREAMING' : 'DETENIDA'}
                  </span>
                </div>
                <p className="text-gray-300 text-sm mb-2">{camera.name}</p>
                <div className="flex items-center gap-2 text-gray-400 text-xs">
                  <MapPin className="w-3 h-3" />
                  <span>{camera.location}</span>
                </div>
              </div>

              {/* Technical Details */}
              <div className="bg-gray-800/50 rounded-lg p-3 mb-4 space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">IP:</span>
                  <span className="text-white font-mono">{camera.ip}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Fuente:</span>
                  <span className="text-white">{camera.sourceType.toUpperCase()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Resolución:</span>
                  <span className="text-white">{camera.resolution}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">FPS:</span>
                  <span className="text-white">{camera.fps}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                {allowControlCameras && (
                  <button
                    onClick={() => toggleStatus(camera)}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      camera.isStreaming
                        ? 'bg-red-500/20 hover:bg-red-500/30 text-red-400'
                        : 'bg-green-500/20 hover:bg-green-500/30 text-green-400'
                    }`}
                  >
                    <Power className="w-4 h-4" />
                    {camera.isStreaming ? 'Detener' : 'Iniciar'}
                  </button>
                )}
                {allowManageCameras && (
                  <>
                    <button
                      onClick={() => handleEdit(camera)}
                      className="p-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setCameraToDelete(camera)}
                      className="p-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {!loading && filteredCameras.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <Camera className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No se encontraron cámaras</p>
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">
                  {editingCamera ? 'Editar Cámara' : 'Nueva Cámara'}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Nombre</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                    placeholder="Cámara Principal"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Ubicación</label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <select
                      value={formData.areaId}
                      onFocus={() => loadAreas().catch(() => toast.error('No se pudieron cargar las áreas'))}
                      onChange={(e) => {
                        const area = areas.find(item => item.id === e.target.value);
                        setFormData({ ...formData, areaId: e.target.value, areaName: area?.name ?? '', location: area?.name ?? '' });
                      }}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-11 pr-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="">{areas.length === 0 ? 'No hay áreas registradas' : 'Seleccionar área'}</option>
                      {areas.map((area) => (
                        <option key={area.id} value={area.id}>{area.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Dirección IP</label>
                  <input
                    type="text"
                    value={formData.ip}
                    onChange={(e) => setFormData({ ...formData, ip: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white font-mono focus:outline-none focus:border-blue-500"
                    placeholder="192.168.1.100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Tipo de Fuente</label>
                    <select
                      value={formData.sourceType}
                      onChange={(e) => setFormData({ ...formData, sourceType: e.target.value as 'webcam' | 'rtsp', sourceUrl: e.target.value === 'webcam' ? '0' : formData.sourceUrl })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="webcam">Webcam Local</option>
                      <option value="rtsp">RTSP / IP</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-400 text-sm mb-2">
                      {formData.sourceType === 'webcam' ? 'Índice Webcam' : 'URL RTSP'}
                    </label>
                    <input
                      type="text"
                      value={formData.sourceUrl}
                      onChange={(e) => setFormData({ ...formData, sourceUrl: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white font-mono focus:outline-none focus:border-blue-500"
                      placeholder={formData.sourceType === 'webcam' ? '0' : 'rtsp://usuario:clave@ip/stream1'}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-400 text-sm mb-2">Resolución</label>
                    <select
                      value={formData.resolution}
                      onChange={(e) => setFormData({ ...formData, resolution: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="1280x720">1280x720 (HD)</option>
                      <option value="1920x1080">1920x1080 (Full HD)</option>
                      <option value="2560x1440">2560x1440 (2K)</option>
                      <option value="3840x2160">3840x2160 (4K)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-gray-400 text-sm mb-2">FPS</label>
                    <select
                      value={formData.fps}
                      onChange={(e) => setFormData({ ...formData, fps: Number(e.target.value) })}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                    >
                      <option value="15">15</option>
                      <option value="24">24</option>
                      <option value="30">30</option>
                      <option value="60">60</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Estado</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="online">En Línea</option>
                    <option value="offline">Fuera de Línea</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowModal(false)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2.5 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg transition-colors"
                >
                  {editingCamera ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        )}

        {cameraToDelete && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Eliminar cámara</h2>
                <button onClick={() => setCameraToDelete(null)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-gray-300 text-sm mb-6">
                ¿Deseas eliminar la cámara <span className="font-semibold text-white">{cameraToDelete.name}</span>? Esta acción no se puede deshacer.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setCameraToDelete(null)}
                  className="flex-1 bg-gray-800 hover:bg-gray-700 text-white px-4 py-2.5 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-lg transition-colors"
                >
                  Eliminar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
