import React, { useMemo, useState } from "react";
import {
  Send,
  Bot,
  Zap,
  BarChart3,
  FileText,
  MessageSquare,
  Sparkles,
  Activity,
  Clock,
} from "lucide-react";
import { Room } from "@/types";

interface WelcomeProps {
  onSendMessage: (message: string) => Promise<void>;
  isBotTyping: boolean;
  rooms: Room[];
  onRoomSelect: (roomId: string) => void;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

const getTimestamp = (room: Room) =>
  room.updated_at || room.created_at || undefined;

const formatRelativeTime = (timestamp?: string) => {
  if (!timestamp) return "Belum ada data";
  const diff = Date.now() - new Date(timestamp).getTime();
  if (diff < 60000) return "baru saja";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m lalu`;
  if (diff < ONE_DAY_MS) return `${Math.floor(diff / 3600000)}j lalu`;
  return `${Math.floor(diff / ONE_DAY_MS)}h lalu`;
};

const formatAbsolute = (timestamp?: string) => {
  if (!timestamp) return "Waktu tidak tersedia";
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const Welcome: React.FC<WelcomeProps> = ({
  onSendMessage,
  isBotTyping,
  rooms,
  onRoomSelect,
}) => {
  const [inputValue, setInputValue] = useState("");

  const stats = useMemo(() => {
    const totalChats = rooms.length;
    const activeToday = rooms.filter((room) => {
      const ts = getTimestamp(room);
      if (!ts) return false;
      return Date.now() - new Date(ts).getTime() < ONE_DAY_MS;
    }).length;
    const lastActiveRoom = [...rooms]
      .sort((a, b) => {
        const aTs = getTimestamp(a);
        const bTs = getTimestamp(b);
        return (
          new Date(bTs || 0).getTime() - new Date(aTs || 0).getTime()
        );
      })
      .shift();

    return [
      {
        label: "Total Percakapan",
        value: totalChats,
        sublabel: totalChats ? "Riwayat tersimpan" : "Mulai percakapan pertama",
        icon: MessageSquare,
      },
      {
        label: "Aktif 24 Jam",
        value: activeToday,
        sublabel: "Percakapan terbaru",
        icon: Activity,
      },
      {
        label: "Aktivitas Terakhir",
        value: lastActiveRoom ? formatRelativeTime(getTimestamp(lastActiveRoom)) : "Belum ada data",
        sublabel: lastActiveRoom
          ? `Room #${lastActiveRoom.room_id}`
          : "Kirim pesan untuk memulai",
        icon: Clock,
      },
    ];
  }, [rooms]);

  const recentRooms = useMemo(() => {
    return [...rooms]
      .sort((a, b) => {
        const aTs = getTimestamp(a);
        const bTs = getTimestamp(b);
        return (
          new Date(bTs || 0).getTime() - new Date(aTs || 0).getTime()
        );
      })
      .slice(0, 4);
  }, [rooms]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isBotTyping) return;
    const message = inputValue.trim();
    setInputValue("");
    await onSendMessage(message);
  };

  const samplePrompts = [
    {
      icon: <BarChart3 className="w-5 h-5" />,
      title: "Sales Analysis",
      prompt: "Berikan 3 kategori penjualan tertinggi",
      gradient: "from-emerald-400 to-cyan-400",
    },
    {
      icon: <FileText className="w-5 h-5" />,
      title: "Export Data",
      prompt:
        "Berikan file excel yang berisi penjualan produk kategori elektronik",
      gradient: "from-purple-400 to-pink-400",
    },
    {
      icon: <BarChart3 className="w-5 h-5" />,
      title: "City Performance",
      prompt: "Berikan penjualan tertinggi berdasarkan kota",
      gradient: "from-orange-400 to-red-400",
    },
    {
      icon: <MessageSquare className="w-5 h-5" />,
      title: "General Inquiry",
      prompt: "Halo, selamat malam",
      gradient: "from-blue-400 to-indigo-400",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-slate-900 to-gray-900 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse delay-1000" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[32rem] h-[32rem] bg-cyan-500/5 rounded-full blur-[160px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto py-12 px-6 space-y-10">
        <header className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3">
            <div className="inline-flex items-center space-x-3 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span className="text-xs uppercase tracking-widest text-gray-300">
                Dashboard Percakapan
              </span>
            </div>
            <div className="flex items-center space-x-3">
              <div className="p-4 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 backdrop-blur">
                <Bot className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-semibold text-white">
                  Selamat datang kembali
                </h1>
                <p className="text-gray-400">
                  Lihat ringkasan aktivitas chat sebelum mulai bertanya.
                </p>
              </div>
            </div>
          </div>
          <div className="text-sm text-gray-400 border border-white/10 rounded-2xl px-4 py-3 backdrop-blur-lg">
            Sistem siap menerima perintah baru kapan saja. Mulai analisis data
            dengan mengetik pertanyaan di bawah.
          </div>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="p-5 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-lg flex items-center space-x-4 hover:border-white/20 transition-colors"
            >
              <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-purple-500/20">
                <stat.icon className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-400">{stat.label}</p>
                <p className="text-2xl font-semibold text-white">
                  {stat.value}
                </p>
                <p className="text-xs text-gray-500">{stat.sublabel}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Percakapan Terbaru
                </h2>
                <p className="text-sm text-gray-400">
                  Ringkasan 4 percakapan terakhir Anda
                </p>
              </div>
              <button
                className="text-sm text-blue-300 hover:text-blue-200 transition-colors"
                onClick={() => onSendMessage("Tolong ringkas semua percakapan terakhir saya.")}
                disabled={isBotTyping}
              >
                Ringkas percakapan
              </button>
            </div>

            {recentRooms.length ? (
              <div className="space-y-3">
                {recentRooms.map((room) => {
                  const timestamp = getTimestamp(room);
                  return (
                    <button
                      key={room.room_id}
                      onClick={() => onRoomSelect(room.room_id.toString())}
                      className="w-full text-left p-4 rounded-2xl bg-black/20 border border-white/5 hover:border-white/20 hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-white">
                            {room.room_name || `Room #${room.room_id}`}
                          </p>
                          <p className="text-xs text-gray-400">
                            {timestamp
                              ? formatRelativeTime(timestamp)
                              : "Belum ada aktivitas"}
                          </p>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatAbsolute(timestamp)}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 rounded-2xl border border-dashed border-white/10 text-center text-gray-400">
                Belum ada percakapan yang tersimpan. Kirim pesan pertama Anda
                untuk memulai dashboard.
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="p-6 rounded-3xl bg-gradient-to-br from-blue-600/30 to-purple-600/30 border border-white/10 backdrop-blur space-y-4">
              <h3 className="text-white font-semibold">
                Mulai cepat dengan prompt berikut
              </h3>
              <div className="grid gap-3">
                {samplePrompts.map((sample) => (
                  <button
                    key={sample.title}
                    onClick={() => onSendMessage(sample.prompt)}
                    disabled={isBotTyping}
                    className="text-left p-4 rounded-2xl bg-white/10 hover:bg-white/20 transition-colors disabled:opacity-50"
                  >
                    <div className="flex items-center space-x-3">
                      <div
                        className={`p-2 rounded-xl bg-gradient-to-r ${sample.gradient} text-white`}
                      >
                        {sample.icon}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-white">
                          {sample.title}
                        </p>
                        <p className="text-xs text-gray-200 line-clamp-2">
                          {sample.prompt}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4 rounded-2xl border border-white/10 bg-white/5 text-xs text-gray-300">
              Tips: gunakan bahasa natural seperti{" "}
              <span className="text-white">
                &quot;Bandingkan penjualan 2023 vs 2024&quot;
              </span>{" "}
              agar bot langsung memahami konteks.
            </div>
          </div>
        </section>

        <section className="p-6 rounded-3xl bg-white/5 border border-white/10 backdrop-blur space-y-4">
          <form onSubmit={handleSubmit} className="relative">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Tanyakan sesuatu tentang data penjualan Anda..."
              className="w-full p-5 pr-16 rounded-2xl bg-black/30 border border-white/10 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-400/20 transition-all"
              disabled={isBotTyping}
            />
            <button
              type="submit"
              disabled={!inputValue.trim() || isBotTyping}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-3 rounded-xl bg-blue-600 hover:bg-blue-500 transition-colors disabled:opacity-50"
            >
              {isBotTyping ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Send className="w-5 h-5 text-white" />
              )}
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-center">
            {[
              { icon: <Zap className="w-4 h-4" />, text: "Analisis Real-time" },
              { icon: <FileText className="w-4 h-4" />, text: "Export Excel" },
              {
                icon: <BarChart3 className="w-4 h-4" />,
                text: "Visualisasi Data",
              },
            ].map((feature) => (
              <div
                key={feature.text}
                className="flex items-center justify-center space-x-2 p-3 rounded-xl bg-black/30 border border-white/10 text-gray-300"
              >
                {feature.icon}
                <span className="text-sm">{feature.text}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 text-center">
            AI dapat membuat kesalahan. Pastikan untuk memverifikasi informasi
            penting.
          </p>
        </section>
      </div>
    </div>
  );
};

export default Welcome;
