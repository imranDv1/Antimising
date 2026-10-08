import { Image } from "@tiptap/extension-image"
import { ReactNodeViewRenderer } from "@tiptap/react"
import { ResizableImageView } from "@/components/tiptap-node/image-node/resizable-image"
import { parseSizeAttr } from "@/lib/tiptap-utils"

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
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ResizableImageView)
  },
})

export default ResizableImage
