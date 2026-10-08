"use client"

import * as React from "react"
import type { NodeViewProps } from "@tiptap/react"
import { NodeViewWrapper } from "@tiptap/react"
import { parseSizeAttr } from "@/lib/tiptap-utils"

const HANDLES = ["nw", "ne", "sw", "se"] as const
type Handle = (typeof HANDLES)[number]

const MIN_SIZE = 48

type DragState = {
  handle: Handle
  startX: number
  startY: number
  startW: number
  aspect: number
  maxW: number
}

export const ResizableImageView: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  selected,
  editor,
}) => {
  const imgRef = React.useRef<HTMLImageElement>(null)
  const dragRef = React.useRef<DragState | null>(null)
  const [activeHandle, setActiveHandle] = React.useState<Handle | null>(null)

  const width = parseSizeAttr(node.attrs.width)
  const height = parseSizeAttr(node.attrs.height)

  const imgStyle: React.CSSProperties = {}
  if (width) {
    imgStyle.width = `${width}px`
    imgStyle.height = "auto"
  } else if (height) {
    imgStyle.height = `${height}px`
    imgStyle.width = "auto"
  }

  const showHandles = selected && editor.isEditable

  const getContentWidth = (): number => {
    const root = editor.view.dom as HTMLElement
    const styles = window.getComputedStyle(root)
    const padding =
      parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight)
    return Math.max(MIN_SIZE, root.clientWidth - padding)
  }

  const handlePointerDown =
    (handle: Handle) => (event: React.PointerEvent<HTMLSpanElement>) => {
      if (!editor.isEditable) return
      const img = imgRef.current
      if (!img) return
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)

      const clientW = img.clientWidth
      const clientH = img.clientHeight
      const aspect =
        img.naturalWidth > 0 && img.naturalHeight > 0
          ? img.naturalWidth / img.naturalHeight
          : clientW / Math.max(1, clientH)

      dragRef.current = {
        handle,
        startX: event.clientX,
        startY: event.clientY,
        startW: clientW,
        aspect,
        maxW: getContentWidth(),
      }
      setActiveHandle(handle)
    }

  const handlePointerMove = (event: React.PointerEvent<HTMLSpanElement>) => {
    const drag = dragRef.current
    const img = imgRef.current
    if (!drag || !img) return
    event.preventDefault()
    event.stopPropagation()

    const dx = event.clientX - drag.startX
    const dy = event.clientY - drag.startY
    const sx = drag.handle.includes("e") ? 1 : -1
    const sy = drag.handle.includes("n") ? -1 : 1
    const alongX = dx * sx
    const alongY = dy * sy
    const delta = Math.abs(alongX) >= Math.abs(alongY) ? alongX : alongY

    const nextW = Math.round(
      Math.min(Math.max(drag.startW + delta, MIN_SIZE), drag.maxW)
    )
    img.style.width = `${nextW}px`
    img.style.height = "auto"
  }

  const handlePointerUp = (event: React.PointerEvent<HTMLSpanElement>) => {
    const drag = dragRef.current
    const img = imgRef.current
    if (!drag || !img) return
    event.preventDefault()
    event.stopPropagation()
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // pointer capture may already be released
    }
    dragRef.current = null
    setActiveHandle(null)

    const nextW = Math.round(
      Math.min(
        Math.max(parseFloat(img.style.width) || img.clientWidth, MIN_SIZE),
        drag.maxW
      )
    )
    updateAttributes({
      width: nextW,
      height: Math.round(nextW / drag.aspect),
    })
  }

  return (
    <NodeViewWrapper className="tiptap-image-node" style={{ width: "fit-content" }}>
      <img
        ref={imgRef}
        src={node.attrs.src}
        alt={node.attrs.alt ?? ""}
        title={node.attrs.title ?? undefined}
        width={width ?? undefined}
        height={height ?? undefined}
        style={imgStyle}
      />
      {showHandles &&
        HANDLES.map((handle) => (
          <span
            key={handle}
            className={`tiptap-image-resize-handle tiptap-image-resize-handle--${handle}${
              activeHandle === handle ? " is-active" : ""
            }`}
            contentEditable={false}
            onPointerDown={handlePointerDown(handle)}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          />
        ))}
    </NodeViewWrapper>
  )
}
