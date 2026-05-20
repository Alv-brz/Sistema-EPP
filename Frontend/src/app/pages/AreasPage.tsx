import { useEffect, useState } from 'react';
import { MapPin, Plus, Edit, Trash2, Search, X, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { ApiArea, createArea, deleteArea, getAreas, updateArea } from '../services/api';

interface AreaData {
  id: string;
  name: string;
  description: string;
  requiredEPPs: string[];
}

function fromApiArea(area: ApiArea): AreaData {
  return {
    id: area.id,
    name: area.name,
    description: area.description,
    requiredEPPs: area.required_epps,
  };
}

export function AreasPage() {
  const [areas, setAreas] = useState<AreaData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingArea, setEditingArea] = useState<AreaData | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    requiredEPPs: [] as string[]
  });

  const eppOptions = [
    { id: 'casco', label: 'Casco' },
    { id: 'chaleco', label: 'Chaleco' },
    { id: 'botas', label: 'Botas de Seguridad' },
    { id: 'guantes', label: 'Guantes' },
    { id: 'lentes', label: 'Lentes de Protección' },
  ];

  const eppLabels: Record<string, string> = {
    casco: 'Casco',
    chaleco: 'Chaleco',
    botas: 'Botas',
    guantes: 'Guantes',
    lentes: 'Lentes'
  };

  const loadAreas = async () => {
    try {
      setLoading(true);
      const response = await getAreas();
      console.log('GET /areas response', response);
      setAreas(response.map(fromApiArea));
    } catch (error) {
      console.error('Error loading areas from API', error);
      toast.error('No se pudieron cargar las áreas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAreas();
  }, []);

  const handleCreate = () => {
    setEditingArea(null);
    setFormData({ name: '', description: '', requiredEPPs: [] });
    setShowModal(true);
  };

  const handleEdit = (area: AreaData) => {
    setEditingArea(area);
    setFormData(area);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.description) {
      toast.error('Por favor completa todos los campos');
      return;
    }

    if (formData.requiredEPPs.length === 0) {
      toast.error('Selecciona al menos un EPP requerido');
      return;
    }

    try {
      if (editingArea) {
        const updated = await updateArea(editingArea.id, {
          name: formData.name,
          description: formData.description,
          required_epps: formData.requiredEPPs as ApiArea['required_epps'],
        });
        setAreas(areas.map(a => a.id === editingArea.id ? fromApiArea(updated) : a));
        toast.success('Área actualizada correctamente');
      } else {
        const created = await createArea({
          name: formData.name,
          description: formData.description,
          required_epps: formData.requiredEPPs as ApiArea['required_epps'],
        });
        console.log('POST /areas response', created);
        setAreas([...areas, fromApiArea(created)]);
        toast.success('Área creada correctamente');
      }
      setShowModal(false);
    } catch (error) {
      console.error('Error saving area through API', error);
      toast.error('No se pudo guardar el área');
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('¿Estás seguro de eliminar esta área?')) {
      try {
        await deleteArea(id);
        setAreas(areas.filter(a => a.id !== id));
        toast.success('Área eliminada correctamente');
      } catch (error) {
        console.error('Error deleting area through API', error);
        toast.error('No se pudo eliminar el área');
      }
    }
  };

  const toggleEPP = (epp: string) => {
    if (formData.requiredEPPs.includes(epp)) {
      setFormData({
        ...formData,
        requiredEPPs: formData.requiredEPPs.filter(e => e !== epp)
      });
    } else {
      setFormData({
        ...formData,
        requiredEPPs: [...formData.requiredEPPs, epp]
      });
    }
  };

  const filteredAreas = areas.filter(area =>
    area.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    area.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
    area.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-auto">
      <div className="bg-gray-900 border-b border-gray-800 px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">Gestión de Áreas</h1>
            <p className="text-gray-400">Configurar zonas monitoreadas y requisitos de EPPs</p>
          </div>
          <button
            onClick={handleCreate}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <Plus className="w-5 h-5" />
            Nueva Área
          </button>
        </div>
      </div>

      <div className="p-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <MapPin className="w-10 h-10 text-blue-500 mb-3 opacity-80" />
            <p className="text-3xl font-bold text-white">{areas.length}</p>
            <p className="text-gray-400 text-sm">Áreas Totales</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <Shield className="w-10 h-10 text-green-500 mb-3 opacity-80" />
            <p className="text-3xl font-bold text-white">
              {Array.from(new Set(areas.flatMap(a => a.requiredEPPs))).length}
            </p>
            <p className="text-gray-400 text-sm">Tipos de EPPs</p>
          </div>

          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-10 h-10 bg-purple-500/20 rounded-full flex items-center justify-center">
                <span className="text-purple-400 font-bold">Avg</span>
              </div>
            </div>
            <p className="text-3xl font-bold text-white">
              {areas.length ? (areas.reduce((sum, a) => sum + a.requiredEPPs.length, 0) / areas.length).toFixed(1) : '0.0'}
            </p>
            <p className="text-gray-400 text-sm">EPPs por Área</p>
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
              placeholder="Buscar por ID, nombre o descripción..."
              className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-11 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>

        {/* Areas Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {!loading && filteredAreas.map((area) => (
            <div key={area.id} className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-colors">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-start gap-3 flex-1">
                  <div className="bg-blue-500/20 p-3 rounded-lg">
                    <MapPin className="w-6 h-6 text-blue-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-semibold text-lg mb-1">{area.name}</h3>
                    <p className="text-gray-400 text-sm mb-2">{area.description}</p>
                    <span className="text-gray-500 text-xs font-mono">{area.id}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(area)}
                    className="p-2 bg-blue-500/20 hover:bg-blue-500/30 rounded-lg transition-colors"
                  >
                    <Edit className="w-4 h-4 text-blue-400" />
                  </button>
                  <button
                    onClick={() => handleDelete(area.id)}
                    className="p-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>

              <div>
                <p className="text-gray-400 text-xs mb-2">EPPs Requeridos:</p>
                <div className="flex flex-wrap gap-2">
                  {area.requiredEPPs.map((epp) => (
                    <span
                      key={epp}
                      className="bg-blue-500/20 text-blue-400 text-xs px-3 py-1 rounded-full flex items-center gap-1"
                    >
                      <Shield className="w-3 h-3" />
                      {eppLabels[epp]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredAreas.length === 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-12 text-center">
            <MapPin className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">No se encontraron áreas</p>
          </div>
        )}

        {/* Modal */}
        {showModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-white">
                  {editingArea ? 'Editar Área' : 'Nueva Área'}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Nombre del Área</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500"
                    placeholder="Área de Producción"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Descripción</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-blue-500 resize-none"
                    placeholder="Describe el área y su función"
                    rows={3}
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-3">EPPs Requeridos</label>
                  <div className="space-y-2">
                    {eppOptions.map((epp) => (
                      <label
                        key={epp.id}
                        className="flex items-center gap-3 bg-gray-800 hover:bg-gray-700 p-3 rounded-lg cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={formData.requiredEPPs.includes(epp.id)}
                          onChange={() => toggleEPP(epp.id)}
                          className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
                        />
                        <div className="flex items-center gap-2 flex-1">
                          <Shield className="w-4 h-4 text-blue-400" />
                          <span className="text-white">{epp.label}</span>
                        </div>
                      </label>
                    ))}
                  </div>
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
                  {editingArea ? 'Actualizar' : 'Crear'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
