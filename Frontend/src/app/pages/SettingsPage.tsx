import { useEffect, useMemo, useState } from 'react';
import { Settings, Bell, Camera, Shield, Database, Mail, Save } from 'lucide-react';
import { toast } from 'sonner';
import { getYoloSettings, updateYoloSettings, YoloSettings } from '../services/api';

const classLabels: Record<string, string> = {
  helmet: 'Casco',
  vest: 'Chaleco',
  person: 'Persona',
  gloves: 'Guantes',
  boots: 'Botas',
  goggles: 'Lentes',
};

const modelClassOptions: Record<string, string[]> = {
  'best.pt': ['helmet', 'vest', 'person'],
  'belst.pt': ['helmet', 'vest', 'gloves', 'boots', 'goggles', 'person'],
  'bes33t.pt': ['helmet', 'vest', 'person'],
};

const rawModelClasses: Record<string, string[]> = {
  'best.pt': ['Hardhat', 'Safety Vest', 'Person', 'NO-Hardhat', 'NO-Safety Vest', 'NO-Mask'],
  'belst.pt': ['helmet', 'gloves', 'vest', 'boots', 'goggles', 'no_helmet', 'no_gloves', 'no_boots', 'no_goggle'],
  'bes33t.pt': ['Hardhat', 'Safety Vest', 'Person', 'NO-Hardhat', 'NO-Safety Vest', 'NO-Mask'],
};

const recommendedSensitivity: Record<string, number> = {
  'best.pt': 50,
  'belst.pt': 5,
  'bes33t.pt': 20,
};

export function SettingsPage() {
  const [activeModel, setActiveModel] = useState<'best.pt' | 'belst.pt' | 'bes33t.pt'>('best.pt');
  const [detectionSensitivity, setDetectionSensitivity] = useState(50);
  const [enabledClasses, setEnabledClasses] = useState<string[]>(['helmet', 'vest', 'person']);
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [availableModels, setAvailableModels] = useState<string[]>(['best.pt', 'belst.pt', 'bes33t.pt']);
  const [recommendedThreshold, setRecommendedThreshold] = useState(50);
  const [detectionEnabled, setDetectionEnabled] = useState(true);
  const [alarmVolume, setAlarmVolume] = useState(80);
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [autoArchive, setAutoArchive] = useState(true);
  const [saving, setSaving] = useState(false);

  const visibleClassOptions = useMemo(() => modelClassOptions[activeModel] ?? modelClassOptions['best.pt'], [activeModel]);

  const applySettings = (settings: YoloSettings) => {
    setActiveModel(settings.active_model);
    setDetectionSensitivity(Math.round(settings.confidence_threshold * 100));
    setEnabledClasses(settings.enabled_classes);
    setDetectionEnabled(settings.detection_enabled);
    setAvailableModels(settings.available_models);
    setAvailableClasses(settings.available_classes);
    setRecommendedThreshold(Math.round(settings.recommended_threshold * 100));
  };

  useEffect(() => {
    getYoloSettings()
      .then(applySettings)
      .catch(() => toast.error('No se pudo cargar la configuración YOLO'));
  }, []);

  const handleClassToggle = (className: string, checked: boolean) => {
    setEnabledClasses((current) => {
      if (checked) return Array.from(new Set([...current, className]));
      return current.filter((item) => item !== className);
    });
  };

  const handleModelChange = (model: 'best.pt' | 'belst.pt' | 'bes33t.pt') => {
    setActiveModel(model);
    setRecommendedThreshold(recommendedSensitivity[model] ?? 50);
    const nextOptions = modelClassOptions[model] ?? [];
    setAvailableClasses(rawModelClasses[model] ?? []);
    setEnabledClasses((current) => {
      const nextEnabled = current.filter((item) => nextOptions.includes(item));
      return nextEnabled.length > 0 ? nextEnabled : nextOptions.slice(0, 3);
    });
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const updated = await updateYoloSettings({
        active_model: activeModel,
        confidence_threshold: detectionSensitivity / 100,
        enabled_classes: enabledClasses,
        detection_enabled: detectionEnabled,
      });
      applySettings(updated);
      toast.success('Configuración YOLO guardada');
    } catch {
      toast.error('No se pudo guardar la configuración YOLO');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-8 py-6">
        <h1 className="text-2xl font-bold text-white mb-2">Configuración del Sistema</h1>
        <p className="text-gray-400">Ajustar parámetros y preferencias del sistema</p>
      </div>

      <div className="p-8 max-w-4xl">
        {/* Detection Settings */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-500/20 p-3 rounded-lg">
              <Camera className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Detección YOLO</h2>
              <p className="text-gray-400 text-sm">Configuración del sistema de detección</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-white mb-2">Modelo Activo</label>
              <select
                value={activeModel}
                onChange={(e) => handleModelChange(e.target.value as 'best.pt' | 'belst.pt' | 'bes33t.pt')}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
              >
                {availableModels.map((model) => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-white mb-3">
                Sensibilidad de Detección: <span className="text-blue-400 font-semibold">{detectionSensitivity}%</span>
              </label>
              <input
                type="range"
                min="1"
                max="100"
                value={detectionSensitivity}
                onChange={(e) => setDetectionSensitivity(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-2">
                <span>Baja (1%)</span>
                <span>Alta (100%)</span>
              </div>
              <p className="text-sm text-gray-400 mt-3">
                Sensibilidad recomendada: <span className="text-blue-400 font-semibold">{recommendedThreshold}%</span>
              </p>
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={detectionEnabled}
                  onChange={(e) => setDetectionEnabled(e.target.checked)}
                  className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-blue-600 focus:ring-blue-500 focus:ring-offset-gray-900"
                />
                <div>
                  <p className="text-white font-medium">Habilitar Detección Automática</p>
                  <p className="text-gray-400 text-sm">Detectar infracciones en tiempo real</p>
                </div>
              </label>
            </div>

            <div>
              <label className="block text-white mb-2">Modelos de EPPs a Detectar</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {visibleClassOptions.map((className) => (
                  <label key={className} className="flex items-center gap-2 bg-gray-800 p-3 rounded-lg cursor-pointer hover:bg-gray-700 transition-colors">
                    <input
                      type="checkbox"
                      checked={enabledClasses.includes(className)}
                      onChange={(e) => handleClassToggle(className, e.target.checked)}
                      className="w-4 h-4 rounded bg-gray-700 border-gray-600 text-blue-600"
                    />
                    <span className="text-white text-sm">{classLabels[className] ?? className}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-gray-800/60 rounded-lg p-4">
              <div className="flex justify-between text-sm mb-3">
                <span className="text-gray-400">Modelo activo</span>
                <span className="text-white font-mono">{activeModel}</span>
              </div>
              <div className="flex justify-between text-sm mb-3">
                <span className="text-gray-400">Sensibilidad recomendada</span>
                <span className="text-white font-mono">{recommendedThreshold}%</span>
              </div>
              <p className="text-gray-400 text-sm mb-2">Clases disponibles del modelo</p>
              <div className="flex flex-wrap gap-2">
                {availableClasses.map((className) => (
                  <span key={className} className="bg-blue-500/20 text-blue-300 text-xs px-2 py-1 rounded">
                    {className}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Alarm Settings */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-red-500/20 p-3 rounded-lg">
              <Bell className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Sistema de Alarmas</h2>
              <p className="text-gray-400 text-sm">Configuración de alertas y notificaciones</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-white mb-3">
                Volumen de Alarma: <span className="text-red-400 font-semibold">{alarmVolume}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={alarmVolume}
                onChange={(e) => setAlarmVolume(Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
            </div>

            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={emailAlerts}
                  onChange={(e) => setEmailAlerts(e.target.checked)}
                  className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-red-600 focus:ring-red-500 focus:ring-offset-gray-900"
                />
                <div>
                  <p className="text-white font-medium">Alertas por Email</p>
                  <p className="text-gray-400 text-sm">Recibir notificaciones de infracciones por correo</p>
                </div>
              </label>
            </div>

            <div>
              <label className="block text-white mb-2">Destinatarios de Alertas</label>
              <input
                type="text"
                placeholder="admin@empresa.com, supervisor@empresa.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-red-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Database Settings */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-green-500/20 p-3 rounded-lg">
              <Database className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Base de Datos</h2>
              <p className="text-gray-400 text-sm">Gestión de almacenamiento y retención</p>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoArchive}
                  onChange={(e) => setAutoArchive(e.target.checked)}
                  className="w-5 h-5 rounded bg-gray-700 border-gray-600 text-green-600 focus:ring-green-500 focus:ring-offset-gray-900"
                />
                <div>
                  <p className="text-white font-medium">Archivar Automáticamente</p>
                  <p className="text-gray-400 text-sm">Mover registros antiguos al archivo cada 90 días</p>
                </div>
              </label>
            </div>

            <div>
              <label className="block text-white mb-2">Período de Retención (días)</label>
              <input
                type="number"
                defaultValue="365"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-colors"
              />
            </div>

            <div className="flex gap-3">
              <button className="flex-1 bg-gray-800 hover:bg-gray-700 text-white px-4 py-3 rounded-lg transition-colors">
                Exportar Base de Datos
              </button>
              <button className="flex-1 bg-gray-800 hover:bg-gray-700 text-white px-4 py-3 rounded-lg transition-colors">
                Limpiar Datos Antiguos
              </button>
            </div>
          </div>
        </div>

        {/* System Info */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-purple-500/20 p-3 rounded-lg">
              <Shield className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Información del Sistema</h2>
              <p className="text-gray-400 text-sm">Versión y estado actual</p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-gray-400">Versión del Sistema</span>
              <span className="text-white font-mono">v2.5.1</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-gray-400">Modelo YOLO</span>
              <span className="text-white font-mono">{activeModel}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-800">
              <span className="text-gray-400">Estado de la Base de Datos</span>
              <span className="text-green-400 font-semibold">Conectado</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-gray-400">Última Actualización</span>
              <span className="text-white">03 May 2026</span>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-900 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
