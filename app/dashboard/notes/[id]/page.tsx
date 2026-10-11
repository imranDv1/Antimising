/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React, { useEffect, useRef, useState } from "react";
import { SimpleEditor } from "@/components/tiptap-templates/simple/simple-editor";
import { authClient } from "@/lib/auth-client";
import { useEditorNotificationStore } from "@/context/simpleEditorupddate";
import { useSharedStore } from "@/context/sharedStore";
import { useSharedCacheStore } from "@/context/sharedCacheStore";
import { useNoteBodyCacheStore } from "@/context/noteBodyCacheStore";
import { ArrowLeftToLine, RefreshCw, ShieldOff } from "lucide-react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type tParams = { id: string };

// 🧠 الكاش يعتبر "طازجًا" خلال 60 ثوانٍ — نعرض المحتوى فورًا دون أي إعادة تحقق
const TTL_MS = 60_000;

const Page = (props: { params: Promise<tParams> }) => {
  const [params, setParams] = useState<tParams | null>(null);
  const [notebody, setNotes] = useState<any | null>(null);
  const [permission, setPermission] = useState<"owner" | "read" | "write">(
    "owner",
  );
  const [isFetched, setIsFetched] = useState(false);
  const [MAX_CHARS, setMaxChars] = useState<number>(10000); // default limit
  const [limit, setMaxlimit] = useState<number>(3); // default limit
  const [error, setUIerror] = useState("");
  const [retrySignal, setRetrySignal] = useState(0);
  const prevRefreshSignalRef = useRef(0);
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  const refreshEditorSignal = useEditorNotificationStore(
    (state) => state.refreshEditorSignal,
  );

  const triggerSharedRefresh = useSharedStore((s) => s.triggerSharedRefresh);

  // ✅ عند فتح ملاحظة مشتركة (ليست ملكي) نعلّمها كمقروءة لتفريغ الـ badge
  useEffect(() => {
    if (!userId || !params || permission === "owner") return;
    const markRead = async () => {
      try {
        await fetch("/api/shared-notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ noteId: params.id }),
        });
        useSharedCacheStore.getState().markRead(params.id);
        triggerSharedRefresh();
      } catch (err) {
        console.error(err);
      }
    };
    markRead();
  }, [userId, params, permission, triggerSharedRefresh]);

  // Resolve params promise
  useEffect(() => {
    const resolveParams = async () => {
      const resolved = await props.params;
      setParams(resolved);
    };
    resolveParams();
  }, [props.params]);

  // Fetch MAX_CHARS based on user subscription
  useEffect(() => {
    if (!userId) return;

    const fetchMaxChars = async () => {
      try {
        const res = await fetch("/api/getSubs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
          cache: "force-cache",
        });

        if (!res.ok) throw new Error("Failed to fetch MAX_CHARS");

        const data = await res.json();
        setMaxChars(data.MAX_CHARS || 10000);
        setMaxlimit(data.limit || 3);
      } catch (err) {
        console.error(err);
        setMaxChars(10000); // fallback if error
        setMaxlimit(3);
      }
    };

    fetchMaxChars();
  }, [userId]);

  // 🧠 Smart caching: serve cached note instantly, then only refetch the full
  // body if the server's updatedAt/permission changed (cheap metaOnly check).
  useEffect(() => {
    if (!userId || !params) return;
    const noteId = params.id;

    const cached = useNoteBodyCacheStore.getState().cache[noteId];
    const isCacheValidForUser = cached && cached.userId === userId;

    const applyBody = (data: any) => {
      setNotes(data.notebody || null);
      if (data?.permission) setPermission(data.permission);
      useNoteBodyCacheStore.getState().set({
        noteId,
        userId,
        notebody: data.notebody || null,
        noteTitle: data.noteTitle,
        permission: data.permission,
        isOwner: data.isOwner,
        shareCount: data.shareCount,
        ownerName: data.ownerName,
        ownerEmail: data.ownerEmail,
        updatedAt: data.updatedAt,
        fetchedAt: Date.now(),
      });
    };

    // اجلب المحتوى كاملًا وخزّنه في الكاش
    const fetchFull = async () => {
      setUIerror("");
      try {
        const res = await fetch("/api/notebody", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, noteId }),
        });

        const data = await res.json();
        if (data?.success === false) {
          setNotes(null);
          setUIerror(data.message);
        } else {
          applyBody(data);
        }
      } catch (err) {
        console.error(err);
        setNotes(null);
        setUIerror("Failed to load note");
      } finally {
        setIsFetched(true);
      }
    };

    // تحقق خفيف بدون فك تشفير: إذا لم يتغير updatedAt/permission نكتفي بالكاش
    const revalidate = async () => {
      try {
        const res = await fetch("/api/notebody", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId, noteId, metaOnly: true }),
        });

        const data = await res.json();
        const current = useNoteBodyCacheStore.getState().cache[noteId];
        if (
          data?.success === false ||
          !current ||
          data.updatedAt !== current.updatedAt ||
          data.permission !== current.permission
        ) {
          setIsFetched(false);
          await fetchFull();
        } else {
          // لا تغييرات — نبقى على الكاش
          setIsFetched(true);
        }
      } catch (err) {
        console.error(err);
        setIsFetched(false);
        await fetchFull();
      }
    };

    if (isCacheValidForUser) {
      // عرض فوري من الكاش دون أي انتظار
      setNotes(cached.notebody);
      setPermission(cached.permission);
      setIsFetched(true);

      // إذا كان الكاش طازجًا ولم ننفّذ عملية حفظ/تحديث نتجاوز إعادة التحقق
      const isFresh =
        Date.now() - cached.fetchedAt < TTL_MS &&
        prevRefreshSignalRef.current === refreshEditorSignal;
      prevRefreshSignalRef.current = refreshEditorSignal;
      if (isFresh) return;
      revalidate();
    } else {
      setIsFetched(false);
      fetchFull();
    }
  }, [userId, params, refreshEditorSignal, retrySignal]);

  if (!params || !isFetched) return null;

  const isThereContent =
    notebody?.content && Object.keys(notebody.content).length > 0;

  if (error) {
    return (
      <div className="w-full h-screen flex flex-col gap-3  items-center justify-center p-6">
        <Link
          className={cn(
            buttonVariants({ variant: "outline" }),
            "flex items-center gap-3",
          )}
          href="/dashboard/create"
        >
          <ArrowLeftToLine /> Back to your notes{" "}
        </Link>
        <div className="text-center flex flex-col items-center gap-4 bg-red-500/10 p-6  border-2 border-red-600">
          <div className="flex items-center gap-4">
            <ShieldOff className="text-red-600 size-8" />
            <p className="text-red-600 text-3xl font-medium">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setRetrySignal((c) => c + 1)}
            className={cn(
              buttonVariants({ variant: "outline" }),
              "flex items-center gap-2 border-red-600 text-red-600 hover:bg-red-600 hover:text-white",
            )}
          >
            <RefreshCw className="size-4" /> Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full min-w-0">
<div className="w-full h-max flex items-center justify-center">
        <SimpleEditor
          noteId={params.id}
          content={isThereContent ? notebody.content : undefined}
          role={permission}
          MAX_CHARS={MAX_CHARS}
          limit={limit} // ✅ Now dynamic based on subscription
        />
      </div>
    </div>
  );
};

export default Page;
