import { Link } from 'react-router';
import {
  MonitorPlay,
  AlertTriangle,
  FileBarChart,
  Camera,
  TrendingUp,
  TrendingDown,
  Users,
  Shield,
  Activity,
  ArrowRight,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { ApiDetection, getDashboardStats } from '../services/api';

export function DashboardPage() {
  const [stats, setStats] = useState({
    totalCameras: 0,
    activeCameras: 0,
    totalViolations: 0,
    activeAlerts: 0,
    compliance: 100,
    peopleDetected: 0,
    peopleCurrentlyInArea: 0,
  });

  const [recentViolations, setRecentViolations] = useState<ApiDetection[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        const data = await getDashboardStats();
        setStats({
          totalCameras: data.total_cameras,
          activeCameras: data.active_cameras,
          totalViolations: data.total_violations_today,
          activeAlerts: data.active_alerts,
          compliance: data.compliance,
          peopleDetected: data.people_detected_today,
          peopleCurrentlyInArea: data.people_currently_in_area,
        });
        setRecentViolations(data.recent_violations);
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const timeAgo = (timestamp: string) => {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  const quickActions = [
    {
      title: 'Monitoreo en Vivo',
      description: 'Ver todas las cámaras en tiempo real',
      icon: MonitorPlay,
      link: '/monitoring',
      color: 'blue'
    },
    {
      title: 'Infracciones',
      description: 'Historial completo de violaciones',
      icon: AlertTriangle,
      link: '/violations',
      color: 'red'
    },
    {
      title: 'Reportes',
      description: 'Análisis y estadísticas detalladas',
      icon: FileBarChart,
      link: '/reports',
      color: 'green'
    },
    {
      title: 'Cámaras',
      description: 'Gestionar dispositivos de vigilancia',
      icon: Camera,
      link: '/cameras',
      color: 'purple'
    },
  ];

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-8 py-6">
        <h1 className="text-2xl font-bold text-white mb-2">Dashboard General</h1>
        <p className="text-gray-400">Resumen del estado del sistema de detección de EPPs</p>
      </div>

      <div className="p-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <Camera className="w-10 h-10 opacity-80" />
              <span className="text-sm bg-white/20 px-3 py-1 rounded-full">
                {stats.activeCameras}/{stats.totalCameras} activas
              </span>
            </div>
            <p className="text-3xl font-bold mb-1">{stats.totalCameras}</p>
            <p className="text-blue-100 text-sm">Cámaras Instaladas</p>
          </div>

          <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <AlertTriangle className="w-10 h-10 opacity-80" />
              <div className="flex items-center gap-1 text-sm bg-white/20 px-3 py-1 rounded-full">
                <TrendingUp className="w-3 h-3" />
                +15%
              </div>
            </div>
            <p className="text-3xl font-bold mb-1">{stats.totalViolations}</p>
            <p className="text-red-100 text-sm">Infracciones Hoy</p>
          </div>

          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <Activity className="w-10 h-10 opacity-80" />
              <span className="text-sm bg-white/20 px-3 py-1 rounded-full font-semibold">
                ACTIVO
              </span>
            </div>
            <p className="text-3xl font-bold mb-1">{stats.activeAlerts}</p>
            <p className="text-orange-100 text-sm">Alertas Pendientes</p>
          </div>

          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-6 text-white">
            <div className="flex items-center justify-between mb-4">
              <Shield className="w-10 h-10 opacity-80" />
              <div className="flex items-center gap-1 text-sm bg-white/20 px-3 py-1 rounded-full">
                <TrendingDown className="w-3 h-3" />
                -3%
              </div>
            </div>
            <p className="text-3xl font-bold mb-1">{stats.compliance}%</p>
            <p className="text-green-100 text-sm">Cumplimiento</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Actions */}
          <div className="lg:col-span-2">
            <h2 className="text-xl font-semibold text-white mb-4">Accesos Rápidos</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {quickActions.map((action) => (
                <Link
                  key={action.link}
                  to={action.link}
                  className="bg-gray-900 border border-gray-800 rounded-xl p-6 hover:border-gray-700 transition-all group"
                >
                  <div className={`inline-flex p-3 rounded-lg mb-4 bg-${action.color}-500/10`}>
                    <action.icon className={`w-6 h-6 text-${action.color}-500`} />
                  </div>
                  <h3 className="text-white font-semibold mb-2 flex items-center justify-between">
                    {action.title}
                    <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </h3>
                  <p className="text-gray-400 text-sm">{action.description}</p>
                </Link>
              ))}
            </div>

            {/* Recent Violations */}
            <div className="mt-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-white">Infracciones Recientes</h2>
                <Link
                  to="/violations"
                  className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1"
                >
                  Ver todas
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
                {!loading && recentViolations.map((violation) => (
                  <div key={violation.id} className="p-4 hover:bg-gray-800/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="bg-red-500/20 p-2 rounded-lg">
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                          <p className="text-white font-medium">{violation.camera_code ?? violation.camera_id ?? 'Sin cámara'}</p>
                          <p className="text-gray-400 text-sm">{violation.area_name ?? violation.location ?? 'Sin ubicación'}</p>
                          <div className="mt-1">
                            <span className="text-xs bg-red-500/20 text-red-400 px-2 py-1 rounded">
                              {violation.missing_epps.join(', ') || 'EPP no registrado'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <span className="text-gray-500 text-sm">Hace {timeAgo(violation.created_at)}</span>
                    </div>
                  </div>
                ))}
                {!loading && recentViolations.length === 0 && (
                  <div className="p-6 text-center text-gray-500">No hay infracciones registradas</div>
                )}
              </div>
            </div>
          </div>

          {/* Status Panel */}
          <div>
            <h2 className="text-xl font-semibold text-white mb-4">Estado del Sistema</h2>

            {/* System Status */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 mb-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-white">Detección YOLO</span>
                  </div>
                  <span className="text-green-400 text-sm font-semibold">Activo</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-white">Base de Datos</span>
                  </div>
                  <span className="text-green-400 text-sm font-semibold">Conectado</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <span className="text-white">Sistema de Alarmas</span>
                  </div>
                  <span className="text-green-400 text-sm font-semibold">Operativo</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <span className="text-white">CAM-05</span>
                  </div>
                  <span className="text-red-400 text-sm font-semibold">Offline</span>
                </div>
              </div>
            </div>

            {/* People Count */}
            <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-6 text-white">
              <Users className="w-10 h-10 mb-4 opacity-80" />
              <p className="text-3xl font-bold mb-1">{stats.peopleDetected}</p>
              <p className="text-purple-100 text-sm">Personal Detectado Hoy</p>
              <div className="mt-4 pt-4 border-t border-purple-400/30">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-purple-100">En área actualmente</span>
                  <span className="font-semibold">{stats.peopleCurrentlyInArea} personas</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
