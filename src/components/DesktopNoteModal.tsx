import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Bell,
  Trash2,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Calendar,
  Clock,
  Radio,
} from 'lucide-react';
import { ref, onValue, remove } from 'firebase/database';
import { rtdb } from '../firebase';
import { Language } from '../types';
import { t } from '../services/translations';

interface NotificationItem {
  id: string;
  message: string;
  author: string;
  color?: string;
  timestamp: number | string;
  sourceNode?: string;
}

// Helper to extract specific message text accurately across all schema variations
function extractMessageText(item: any): string {
  if (item === null || item === undefined) return '';
  if (typeof item === 'string') return item.trim();
  if (typeof item === 'number' || typeof item === 'boolean') return String(item);

  if (typeof item === 'object') {
    // 1. Direct string fields in order of priority (standard Firebase RTDB patterns)
    if (typeof item.text === 'string' && item.text.trim()) return item.text.trim();
    if (typeof item.message === 'string' && item.message.trim()) return item.message.trim();
    if (typeof item.msg === 'string' && item.msg.trim()) return item.msg.trim();
    if (typeof item.content === 'string' && item.content.trim()) return item.content.trim();
    if (typeof item.body === 'string' && item.body.trim()) return item.body.trim();
    if (typeof item.notification === 'string' && item.notification.trim()) return item.notification.trim();
    if (typeof item.title === 'string' && item.title.trim()) return item.title.trim();
    if (typeof item.note === 'string' && item.note.trim()) return item.note.trim();
    if (typeof item.value === 'string' && item.value.trim()) return item.value.trim();
    if (typeof item.description === 'string' && item.description.trim()) return item.description.trim();

    // 2. Nested objects (data, payload, notification, message, text)
    if (item.data && typeof item.data === 'object') {
      const nested = extractMessageText(item.data);
      if (nested) return nested;
    }
    if (item.payload && typeof item.payload === 'object') {
      const nested = extractMessageText(item.payload);
      if (nested) return nested;
    }
    if (item.message && typeof item.message === 'object') {
      const nested = extractMessageText(item.message);
      if (nested) return nested;
    }
    if (item.text && typeof item.text === 'object') {
      const nested = extractMessageText(item.text);
      if (nested) return nested;
    }

    // 3. Fallback: find any non-metadata string property
    for (const [key, val] of Object.entries(item)) {
      if (
        typeof val === 'string' &&
        val.trim() &&
        !['author', 'sender', 'user', 'name', 'timestamp', 'time', 'date', 'createdAt', 'id', 'key', 'color', 'theme'].includes(key)
      ) {
        return val.trim();
      }
    }

    try {
      return JSON.stringify(item);
    } catch {
      return String(item);
    }
  }

  return String(item);
}

function extractAuthor(item: any): string {
  if (typeof item === 'object' && item !== null) {
    if (typeof item.author === 'string' && item.author.trim()) return item.author.trim();
    if (typeof item.sender === 'string' && item.sender.trim()) return item.sender.trim();
    if (typeof item.user === 'string' && item.user.trim()) return item.user.trim();
    if (typeof item.username === 'string' && item.username.trim()) return item.username.trim();
    if (typeof item.displayName === 'string' && item.displayName.trim()) return item.displayName.trim();
    if (typeof item.name === 'string' && item.name.trim()) return item.name.trim();
  }
  return 'Yaaro Ka Yaar';
}

function extractTimestamp(item: any): number | string {
  if (typeof item === 'object' && item !== null) {
    if (item.timestamp) return item.timestamp;
    if (item.createdAt) return item.createdAt;
    if (item.time) return item.time;
    if (item.date) return item.date;
    if (item.created) return item.created;
  }
  return Date.now();
}

interface DesktopNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUsername?: string;
  lang?: Language;
}

export const DesktopNoteModal: React.FC<DesktopNoteModalProps> = ({
  isOpen,
  onClose,
  lang = 'en',
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const listEndRef = useRef<HTMLDivElement>(null);
  const initialLoadRef = useRef(true);

  // Audio synthesizer for incoming notifications
  const playChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1318.51, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1661.22, ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.45);
    } catch {
      // ignore
    }
  };

  // Track message timestamps so they remain stable across re-renders
  const timestampCache = useRef<Record<string, number | string>>({});
  const lastMessageMap = useRef<Record<string, string>>({});

  // Real-time listener actively targeting "text" (https://.../text), "messages", and "notifications" nodes in Firebase Realtime Database
  useEffect(() => {
    setIsLoading(true);
    const textRef = ref(rtdb, 'text');
    const messagesRef = ref(rtdb, 'messages');
    const notificationsRef = ref(rtdb, 'notifications');
    const singleMsgRef = ref(rtdb, 'message');

    let currentText: NotificationItem[] = [];
    let currentMessages: NotificationItem[] = [];
    let currentNotifications: NotificationItem[] = [];
    let currentSingleMsg: NotificationItem[] = [];

    const updateAll = () => {
      const map = new Map<string, NotificationItem>();
      
      // Combine all sources: text (primary), messages, notifications, message
      [...currentText, ...currentMessages, ...currentNotifications, ...currentSingleMsg].forEach((item) => {
        map.set(item.id, item);
      });
      const combined = Array.from(map.values());

      // Sort latest notifications first
      combined.sort((a, b) => {
        const tA = new Date(a.timestamp).getTime() || 0;
        const tB = new Date(b.timestamp).getTime() || 0;
        return tB - tA;
      });

      if (!initialLoadRef.current && combined.length > notifications.length) {
        playChime();
      }
      initialLoadRef.current = false;
      setIsLoading(false);
      setNotifications(combined);
    };

    const processSnapshot = (snapshot: any, sourceNode: string): NotificationItem[] => {
      const loaded: NotificationItem[] = [];
      if (!snapshot.exists()) return loaded;

      const rawVal = snapshot.val();
      if (rawVal === null || rawVal === undefined) return loaded;

      // 1. Primitive string, number, or boolean directly at the node (e.g. /text = "Match started live")
      if (typeof rawVal === 'string' || typeof rawVal === 'number' || typeof rawVal === 'boolean') {
        const textStr = String(rawVal).trim();
        if (textStr) {
          const cacheKey = `${sourceNode}-direct-value`;
          if (!lastMessageMap.current[cacheKey] || lastMessageMap.current[cacheKey] !== textStr) {
            lastMessageMap.current[cacheKey] = textStr;
            timestampCache.current[cacheKey] = Date.now();
          }

          loaded.push({
            id: cacheKey,
            message: textStr,
            author: 'Yaaro Ka Yaar',
            timestamp: timestampCache.current[cacheKey] || Date.now(),
            sourceNode,
          });
        }
        return loaded;
      }

      // 2. Object at the node
      if (typeof rawVal === 'object') {
        // Check if rawVal itself represents a single message object with a direct text/message property
        const directText = (typeof rawVal.text === 'string' && rawVal.text.trim()) ||
                           (typeof rawVal.message === 'string' && rawVal.message.trim()) ||
                           (typeof rawVal.msg === 'string' && rawVal.msg.trim()) ||
                           (typeof rawVal.content === 'string' && rawVal.content.trim()) ||
                           (typeof rawVal.body === 'string' && rawVal.body.trim()) ||
                           (typeof rawVal.notification === 'string' && rawVal.notification.trim()) ||
                           '';

        const keys = Object.keys(rawVal);
        const hasNestedObjects = keys.some(k => typeof rawVal[k] === 'object' && rawVal[k] !== null);

        // If it has a direct text property and no child objects, treat as a single message
        if (directText && !hasNestedObjects) {
          const cacheKey = `${sourceNode}-single-object`;
          if (!lastMessageMap.current[cacheKey] || lastMessageMap.current[cacheKey] !== directText) {
            lastMessageMap.current[cacheKey] = directText;
            timestampCache.current[cacheKey] = extractTimestamp(rawVal);
          }

          loaded.push({
            id: cacheKey,
            message: directText,
            author: extractAuthor(rawVal),
            timestamp: timestampCache.current[cacheKey],
            sourceNode,
          });
          return loaded;
        }

        // 3. Otherwise iterate through child nodes (e.g. push keys or child records)
        snapshot.forEach((childSnap: any) => {
          const childKey = childSnap.key || String(Date.now());
          const childVal = childSnap.val();
          const mappedText = extractMessageText(childVal);

          if (mappedText) {
            const cacheKey = `${sourceNode}-${childKey}`;
            if (!lastMessageMap.current[cacheKey] || lastMessageMap.current[cacheKey] !== mappedText) {
              lastMessageMap.current[cacheKey] = mappedText;
              timestampCache.current[cacheKey] = extractTimestamp(childVal);
            }

            loaded.push({
              id: cacheKey,
              message: mappedText,
              author: extractAuthor(childVal),
              timestamp: timestampCache.current[cacheKey],
              sourceNode,
            });
          }
        });
      }

      return loaded;
    };

    // Primary listener: Firebase RTDB "text" node (https://yaarokayaarstream-default-rtdb.asia-southeast1.firebasedatabase.app/text)
    const unsubText = onValue(
      textRef,
      (snapshot) => {
        currentText = processSnapshot(snapshot, 'text');
        updateAll();
      },
      (error) => {
        console.error('RTDB text listener error:', error);
        setIsLoading(false);
      }
    );

    // Listener for "messages" node
    const unsubMessages = onValue(
      messagesRef,
      (snapshot) => {
        currentMessages = processSnapshot(snapshot, 'messages');
        updateAll();
      },
      (error) => {
        console.error('RTDB messages listener error:', error);
      }
    );

    // Listener for "notifications" node
    const unsubNotifications = onValue(
      notificationsRef,
      (snapshot) => {
        currentNotifications = processSnapshot(snapshot, 'notifications');
        updateAll();
      },
      (error) => {
        console.error('RTDB notifications listener error:', error);
      }
    );

    // Listener for single "message" node
    const unsubSingleMsg = onValue(
      singleMsgRef,
      (snapshot) => {
        currentSingleMsg = processSnapshot(snapshot, 'message');
        updateAll();
      },
      (error) => {
        console.error('RTDB message listener error:', error);
      }
    );

    return () => {
      unsubText();
      unsubMessages();
      unsubNotifications();
      unsubSingleMsg();
    };
  }, []);

  if (!isOpen) return null;

  const handleDelete = async (id: string, sourceNode = 'messages') => {
    try {
      if (id.startsWith('text-direct-value') || id.startsWith('text-single-object')) {
        await remove(ref(rtdb, 'text'));
      } else if (id.startsWith('message-direct-value') || id.startsWith('message-single-object')) {
        await remove(ref(rtdb, 'message'));
      } else if (id.startsWith(`${sourceNode}-`)) {
        const childKey = id.slice(sourceNode.length + 1);
        await remove(ref(rtdb, `${sourceNode}/${childKey}`));
      } else {
        await remove(ref(rtdb, `${sourceNode}/${id}`));
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatNotificationDateTime = (ts: number | string) => {
    if (!ts) return { date: 'Today', time: 'Just now' };
    const d = new Date(ts);
    if (isNaN(d.getTime())) return { date: 'Date', time: String(ts) };

    const dateStr = d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

    const timeStr = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });

    return { date: dateStr, time: timeStr };
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 flex flex-col w-screen h-screen overflow-hidden text-slate-100 font-sans animate-in fade-in duration-200">
      {/* Full Screen Header */}
      <header className="shrink-0 h-16 px-4 sm:px-8 bg-slate-900/90 border-b border-slate-800/80 backdrop-blur-md flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-500/10 text-rose-500 rounded-xl border border-rose-500/20 shadow-xs">
            <Bell className="w-5 h-5 text-rose-400" />
          </div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">{t('notification_title', lang)}</h1>
            <span className="text-xs font-bold px-2.5 py-0.5 bg-rose-500/15 text-rose-400 border border-rose-500/30 rounded-full">
              {notifications.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`p-2 rounded-xl transition-all cursor-pointer border ${
              soundEnabled
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : 'bg-slate-800 border-slate-700 text-slate-400'
            }`}
            title={soundEnabled ? t('sound_enabled', lang) : t('sound_muted', lang)}
            aria-label="Toggle Sound"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>

          {/* Close Button */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-600 hover:text-white text-slate-300 rounded-xl transition-all cursor-pointer border border-slate-700 font-semibold text-xs active:scale-95 shadow-2xs"
            title={t('close', lang)}
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">{t('close', lang)}</span>
          </button>
        </div>
      </header>

      {/* Main Full-Screen Notifications Feed (Receives all incoming messages from Firebase Realtime Database) */}
      <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 bg-slate-950/60">
        <div className="max-w-4xl mx-auto space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400">
              <Radio className="w-8 h-8 text-rose-400 animate-spin mb-3" />
              <p className="text-sm font-semibold">{t('connecting_rtdb', lang)}</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center text-slate-400">
              <div className="w-14 h-14 rounded-2xl bg-slate-900 flex items-center justify-center mb-3 text-rose-400 border border-slate-800 shadow-inner">
                <Bell className="w-7 h-7 opacity-60" />
              </div>
              <h3 className="text-base font-bold text-slate-200 mb-1">{t('no_notifications', lang)}</h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-sm">
                {t('notification_empty_hint', lang)}
              </p>
            </div>
          ) : (
            notifications.map((note) => {
              const { date, time } = formatNotificationDateTime(note.timestamp);
              const isCopied = copiedId === note.id;

              return (
                <div
                  key={note.id}
                  className="p-4 sm:p-5 rounded-2xl bg-slate-900/90 border border-slate-800/90 hover:border-slate-700 shadow-md transition-all group"
                >
                  {/* Card Header: Author + Date + Time + Copy & Delete */}
                  <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 mb-3 border-b border-slate-800/80">
                    {/* Author Badge */}
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
                        {note.author ? note.author[0].toUpperCase() : 'Y'}
                      </div>
                      <span className="text-xs sm:text-sm font-bold text-slate-200">
                        {note.author || 'Yaaro Ka Yaar'}
                      </span>
                    </div>

                    {/* Meta: Date, Time & Action Buttons */}
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      {/* Date Badge */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/90 border border-slate-700/80 rounded-lg text-slate-300 text-xs font-medium">
                        <Calendar className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>{date}</span>
                      </div>

                      {/* Time Badge */}
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800/90 border border-slate-700/80 rounded-lg text-slate-300 text-xs font-mono font-medium">
                        <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>{time}</span>
                      </div>

                      {/* Copy Button */}
                      <button
                        type="button"
                        onClick={() => handleCopy(note.id, note.message)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                          isCopied
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-slate-700'
                        }`}
                        title={t('copy', lang)}
                        aria-label="Copy Notification Text"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                            <span>{t('copied', lang)}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
                            <span>{t('copy', lang)}</span>
                          </>
                        )}
                      </button>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDelete(note.id, note.sourceNode)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                        title={t('delete', lang)}
                        aria-label="Delete Notification"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Notification Content Body */}
                  <p className="text-sm sm:text-base font-normal text-slate-100 leading-relaxed whitespace-pre-wrap break-words select-text">
                    {note.message}
                  </p>
                </div>
              );
            })
          )}
          <div ref={listEndRef} />
        </div>
      </main>
    </div>
  );
};
