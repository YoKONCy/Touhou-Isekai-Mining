import { CONFIG } from '../config'
import { drawCollapseApproach, drawCollapsedPile, drawCollapseRock } from './mineCollapseAppearance'

const hash = (n: number) => { const x = Math.sin(n*127.1+53.7)*43758.5453; return x-Math.floor(x) }
let dust: HTMLCanvasElement | null = null
function dustSprite(): HTMLCanvasElement {
  if (dust) return dust
  const canvas=document.createElement('canvas');canvas.width=96;canvas.height=96
  const g=canvas.getContext('2d')!,shade=g.createRadialGradient(48,48,2,48,48,47)
  shade.addColorStop(0,'#ad9b80aa');shade.addColorStop(.4,'#95867466');shade.addColorStop(1,'#7a6c5900')
  g.fillStyle=shade;g.fillRect(0,0,96,96);dust=canvas;return canvas
}
/** 塌方独立演出：岩块只初始化一次，落灰使用共享小图，不重绘矿石资源。 */
export class MineCollapse {
  age=-1
  start():void{this.age=0}
  update(dt:number):void{if(this.age>=0)this.age+=dt}
  get falling():boolean{return this.age>=0&&this.age<2.4}
  render(g:CanvasRenderingContext2D):void{
    const t=CONFIG.tile
    g.save();g.translate(23*t,10*t);g.scale(t/48,t/48)
    const opacity=g.globalAlpha
    if(this.age<0)drawCollapseApproach(g)
    if(this.age>=0){
      drawCollapsedPile(g,this.age)
      if(this.age<4.8){
        const sprite=dustSprite()
        for(let i=0;i<20;i++){
          const age=this.age-(i%5)*.12;if(age<0)continue
          const fade=Math.min(1,age/.3)*Math.pow(Math.max(0,1-age/4.1),1.6)
          const size=88+Math.min(age,2.5)*64,dx=70+hash(i+120)*100-age*(25+hash(i+130)*37),dy=-110+hash(i+140)*300-age*18
          g.globalAlpha=opacity*fade*.4;g.drawImage(sprite,dx-size/2,dy-size/2,size,size)
        }
      }
    }
    g.restore()
  }
}
/** 细石屑和脚边颤石是短暂提示，不添加碰撞或伤害实体。 */
export function drawLoosePebbles(g:CanvasRenderingContext2D,x:number,y:number,age:number,fromRoof:boolean):void{
  if(age<0||age>1.3)return
  g.save();g.globalAlpha*=Math.max(0,1-age/1.3)
  for(let i=0;i<7;i++){
    const dx=(hash(i+250)-.5)*70,dy=fromRoof?-190+Math.min(1,age/.75)**2*190:Math.sin(age*42+i)*2*(1-age/1.3)
    drawCollapseRock(g,x+dx,y+dy,2.3+hash(i+260)*2,i,(hash(i+8)-.5)*.8)
  }
  g.restore()
}
