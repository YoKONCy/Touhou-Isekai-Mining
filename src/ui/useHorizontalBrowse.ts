import { onBeforeUnmount, ref } from 'vue'

/** 材料托盘共享横向浏览：直接更新滚动位置，不让高频拖拽触发组件重绘。 */
export function useHorizontalBrowse(){
  const strip=ref<HTMLElement|null>(null)
  let drag:{pointer:number;x:number;scroll:number;active:boolean}|null=null
  function stop(){
    const pointer=drag?.pointer,element=strip.value
    drag=null
    if(pointer!==undefined&&element?.hasPointerCapture(pointer))element.releasePointerCapture(pointer)
    element?.classList.remove('dragging')
  }
  function beginBrowse(e:PointerEvent){
    if(e.button!==0)return
    drag={pointer:e.pointerId,x:e.clientX,scroll:strip.value?.scrollLeft??0,active:false}
  }
  function moveBrowse(e:PointerEvent){
    const element=strip.value
    if(!element||!drag||drag.pointer!==e.pointerId)return
    const dx=e.clientX-drag.x
    if(!drag.active&&Math.abs(dx)>6&&element.scrollWidth>element.clientWidth){
      drag.active=true;element.setPointerCapture(e.pointerId);element.classList.add('dragging')
    }
    if(drag.active){e.preventDefault();element.scrollLeft=drag.scroll-dx}
  }
  function endBrowse(e:PointerEvent){if(drag?.pointer===e.pointerId)stop()}
  function leaveBrowse(){if(!drag?.active)stop()}
  function browseWheel(e:WheelEvent){
    const element=strip.value
    if(!element||element.scrollWidth<=element.clientWidth)return
    e.preventDefault()
    const delta=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY
    element.scrollLeft+=delta*(e.deltaMode===1?20:e.deltaMode===2?element.clientWidth:1)
  }
  onBeforeUnmount(stop)
  return {strip,beginBrowse,moveBrowse,endBrowse,leaveBrowse,browseWheel}
}
