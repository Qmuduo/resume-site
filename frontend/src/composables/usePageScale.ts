import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

const MM_TO_PX = 96 / 25.4
const PAGE_WIDTH_MM = 210

/**
 * A4 简历页缩放：按容器宽度把 210mm 页面等比缩放到 1:1 以内，
 * 屏幕预览用小尺寸，打印时由 @media print 取消 transform 恢复原始尺寸。
 */
export function usePageScale(
  stageRef: Ref<HTMLElement | null>,
  contentRef: Ref<HTMLElement | null>
) {
  const scale = ref(1)
  const viewport = ref({ width: 0, height: 0 })
  let observer: ResizeObserver | null = null

  function update() {
    const stage = stageRef.value
    const content = contentRef.value
    if (!stage || !content) return
    const pageWidth = PAGE_WIDTH_MM * MM_TO_PX
    const nextScale = Math.min(stage.clientWidth / pageWidth, 1)
    scale.value = nextScale
    viewport.value = {
      width: pageWidth * nextScale,
      height: content.scrollHeight * nextScale
    }
  }

  onMounted(() => {
    update()
    observer = new ResizeObserver(update)
    if (stageRef.value) observer.observe(stageRef.value)
    if (contentRef.value) observer.observe(contentRef.value)
  })

  onBeforeUnmount(() => {
    observer?.disconnect()
  })

  return {
    viewportStyle: computed(() => ({
      width: `${viewport.value.width}px`,
      height: `${viewport.value.height}px`
    })),
    scalerStyle: computed(() => ({ transform: `scale(${scale.value})` }))
  }
}
