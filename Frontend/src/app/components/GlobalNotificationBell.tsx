import { useState } from 'react';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import { useAlerts } from '../contexts/AlertContext';

export function GlobalNotificationBell() {
  const [open, setOpen] = useState(false);
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearNotifications } = useAlerts();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((current) => !current)}
        className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors relative"
        title="Notificaciones"
      >
        <Bell className="w-5 h-5 text-white" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs min-w-5 h-5 px-1 rounded-full flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-gray-900 border border-gray-800 rounded-lg shadow-xl z-50">
          <div className="flex items-center justify-between p-3 border-b border-gray-800">
            <div>
              <p className="text-white font-semibold">Notificaciones</p>
              <p className="text-xs text-gray-500">Máximo 50 alertas recientes</p>
            </div>
            <div className="flex gap-2">
              <button onClick={markAllAsRead} className="p-1 text-gray-400 hover:text-white" title="Marcar todas como leídas">
                <CheckCheck className="w-4 h-4" />
              </button>
              <button onClick={clearNotifications} className="p-1 text-gray-400 hover:text-white" title="Limpiar notificaciones">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="p-4 text-sm text-gray-500 text-center">No hay notificaciones</p>
            ) : (
              notifications.map((item) => (
                <div key={item.id} className={`p-3 border-b border-gray-800 ${item.read ? 'bg-gray-900' : 'bg-red-500/10'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm text-white font-medium">
                        {item.cameraId}
                        {item.repetitions > 1 && <span className="ml-2 text-xs text-red-300">x{item.repetitions}</span>}
                      </p>
                      <p className="text-xs text-gray-400 truncate">{item.location}</p>
                      <p className="text-xs text-red-400 mt-1">{item.missingEpps.join(', ')}</p>
                      <p className="text-xs text-gray-500 mt-1">{new Date(item.lastDetectedAt).toLocaleString()}</p>
                    </div>
                    {!item.read && (
                      <button onClick={() => markAsRead(item.id)} className="p-1 text-gray-400 hover:text-white" title="Marcar como leída">
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
