import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getDetectionWebSocketUrl, getGeneralSettings } from '../services/api';
import { useAuth } from './AuthContext';

const NOTIFICATIONS_KEY = 'epp_notifications';
const ACTIVE_ALERTS_KEY = 'epp_active_alerts';
const ALARM_SETTINGS_KEY = 'epp_alarm_settings';
const MAX_NOTIFICATIONS = 50;
const MAX_ACTIVE_ALERTS = 10;
const ACTIVE_WINDOW_MS = 10 * 60 * 1000;
const DUPLICATE_WINDOW_MS = 30 * 1000;
const SOUND_COOLDOWN_MS = 3000;

export interface GlobalAlert {
  id: string;
  cameraId: string;
  location: string;
  timestamp: string;
  lastDetectedAt: string;
  missingEpps: string[];
  frame: string;
  read: boolean;
  repetitions: number;
  sourceIds: string[];
}

interface AlertContextType {
  notifications: GlobalAlert[];
  activeAlerts: GlobalAlert[];
  unreadCount: number;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
  dismissActiveAlert: (id: string) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

function safeParseAlerts(value: string | null): GlobalAlert[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isRecent(alert: GlobalAlert): boolean {
  return Date.now() - new Date(alert.lastDetectedAt || alert.timestamp).getTime() <= ACTIVE_WINDOW_MS;
}

function normalizeMissingEpps(missingEpps: string[]): string[] {
  return [...new Set(missingEpps.map((item) => String(item).trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );
}

function getSignature(alert: Pick<GlobalAlert, 'cameraId' | 'missingEpps'>): string {
  return `${alert.cameraId}|${normalizeMissingEpps(alert.missingEpps).join(',')}`;
}

function limitActive(alerts: GlobalAlert[]): GlobalAlert[] {
  return alerts.filter(isRecent).slice(0, MAX_ACTIVE_ALERTS);
}

function mapDetectionToAlert(data: any): GlobalAlert | null {
  const missingEpps = normalizeMissingEpps(data?.missing_epps ?? []);
  if (!missingEpps.length) return null;

  const timestamp = data.created_at ?? data.timestamp ?? new Date().toISOString();
  return {
    id: String(data.id ?? `${data.camera_code ?? data.camera_id ?? 'unknown'}-${timestamp}`),
    cameraId: String(data.camera_code ?? data.camera_id ?? 'N/A'),
    location: String(data.area_name ?? data.location ?? 'Sin ubicación'),
    timestamp,
    lastDetectedAt: timestamp,
    missingEpps,
    frame: String(data.annotated_image_path ?? data.annotated_image_url ?? data.image_path ?? data.image_url ?? ''),
    read: false,
    repetitions: 1,
    sourceIds: [String(data.id ?? timestamp)],
  };
}

export function AlertProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<GlobalAlert[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<GlobalAlert[]>([]);
  const [alarmSettings, setAlarmSettings] = useState({ enabled: true, volume: 80 });
  const notificationsRef = useRef<GlobalAlert[]>([]);
  const activeAlertsRef = useRef<GlobalAlert[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const closingRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const lastSoundAtRef = useRef(0);
  const audioBlockedNotifiedRef = useRef(false);

  useEffect(() => {
    const savedNotifications = safeParseAlerts(localStorage.getItem(NOTIFICATIONS_KEY)).slice(0, MAX_NOTIFICATIONS);
    const savedActiveAlerts = limitActive(safeParseAlerts(localStorage.getItem(ACTIVE_ALERTS_KEY)));
    notificationsRef.current = savedNotifications;
    activeAlertsRef.current = savedActiveAlerts;
    setNotifications(savedNotifications);
    setActiveAlerts(savedActiveAlerts);

    const savedSettings = localStorage.getItem(ALARM_SETTINGS_KEY);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        setAlarmSettings({ enabled: Boolean(parsed.enabled), volume: Number(parsed.volume ?? 80) });
      } catch {
        setAlarmSettings({ enabled: true, volume: 80 });
      }
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    getGeneralSettings()
      .then((settings) => {
        const next = { enabled: settings.alarm_sound_enabled, volume: settings.alarm_volume };
        setAlarmSettings(next);
        localStorage.setItem(ALARM_SETTINGS_KEY, JSON.stringify(next));
      })
      .catch(() => undefined);
  }, [isAuthenticated]);

  useEffect(() => {
    const unlockAudio = () => {
      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch {
          return;
        }
      }
      audioContextRef.current.resume().catch(() => undefined);
    };

    window.addEventListener('pointerdown', unlockAudio, { once: true });
    window.addEventListener('keydown', unlockAudio, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);
      audioContextRef.current?.close().catch(() => undefined);
      audioContextRef.current = null;
    };
  }, []);

  const playAlarm = useCallback(async () => {
    if (!alarmSettings.enabled) return;
    const now = Date.now();
    if (now - lastSoundAtRef.current < SOUND_COOLDOWN_MS) return;
    lastSoundAtRef.current = now;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const context = audioContextRef.current;
      if (context.state === 'suspended') {
        await context.resume();
      }
      const gainValue = (Math.max(0, Math.min(alarmSettings.volume, 100)) / 100) * 0.3;

      [0, 0.6].forEach((offset, index) => {
        const oscillator = context.createOscillator();
        const gainNode = context.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(context.destination);
        oscillator.frequency.value = index === 0 ? 800 : 1000;
        oscillator.type = 'sine';
        gainNode.gain.setValueAtTime(gainValue, context.currentTime + offset);
        gainNode.gain.exponentialRampToValueAtTime(0.01, context.currentTime + offset + 0.45);
        oscillator.start(context.currentTime + offset);
        oscillator.stop(context.currentTime + offset + 0.45);
      });
    } catch {
      if (!audioBlockedNotifiedRef.current) {
        audioBlockedNotifiedRef.current = true;
        toast.info('El navegador bloqueó el sonido. Haz clic en la página para habilitar alarmas.');
      }
    }
  }, [alarmSettings.enabled, alarmSettings.volume]);

  const persistNotifications = (alerts: GlobalAlert[]) => {
    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(alerts.slice(0, MAX_NOTIFICATIONS)));
  };

  const persistActiveAlerts = (alerts: GlobalAlert[]) => {
    localStorage.setItem(ACTIVE_ALERTS_KEY, JSON.stringify(limitActive(alerts)));
  };

  const upsertAlert = useCallback(
    (incoming: GlobalAlert) => {
      const previousNotifications = notificationsRef.current;
      const bySourceId = previousNotifications.find((item) => item.sourceIds.includes(incoming.id) || item.id === incoming.id);
      if (bySourceId) return;

      let displayedAlert = incoming;
      const incomingSignature = getSignature(incoming);
      const duplicate = previousNotifications.find((item) => {
        const ageMs = new Date(incoming.lastDetectedAt).getTime() - new Date(item.lastDetectedAt).getTime();
        return getSignature(item) === incomingSignature && ageMs >= 0 && ageMs <= DUPLICATE_WINDOW_MS;
      });

      const nextNotifications = duplicate
        ? [
            {
              ...duplicate,
              location: incoming.location,
              frame: incoming.frame || duplicate.frame,
              lastDetectedAt: incoming.lastDetectedAt,
              read: false,
              repetitions: duplicate.repetitions + 1,
              sourceIds: [...duplicate.sourceIds, incoming.id],
            },
            ...previousNotifications.filter((item) => item.id !== duplicate.id),
          ]
        : [incoming, ...previousNotifications];

      displayedAlert = nextNotifications[0];
      const limitedNotifications = nextNotifications.slice(0, MAX_NOTIFICATIONS);
      notificationsRef.current = limitedNotifications;
      persistNotifications(limitedNotifications);
      setNotifications(limitedNotifications);

      const previousActiveAlerts = activeAlertsRef.current;
      const existing = previousActiveAlerts.find((item) => item.id === displayedAlert.id);
      const nextActiveAlerts = existing
        ? [displayedAlert, ...previousActiveAlerts.filter((item) => item.id !== displayedAlert.id)]
        : [displayedAlert, ...previousActiveAlerts];
      const limitedActiveAlerts = limitActive(nextActiveAlerts);
      activeAlertsRef.current = limitedActiveAlerts;
      persistActiveAlerts(limitedActiveAlerts);
      setActiveAlerts(limitedActiveAlerts);

      toast.error('Infracción detectada', {
        description: `${displayedAlert.cameraId} - ${displayedAlert.location} - ${displayedAlert.missingEpps.join(', ')} - ${new Date(displayedAlert.lastDetectedAt).toLocaleTimeString()}`,
      });
      playAlarm().catch(() => undefined);
    },
    [playAlarm],
  );

  const connect = useCallback(() => {
    if (!isAuthenticated || socketRef.current) return;
    closingRef.current = false;
    const socket = new WebSocket(getDetectionWebSocketUrl());
    socketRef.current = socket;

    socket.onopen = () => {
      reconnectAttemptsRef.current = 0;
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.event !== 'detection.created') return;
        const alert = mapDetectionToAlert(message.data);
        if (alert) upsertAlert(alert);
      } catch {
        undefined;
      }
    };

    socket.onerror = () => {
      if (!closingRef.current) {
        toast.error('No se pudo conectar al canal global de alertas');
      }
    };

    socket.onclose = (event) => {
      socketRef.current = null;
      if (closingRef.current || !isAuthenticated) return;
      if (event.code === 1008) {
        toast.error('Sesión no válida para alertas en vivo');
        return;
      }
      const delay = Math.min(30000, 1000 * 2 ** reconnectAttemptsRef.current);
      reconnectAttemptsRef.current += 1;
      reconnectTimerRef.current = window.setTimeout(connect, delay);
    };
  }, [isAuthenticated, upsertAlert]);

  useEffect(() => {
    if (isAuthenticated) {
      connect();
    }

    return () => {
      closingRef.current = true;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [connect, isAuthenticated]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setActiveAlerts((prev) => {
        const next = limitActive(prev);
        if (next.length !== prev.length) {
          activeAlertsRef.current = next;
          persistActiveAlerts(next);
        }
        return next;
      });
    }, 30000);
    return () => window.clearInterval(interval);
  }, []);

  const markAsRead = useCallback((id: string) => {
    const mark = (items: GlobalAlert[]) => items.map((item) => (item.id === id ? { ...item, read: true } : item));
    setNotifications((prev) => {
      const next = mark(prev);
      notificationsRef.current = next;
      persistNotifications(next);
      return next;
    });
    setActiveAlerts((prev) => {
      const next = mark(prev);
      activeAlertsRef.current = next;
      persistActiveAlerts(next);
      return next;
    });
  }, []);

  const markAllAsRead = useCallback(() => {
    const markAll = (items: GlobalAlert[]) => items.map((item) => ({ ...item, read: true }));
    setNotifications((prev) => {
      const next = markAll(prev);
      notificationsRef.current = next;
      persistNotifications(next);
      return next;
    });
    setActiveAlerts((prev) => {
      const next = markAll(prev);
      activeAlertsRef.current = next;
      persistActiveAlerts(next);
      return next;
    });
  }, []);

  const clearNotifications = useCallback(() => {
    notificationsRef.current = [];
    activeAlertsRef.current = [];
    setNotifications([]);
    setActiveAlerts([]);
    localStorage.removeItem(NOTIFICATIONS_KEY);
    localStorage.removeItem(ACTIVE_ALERTS_KEY);
  }, []);

  const dismissActiveAlert = useCallback((id: string) => {
    setActiveAlerts((prev) => {
      const next = prev.filter((item) => item.id !== id);
      activeAlertsRef.current = next;
      persistActiveAlerts(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      notifications,
      activeAlerts,
      unreadCount: notifications.filter((item) => !item.read).length,
      markAsRead,
      markAllAsRead,
      clearNotifications,
      dismissActiveAlert,
    }),
    [activeAlerts, clearNotifications, dismissActiveAlert, markAllAsRead, markAsRead, notifications],
  );

  return <AlertContext.Provider value={value}>{children}</AlertContext.Provider>;
}

export function useAlerts() {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlerts must be used within AlertProvider');
  }
  return context;
}
