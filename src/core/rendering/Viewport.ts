export interface Viewport {left:number;top:number;right:number;bottom:number}
/** 读取实际画布变换，包含高分屏、相机插值与震动。 */
export function canvasViewport(ctx:CanvasRenderingContext2D):Viewport {
  const m=ctx.getTransform()
  if(m.b!==0||m.c!==0||!m.a||!m.d)return {left:-Infinity,top:-Infinity,right:Infinity,bottom:Infinity}
  const x0=-m.e/m.a,x1=(ctx.canvas.width-m.e)/m.a,y0=-m.f/m.d,y1=(ctx.canvas.height-m.f)/m.d
  return {left:Math.min(x0,x1),top:Math.min(y0,y1),right:Math.max(x0,x1),bottom:Math.max(y0,y1)}
}
export function visible(view:Viewport,x:number,y:number,r:number):boolean{return x+r>=view.left&&x-r<=view.right&&y+r>=view.top&&y-r<=view.bottom}
/** 静态大层只提交视口内切片，仍保持原始采样密度。 */
export function drawVisibleLayer(ctx:CanvasRenderingContext2D,image:HTMLCanvasElement,width:number,height:number,view:Viewport):void {
  const x=Math.max(0,view.left),y=Math.max(0,view.top),right=Math.min(width,view.right),bottom=Math.min(height,view.bottom)
  if(right<=x||bottom<=y)return
  ctx.drawImage(image,x*image.width/width,y*image.height/height,(right-x)*image.width/width,(bottom-y)*image.height/height,x,y,right-x,bottom-y)
}
