"use client"

/* eslint-disable @next/next/no-img-element -- editor content images are user-provided and intentionally raw <img> */

import * as React from "react"
import type { NodeViewProps } from "@tiptap/react"
import { NodeViewWrapper } from "@tiptap/react"
import { Check, Crop, RotateCcw, X } from "lucide-react"
import { parseCropAttr, parseSizeAttr } from "@/lib/tiptap-utils"

const RESIZE_HANDLES = ["nw", "ne", "sw", "se"] as const
type ResizeHandle = (typeof RESIZE_HANDLES)[number]

const CROP_HANDLES = ["nw", "n", "ne", "e", "se", "s", "sw", "w"] as const
type CropHandle = (typeof CROP_HANDLES)[number]

const MIN_SIZE = 48
const MIN_CROP = 0.05

type Rect = { x: number; y: number; w: number; h: number }

type ResizeDrag = {
  handle: ResizeHandle
  startX: number
  startY: number
  startW: number
  aspect: number
  maxW: number
}

type CropDrag = {
  handle: CropHandle | "move"
  startX: number
  startY: number
  start: Rect
  boxW: number
  boxH: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function round4(value: number): number {
  return Math.round(value * 1e4) / 1e4
}

export const ResizableImageView: React.FC<NodeViewProps> = ({
  node,
  updateAttributes,
  selected,
  editor,
}) => {
  const imgRef = React.useRef<HTMLImageElement>(null)
  const boxRef = React.useRef<HTMLDivElement>(null)
  const cropBoxRef = React.useRef<HTMLDivElement>(null)
  const resizeRef = React.useRef<ResizeDrag | null>(null)
  const cropDragRef = React.useRef<CropDrag | null>(null)

  const [activeResize, setActiveResize] = React.useState<ResizeHandle | null>(
    null
  )
  const [natural, setNatural] = React.useState<{ w: number; h: number } | null>(
    null
  )
  const [cropping, setCropping] = React.useState(false)
  const [crop, setCrop] = React.useState<Rect | null>(null)
  const [liveWidth, setLiveWidth] = React.useState<number | null>(null)
  const liveWidthRef = React.useRef<number | null>(null)

  const src = node.attrs.src as string

  const width = parseSizeAttr(node.attrs.width)
  const height = parseSizeAttr(node.attrs.height)

  const committed = React.useMemo<Rect>(
    () => ({
      x: parseCropAttr(node.attrs.cropX, 0),
      y: parseCropAttr(node.attrs.cropY, 0),
      w: parseCropAttr(node.attrs.cropWidth, 1) || 1,
      h: parseCropAttr(node.attrs.cropHeight, 1) || 1,
    }),
    [
      node.attrs.cropX,
      node.attrs.cropY,
      node.attrs.cropWidth,
      node.attrs.cropHeight,
    ]
  )

  const showHandles = selected && editor.isEditable

  const measure = React.useCallback(() => {
    const img = imgRef.current
    if (!img || !img.naturalWidth || !img.naturalHeight) return
    setNatural((prev) =>
      prev && prev.w === img.naturalWidth && prev.h === img.naturalHeight
        ? prev
        : { w: img.naturalWidth, h: img.naturalHeight }
    )
  }, [])

  // The natural size is needed to derive the crop box's aspect ratio; drop it
  // when the source changes so stale measurements can't distort a new image.
  React.useEffect(() => {
    setNatural(null)
  }, [src])

  React.useEffect(() => {
    const img = imgRef.current
    if (img && img.complete) measure()
  }, [measure, src])

  // Auto-fit oversized images: once the natural size is known, shrink any
  // image that has no explicit size and is wider than the editor's content
  // area down to the available width (height keeps the aspect ratio). The
  // stored crop box clips anything the image would otherwise spill.
  React.useEffect(() => {
    if (!natural) return
    // Never mutate the document in a read-only viewer.
    if (!editor.isEditable) return
    // Respect an explicit user resize / saved size.
    if (width !== null || height !== null) return

    const root = editor.view.dom as HTMLElement
    const styles = window.getComputedStyle(root)
    const padding =
      parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight)
    const available = root.clientWidth - padding
    if (!Number.isFinite(available) || available <= MIN_SIZE) return
    if (natural.w <= available) return

    const fitW = Math.round(available)
    const fitH = Math.round(fitW / (natural.w / natural.h))
    updateAttributes({ width: fitW, height: fitH })
  }, [natural, width, height, editor, updateAttributes])

  const getContentWidth = (): number => {
    const root = editor.view.dom as HTMLElement
    const styles = window.getComputedStyle(root)
    const padding =
      parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight)
    let available = root.clientWidth - padding

    // The image may live inside a narrower block (list item, blockquote…).
    // Measure that containing block too so the image can never grow past it.
    const container = boxRef.current?.parentElement?.parentElement
    if (container && container !== root) {
      const containerStyles = window.getComputedStyle(container)
      const containerPadding =
        parseFloat(containerStyles.paddingLeft) +
        parseFloat(containerStyles.paddingRight)
      available = Math.min(available, container.clientWidth - containerPadding)
    }

    return Math.max(MIN_SIZE, available)
  }

  const handleResizeDown =
    (handle: ResizeHandle) => (event: React.PointerEvent<HTMLSpanElement>) => {
      if (!editor.isEditable) return
      const box = boxRef.current
      if (!box) return
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)

      const startW = box.clientWidth
      resizeRef.current = {
        handle,
        startX: event.clientX,
        startY: event.clientY,
        startW,
        aspect: startW / Math.max(1, box.clientHeight),
        maxW: getContentWidth(),
      }
      setActiveResize(handle)
    }

  const handleResizeMove = (event: React.PointerEvent<HTMLSpanElement>) => {
    const drag = resizeRef.current
    const box = boxRef.current
    if (!drag || !box) return
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
      clamp(drag.startW + delta, MIN_SIZE, drag.maxW)
    )
    liveWidthRef.current = nextW
    setLiveWidth(nextW)
  }

  const handleResizeUp = (event: React.PointerEvent<HTMLSpanElement>) => {
    const drag = resizeRef.current
    const box = boxRef.current
    if (!drag || !box) return
    event.preventDefault()
    event.stopPropagation()
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // pointer capture may already be released
    }
    resizeRef.current = null
    setActiveResize(null)

    const nextW = Math.round(
      clamp(liveWidthRef.current ?? drag.startW, MIN_SIZE, drag.maxW)
    )
    liveWidthRef.current = null
    setLiveWidth(null)
    updateAttributes({
      width: nextW,
      height: Math.round(nextW / drag.aspect),
    })
  }

  const startCropping = () => {
    setCrop({ ...committed })
    setCropping(true)
  }

  const applyCrop = () => {
    if (crop) {
      updateAttributes({
        cropX: round4(crop.x),
        cropY: round4(crop.y),
        cropWidth: round4(crop.w),
        cropHeight: round4(crop.h),
      })
    }
    setCropping(false)
    setCrop(null)
  }

  const cancelCrop = () => {
    setCropping(false)
    setCrop(null)
  }

  const resetCrop = () => setCrop({ x: 0, y: 0, w: 1, h: 1 })

  const handleCropDown =
    (handle: CropHandle | "move") => (event: React.PointerEvent<HTMLElement>) => {
      const box = cropBoxRef.current
      if (!box) return
      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)
      const rect = box.getBoundingClientRect()
      cropDragRef.current = {
        handle,
        startX: event.clientX,
        startY: event.clientY,
        start: { ...(crop ?? committed) },
        boxW: Math.max(1, rect.width),
        boxH: Math.max(1, rect.height),
      }
    }

  const handleCropMove = (event: React.PointerEvent<HTMLElement>) => {
    const drag = cropDragRef.current
    if (!drag) return
    event.preventDefault()
    event.stopPropagation()

    const dx = (event.clientX - drag.startX) / drag.boxW
    const dy = (event.clientY - drag.startY) / drag.boxH
    const start = drag.start
    let x = start.x
    let y = start.y
    let w = start.w
    let h = start.h
    const right = start.x + start.w
    const bottom = start.y + start.h

    if (drag.handle === "move") {
      x = clamp(start.x + dx, 0, 1 - w)
      y = clamp(start.y + dy, 0, 1 - h)
    } else {
      if (drag.handle.includes("w")) {
        const nextX = clamp(start.x + dx, 0, right - MIN_CROP)
        w = right - nextX
        x = nextX
      }
      if (drag.handle.includes("e")) {
        const nextRight = clamp(right + dx, start.x + MIN_CROP, 1)
        w = nextRight - x
      }
      if (drag.handle.includes("n")) {
        const nextY = clamp(start.y + dy, 0, bottom - MIN_CROP)
        h = bottom - nextY
        y = nextY
      }
      if (drag.handle.includes("s")) {
        const nextBottom = clamp(bottom + dy, start.y + MIN_CROP, 1)
        h = nextBottom - y
      }
    }

    setCrop({ x, y, w, h })
  }

  const handleCropUp = (event: React.PointerEvent<HTMLElement>) => {
    if (!cropDragRef.current) return
    event.preventDefault()
    event.stopPropagation()
    cropDragRef.current = null
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      // pointer capture may already be released
    }
  }

  const fallbackStyle: React.CSSProperties = {}
  if (width) {
    fallbackStyle.width = `${width}px`
    fallbackStyle.height = "auto"
  } else if (height) {
    fallbackStyle.height = `${height}px`
    fallbackStyle.width = "auto"
  }

  // Until the natural size is known the crop geometry can't be derived, so the
  // plain image is shown; it self-measures on load and then re-renders cropped.
  if (!natural) {
    return (
      <NodeViewWrapper
        className="tiptap-image-node"
        style={{ width: "fit-content", maxWidth: "100%", overflow: "hidden" }}
      >
        <img
          ref={imgRef}
          src={src}
          alt={node.attrs.alt ?? ""}
          title={node.attrs.title ?? undefined}
          width={width ?? undefined}
          height={height ?? undefined}
          style={{ ...fallbackStyle, maxWidth: "100%", height: "auto" }}
          onLoad={measure}
          draggable={false}
        />
      </NodeViewWrapper>
    )
  }

  const natAspect = natural.w / natural.h
  const committedAspect = (committed.w / committed.h) * natAspect
  const displayWidth = width ?? (height ? height * committedAspect : natural.w)
  const fullWidth = displayWidth / committed.w
  const activeCrop = crop ?? committed

  return (
    <NodeViewWrapper
      className="tiptap-image-node"
      style={{
        width: `${liveWidth ?? (cropping ? fullWidth : displayWidth)}px`,
        maxWidth: "100%",
      }}
    >
      {cropping ? (
        <div
          ref={cropBoxRef}
          className="tiptap-image-crop-edit"
          style={{ aspectRatio: `${natAspect}` }}
        >
          <img
            ref={imgRef}
            className="tiptap-image-crop-source"
            src={src}
            alt={node.attrs.alt ?? ""}
            onLoad={measure}
            draggable={false}
          />
          <div
            className="tiptap-image-crop-clip"
            contentEditable={false}
            aria-hidden="true"
          >
            <div
              className="tiptap-image-crop-mask"
              style={{
                left: `${activeCrop.x * 100}%`,
                top: `${activeCrop.y * 100}%`,
                width: `${activeCrop.w * 100}%`,
                height: `${activeCrop.h * 100}%`,
              }}
            />
          </div>
          <div
            className="tiptap-image-crop-rect"
            style={{
              left: `${activeCrop.x * 100}%`,
              top: `${activeCrop.y * 100}%`,
              width: `${activeCrop.w * 100}%`,
              height: `${activeCrop.h * 100}%`,
            }}
            onPointerDown={handleCropDown("move")}
            onPointerMove={handleCropMove}
            onPointerUp={handleCropUp}
            onPointerCancel={handleCropUp}
          >
            {CROP_HANDLES.map((handle) => (
              <span
                key={handle}
                className={`tiptap-image-crop-handle tiptap-image-crop-handle--${handle}`}
                onPointerDown={handleCropDown(handle)}
                onPointerMove={handleCropMove}
                onPointerUp={handleCropUp}
                onPointerCancel={handleCropUp}
              />
            ))}
          </div>
          <div className="tiptap-image-crop-toolbar" contentEditable={false}>
            <button type="button" onClick={applyCrop} title="Apply crop">
              <Check />
            </button>
            <button type="button" onClick={resetCrop} title="Reset crop">
              <RotateCcw />
            </button>
            <button type="button" onClick={cancelCrop} title="Cancel">
              <X />
            </button>
          </div>
        </div>
      ) : (
        <div
          ref={boxRef}
          className="tiptap-image-crop"
          style={{ aspectRatio: `${committedAspect}` }}
        >
          <img
            ref={imgRef}
            src={src}
            alt={node.attrs.alt ?? ""}
            title={node.attrs.title ?? undefined}
            style={{
              width: `${100 / committed.w}%`,
              left: `${-(committed.x / committed.w) * 100}%`,
              top: `${-(committed.y / committed.h) * 100}%`,
            }}
            onLoad={measure}
            draggable={false}
          />
        </div>
      )}

      {showHandles && !cropping && (
        <button
          type="button"
          className="tiptap-image-crop-button"
          contentEditable={false}
          onPointerDown={(event) => event.preventDefault()}
          onClick={startCropping}
          title="Crop image"
        >
          <Crop />
        </button>
      )}

      {showHandles &&
        !cropping &&
        RESIZE_HANDLES.map((handle) => (
          <span
            key={handle}
            className={`tiptap-image-resize-handle tiptap-image-resize-handle--${handle}${
              activeResize === handle ? " is-active" : ""
            }`}
            contentEditable={false}
            onPointerDown={handleResizeDown(handle)}
            onPointerMove={handleResizeMove}
            onPointerUp={handleResizeUp}
            onPointerCancel={handleResizeUp}
          />
        ))}
    </NodeViewWrapper>
  )
}
