"use client";
import React, { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import Image from "next/image";
import { Copy, Send, Sparkles, StopCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/cjs/styles/prism";

// ─── Constants ────────────────────────────────────────────────────────────────

const AI_AVATAR = "/icons/note ai.png";
const PLACEHOLDER_AVATAR =
  "https://api.dicebear.com/7.x/lorelei/svg?seed=user&backgroundColor=transparent";

const normalizeAiResponse = (raw: string, query: string): string => {
  let text = raw.replace(/\r\n?/g, "\n").trim();
  const firstLine = text.split("\n", 1)[0].trim();
  if (firstLine && firstLine.toLowerCase() === query.trim().toLowerCase()) {
    const newlineIndex = text.indexOf("\n");
    text = newlineIndex === -1 ? "" : text.slice(newlineIndex + 1).trimStart();
  }
  if (!text.includes("```")) text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
};

// ─── Types ────────────────────────────────────────────────────────────────────

type Message = {
  from: "user" | "ai";
  name: string;
  avatar: string;
  text: string;
};

// ─── Code block renderer ──────────────────────────────────────────────────────

function detectLanguage(code: string): string {
  if (/^#include |int main\s*\(/.test(code)) return "cpp";
  if (/^import |def |print\(/.test(code)) return "python";
  if (/CREATE TABLE|SELECT |INSERT |UPDATE |DELETE /i.test(code)) return "sql";
  if (/<!DOCTYPE html>|<html>|<div|<\/div>/i.test(code)) return "html";
  return "javascript";
}

function renderMessageContent(text: string, isAi: boolean): React.ReactNode {
  if (!isAi) return <span className="whitespace-pre-wrap">{text}</span>;

  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let idx = 0;

  codeBlockRegex.lastIndex = 0;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    const before = text.slice(lastIndex, match.index);
    if (before) {
      parts.push(
        <span key={idx++} className="whitespace-pre-wrap">
          {before}
        </span>,
      );
    }
    const lang = match[1] || detectLanguage(match[2]);
    parts.push(
      <SyntaxHighlighter
        key={idx++}
        language={lang}
        style={vscDarkPlus}
        className="rounded-xl my-2 text-xs !p-3"
        wrapLongLines
      >
        {match[2].trim()}
      </SyntaxHighlighter>,
    );
    lastIndex = codeBlockRegex.lastIndex;
  }

  const remaining = text.slice(lastIndex);
  if (remaining)
    parts.push(
      <span key={idx++} className="whitespace-pre-wrap">
        {remaining}
      </span>,
    );

  return parts.length ? (
    parts
  ) : (
    <span className="whitespace-pre-wrap">{text}</span>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  msg,
  isAi,
  onCopy,
  onWrite,
}: {
  msg: Message;
  isAi: boolean;
  onCopy?: (text: string) => void;
  onWrite?: (text: string) => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`flex items-end gap-2.5 group ${isAi ? "flex-row" : "flex-row-reverse"}`}
    >
      {/* Avatar */}
      <Image
        src={msg.avatar}
        alt={msg.name}
        width={32}
        height={32}
        className=" object-cover w-8 h-8 border border-gray-200 dark:border-neutral-700 shrink-0 mb-0.5"
      />

      <div
        className={`max-w-[78vw] md:max-w-[520px] flex flex-col gap-0.5 ${isAi ? "" : "items-end"}`}
      >
        <span
          className={`text-[11px] font-medium px-1 select-none ${isAi ? "text-gray-500 dark:text-neutral-400" : "text-primary/70"}`}
        >
          {msg.name}
        </span>

        <div
          className={`relative group/bubble px-4 py-3 text-sm  break-words
          ${
            isAi
              ? "bg-white dark:bg-neutral-900 text-gray-800 dark:text-neutral-100 border border-gray-200 dark:border-neutral-800 shadow-sm rounded-tl-sm"
              : "bg-gradient-to-br from-primary to-primary/80 text-white shadow-md rounded-tr-sm"
          }`}
        >
          {renderMessageContent(msg.text, isAi)}

          {/* AI action buttons */}
          {isAi && (
            <div className="absolute -top-2 right-2 flex items-center gap-1 opacity-0 group-hover/bubble:opacity-100 transition-all duration-150 pointer-events-none group-hover/bubble:pointer-events-auto">
              <button
                onClick={() => onCopy?.(msg.text)}
                className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-gray-800 dark:text-neutral-400 dark:hover:text-white bg-white dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 px-2 py-0.5  shadow-sm transition-colors"
                title="Copy response"
              >
                <Copy size={11} />
                Copy
              </button>
              <button
                onClick={() => onWrite?.(msg.text)}
                className="flex items-center gap-1 text-[11px] text-primary hover:text-primary dark:text-primary dark:hover:text-violet-200 bg-white dark:bg-neutral-800 border border-violet-200 dark:border-primary px-2 py-0.5  shadow-sm transition-colors"
                title="Insert into editor"
              >
                Write
              </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Typing indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-end gap-2.5"
    >
      <Image
        src={AI_AVATAR}
        alt="AI"
        width={32}
        height={32}
        className=" w-8 h-8 border border-gray-200 dark:border-neutral-700"
      />
      <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800  rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-1.5">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="w-1.5 h-1.5  bg-gray-400 dark:bg-neutral-500 block"
              animate={{ y: [0, -4, 0] }}
              transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const CustomButton = () => {
  const { data: session } = authClient.useSession();
  const user = session?.user;
  const userName = user?.name || "You";
  const userImage = user?.image || PLACEHOLDER_AVATAR;

  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      from: "ai",
      name: "NoteBuddy",
      avatar: AI_AVATAR,
      text: "Hello 👋! I'm NoteBuddy — your AI note assistant. Ask me anything, and I can help you write, research, or brainstorm.",
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  // ── Send message ───────────────────────────────────────────────────────────

  const sendMessage = async () => {
    const text = inputValue.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      from: "user",
      name: userName,
      avatar: userImage,
      text,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputValue("");
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    let acc = "";
    let pushed = false;

    const upsertAiText = (nextText: string) => {
      acc = nextText;
      if (!pushed) {
        pushed = true;
        setMessages((prev) => [
          ...prev,
          { from: "ai", name: "NoteBuddy", avatar: AI_AVATAR, text: acc },
        ]);
      } else {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { ...next[next.length - 1], text: acc };
          return next;
        });
      }
    };

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user?.id, title: text }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res
          .json()
          .catch(() => ({ message: "Failed to get AI response." }));
        throw new Error(data.message || "Failed to get AI response.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) upsertAiText(acc + chunk);
      }

      const tail = decoder.decode();
      if (tail) upsertAiText(acc + tail);

      if (!pushed)
        throw new Error("Sorry, something went wrong. Please try again.");

      upsertAiText(normalizeAiResponse(acc, text));
    } catch (err) {
      const aborted =
        controller.signal.aborted ||
        (err instanceof Error && err.name === "AbortError");

      if (aborted) {
        if (!pushed) upsertAiText("Response stopped.");
      } else {
        const message =
          err instanceof Error && err.message
            ? err.message
            : "An unexpected error occurred.";
        toast.error(message);
        if (!pushed) upsertAiText(message);
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(
      text.replace(/\n{3,}/g, "\n\n").replace(/\t/g, "  "),
    );
    toast.success("Copied to clipboard ✅");
  };

  const writeToEditor = (text: string) => {
    try {
      window.dispatchEvent(
        new CustomEvent("rivorea-insert-note", { detail: { text } }),
      );
      toast.success("Inserted into editor ✅");
    } catch {
      toast.error("Could not write to editor.");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {/* ── Trigger button ───────────────────────────────────────────────── */}
      <DialogTrigger asChild>
        <button
          className="group inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground shadow-xs transition-all duration-150 hover:border-primary/40 hover:bg-primary/10 hover:text-primary active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          tabIndex={0}
          aria-label="Open AI assistant"
        >
          <Sparkles size={15} className="text-primary" />
          AI
        </button>
      </DialogTrigger>

      {/* ── Dialog ───────────────────────────────────────────────────────── */}
      <DialogContent className="max-w-2xl w-[95vw] h-[82vh] flex flex-col p-0 overflow-hidden  shadow-2xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950 focus:outline-none focus-visible:outline-none">
        {/* Header */}
        <DialogHeader className="shrink-0 bg-white dark:bg-neutral-900 border-b border-gray-200 dark:border-neutral-800 px-5 py-4">
          <DialogTitle className="flex items-center gap-3">
            <div className="relative">
              <Image
                src={AI_AVATAR}
                alt="NoteBuddy"
                width={36}
                height={36}
                className=" border-2 border-primary dark:border-primary"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400  border-2 border-white dark:border-neutral-900" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white leading-none">
                NoteBuddy
              </p>
              <p className="text-xs text-green-500 font-normal mt-0.5">
                Online
              </p>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5 scroll-smooth">
          <AnimatePresence initial={false}>
            {messages.map((msg, idx) => (
              <MessageBubble
                key={idx}
                msg={msg}
                isAi={msg.from === "ai"}
                onCopy={copyToClipboard}
                onWrite={writeToEditor}
              />
            ))}
            {loading && messages[messages.length - 1]?.from !== "ai" && (
              <TypingIndicator key="typing" />
            )}
          </AnimatePresence>
          <div ref={messagesEndRef} />
        </div>

        {/* Input bar */}
        <div className="shrink-0 bg-white dark:bg-neutral-900 border-t border-gray-200 dark:border-neutral-800 px-4 py-3">
          <div className="flex items-center gap-2 bg-gray-100 dark:bg-neutral-800 rounded-xl px-3 py-1.5">
            <Input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask NoteBuddy anything…"
              disabled={loading}
              className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm placeholder:text-gray-400 dark:placeholder:text-neutral-500 px-0 py-1.5 h-auto"
            />
            {loading ? (
              <button
                onClick={() => {
                  abortRef.current?.abort();
                  setLoading(false);
                }}
                className="shrink-0 p-1.5  text-gray-400 hover:text-red-500 transition-colors"
                title="Stop"
              >
                <StopCircle size={18} />
              </button>
            ) : (
              <button
                onClick={sendMessage}
                disabled={!inputValue.trim()}
                className="shrink-0 p-1.5  bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                title="Send"
              >
                <Send size={15} />
              </button>
            )}
          </div>
          <p className="text-center text-[10px] text-gray-400 dark:text-neutral-600 mt-2">
            NoteBuddy can make mistakes. Verify important information.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CustomButton;
