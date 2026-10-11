import { bakeSprite,drawSprite,type RasterSprite } from '../../core/rendering/SpriteCache'
import { radialStamp } from '../../core/rendering/RadialStamp'
import { visible,type Viewport } from '../../core/rendering/Viewport'
import type { Player } from '../Player'
import { hash2 } from './artPalette'
import { displaySettings, compactLayout } from '../../browser/display'

interface Vent {x:number;y:number;seed:number}
const TILE=512,GUTTER=4,DENSITY=.5
const SMOKE:readonly [number,string][]=[[0,'rgba(190,180,162,.92)'],[.45,'rgba(159,150,137,.65)'],[1,'rgba(137,132,121,0)']]
const HEAT:readonly [number,string][]=[[0,'rgba(248,131,64,.46)'],[.5,'rgba(210,85,55,.2)'],[1,'rgba(155,55,50,0)']]
const modulo=(value:number,period:number)=>((value%period)+period)%period

/** 云纹静态分块、漂移连续变换、人物清晰区逐显示帧合成；三者不共用低频刷新计时。 */
export class OldHellAtmosphere {
  private readonly tiles=new Map<string,RasterSprite>()
  private image:HTMLCanvasElement|null=null
  private context:CanvasRenderingContext2D|null=null
  constructor(private readonly seed:number,private readonly roomWidth:number,private readonly roomHeight:number){}
  get rasterBytes():number {
    let bytes=(this.image?.width??0)*(this.image?.height??0)*4
    for(const sprite of this.tiles.values())bytes+=sprite.image.width*sprite.image.height*4
    return bytes
  }
  releaseRenderResources():void {
    if(this.image)this.image.width=this.image.height=1
    for(const sprite of this.tiles.values())sprite.image.width=sprite.image.height=1
    this.image=null;this.context=null;this.tiles.clear()
  }
  private tile(layer:number,col:number,row:number):RasterSprite {
    // 两层都以四乘三块为纹理周期，跨周期仍从同一邻域生成，不露接缝。
    col=modulo(col,4);row=modulo(row,3)
    const key=`${layer}:${col}:${row}`,cached=this.tiles.get(key)
    if(cached)return cached
    const left=col*TILE,top=row*TILE,cell=layer?256:512,rx=layer?195:285,ry=layer?96:155,margin=rx+210
    const smoke=radialStamp('old-hell-fog-earth',.08,SMOKE)
    const sprite=bakeSprite(left-GUTTER,top-GUTTER,TILE+GUTTER*2,TILE+GUTTER*2,g=>{
      for(let r=Math.floor((top-margin)/cell);r<=Math.ceil((top+TILE+margin)/cell);r++)for(let c=Math.floor((left-margin)/cell);c<=Math.ceil((left+TILE+margin)/cell);c++){
        const h=hash2(this.seed+modulo(c,4*TILE/cell)+layer*137,modulo(r,3*TILE/cell))
        const x=c*cell+h*100,y=r*cell+Math.sin(h*9+layer)*48
        for(let lobe=0;lobe<3;lobe++){
          const px=x+(lobe-1)*76,py=y+Math.sin(h*8+lobe)*31,sx=rx+h*80,sy=ry+h*47
          if(px+sx<left-GUTTER||px-sx>left+TILE+GUTTER||py+sy<top-GUTTER||py-sy>top+TILE+GUTTER)continue
          g.save();g.translate(px,py);g.scale(sx/128,sy/128);g.globalAlpha=(layer?.32:.4)+h*.12;drawSprite(g,smoke);g.restore()
        }
      }
    },DENSITY)
    // 总共只有二十四块，容量覆盖完整纹理周期，不会在视野内互相淘汰。
    this.tiles.set(key,sprite);return sprite
  }
  render(g:CanvasRenderingContext2D,view:Viewport,time:number,players:readonly Player[],clearedAt:number|null,vents:readonly Vent[]):void {
    const width=view.right-view.left,height=view.bottom-view.top
    if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)return
    const progress=clearedAt===null?0:Math.max(0,Math.min(1,(time-clearedAt)/6)),amount=1-progress*progress*(3-2*progress)
    if(amount===0&&!vents.some(vent=>visible(view,vent.x,vent.y,300)))return
    const limit=displaySettings.quality==='low'?480:compactLayout.value&&displaySettings.quality!=='high'?640:960
    const density=Math.min(.5,limit/Math.max(width,height)),w=Math.max(1,Math.ceil(width*density-1e-6)),h=Math.max(1,Math.ceil(height*density-1e-6))
    if(!this.image){this.image=document.createElement('canvas');this.context=this.image.getContext('2d')!}
    // 缓冲尺寸只随真实视口改变，走到房间右边界不反复重新分配画布。
    if(this.image.width!==w||this.image.height!==h){this.image.width=w;this.image.height=h}
    const c=this.context!
    c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='source-over';c.globalAlpha=1;c.clearRect(0,0,w,h)
    c.setTransform(density,0,0,density,-view.left*density,-view.top*density)
    c.save();c.beginPath();c.rect(0,0,this.roomWidth,this.roomHeight);c.clip();c.imageSmoothingEnabled=true
    if(amount>0){
      for(let layer=0;layer<2;layer++){
        const dx=time*(layer?-11:7),dy=Math.sin(time*.16+layer)*24
        for(let row=Math.floor((view.top-dy)/TILE);row<=Math.floor((view.bottom-dy)/TILE);row++)for(let col=Math.floor((view.left-dx)/TILE);col<=Math.floor((view.right-dx)/TILE);col++){
          const sprite=this.tile(layer,col,row)
          c.drawImage(sprite.image,(GUTTER-.5)*DENSITY,(GUTTER-.5)*DENSITY,(TILE+1)*DENSITY,(TILE+1)*DENSITY,col*TILE+dx-.5,row*TILE+dy-.5,TILE+1,TILE+1)
        }
      }
      c.globalCompositeOperation='destination-out'
      const clear=radialStamp('old-hell-fog-clear-dense',.1,[[0,'rgba(0,0,0,.75)'],[.6,'rgba(0,0,0,.35)'],[1,'rgba(0,0,0,0)']])
      for(const player of players){
        const p=player.renderPosition,radius=.8*(player.equipmentCombat.lightRadiusMultiplier??1)
        c.save();c.translate(p.x,p.y-22);c.scale(radius,radius);drawSprite(c,clear);c.restore()
      }
      if(amount<1){c.globalCompositeOperation='destination-in';c.globalAlpha=amount;c.fillStyle='#000';c.fillRect(view.left,view.top,width,height)}
      c.globalCompositeOperation='source-over';c.globalAlpha=1
    }
    const smoke=radialStamp('old-hell-fog-earth',.08,SMOKE),heat=radialStamp('old-hell-heat',0,HEAT)
    // 热汽独立保留，在同一低分辨率缓冲里连续绘制，避免高分屏逐团过度填充。
    for(const vent of vents){
      if(!visible(view,vent.x,vent.y,300))continue
      c.save();c.translate(vent.x,vent.y);c.scale(1.8,.55);c.globalAlpha=.6;drawSprite(c,heat);c.restore()
      for(let i=0;i<6;i++){
        const p=(time*.27+i/6+vent.seed)%1,x=vent.x+(i-2.5)*22+Math.sin(time*.7+i)*17,y=vent.y-p*170
        c.save();c.translate(x,y);c.scale((33+p*55)/128,(27+p*48)/128);c.globalAlpha=Math.sin(p*Math.PI)*.9;drawSprite(c,smoke);c.restore()
      }
    }
    c.restore();g.save();g.imageSmoothingEnabled=true
    g.drawImage(this.image,0,0,width*density,height*density,view.left,view.top,width,height);g.restore()
  }
}
