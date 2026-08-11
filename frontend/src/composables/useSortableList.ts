import { onBeforeUnmount, onMounted, watch, type Ref } from 'vue'
import Sortable from 'sortablejs'

/** SortableJS 的 Vue 3.5 兼容封装（vuedraggable@4 依赖 Vue2 的 $scopedSlots，已弃用）。 */
export function useSortableList(
  el: Ref<HTMLElement | null>,
  options: { handle?: string; onEnd?: (evt: Sortable.SortableEvent) => void }
) {
  let instance: Sortable | null = null

  function attach() {
    if (!el.value || instance) return
    instance = Sortable.create(el.value, {
      handle: options.handle,
      animation: 150,
      onEnd: (evt) => options.onEnd?.(evt)
    })
  }

  function destroy() {
    instance?.destroy()
    instance = null
  }

  watch(el, (value) => {
    if (value) attach()
    else destroy()
  }, { flush: 'post' })

  onMounted(attach)
  onBeforeUnmount(destroy)

  return { destroy }
}
