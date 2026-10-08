import { drawMineSprite, mineAssetsReady, type MineSprite } from './mineAssets'
import type { Prop } from './props'

/** 原脚底位置与尺寸保留，贴图外观不决定碰撞范围。 */
export function drawMineDetail(g:CanvasRenderingContext2D,name:MineSprite,x:number,y:number,width:number,height:number):boolean{
  if(mineAssetsReady()){g.save();g.fillStyle='#15131e30';g.beginPath();g.ellipse(x,y-3,width*.32,Math.max(1.2,height*.035),0,0,Math.PI*2);g.fill();g.restore()}
  return drawMineSprite(g,name,x-width/2,y-height,width,height)
}

export function drawMinePropDetail(g:CanvasRenderingContext2D,p:Prop,name:MineSprite,width:number,height:number):boolean{
  g.save();g.translate(p.x,p.y);g.scale(p.s,p.s)
  const drawn=drawMineDetail(g,name,0,2,width,height)
  g.restore();return drawn
}
