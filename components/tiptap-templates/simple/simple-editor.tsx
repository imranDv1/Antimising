/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import * as React from "react";
import {
  Editor,
  EditorContent,
  EditorContext,
  useEditor,
  JSONContent,
} from "@tiptap/react";
import DragHandle from "@tiptap/extension-drag-handle";

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit";
import { ResizableImage } from "@/components/tiptap-node/image-node/resizable-image-extension";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TextAlign } from "@tiptap/extension-text-align";
import { Typography } from "@tiptap/extension-typography";
import { Highlight } from "@tiptap/extension-highlight";
import { Subscript } from "@tiptap/extension-subscript";
import { Superscript } from "@tiptap/extension-superscript";
import { Selection } from "@tiptap/extensions";

// --- UI Primitives ---
import { Button } from "@/components/tiptap-ui-primitive/button";
import { buttonVariants, Button as ShadcnButton } from "@/components/ui/button";
import { Spacer } from "@/components/tiptap-ui-primitive/spacer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/tiptap-ui-primitive/toolbar";

// --- Tiptap Node ---
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension";
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension";
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss";
import "@/components/tiptap-node/code-block-node/code-block-node.scss";
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss";
import "@/components/tiptap-node/list-node/list-node.scss";
import "@/components/tiptap-node/image-node/image-node.scss";
import "@/components/tiptap-node/heading-node/heading-node.scss";
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss";

// --- Tiptap UI ---
import { HeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu";
import { ImageUploadButton } from "@/components/tiptap-ui/image-upload-button";
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu";
import { BlockquoteButton } from "@/components/tiptap-ui/blockquote-button";
import { CodeBlockButton } from "@/components/tiptap-ui/code-block-button";
import {
  ColorHighlightPopover,
  ColorHighlightPopoverContent,
  ColorHighlightPopoverButton,
} from "@/components/tiptap-ui/color-highlight-popover";
import {
  LinkPopover,
  LinkContent,
  LinkButton,
} from "@/components/tiptap-ui/link-popover";
import { MarkButton } from "@/components/tiptap-ui/mark-button";
import { TextAlignButton } from "@/components/tiptap-ui/text-align-button";
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button";

// --- Icons ---
import { ArrowLeftIcon } from "@/components/tiptap-icons/arrow-left-icon";
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon";
import { LinkIcon } from "@/components/tiptap-icons/link-icon";

// --- Hooks ---
import { useIsMobile } from "@/hooks/use-mobile";
import { useWindowSize } from "@/hooks/use-window-size";
import { useCursorVisibility } from "@/hooks/use-cursor-visibility";

// --- Lib ---
import { handleImageUpload, MAX_FILE_SIZE, sanitizeImageAttrs } from "@/lib/tiptap-utils";
import { CornerDownLeft, Eye, Loader2, Save, Share2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

// --- Styles ---
import "@/components/tiptap-templates/simple/simple-editor.scss";
import { toast } from "sonner";
import { JsonValue } from "@/lib/generated/prisma/runtime/library";
import Link from "next/link";
import CustomButton from "@/components/CustomButton";
import { ShareNoteDialog } from "@/components/share-dialog";
import { useEditorNotificationStore } from "@/context/simpleEditorupddate";
import { convertMarkdownHeadingsToHtml } from "@/lib/converMarkdownHeading";

// --- Fix 1: Removed unused `authClient` import ---

// --- Fix 2: Removed `onSave` from MainToolbarContent props (was declared but never used) ---
const MainToolbarContent = ({
  onHighlighterClick,
  onLinkClick,
  isMobile,
}: {
  onHighlighterClick: () => void;
  onLinkClick: () => void;
  isMobile: boolean;
}) => {
  // --- Fix 3: Removed unused `imageUploadRef` ---

  return (
    <>
      <Spacer />

      <ToolbarGroup>
        <UndoRedoButton action="undo" />
        <UndoRedoButton action="redo" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <HeadingDropdownMenu levels={[1, 2, 3, 4]} portal={isMobile} />
        <ListDropdownMenu
          types={["bulletList", "orderedList", "taskList"]}
          portal={isMobile}
        />
        <BlockquoteButton />
        <CodeBlockButton />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="bold" />
        <MarkButton type="italic" />
        <MarkButton type="strike" />
        <MarkButton type="code" />
        <MarkButton type="underline" />
        {!isMobile ? (
          <ColorHighlightPopover />
        ) : (
          <ColorHighlightPopoverButton onClick={onHighlighterClick} />
        )}
        {!isMobile ? <LinkPopover /> : <LinkButton onClick={onLinkClick} />}
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="superscript" />
        <MarkButton type="subscript" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <TextAlignButton align="left" />
        <TextAlignButton align="center" />
        <TextAlignButton align="right" />
        <TextAlignButton align="justify" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ImageUploadButton />
      </ToolbarGroup>

      <Spacer />

      {isMobile && <ToolbarSeparator />}
    </>
  );
};

const MobileToolbarContent = ({
  type,
  onBack,
}: {
  type: "highlighter" | "link";
  onBack: () => void;
}) => (
  <>
    <ToolbarGroup>
      <Button data-style="ghost" onClick={onBack}>
        <ArrowLeftIcon className="tiptap-button-icon" />
        {type === "highlighter" ? (
          <HighlighterIcon className="tiptap-button-icon" />
        ) : (
          <LinkIcon className="tiptap-button-icon" />
        )}
      </Button>
    </ToolbarGroup>

    <ToolbarSeparator />

    {type === "highlighter" ? (
      <ColorHighlightPopoverContent />
    ) : (
      <LinkContent />
    )}
  </>
);

const hasInlineNewline = (node: JSONContent): boolean =>
  node.type === "text" && !!node.text && /[\r\n]/.test(node.text);

const splitParagraphWithNewlines = (paragraph: JSONContent): JSONContent[] => {
  const blocks: JSONContent[][] = [];
  let current: JSONContent[] = [];

  const flush = () => {
    if (current.length) {
      blocks.push(current);
      current = [];
    }
  };

  for (const child of paragraph.content ?? []) {
    const raw = child.type === "text" ? child.text : undefined;
    if (!raw || !/[\r\n]/.test(raw)) {
      current.push(child);
      continue;
    }

    const segments = raw.replace(/\r\n?/g, "\n").split(/(\n[ \t]*\n+)/);
    for (const segment of segments) {
      if (!segment) continue;
      if (/^\n[ \t\n]*$/.test(segment)) {
        flush();
        continue;
      }
      segment.split("\n").forEach((line, index) => {
        if (index > 0) current.push({ type: "hardBreak" });
        if (line) current.push({ ...child, text: line });
      });
    }
  }
  flush();

  if (!blocks.length) return [paragraph];
  return blocks.map((block) => ({ ...paragraph, content: block }));
};

const normalizeInlineNewlines = (node: JSONContent): JSONContent => {
  if (!node.content?.length) return node;
  const content = node.content.flatMap((child) =>
    child.type === "paragraph" && child.content?.some(hasInlineNewline)
      ? splitParagraphWithNewlines(child)
      : [normalizeInlineNewlines(child)]
  );
  return { ...node, content };
};

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const textPartToBlocksHtml = (text: string) =>
  text
    .replace(/\r\n?/g, "\n")
    .split(/\n[ \t]*\n+/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map(
      (block) =>
        `<p>${block.split("\n").map(escapeHtml).join("<br />")}</p>`
    )
    .join("");

/**
 * Isolated character counter + plan-limit enforcement.
 * Keeping this work in its own component means typing or pasting a long note
 * never re-renders the whole editor, and the count/enforcement is throttled so
 * the document isn't rescanned on every keystroke.
 */
const CharacterCount = ({
  editor,
  maxChars,
}: {
  editor: Editor | null;
  maxChars: number;
}) => {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    if (!editor) return;

    const THROTTLE_MS = 150;
    let timer: number | undefined;
    let lastRun = 0;

    const sync = () => {
      timer = undefined;
      lastRun = Date.now();

      const textLength = editor.getText().length;
      setCount((prev) => (prev === textLength ? prev : textLength));

      if (textLength > maxChars) {
        editor.chain().deleteRange({ from: maxChars, to: textLength }).run();
        toast.error(`Maximum content length is ${maxChars} characters!`);
      }
    };

    // Immediate first pass so the counter is correct on load.
    sync();

    const schedule = () => {
      if (timer !== undefined) return;
      const wait = Math.max(0, THROTTLE_MS - (Date.now() - lastRun));
      timer = window.setTimeout(sync, wait);
    };

    editor.on("update", schedule);

    return () => {
      editor.off("update", schedule);
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [editor, maxChars]);

  return (
    <span
      className={`text-sm ${count > maxChars ? "text-red-500" : "text-primary"}`}
    >
      {count}/{maxChars}
    </span>
  );
};

type EditorProps = {
  noteId: string;
  content?: JsonValue;
  role?: "owner" | "read" | "write";
  MAX_CHARS: number;
  limit: number;
};

export function SimpleEditor({
  noteId,
  content,
  role = "owner",
  MAX_CHARS,
  limit,
}: EditorProps) {
  const isMobile = useIsMobile();
  const { height } = useWindowSize();
  const router = useRouter();
  const [mobileView, setMobileView] = React.useState<
    "main" | "highlighter" | "link"
  >("main");
  const [shareDialogOpen, setShareDialogOpen] = React.useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleteLoading, setDeleteLoading] = React.useState(false);
  const toolbarRef = React.useRef<HTMLDivElement>(null);
  const triggerEditorRefresh = useEditorNotificationStore(
    (state) => state.triggerEditorRefresh
  );
  const [uploadedFiles, setUploadedFiles] = React.useState<File[]>([]);
  const [edit, setEdit] = React.useState(
    !content ||
      (typeof content === "object" && Object.keys(content).length === 0)
  );
  const [saveLoading, setSaveLoading] = React.useState(false); // Fix 4: renamed SaveLoading → saveLoading (camelCase convention)

  const canEdit = role !== "read";
  const isOwner = role === "owner";

  const baselineRef = React.useRef<string | null>(null);
  const uploadedFilesRef = React.useRef<File[]>(uploadedFiles);

  const editor = useEditor({
    immediatelyRender: false,
    shouldRerenderOnTransaction: false,
    editable: edit,
    content: (() => {
      if (!content) return "";
      if (typeof content === "string")
        return convertMarkdownHeadingsToHtml(content);
      try {
        const normalized = normalizeInlineNewlines(content as JSONContent);
        sanitizeImageAttrs(normalized);
        return normalized;
      } catch {
        return "";
      }
    })(),
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        class: "simple-editor",
      },
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        link: { openOnClick: false, enableClickSelection: true },
      }),
      HorizontalRule,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      ResizableImage,
      Typography,
      Superscript,
      Subscript,
      Selection,
      ImageUploadNode.configure({
        accept: "image/*",
        maxSize: MAX_FILE_SIZE,
        limit: limit,
        upload: async (file, onProgress, signal) => {
          const { previewUrl, file: originalFile } = await handleImageUpload(
            file,
            onProgress,
            signal
          );
          setUploadedFiles((prev) => [...prev, originalFile]);
          return previewUrl;
        },
        onError: (error) => console.error("Upload failed:", error),
      }),
      DragHandle.configure({
        render: () => {
          const span = document.createElement("span");
          span.className = "drag-handle hidden sm:inline-block";
          span.textContent = "⋮⋮";
          return span;
        },
      }),
    ],
  });

  // Listen for insert requests from the AI dialog and insert at cursor
  React.useEffect(() => {
    if (!editor) return;

    const handleInsert = (e: Event) => {
      const custom = e as CustomEvent<{ text?: string }>;
      const value = custom.detail?.text?.toString();
      if (!value) return;

      // القراءة فقط: لا يمكن إدخال نص من مساعد الذكاء الاصطناعي
      if (!canEdit) return;

      setEdit(true);

      const codeRegex = /```([\w-]*)\n([\s\S]*?)```/g;
      let lastIndex = 0;
      const parts: Array<{
        type: "text" | "code";
        content: string;
        lang?: string;
      }> = [];
      let match: RegExpExecArray | null;

      while ((match = codeRegex.exec(value)) !== null) {
        if (match.index > lastIndex) {
          parts.push({
            type: "text",
            content: value.slice(lastIndex, match.index),
          });
        }
        parts.push({
          type: "code",
          content: match[2].trimEnd(),
          lang: match[1] || "text",
        });
        lastIndex = codeRegex.lastIndex;
      }

      if (lastIndex < value.length) {
        parts.push({ type: "text", content: value.slice(lastIndex) });
      }

      const chain = editor.chain().focus();
      for (const part of parts) {
        if (part.type === "code") {
          chain.insertContent({
            type: "codeBlock",
            attrs: { language: part.lang },
            content: [{ type: "text", text: part.content }],
          });
        } else if (part.content.trim()) {
          chain.insertContent(textPartToBlocksHtml(part.content));
        }
      }
      chain.run();

      try {
        (editor.view.dom as HTMLElement).scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      } catch {
        // ignore scroll errors silently
      }

      toast.success("Added to editor");
    };

    window.addEventListener("rivorea-insert-note", handleInsert as EventListener);
    return () => {
      window.removeEventListener("rivorea-insert-note", handleInsert as EventListener);
    };
  }, [editor, canEdit]);

  // Sync editor editable state with `edit` + read-only role
  React.useEffect(() => {
    if (editor) {
      editor.setEditable(edit && canEdit);
    }
  }, [edit, editor, canEdit]);

  React.useEffect(() => {
    uploadedFilesRef.current = uploadedFiles;
  }, [uploadedFiles]);

  React.useEffect(() => {
    if (!editor || baselineRef.current !== null) return;
    baselineRef.current = JSON.stringify(editor.getJSON());
  }, [editor]);

  const isDirty = React.useCallback(() => {
    if (!editor) return false;
    if (uploadedFilesRef.current.length > 0) return true;
    if (baselineRef.current === null) {
      baselineRef.current = JSON.stringify(editor.getJSON());
      return false;
    }
    return JSON.stringify(editor.getJSON()) !== baselineRef.current;
  }, [editor]);

  React.useEffect(() => {
    if (!editor) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!isDirty()) return;
      e.preventDefault();
      e.returnValue = "";
    };

    const handleDocumentClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (!isDirty()) return;

      const target = e.target as HTMLElement | null;
      if (!target || typeof target.closest !== "function") return;
      if (editor.view.dom.contains(target)) return;

      const anchor = target.closest("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target === "_blank") return;

      const href = anchor.getAttribute("href") ?? "";
      if (!href.startsWith("/")) return;

      if (window.confirm("You have unsaved changes. Leave without saving?"))
        return;
      e.preventDefault();
      e.stopPropagation();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("click", handleDocumentClick, true);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("click", handleDocumentClick, true);
    };
  }, [editor, isDirty]);

  const rect = useCursorVisibility({
    editor,
    overlayHeight: toolbarRef.current?.getBoundingClientRect().height ?? 0,
  });

  React.useEffect(() => {
    if (!isMobile && mobileView !== "main") setMobileView("main");
  }, [isMobile, mobileView]);

  const handleSave = async () => {
    if (!editor) return;

    // لا تغييرات — نكتفي بإغلاق وضع التعديل دون حفظ أو إعادة جلب
    if (!isDirty()) {
      toast.info("No changes to save.");
      setEdit(false);
      return;
    }

    const contentLength = editor.getText().length;
    if (contentLength > MAX_CHARS) {
      toast.error(`Cannot save! Maximum allowed content is ${MAX_CHARS} characters.`);
      return;
    }

    const contentJSON = JSON.stringify(editor.getJSON());
    setSaveLoading(true);

    const formData = new FormData();
    formData.append("noteId", noteId);
    formData.append("content", contentJSON);

    for (const file of uploadedFiles) {
      formData.append("images", file);
    }

    try {
      const res = await fetch("/api/note-body", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        toast.success("Note saved!");
        baselineRef.current = contentJSON;
        setUploadedFiles([]); // Fix 8: clear uploaded files after successful save to avoid re-uploading
        triggerEditorRefresh();
        setEdit(false); // ✅ الخروج من وضع التعديل بعد الحفظ
      } else {
        toast.error("Error: " + data.error);
      }
    } catch {
      toast.error("Failed to save. Please check your connection.");
    } finally {
      setSaveLoading(false); // Fix 9: use finally so loading always resets even on network errors
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/create/${noteId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Failed to delete note");
      }
      toast.success("Note deleted");
      setDeleteDialogOpen(false);
      setDeleteLoading(false);
      triggerEditorRefresh();
      router.push("/dashboard/create");
    } catch (err) {
      toast.error((err as Error).message);
      setDeleteLoading(false);
    }
  };

  // Fix 10: cleaned up redundant whitespace in className strings below
  return (
    <div className="w-full min-w-0 flex flex-col items-center mt-4 gap-4">
      <div className="w-full flex lg:flex-row flex-col justify-end gap-4 items-center">
        <div className="w-full lg:w-max flex justify-end">
          {content ? (
            <div className="flex items-center gap-3">
              <Link
                className={buttonVariants({ variant: "outline" })}
                href="/dashboard/create"
              >
                <CornerDownLeft />
              </Link>

              {canEdit ? (
                <ShadcnButton variant="outline" onClick={() => setEdit(!edit)}>
                  {edit ? "Close Edit" : "Edit"}
                </ShadcnButton>
              ) : (
                <span
                  className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-muted/50 px-3 text-sm font-medium text-muted-foreground"
                  title="You can view this note but cannot modify it."
                >
                  <Eye className="size-4" />
                  View only
                </span>
              )}

              {isOwner && (
                <>
                  <ShadcnButton
                    variant="outline"
                    onClick={() => setShareDialogOpen(true)}
                    className="h-9"
                  >
                    <Share2 className="mr-1.5 size-4" />
                    Share
                  </ShadcnButton>
                  <ShadcnButton
                    variant="outline"
                    onClick={() => setDeleteDialogOpen(true)}
                    disabled={deleteLoading}
                    className="h-9 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Trash2 className="mr-1.5 size-4" />
                    Delete
                  </ShadcnButton>
                </>
              )}
            </div>
          ) : (
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/dashboard/create"
            >
              <CornerDownLeft />
            </Link>
          )}
        </div>

        {edit && canEdit && (
          <div className="w-full flex items-center justify-end gap-4">
            <CharacterCount editor={editor} maxChars={MAX_CHARS} />

            {/* AI assistant button */}
            {/* <CustomButton /> */}

            <ShadcnButton disabled={saveLoading} size="sm" onClick={handleSave}>
              {saveLoading ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Saving…</span>
                </>
              ) : (
                <>
                  <Save />
                  Save
                </>
              )}
            </ShadcnButton>
          </div>
        )}
      </div>

      <EditorContext.Provider value={{ editor }}>
        {edit && canEdit && (
          <Toolbar
            ref={toolbarRef}
            style={
              isMobile
                ? { bottom: `calc(100% - ${height - rect.y}px)` }
                : undefined
            }
          >
            {mobileView === "main" ? (
              <MainToolbarContent
                onHighlighterClick={() => setMobileView("highlighter")}
                onLinkClick={() => setMobileView("link")}
                isMobile={isMobile}
              />
            ) : (
              <MobileToolbarContent
                type={mobileView === "highlighter" ? "highlighter" : "link"}
                onBack={() => setMobileView("main")}
              />
            )}
          </Toolbar>
        )}

        {/* ── Share Note Dialog (owner only) ─────────────────────────── */}
        <ShareNoteDialog
          noteId={noteId}
          open={shareDialogOpen}
          onOpenChange={setShareDialogOpen}
          onChanged={() => triggerEditorRefresh()}
        />

        {/* ── Delete Note Confirmation Dialog ────────────────────────── */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent
            className="max-w-sm"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <DialogHeader>
              <DialogTitle className="text-lg font-semibold">
                Delete this note?
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                This action cannot be undone. The note will be permanently
                removed.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4 flex gap-2">
              <ShadcnButton
                variant="outline"
                className="flex-1"
                disabled={deleteLoading}
                onClick={() => setDeleteDialogOpen(false)}
              >
                Cancel
              </ShadcnButton>
              <ShadcnButton
                className="flex-1 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteLoading}
                onClick={handleDelete}
              >
                {deleteLoading ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="size-4 animate-spin" />
                    Deleting…
                  </span>
                ) : (
                  "Delete"
                )}
              </ShadcnButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <EditorContent
          editor={editor}
          role="presentation"
          className="w-full min-w-0 mt-2"
        />
      </EditorContext.Provider>
    </div>
  );
}