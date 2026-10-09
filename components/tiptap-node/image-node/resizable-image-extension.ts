import { Image } from "@tiptap/extension-image"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { ResizableImageView } from "@/components/tiptap-node/image-node/resizable-image"
import { parseCropAttr, parseSizeAttr } from "@/lib/tiptap-utils"

export const ResizableImage = Image.extend({
  name: "image",

  addAttributes() {
    return {
      src: {
        default: null,
      },
      alt: {
        default: null,
      },
      title: {
        default: null,
      },
      width: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          parseSizeAttr(element.getAttribute("width")),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.width ? { width: attributes.width } : {},
      },
      height: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          parseSizeAttr(element.getAttribute("height")),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.height ? { height: attributes.height } : {},
      },
      // Non-destructive crop, stored as fractions (0..1) of the natural size.
      // Excalidraw-style: the original image is always kept, only the visible
      // window changes, so a crop can be re-edited at any time.
      cropX: {
        default: 0,
        parseHTML: (element: HTMLElement) =>
          parseCropAttr(element.getAttribute("data-crop-x"), 0),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.cropX ? { "data-crop-x": attributes.cropX } : {},
      },
      cropY: {
        default: 0,
        parseHTML: (element: HTMLElement) =>
          parseCropAttr(element.getAttribute("data-crop-y"), 0),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.cropY ? { "data-crop-y": attributes.cropY } : {},
      },
      cropWidth: {
        default: 1,
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute("data-crop-width")
          return value == null ? 1 : parseCropAttr(value, 1)
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.cropWidth && attributes.cropWidth !== 1
            ? { "data-crop-width": attributes.cropWidth }
            : {},
      },
      cropHeight: {
        default: 1,
        parseHTML: (element: HTMLElement) => {
          const value = element.getAttribute("data-crop-height")
          return value == null ? 1 : parseCropAttr(value, 1)
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.cropHeight && attributes.cropHeight !== 1
            ? { "data-crop-height": attributes.cropHeight }
            : {},
      },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView)
  },
})

export default ResizableImage
