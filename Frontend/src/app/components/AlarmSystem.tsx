import { useEffect, useState } from 'react';
import { Bell, Volume2, VolumeX } from 'lucide-react';

interface AlarmSystemProps {
  isActive: boolean;
  location: string;
  enabled?: boolean;
  volume?: number;
}

export function AlarmSystem({ isActive, location, enabled = true, volume = 80 }: AlarmSystemProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [audioContext, setAudioContext] = useState<AudioContext | null>(null);
  const [lastPlayedAt, setLastPlayedAt] = useState(0);

  useEffect(() => {
    // Inicializar Web Audio API
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      setAudioContext(context);

      return () => {
        context.close().catch(() => undefined);
      };
    } catch {
      setAudioContext(null);
    }
  }, []);

  useEffect(() => {
    if (isActive && enabled && !isMuted && audioContext) {
      const now = Date.now();
      if (now - lastPlayedAt < 3000) return;
      setLastPlayedAt(now);
      playAlarm().catch(() => undefined);
    }
  }, [isActive, enabled, isMuted, audioContext, volume, lastPlayedAt]);

  const playAlarm = async () => {
    if (!audioContext) return;
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    const gainValue = Math.max(0, Math.min(volume, 100)) / 100 * 0.3;

    // Crear un beep de alarma usando Web Audio API
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800; // Frecuencia del beep
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(gainValue, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);

    // Segundo beep
    setTimeout(() => {
      if (!isMuted && isActive && enabled && audioContext.state !== 'closed') {
        const osc2 = audioContext.createOscillator();
        const gain2 = audioContext.createGain();

        osc2.connect(gain2);
        gain2.connect(audioContext.destination);

        osc2.frequency.value = 1000;
        osc2.type = 'sine';

        gain2.gain.setValueAtTime(gainValue, audioContext.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

        osc2.start(audioContext.currentTime);
        osc2.stop(audioContext.currentTime + 0.5);
      }
    }, 600);
  };

  if (!isActive) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-red-600 text-white px-6 py-4 rounded-lg shadow-2xl flex items-center gap-4 animate-[slideDown_0.3s_ease-out]">
        <Bell className="w-6 h-6 animate-[ring_1s_ease-in-out_infinite]" />
        <div>
          <p className="font-bold text-lg">¡ALARMA ACTIVADA!</p>
          <p className="text-sm text-red-100">Infracción en: {location}</p>
        </div>
        <button
          onClick={() => setIsMuted(!isMuted)}
          className="ml-4 p-2 bg-red-700 hover:bg-red-800 rounded-lg transition-colors"
        >
          {isMuted ? (
            <VolumeX className="w-5 h-5" />
          ) : (
            <Volume2 className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
}
