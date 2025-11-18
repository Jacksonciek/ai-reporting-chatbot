import React, { useState, useEffect, useRef } from "react";
import {
  Send,
  Bot,
  User,
  Download,
  FileText,
  Copy,
  Check,
  Sparkles,
  Edit3,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Mock Message interface since we don't have access to the actual types
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  image?: string;
  document?: string;
  created_at: string;
}

interface ChatInterfaceProps {
  roomId: string | null;
  sidebarExpanded: boolean;
  messages: Message[];
  onSendMessage: (message: string) => Promise<void>;
  isBotTyping: boolean;
  onNewChat: () => void;
  onEditMessage: (messageId: string, updatedContent: string) => Promise<void>;
}

const EmptyState: React.FC = () => (
  <motion.div
    className="flex-1 flex items-center justify-center p-8"
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6 }}
  >
    <div className="text-center max-w-md">
      <motion.div
        animate={{
          rotate: 360,
          scale: [1, 1.1, 1],
        }}
        transition={{
          rotate: { duration: 20, repeat: Infinity, ease: "linear" },
          scale: { duration: 2, repeat: Infinity, ease: "easeInOut" },
        }}
      >
        <Sparkles className="w-16 h-16 mx-auto mb-4 text-blue-400/70" />
      </motion.div>
      <motion.h3
        className="text-2xl font-semibold text-gray-200 mb-2 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        Ready to chat
      </motion.h3>
      <motion.p
        className="text-gray-400"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
      >
        Start a conversation by typing your message below
      </motion.p>
    </div>
  </motion.div>
);

const TypingIndicator: React.FC = () => (
  <motion.div
    className="flex items-start space-x-3"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -10 }}
    transition={{ duration: 0.3 }}
  >
    <div className="w-8 h-8 rounded-full bg-gray-800/60 backdrop-blur-md border border-gray-600/30 flex items-center justify-center">
      <Bot className="w-4 h-4 text-blue-400" />
    </div>
    <div className="bg-gray-800/60 backdrop-blur-md rounded-2xl p-4 border border-gray-600/30">
      <div className="flex space-x-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-2 h-2 bg-blue-400 rounded-full"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
    </div>
  </motion.div>
);

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  roomId,
  sidebarExpanded,
  messages,
  onSendMessage,
  isBotTyping,
  onNewChat,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, [roomId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || isBotTyping) return;

    const message = inputValue.trim();
    setInputValue("");
    await onSendMessage(message);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const copyToClipboard = async (text: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
    } catch (error) {
      console.error("Failed to copy text:", error);
    }
  };

  const startEditing = (message: Message) => {
    if (isBotTyping || message.role !== "user") return;
    setEditingMessageId(message.id);
    setEditingValue(message.content);
  };

  const cancelEditing = () => {
    setEditingMessageId(null);
    setEditingValue("");
  };

  const handleEditSubmit = async () => {
    if (!editingMessageId) return;
    const trimmed = editingValue.trim();
    if (!trimmed) return;
    await onEditMessage(editingMessageId, trimmed);
    cancelEditing();
  };

  const formatContentWithBold = (text: string) => {
    const result: React.ReactNode[] = [];
    const regex = /\*\*([\s\S]*?)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        result.push(text.slice(lastIndex, match.index));
      }

      const boldText = match[1];
      result.push(
        <strong key={`bold-${match.index}-${boldText}`}>
          {boldText}
        </strong>
      );

      lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) {
      result.push(text.slice(lastIndex));
    }

    return result.length ? result : [text];
  };

  const renderMessageContent = (message: Message) => {
    const content = (
      <div className="space-y-3">
        <div className="prose prose-invert max-w-none relative">
          {editingMessageId === message.id && message.role === "user" ? (
            <div className="space-y-3">
              <textarea
                value={editingValue}
                onChange={(e) => setEditingValue(e.target.value)}
                className="w-full bg-gray-900/70 border border-gray-600/50 rounded-xl p-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-400/40"
                rows={3}
              />
              <div className="flex space-x-2">
                <motion.button
                  onClick={handleEditSubmit}
                  className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  disabled={isBotTyping}
                >
                  Regenerate
                </motion.button>
                <motion.button
                  onClick={cancelEditing}
                  className="px-3 py-1.5 text-sm rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  Cancel
                </motion.button>
              </div>
            </div>
          ) : (
            <div className="whitespace-pre-wrap leading-relaxed text-gray-100">
              {formatContentWithBold(message.content)}
            </div>
          )}
        </div>

        {message.image && (
          <motion.div
            className="mt-3"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            <img
              src={message.image}
              alt="Generated content"
              className="max-w-full h-auto rounded-lg border border-gray-600/30 shadow-2xl backdrop-blur-sm"
              style={{ maxHeight: "400px" }}
            />
          </motion.div>
        )}

        {message.document && (
          <motion.div
            className="mt-3 p-3 bg-gray-800/40 backdrop-blur-md rounded-lg border border-gray-600/30"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center space-x-3">
              <FileText className="w-5 h-5 text-blue-400" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-200">
                  Document Attachment
                </p>
                <p className="text-xs text-gray-400">Click to download</p>
              </div>
              <motion.a
                href={message.document}
                download
                className="p-2 bg-gray-700/50 backdrop-blur-sm rounded-lg transition-all duration-200 hover:bg-blue-500/20 border border-gray-600/30"
                target="_blank"
                rel="noopener noreferrer"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Download className="w-4 h-4 text-gray-300" />
              </motion.a>
            </div>
          </motion.div>
        )}
      </div>
    );

    if (message.role === "assistant") {
      return (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {content}
        </motion.div>
      );
    }

    return content;
  };

  return (
    <div
      className={`
      flex flex-col h-screen transition-all duration-300 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900
      ${sidebarExpanded ? "ml-80" : "ml-16"}
    `}
    >
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full blur-3xl animate-pulse"
          style={{ animationDelay: "1s" }}
        ></div>
      </div>

      {/* Header */}
      <motion.div
        className="border-b border-gray-700/50 backdrop-blur-md bg-gray-800/30 p-4 relative z-10"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <motion.div
              whileHover={{ rotate: 15, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400, damping: 10 }}
            >
              <Bot className="w-6 h-6 text-blue-400" />
            </motion.div>
            <span className="font-medium text-gray-200">
              {roomId ? "AI Assistant" : "New Conversation"}
            </span>
          </div>
          <AnimatePresence>
            {messages.length > 0 && (
              <motion.button
                onClick={onNewChat}
                className="px-4 py-2 text-sm bg-gray-700/50 backdrop-blur-sm rounded-lg border border-gray-600/30 hover:border-gray-500/50 transition-all duration-200 text-gray-200 hover:bg-gray-600/50"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                New chat
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Messages Area */}
      {messages.length === 0 && !isBotTyping ? (
        <EmptyState />
      ) : (
        <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-track-gray-800 scrollbar-thumb-gray-600">
          <div className="max-w-4xl mx-auto p-4 space-y-6">
            <AnimatePresence>
              {messages.map((message, index) => (
                <motion.div
                  key={message.id}
                  className={`flex items-start space-x-3 group ${
                    message.role === "user"
                      ? "flex-row-reverse space-x-reverse"
                      : ""
                  }`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                >
                  <motion.div
                    className={`
                      w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                      ${
                        message.role === "user"
                          ? "bg-gradient-to-r from-blue-500 to-purple-500 shadow-lg"
                          : "bg-gray-800/60 backdrop-blur-md border border-gray-600/30"
                      }
                    `}
                    whileHover={{ scale: 1.1 }}
                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  >
                    {message.role === "user" ? (
                      <User className="w-4 h-4 text-white" />
                    ) : (
                      <Bot className="w-4 h-4 text-blue-400" />
                    )}
                  </motion.div>

                  <motion.div
                    className={`
                      max-w-3xl backdrop-blur-md rounded-2xl p-4 relative group/message
                      ${
                        message.role === "user"
                          ? "bg-gradient-to-r from-blue-600/20 to-purple-600/20 border border-blue-500/30 shadow-lg"
                          : "bg-gray-800/40 border border-gray-600/30"
                      }
                    `}
                    whileHover={{ scale: 1.01 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  >
                    {renderMessageContent(message)}

                    <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                      <div>{new Date(message.created_at).toLocaleTimeString()}</div>
                      <div className="flex items-center space-x-2 opacity-0 group-hover/message:opacity-100 transition-opacity duration-200">
                        <motion.button
                          onClick={() => copyToClipboard(message.content, message.id)}
                          className="p-2 rounded-lg bg-gray-700/60 hover:bg-gray-700 text-gray-200 border border-gray-600/50"
                          title="Copy message"
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                        >
                          <AnimatePresence mode="wait">
                            {copiedMessageId === message.id ? (
                              <motion.div
                                key="check"
                                initial={{ scale: 0, rotate: -180 }}
                                animate={{ scale: 1, rotate: 0 }}
                                exit={{ scale: 0, rotate: 180 }}
                                transition={{ duration: 0.2 }}
                              >
                                <Check className="w-4 h-4 text-green-400" />
                              </motion.div>
                            ) : (
                              <motion.div
                                key="copy"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                exit={{ scale: 0 }}
                                transition={{ duration: 0.2 }}
                              >
                                <Copy className="w-4 h-4 text-gray-200" />
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.button>
                        {message.role === "user" && (
                          <motion.button
                            onClick={() => startEditing(message)}
                            className="p-2 rounded-lg bg-gray-700/60 hover:bg-gray-700 text-gray-200 border border-gray-600/50"
                            title="Edit & regenerate"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            disabled={isBotTyping}
                          >
                            <Edit3 className="w-4 h-4" />
                          </motion.button>
                        )}
                      </div>
                    </div>

                  </motion.div>
                </motion.div>
              ))}
            </AnimatePresence>

            <AnimatePresence>
              {isBotTyping && <TypingIndicator />}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </div>
        </div>
      )}

      {/* Input Area */}
      <motion.div
        className="border-t border-gray-700/50 backdrop-blur-md bg-gray-800/30 p-4 relative z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex space-x-3">
            <div className="flex-1 relative">
              <motion.input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setIsInputFocused(true)}
                onBlur={() => setIsInputFocused(false)}
                placeholder={
                  roomId
                    ? "Type your message..."
                    : "Start a new conversation..."
                }
                className={`
                  w-full p-4 pr-12 bg-gray-800/60 backdrop-blur-md rounded-2xl border transition-all duration-300 text-white placeholder-gray-400 focus:outline-none focus:ring-2
                  ${
                    isInputFocused
                      ? "border-blue-400/50 focus:ring-blue-400/20 bg-gray-800/80"
                      : "border-gray-600/30 hover:border-gray-500/50"
                  }
                `}
                disabled={isBotTyping}
                whileFocus={{ scale: 1.01 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              />
              <motion.button
                onClick={handleSubmit}
                disabled={!inputValue.trim() || isBotTyping}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 hover:from-blue-600 hover:to-purple-600"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Send className="w-5 h-5 text-white" />
              </motion.button>
            </div>
          </div>

          <motion.p
            className="text-xs text-gray-500 text-center mt-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            AI can make mistakes. Please verify important information.
          </motion.p>
        </div>
      </motion.div>
    </div>
  );
};

export default ChatInterface;
