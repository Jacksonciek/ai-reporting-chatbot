'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Activity, Bot, Clock, Database, FileText, PanelRight, RefreshCcw, TerminalSquare } from 'lucide-react';
import { apiService } from '@/services/api';
import { Room } from '@/types';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const getTimestamp = (room: Room) => room.updated_at || room.created_at || undefined;

const formatRelativeTime = (timestamp?: string) => {
  if (!timestamp) return 'Belum ada data';
  const diff = Date.now() - new Date(timestamp).getTime();
  if (diff < 60000) return 'baru saja';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m lalu`;
  if (diff < ONE_DAY_MS) return `${Math.floor(diff / 3600000)}j lalu`;
  return `${Math.floor(diff / ONE_DAY_MS)}h lalu`;
};

const formatAbsolute = (timestamp?: string) => {
  if (!timestamp) return 'Waktu tidak tersedia';
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const endpoints = [
  { method: 'GET', path: '/api/rooms/:user_id/messages', desc: 'List room beserta pesan terakhir' },
  { method: 'GET', path: '/api/:user_id/rooms', desc: 'List pesan per room (user/bot pairs)' },
  { method: 'POST', path: '/api/new_room', desc: 'Buat room baru' },
  { method: 'POST', path: '/api/rooms/:room_id/messages/bot', desc: 'Kirim prompt & dapatkan jawaban bot' },
];

export default function DashboardPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true);
        const response = await apiService.getRooms({ limit: 20 });
        setRooms(response.data || []);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch rooms', err);
        setError('Gagal memuat data dari API');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const stats = useMemo(() => {
    const total = rooms.length;
    const activeToday = rooms.filter((room) => {
      const ts = getTimestamp(room);
      return ts ? Date.now() - new Date(ts).getTime() < ONE_DAY_MS : false;
    }).length;
    const lastActiveRoom = [...rooms].sort((a, b) => {
      const aTs = getTimestamp(a);
      const bTs = getTimestamp(b);
      return new Date(bTs || 0).getTime() - new Date(aTs || 0).getTime();
    })[0];

    return {
      total,
      activeToday,
      lastActiveRoom,
    };
  }, [rooms]);

  const recentRooms = useMemo(() => {
    return [...rooms]
      .sort((a, b) => {
        const aTs = getTimestamp(a);
        const bTs = getTimestamp(b);
        return new Date(bTs || 0).getTime() - new Date(aTs || 0).getTime();
      })
      .slice(0, 5);
  }, [rooms]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-950 text-white relative overflow-hidden">
      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_20%_20%,rgba(96,165,250,0.4),transparent_35%),radial-gradient(circle_at_80%_0%,rgba(168,85,247,0.35),transparent_30%),radial-gradient(circle_at_50%_80%,rgba(34,197,235,0.25),transparent_35%)]" />

      <div className="max-w-6xl mx-auto px-6 py-16 relative z-10 space-y-8">
        <motion.div
          className="flex items-center justify-between"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center space-x-3">
            <Bot className="w-8 h-8 text-blue-400" />
            <div>
              <h1 className="text-3xl font-semibold">Dashboard</h1>
              <p className="text-sm text-gray-400">Ringkasan data dari API chatbot</p>
            </div>
          </div>
          <Link
            href="/chatbot"
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 transition-colors text-white font-medium shadow-lg"
          >
            <span>Buka Chatbot</span>
            <PanelRight className="w-4 h-4" />
          </Link>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 md:grid-cols-3 gap-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <StatCard
            title="Total Room"
            icon={Database}
            value={isLoading ? '...' : stats.total}
            helper="Jumlah percakapan tersimpan"
            gradient="from-blue-500/30 to-cyan-500/30"
          />
          <StatCard
            title="Aktif 24 Jam"
            icon={Activity}
            value={isLoading ? '...' : stats.activeToday}
            helper="Room dengan aktivitas < 24 jam"
            gradient="from-emerald-500/30 to-teal-500/30"
          />
          <StatCard
            title="Aktivitas Terakhir"
            icon={Clock}
            value={
              isLoading
                ? '...'
                : stats.lastActiveRoom
                  ? formatRelativeTime(getTimestamp(stats.lastActiveRoom))
                  : 'Belum ada data'
            }
            helper={
              stats.lastActiveRoom
                ? stats.lastActiveRoom.room_name || `Room #${stats.lastActiveRoom.room_id}`
                : 'Mulai percakapan untuk melihat data'
            }
            gradient="from-purple-500/30 to-pink-500/30"
          />
        </motion.div>

        <motion.div
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">Room Terbaru</h2>
                <p className="text-sm text-gray-400">Diambil dari API /rooms</p>
              </div>
              <RefreshCcw className="w-4 h-4 text-gray-400" />
            </div>

            {error && (
              <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                {error}
              </div>
            )}

            {isLoading ? (
              <div className="text-gray-400 text-sm">Loading data...</div>
            ) : recentRooms.length ? (
              <div className="space-y-3">
                {recentRooms.map((room) => {
                  const ts = getTimestamp(room);
                  return (
                    <div
                      key={room.room_id}
                      className="p-4 rounded-2xl bg-black/20 border border-white/5 hover:border-white/20 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">{room.room_name || `Room #${room.room_id}`}</p>
                          <p className="text-xs text-gray-400">{formatRelativeTime(ts)}</p>
                        </div>
                        <span className="text-xs text-gray-500">{formatAbsolute(ts)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-gray-400 text-sm">Belum ada data room.</div>
            )}
          </div>

          <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-lg shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">API Endpoints</h2>
                <p className="text-sm text-gray-400">Daftar endpoint yang dipakai dashboard</p>
              </div>
              <TerminalSquare className="w-4 h-4 text-gray-400" />
            </div>

            <div className="space-y-2">
              {endpoints.map((ep) => (
                <div
                  key={ep.path}
                  className="p-4 rounded-2xl bg-black/20 border border-white/5 hover:border-white/15 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <span
                      className={`text-xs font-semibold px-2 py-1 rounded ${
                        ep.method === 'GET'
                          ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30'
                          : 'bg-blue-500/20 text-blue-200 border border-blue-500/30'
                      }`}
                    >
                      {ep.method}
                    </span>
                    <p className="text-sm font-mono text-gray-200">{ep.path}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-2">{ep.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  helper,
  icon: Icon,
  gradient,
}: {
  title: string;
  value: string | number;
  helper: string;
  icon: React.ComponentType<any>;
  gradient: string;
}) {
  return (
    <div className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur-lg shadow-2xl flex items-center space-x-4">
      <div className={`p-3 rounded-2xl bg-gradient-to-br ${gradient}`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-400">{title}</p>
        <p className="text-2xl font-semibold">{value}</p>
        <p className="text-xs text-gray-500">{helper}</p>
      </div>
    </div>
  );
}
