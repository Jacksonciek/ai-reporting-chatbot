import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Plus,
  Bot,
  RefreshCw,
  Trash2,
  Edit3,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { gsap } from "gsap";
import { Room } from "@/types";
import { apiService } from "@/services/api";

interface SidebarProps {
  isExpanded: boolean;
  onToggle: () => void;
  selectedRoomId: string | null;
  onRoomSelect: (roomId: string) => void;
  onNewChat: () => void;
  rooms: Room[];
  onRefreshRooms?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  isExpanded,
  onToggle,
  selectedRoomId,
  onRoomSelect,
  onNewChat,
  rooms: initialRooms,
  onRefreshRooms,
}) => {
  const [rooms, setRooms] = useState<Room[]>(initialRooms);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionTested, setConnectionTested] = useState(false);
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);
  const [editingRoom, setEditingRoom] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const roomRefs = useRef<{ [key: string]: HTMLDivElement }>({});

  // GSAP Animations
  useEffect(() => {
    if (sidebarRef.current) {
      gsap.fromTo(
        sidebarRef.current,
        { x: -100, opacity: 0 },
        { x: 0, opacity: 1, duration: 0.6, ease: "power3.out" }
      );
    }
  }, []);

  useEffect(() => {
    if (isExpanded) {
      gsap.to(sidebarRef.current, {
        width: "320px",
        duration: 0.4,
        ease: "power2.inOut",
      });
    } else {
      gsap.to(sidebarRef.current, {
        width: "64px",
        duration: 0.4,
        ease: "power2.inOut",
      });
    }
  }, [isExpanded]);

  // Animate rooms when they load
  useEffect(() => {
    if (rooms.length > 0) {
      Object.values(roomRefs.current).forEach((ref, index) => {
        if (ref) {
          gsap.fromTo(
            ref,
            { x: -50, opacity: 0 },
            {
              x: 0,
              opacity: 1,
              duration: 0.4,
              delay: index * 0.05,
              ease: "power2.out",
            }
          );
        }
      });
    }
  }, [rooms.length]);

  // Update rooms when prop changes
  useEffect(() => {
    if (initialRooms && initialRooms.length > 0) {
      console.log("Setting rooms from props:", initialRooms);
      setRooms(initialRooms);
      setError(null);
    }
  }, [initialRooms]);

  // Test API connection and load rooms when component mounts
  useEffect(() => {
    if (isExpanded && !connectionTested) {
      loadRooms();
    }
  }, [isExpanded, connectionTested]);

  const loadRooms = useCallback(async () => {
    if (loading) return;

    try {
      setLoading(true);
      setError(null);

      console.log("Loading rooms...");
      const response = await apiService.getRooms({ limit: 50 });

      console.log("API Response:", response);

      if (response.data && response.data.length > 0) {
        const sortedRooms = response.data.sort((a, b) => {
          const dateA = new Date(a.created_at || "").getTime();
          const dateB = new Date(b.created_at || "").getTime();
          return dateB - dateA;
        });

        setRooms(sortedRooms);
        setError(null);
        setConnectionTested(true);
        console.log(`Loaded ${sortedRooms.length} rooms:`, sortedRooms);
      } else {
        setRooms([]);
        setConnectionTested(true);
        console.log("No rooms found");
      }
    } catch (error) {
      console.error("Failed to load rooms:", error);
      setError(
        `Failed to load conversations: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      setRooms([]);
      setConnectionTested(true);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return "Just now";

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Just now";

      const now = new Date();
      const diff = now.getTime() - date.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor(diff / (1000 * 60));

      if (minutes < 1) return "Just now";
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      if (days === 1) return "Yesterday";
      if (days < 7) return `${days}d ago`;
      if (days < 30) return `${Math.floor(days / 7)}w ago`;
      return date.toLocaleDateString();
    } catch {
      return "Just now";
    }
  };

  const truncateText = (text: string, maxLength: number = 30) => {
    if (!text) return "New chat";
    return text.length <= maxLength
      ? text
      : `${text.substring(0, maxLength)}...`;
  };

  const refresh = async () => {
    console.log("Refreshing rooms...");
    setError(null);
    setConnectionTested(false);
    await loadRooms();

    if (onRefreshRooms) {
      onRefreshRooms();
    }
  };

  const handleNewChat = async () => {
    try {
      const newRoom = await apiService.createRoom("New chat");
      console.log("Created new room:", newRoom);

      const roomData: Room = {
        room_id: newRoom.room_id,
        room_name: newRoom.room_name || "New chat",
        created_at: newRoom.created_at,
        updated_at: newRoom.created_at,
        user_id: 1,
      };

      setRooms((prev) => [roomData, ...prev]);
      onNewChat();
      onRoomSelect(newRoom.room_id.toString());
    } catch (error) {
      console.error("Failed to create new room:", error);
      setError("Failed to create new chat");
      onNewChat();
    }
  };

  const handleEditRoom = (roomId: string, currentName: string) => {
    setEditingRoom(roomId);
    setEditingName(currentName);
  };

  const handleSaveEdit = async (roomId: string) => {
    // Add your save logic here
    setEditingRoom(null);
    setEditingName("");
  };

  const sidebarVariants = {
    expanded: {
      width: 320,
      transition: {
        duration: 0.4,
        ease: [0.25, 0.1, 0.25, 1],
      },
    },
    collapsed: {
      width: 64,
      transition: {
        duration: 0.4,
        ease: [0.25, 0.1, 0.25, 1],
      },
    },
  };

  const roomVariants = {
    hidden: {
      x: -20,
      opacity: 0,
      scale: 0.95,
    },
    visible: (index: number) => ({
      x: 0,
      opacity: 1,
      scale: 1,
      transition: {
        delay: index * 0.03,
        duration: 0.3,
        ease: [0.25, 0.1, 0.25, 1],
      },
    }),
    hover: {
      scale: 1.02,
      transition: { duration: 0.2 },
    },
  };

  return (
    <motion.div
      ref={sidebarRef}
      className="fixed left-0 top-0 h-full z-50"
      initial="collapsed"
      animate={isExpanded ? "expanded" : "collapsed"}
      style={{
        background: "rgba(15, 15, 15, 0.95)",
        backdropFilter: "blur(20px)",
        borderRight: "1px solid rgba(255, 255, 255, 0.05)",
        boxShadow: "0 0 40px rgba(0, 0, 0, 0.5)",
      }}
    >
      {/* Header */}
      <motion.div
        className="flex items-center justify-between p-4 border-b border-white/5"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
      >
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="flex items-center space-x-3"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                className="relative"
                whileHover={{ rotate: 10, scale: 1.1 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <Bot className="w-8 h-8 text-blue-400" />
                <motion.div
                  className="absolute inset-0 bg-blue-400/20 rounded-full blur-md"
                  animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              </motion.div>

              <motion.span
                className="text-xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5 }}
              >
                AI Reporting
              </motion.span>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.button
          onClick={onToggle}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 transition-all duration-300"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          {isExpanded ? (
            <ChevronLeft className="w-5 h-5 text-gray-300" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-300" />
          )}
        </motion.button>
      </motion.div>

      {/* New chat button */}
      <motion.div
        className="p-4"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
      >
        <motion.button
          onClick={handleNewChat}
          className={`
            w-full flex items-center space-x-3 p-3 rounded-xl
            bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-cyan-600/20
            hover:from-blue-600/30 hover:via-purple-600/30 hover:to-cyan-600/30
            border border-white/10 hover:border-white/20
            backdrop-blur-md transition-all duration-300
            ${!isExpanded ? "justify-center" : ""}
          `}
          whileHover={{
            scale: 1.02,
            boxShadow: "0 8px 25px rgba(59, 130, 246, 0.15)",
          }}
          whileTap={{ scale: 0.98 }}
        >
          <motion.div
            animate={{ rotate: 0 }}
            whileHover={{ rotate: 90 }}
            transition={{ duration: 0.3 }}
          >
            <Plus className="w-5 h-5 text-blue-400" />
          </motion.div>
          <AnimatePresence>
            {isExpanded && (
              <motion.span
                className="text-gray-200 font-medium"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                New chat
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </motion.div>

      {/* Chat List */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 pb-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent"
      >
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="mb-4 flex items-center justify-between"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ delay: 0.4, duration: 0.3 }}
            >
              <span className="text-sm text-gray-500 font-medium">
                {rooms.length} conversation{rooms.length !== 1 ? "s" : ""}
              </span>
              <motion.button
                onClick={refresh}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 transition-all duration-300"
                title="Refresh conversations"
                disabled={loading}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <motion.div
                  animate={{ rotate: loading ? 360 : 0 }}
                  transition={{
                    duration: 1,
                    repeat: loading ? Infinity : 0,
                    ease: "linear",
                  }}
                >
                  <RefreshCw className="w-4 h-4 text-gray-400" />
                </motion.div>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-2">
          {/* Error State */}
          <AnimatePresence>
            {error && isExpanded && (
              <motion.div
                className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 backdrop-blur-md"
                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex justify-between items-center">
                  <span className="flex-1 text-red-300 text-sm">{error}</span>
                  <motion.button
                    onClick={refresh}
                    className="ml-2 p-1 rounded-lg hover:bg-red-500/20 transition-colors"
                    title="Retry"
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                  >
                    <RefreshCw className="w-4 h-4 text-red-400" />
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading State */}
          <AnimatePresence>
            {loading && isExpanded && (
              <motion.div
                className="p-4 text-center text-gray-500"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.3 }}
              >
                <motion.div
                  className="w-6 h-6 border-2 border-blue-400/30 border-t-blue-400 rounded-full mx-auto mb-2"
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: "linear",
                  }}
                />
                <span className="text-sm">Loading conversations...</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Empty State */}
          <AnimatePresence>
            {!loading &&
              rooms.length === 0 &&
              !error &&
              connectionTested &&
              isExpanded && (
                <motion.div
                  className="p-6 text-center"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.4 }}
                >
                  <motion.div
                    className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center"
                    animate={{
                      scale: [1, 1.05, 1],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  >
                    <MessageSquare className="w-6 h-6 text-gray-600" />
                  </motion.div>
                  <p className="text-gray-500 text-sm">
                    No conversations yet.
                    <br />
                    <span className="text-gray-400">
                      Start a new chat to begin!
                    </span>
                  </p>
                </motion.div>
              )}
          </AnimatePresence>

          {/* Room List */}
          <AnimatePresence>
            {rooms.map((room, index) => (
              <motion.div
                key={room.room_id}
                ref={(el) => {
                  if (el) roomRefs.current[room.room_id] = el;
                }}
                className="relative group"
                initial="hidden"
                animate="visible"
                exit="hidden"
                custom={index}
                whileHover="hover"
                onHoverStart={() => setHoveredRoom(room.room_id.toString())}
                onHoverEnd={() => setHoveredRoom(null)}
              >
                <motion.div
                  className={`
                    rounded-xl transition-all duration-300 overflow-hidden
                    ${
                      selectedRoomId === room.room_id.toString()
                        ? "bg-gradient-to-r from-blue-600/20 via-purple-600/20 to-cyan-600/20 border border-white/20 shadow-lg"
                        : "bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/10"
                    }
                  `}
                  style={{
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <button
                    onClick={() => onRoomSelect(room.room_id.toString())}
                    className={`
                      w-full flex items-center space-x-3 p-3 transition-all duration-200
                      ${!isExpanded ? "justify-center" : ""}
                    `}
                    title={isExpanded ? room.room_name : undefined}
                  >
                    <motion.div
                      animate={{
                        scale:
                          selectedRoomId === room.room_id.toString() ? 1.1 : 1,
                        color:
                          selectedRoomId === room.room_id.toString()
                            ? "#60a5fa"
                            : "#9ca3af",
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      <MessageSquare className="w-5 h-5 flex-shrink-0" />
                    </motion.div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          className="flex-1 text-left min-w-0"
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{ duration: 0.2 }}
                        >
                          {editingRoom === room.room_id.toString() ? (
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onBlur={() =>
                                handleSaveEdit(room.room_id.toString())
                              }
                              onKeyPress={(e) =>
                                e.key === "Enter" &&
                                handleSaveEdit(room.room_id.toString())
                              }
                              className="w-full bg-transparent text-sm font-medium text-gray-200 border-b border-blue-400 outline-none"
                              autoFocus
                            />
                          ) : (
                            <>
                              <div className="truncate text-sm font-medium text-gray-200">
                                {truncateText(room.room_name || "New chat", 25)}
                              </div>
                              <div className="text-xs text-gray-500">
                                {formatDate(room.created_at)}
                              </div>
                            </>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>

                  {/* Hover Actions */}
                  <AnimatePresence>
                    {isExpanded && hoveredRoom === room.room_id.toString() && (
                      <motion.div
                        className="absolute right-2 top-1/2 transform -translate-y-1/2 flex space-x-1"
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.2 }}
                      >
                        <motion.button
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-blue-500/20 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditRoom(
                              room.room_id.toString(),
                              room.room_name || "New chat"
                            );
                          }}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <Edit3 className="w-3 h-3 text-blue-400" />
                        </motion.button>

                        <motion.button
                          className="p-1.5 rounded-lg bg-white/10 hover:bg-red-500/20 transition-colors"
                          onClick={(e) => e.stopPropagation()}
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          <Trash2 className="w-3 h-3 text-red-400" />
                        </motion.button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom Gradient Overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
    </motion.div>
  );
};

Sidebar.displayName = "Sidebar";

export default Sidebar;
