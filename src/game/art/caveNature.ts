import type { BackgroundRock } from './floorDecorations'
import type { TileMap } from '../tilemap'
import type { Prop } from './props'
import { circleHitsProp } from './props'
import { WOOD_ID, MUSHROOM_ID, HERB_ID, FLAX_ID, CLOVER_ID, DROOP_FRUIT_ID } from '../../content/items/vanilla/ids'
import { FRAGRANT_MUSHROOM_ID, drawFragrantMushroom } from '../../content/items/vanilla/food/fragrantMushroom'
import { FORGET_ME_NOT_ID } from '../../content/items/vanilla/ids'
import { drawForgetMeNot } from '../../content/items/vanilla/materials/fourthFloorMaterials'
import { drawMineSprite, type MineSprite } from './mineAssets'
import { drawMineDetail } from './mineDetails'
import { canGatherResource } from '../../shared/mineResources'

export interface NatureGather { x:number; y:number; item:string; qty:number; done:boolean }
export interface WoodRemnant { x:number; y:number; kind:number; hp:number }
interface Puddle { x:number; y:number; rx:number; ry:number; path:Path2D }
/** 每房创建一次，所有随机几何固定；采集点与废木不占用承重支架。 */
export class CaveNature {
  readonly gathers:NatureGather[]=[]
  readonly wood:WoodRemnant[]=[]
  private puddles:Puddle[]=[]
  get waterBanks(): readonly { x: number; y: number; rx: number; ry: number }[] { return this.puddles }
  private floor:HTMLCanvasElement
  constructor(map:TileMap,props:readonly Prop[],spawnX:number,spawnY:number,floor=1,backgroundRocks:readonly BackgroundRock[]=[]){
    const width=map.cols*map.tile,height=map.rows*map.tile
    this.floor=document.createElement('canvas');this.floor.width=width*2;this.floor.height=height*2
    const g=this.floor.getContext('2d')!
    g.scale(2,2)
    const valid=(x:number,y:number,r=22)=>Math.hypot(x-spawnX,y-spawnY)>110&&[[0,0],[r,0],[-r,0],[0,r],[0,-r]].every(([dx,dy])=>!map.solidAtWorld(x+dx,y+dy))&&!props.some(p=>circleHitsProp(x,y,r,p))
    const spot=()=>{for(let i=0;i<80;i++){const x=150+Math.random()*(width-300),y=160+Math.random()*(height-320);if(valid(x,y))return {x,y}}return null}
    // 每块背景岩石独立摇号一次；成功后在它附近找一处可达空位，只生成一株。
    if(canGatherResource(FLAX_ID,floor))for(const rock of backgroundRocks){
      if(Math.random()>=.15)continue
      for(let k=0;k<12;k++){
        const a=k/12*Math.PI*2,radius=rock.radius??26,x=rock.x+Math.cos(a)*radius,y=rock.y+Math.sin(a)*radius*.65
        if(!valid(x,y,10)||this.gathers.some(p=>Math.hypot(p.x-x,p.y-y)<24))continue
        this.gathers.push({x,y,item:FLAX_ID,qty:1,done:false});break
      }
    }
    if(canGatherResource(DROOP_FRUIT_ID,floor))for(const rock of backgroundRocks){
      if(!rock.fruitAnchor||Math.random()>=.25)continue
      const x=rock.fruitAnchor.x+3,y=rock.fruitAnchor.y+21
      if(valid(x,y,9)&&!this.gathers.some(p=>Math.hypot(p.x-x,p.y-y)<22))this.gathers.push({x,y,item:DROOP_FRUIT_ID,qty:1,done:false})
    }
    for(let i=0,n=1+Math.floor(Math.random()*3);i<n;i++){
      const p=spot();if(!p||this.puddles.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<180))continue
      const rx=40+Math.random()*34,ry=15+Math.random()*15
      if(!valid(p.x,p.y,rx+10))continue
      const points:Array<[number,number]>=[]
      for(let k=0;k<16;k++){const a=k/16*Math.PI*2,r=0.86+Math.random()*0.22;points.push([p.x+Math.cos(a)*rx*r,p.y+Math.sin(a)*ry*r])}
      const path=new Path2D();path.moveTo((points[15][0]+points[0][0])/2,(points[15][1]+points[0][1])/2)
      points.forEach((v,k)=>{const b=points[(k+1)%16];path.quadraticCurveTo(v[0],v[1],(v[0]+b[0])/2,(v[1]+b[1])/2)});path.closePath()
      this.puddles.push({...p,rx,ry,path})
      // 湿泥外岸、凹入岩唇、透出砂底的浅滩与暗水深处逐层叠加。
      g.strokeStyle='#29292135';g.lineWidth=13;g.stroke(path)
      g.save();g.translate(0,2);g.strokeStyle='#aba08042';g.lineWidth=3;g.stroke(path);g.restore()
      g.strokeStyle='#35425199';g.lineWidth=1.5;g.stroke(path)
      g.save();g.clip(path)
      const gradient=g.createRadialGradient(p.x-rx*.15,p.y-ry*.2,3,p.x,p.y,rx)
      gradient.addColorStop(0,'#293843');gradient.addColorStop(.5,'#394951');gradient.addColorStop(.85,'#535a59');gradient.addColorStop(1,'#70665c')
      g.fillStyle=gradient;g.fillRect(p.x-rx*1.2,p.y-ry*1.2,rx*2.4,ry*2.4)
      for(let k=0;k<38;k++){
        const a=Math.random()*Math.PI*2,rr=.68+Math.random()*.35,x=p.x+Math.cos(a)*rx*rr,y=p.y+Math.sin(a)*ry*rr
        g.fillStyle=k%3?'#a2936c3b':'#162c304f';g.beginPath();g.ellipse(x,y,.7+Math.random()*2.1,.5+Math.random(),a,0,Math.PI*2);g.fill()
      }
      g.strokeStyle='#b0bba42b';g.lineWidth=.7;g.beginPath();g.moveTo(p.x-rx*.6,p.y+ry*.45);g.bezierCurveTo(p.x-rx*.2,p.y+ry*.7,p.x+rx*.15,p.y+ry*.3,p.x+rx*.5,p.y+ry*.42);g.stroke();g.restore()
      // 苔藓贴岸成片但留缺口，避免给每个水坑套上同样的绿圈。
      for(let k=0;k<10;k++){const a=k*0.58,x=p.x+Math.cos(a)*(rx+8),y=p.y+Math.sin(a)*(ry+6);if(!valid(x,y,8))continue;g.save();g.globalAlpha=.65;drawMineSprite(g,'moss-patch',x-12,y-4,24+k%4*3,9);g.restore()}
      if(canGatherResource(MUSHROOM_ID,floor)&&Math.random()<0.33){for(let k=0,n=1+Math.floor(Math.random()*2);k<n;k++){const x=p.x-rx+15+k*26,y=p.y+ry+12;if(valid(x,y,9))this.gathers.push({x,y,item:MUSHROOM_ID,qty:1,done:false})}}
      // 每个已生成水坑独立摇号一次；成功后只找一个岸边位置，不叠在其他采集点上。
      if(canGatherResource(FRAGRANT_MUSHROOM_ID,floor)&&Math.random()<0.08){
        for(let k=0;k<12;k++){
          const a=k/12*Math.PI*2,x=p.x+Math.cos(a)*(rx+16),y=p.y+Math.sin(a)*(ry+14)
          if(!valid(x,y,12)||this.gathers.some(q=>Math.hypot(q.x-x,q.y-y)<25))continue
          this.gathers.push({x,y,item:FRAGRANT_MUSHROOM_ID,qty:1,done:false});break
        }
      }
    }
    if(canGatherResource(CLOVER_ID,floor))for(const puddle of this.puddles){
      if(Math.random()>=.01)continue
      for(let k=0;k<12;k++){
        const a=k/12*Math.PI*2,x=puddle.x+Math.cos(a)*(puddle.rx+14),y=puddle.y+Math.sin(a)*(puddle.ry+12)
        if(!valid(x,y,9)||this.gathers.some(p=>Math.hypot(p.x-x,p.y-y)<22))continue
        this.gathers.push({x,y,item:CLOVER_ID,qty:1,done:false});break
      }
    }
    // 大片苔毯在可用地面随机分布，逐簇避开矿格、摆件与水面，边界疏松。
    if (canGatherResource(FORGET_ME_NOT_ID,floor)) {
      // 勿忘我偏向湿润岸边，概率暂定每个水坑百分之四十五；一次只生成一簇。
      for (const puddle of this.puddles) {
        if (Math.random() >= .45) continue
        for (let k = 0; k < 12; k++) {
          const a = k / 12 * Math.PI * 2, x = puddle.x + Math.cos(a) * (puddle.rx + 20), y = puddle.y + Math.sin(a) * (puddle.ry + 20)
          if (!valid(x, y, 10) || this.gathers.some(p => Math.hypot(p.x - x, p.y - y) < 26)) continue
          this.gathers.push({ x, y, item: FORGET_ME_NOT_ID, qty: 1, done: false }); break
        }
      }
    }
    for(let patch=0,n=2+Math.floor(Math.random()*3);patch<n;patch++){
      const center=spot();if(!center)continue
      const rx=65+Math.random()*65,ry=25+Math.random()*28
      for(let k=0;k<260;k++){
        const a=Math.random()*Math.PI*2,r=Math.sqrt(Math.random()),x=center.x+Math.cos(a)*rx*r,y=center.y+Math.sin(a)*ry*r
        if(!valid(x,y,4)||this.puddles.some(p=>Math.pow((x-p.x)/(p.rx+8),2)+Math.pow((y-p.y)/(p.ry+5),2)<1))continue
        if(Math.random()<r*.4||Math.sin(x*.09+y*.06)> .8)continue
        const size=1.3+Math.random()*4
        const angle=Math.random()
        if(k%6===0){g.save();g.translate(x,y);g.rotate(angle*.3);g.globalAlpha=.72;drawMineSprite(g,'moss-patch',-size*3,-size, size*6,size*2.5);g.restore()}
      }
    }
    if(canGatherResource(HERB_ID,floor)&&Math.random()<0.09){const p=spot();if(p)this.gathers.push({...p,item:HERB_ID,qty:1+Math.floor(Math.random()*2),done:false})}
    if(canGatherResource(WOOD_ID,floor))for(let k=0,n=Math.floor(Math.random()*4);k<n;k++){const p=spot();if(p&&!this.wood.some(w=>Math.hypot(w.x-p.x,w.y-p.y)<70)&&!this.gathers.some(w=>Math.hypot(w.x-p.x,w.y-p.y)<45)&&!this.puddles.some(q=>Math.hypot(q.x-p.x,q.y-p.y)<q.rx+35))this.wood.push({...p,kind:k%3,hp:30})}
  }
  renderGround(g:CanvasRenderingContext2D,time:number):void{
    g.drawImage(this.floor,0,0,this.floor.width/2,this.floor.height/2)
    for(const p of this.puddles){
      g.save();g.clip(p.path)
      // 两组错峰滴水波纹由岸边向外扩散，避免所有水坑同心同步。
      for(let i=0;i<2;i++){
        const phase=(time*.32+p.x*.017+i*.53)%1,alpha=Math.sin(phase*Math.PI)*.19
        const x=p.x+Math.sin(p.x+i*9)*p.rx*.3,y=p.y+Math.cos(p.y+i)*p.ry*.2
        g.strokeStyle=`rgba(177,193,177,${alpha})`;g.lineWidth=.65
        g.beginPath();g.ellipse(x,y,3+phase*p.rx*.72,1+phase*p.ry*.65,0,.18,Math.PI*1.85);g.stroke()
      }
      // 水面细波光连续缓移而不是闪烁整块水色。
      for(let i=0;i<7;i++){
        const x=p.x+Math.sin(i*3.7+p.x)*p.rx*.65,y=p.y+(i-3)*p.ry*.19+Math.sin(time*.8+i)*1.1
        g.strokeStyle=`rgba(165,184,166,${.035+.035*(1+Math.sin(time*1.1+i*1.8))})`;g.lineWidth=.65
        g.beginPath();g.moveTo(x-4,y);g.quadraticCurveTo(x,y-1,x+6+Math.sin(time+i)*2,y);g.stroke()
      }
      g.restore()
    }
  }
  renderGather(g:CanvasRenderingContext2D,p:NatureGather):void{
    if(!p.done){
      const name:MineSprite=p.item===DROOP_FRUIT_ID?'plant-droop-fruit':p.item===MUSHROOM_ID?'plant-mushroom-0':p.item===FRAGRANT_MUSHROOM_ID?'plant-mushroom-1':p.item===FORGET_ME_NOT_ID?'plant-forget-me-not':p.item===CLOVER_ID?'plant-clover':p.item===FLAX_ID?'plant-flax':'plant-herb'
      const width=p.item===MUSHROOM_ID||p.item===FRAGRANT_MUSHROOM_ID?30:32,height=width*(name.startsWith('plant-mushroom')?.75:1)
      if(drawMineDetail(g,name,p.x,p.y+4,width,height,true))return
    }
    g.save();g.translate(p.x,p.y)
    g.lineJoin='round'
    // 共同基座：松土暗托＋椭圆贴地影（ink 细描边，与摆件同一光照语言）
    g.fillStyle='rgba(10,7,6,0.3)';g.beginPath();g.ellipse(0,2,11,3.4,0,0,Math.PI*2);g.fill()
    g.fillStyle='#3a2f26';g.beginPath();g.ellipse(0,1,8.5,2.6,0,0,Math.PI*2);g.fill()
    if(p.item===DROOP_FRUIT_ID){
      g.strokeStyle='#6d7951';g.lineWidth=1.4;g.beginPath();g.moveTo(-3,-21);g.bezierCurveTo(0,-19,-5,-13,0,-9);g.stroke()
      if(!p.done){
        g.fillStyle='#5a7faa';g.strokeStyle='#303d4c';g.lineWidth=.9;g.beginPath();g.moveTo(0,-10);g.bezierCurveTo(10,-13,10,0,0,6);g.bezierCurveTo(-10,-1,-8,-12,0,-10);g.fill();g.stroke()
        g.fillStyle='#99b8d1';g.beginPath();g.ellipse(-3,-6,2,4,-.2,0,Math.PI*2);g.fill();g.strokeStyle='#c0ced780';g.lineWidth=.7;g.beginPath();g.moveTo(-1,-3);g.lineTo(3,-4);g.moveTo(1,0);g.lineTo(4,-1);g.stroke()
        g.fillStyle='#80945b';g.beginPath();g.moveTo(-2,-16);g.quadraticCurveTo(4,-21,7,-15);g.quadraticCurveTo(2,-12,-2,-16);g.fill()
      }
      g.restore();return
    }
    if(p.done){
      // 采集后：一小截残茬＋暗坑
      g.strokeStyle='#282735';g.lineWidth=1
      g.beginPath();g.moveTo(-1,-2);g.lineTo(-1.5,1);g.moveTo(2,-1);g.lineTo(2.5,1);g.stroke()
      g.fillStyle='#241c17';g.beginPath();g.ellipse(0,1.5,4,1.4,0,0,Math.PI*2);g.fill()
      // 坑内上缘压暗、下缘露湿土切面，少量根须和土粒打破规则椭圆。
      g.strokeStyle='#88735988';g.lineWidth=.8;g.beginPath();g.ellipse(0,1.7,5,1.8,0,.15,Math.PI-.15);g.stroke()
      g.strokeStyle='#3a3029';g.beginPath();g.moveTo(-4,-.5);g.lineTo(-2,1);g.moveTo(3,0);g.lineTo(4,1.4);g.stroke()
      for(const [x,y] of [[-7,1],[-5,3],[5,2],[7,0]]){g.fillStyle='#736048';g.beginPath();g.ellipse(x,y,1.1,.65,.2,0,Math.PI*2);g.fill()}
    }else if(p.item===FORGET_ME_NOT_ID){
      drawForgetMeNot(g)
    }else if(p.item===CLOVER_ID){
      g.strokeStyle='#68804a';g.lineWidth=1.1;g.beginPath();g.moveTo(0,1);g.quadraticCurveTo(4,-4,0,-8);g.stroke()
      g.save();g.translate(0,-9)
      for(let i=0;i<4;i++){g.save();g.rotate(i*Math.PI/2+.35);g.fillStyle=i%2?'#789953':'#92ae65';g.strokeStyle='#3d5d38';g.lineWidth=.6;g.beginPath();g.moveTo(0,0);g.bezierCurveTo(-8,-1,-7,-9,-2,-7);g.bezierCurveTo(3,-12,8,-5,0,0);g.fill();g.stroke();g.strokeStyle='#ced99a77';g.beginPath();g.moveTo(0,0);g.lineTo(-1,-6);g.stroke();g.restore()}
      g.fillStyle='#bdd187';g.beginPath();g.arc(0,0,1,0,Math.PI*2);g.fill();g.fillStyle='#e1e4be';g.beginPath();g.arc(-4,-6,.9,0,Math.PI*2);g.fill();g.restore()
    }else if(p.item===FLAX_ID){
      g.strokeStyle='#758454';g.lineWidth=1.1
      for(let k=0;k<4;k++){
        const x=(k-1.5)*3,h=18+k%3*4,lean=Math.sin(p.x+k)*3
        g.beginPath();g.moveTo(x,1);g.quadraticCurveTo(x+lean,-h*.5,x+lean,-h);g.stroke()
        for(let j=0;j<3;j++){const y=-5-j*5,side=j%2?1:-1;g.fillStyle=j%2?'#8d9f68':'#5f7d52';g.beginPath();g.moveTo(x,y);g.quadraticCurveTo(x+side*7,y-5,x+side*6,y-7);g.lineTo(x,y-2);g.fill()}
        g.save();g.translate(x+lean,-h);g.fillStyle='#a5bbd7';g.strokeStyle='#556782';g.lineWidth=.6
        for(let j=0;j<5;j++){const a=j/5*Math.PI*2;g.beginPath();g.ellipse(Math.cos(a)*2,Math.sin(a)*2,2.5,1.3,a,0,Math.PI*2);g.fill();g.stroke()}
        g.fillStyle='#d9c889';g.beginPath();g.arc(0,0,1,0,Math.PI*2);g.fill();g.restore();g.strokeStyle='#758454';g.lineWidth=1.1
      }
    }else if(p.item===FRAGRANT_MUSHROOM_ID){
      drawFragrantMushroom(g)
    }else if(p.item===MUSHROOM_ID){
      // 可疑蘑菇：2~3 朵灰白紫大伞簇生（位置哈希决定朵数，同点重访形态固定）
      const h=Math.abs(Math.sin(p.x*12.9898+p.y*78.233)*43758.5453)%1
      const blooms:Array<[number,number,number]>=h<0.45?[[-1,-3,1],[5,-1,0.72]]:[[-2,-3,1],[5,-1,0.72],[-7,0,0.55]]
      for(const[bx,by,sc]of blooms){
        // 菌柄（微鼓，根部收进暗托）
        g.fillStyle='#282735';g.beginPath();g.ellipse(bx,by-6*sc,3*sc,7*sc,0,0,Math.PI*2);g.fill()
        g.fillStyle='#cbbfac';g.beginPath();g.ellipse(bx-0.4,by-6*sc,2.3*sc,6.4*sc,0,0,Math.PI*2);g.fill()
        // 菌柄暗侧
        g.fillStyle='rgba(90,76,64,0.35)';g.beginPath();g.ellipse(bx+0.9,by-6*sc,1.1*sc,5.4*sc,0,0,Math.PI*2);g.fill()
        // 菌环（柄上一圈小领）
        g.fillStyle='#b6a892';g.fillRect(bx-2.6*sc,by-7*sc,5.2*sc,1.4*sc)
        // 伞盖（灰白带紫，半球扁伞）
        const mw=7.5*sc,mh=6*sc,my=by-11*sc
        g.fillStyle='#282735';g.beginPath();g.ellipse(bx,my,mw+1,mh+1,0,Math.PI,0);g.fill()
        g.fillStyle='#8a7d92';g.beginPath();g.ellipse(bx,my,mw,mh,0,Math.PI,0);g.fill()
        g.fillStyle='#9d91a8';g.beginPath();g.ellipse(bx-1.5*sc,my+0.4,mw*0.72,mh*0.78,0,Math.PI*1.12,Math.PI*1.75);g.fill()
        // 伞下菌褶暗边
        g.fillStyle='#564c61';g.fillRect(bx-mw,my-0.8,mw*2,1.8)
        // 盖面浅斑
        g.fillStyle='rgba(228,222,238,0.85)'
        g.beginPath()
        g.arc(bx-mw*0.34,my-mh*0.36,0.95*sc,0,Math.PI*2)
        g.arc(bx+mw*0.28,my-mh*0.5,0.8*sc,0,Math.PI*2)
        g.arc(bx+mw*0.05,my-mh*0.15,0.6*sc,0,Math.PI*2)
        g.fill()
      }
      // 根部几粒静态孢子点（不发光，只点材质）
      g.fillStyle='rgba(214,208,226,0.55)'
      g.beginPath();g.arc(4,2,0.7,0,Math.PI*2);g.arc(-5,2.5,0.6,0,Math.PI*2);g.fill()
    }else{
      // 草药：伏地锯齿叶莲座 5~7 片＋中脉亮线＋中心嫩芽
      const h=Math.abs(Math.cos(p.x*43.21+p.y*17.7)*12345.678)%1
      const n=5+Math.floor(h*3)
      for(let i=0;i<n;i++){
        const a=(i/n)*Math.PI*2+0.3
        g.save();g.rotate(a)
        // 单片锯齿叶（三段折角，尖朝外）
        g.fillStyle='#282735'
        g.beginPath();g.moveTo(0,0);g.lineTo(3,-5);g.lineTo(1.5,-8);g.lineTo(3.5,-12);g.lineTo(0,-15);g.lineTo(-3.5,-12);g.lineTo(-1.5,-8);g.lineTo(-3,-5);g.closePath();g.fill()
        g.fillStyle=i%2?'#6b8155':'#58704a'
        g.beginPath();g.moveTo(0,-0.6);g.lineTo(2.2,-5);g.lineTo(1,-8);g.lineTo(2.6,-11.6);g.lineTo(0,-14);g.lineTo(-2.6,-11.6);g.lineTo(-1,-8);g.lineTo(-2.2,-5);g.closePath();g.fill()
        // 中脉＋叶尖亮色
        g.strokeStyle='rgba(184,202,150,0.7)';g.lineWidth=0.7
        g.beginPath();g.moveTo(0,-1);g.lineTo(0,-13);g.stroke()
        g.strokeStyle='#a7bd82';g.lineWidth=1
        g.beginPath();g.moveTo(0,-12.4);g.lineTo(0,-14);g.stroke()
        g.restore()
      }
      // 中心嫩芽（未开，浅绿卷尖）
      g.fillStyle='#282735';g.beginPath();g.ellipse(0,-3,2.2,4.2,0,0,Math.PI*2);g.fill()
      g.fillStyle='#93ad6e';g.beginPath();g.ellipse(0,-3,1.5,3.5,0,0,Math.PI*2);g.fill()
      g.fillStyle='#c4d69a';g.fillRect(-0.5,-6,1,2.5)
    }
    g.restore()
  }
  renderWood(g:CanvasRenderingContext2D,p:WoodRemnant):void{
    if(drawMineDetail(g,(['wood-remnant-0','wood-remnant-1','wood-remnant-2'] as const)[p.kind%3]!,p.x,p.y+4,60,42,p.hp>0))return
    g.save();g.translate(p.x,p.y);g.fillStyle='#15152244';g.beginPath();g.ellipse(0,2,27,7,0,0,Math.PI*2);g.fill()
    g.strokeStyle='#302735';g.lineWidth=1.5;g.lineJoin='round'
    const face=(pts:number[][],c:string)=>{g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=c;g.fill();g.stroke()}
    if(p.kind===2){
      face([[-24,-22],[17,-22],[17,0],[-24,0]],'#856b50')
      face([[17,-22],[25,-29],[25,-7],[17,0]],'#594a40')
      face([[-24,-22],[-16,-29],[25,-29],[17,-22]],'#ac9270')
      face([[-17,-24],[-12,-27],[17,-27],[12,-23]],'#292734')
      g.strokeStyle='#544437';g.lineWidth=1
      for(const x of [-13,-3,7]){g.beginPath();g.moveTo(x,-20);g.lineTo(x+1,-2);g.stroke()}
      g.fillStyle='#62584b';g.fillRect(-22,-21,4,19);g.fillRect(10,-21,4,19)
      g.fillStyle='#c0a477';for(const x of [-20,12])for(const y of [-18,-4]){g.beginPath();g.arc(x,y,.9,0,Math.PI*2);g.fill()}
      face([[-5,-23],[-2,-29],[3,-24],[7,-28],[8,-22]],'#b89b72')
      g.strokeStyle='#ccb18a88';g.beginPath();g.moveTo(-11,-16);g.lineTo(-6,-17);g.moveTo(-9,-8);g.lineTo(5,-9);g.stroke()
    }else{
      for(let i=0;i<3;i++){
        g.save();g.translate((i-1)*3,-i*7-3);g.rotate(p.kind===0?(i-1)*.22:.04)
        g.strokeStyle='#302735';g.lineWidth=1.3
        face([[-25,-7],[19,-7],[24,-3],[20,-1],[24,3],[-25,3]],i%2?'#8e7051':'#79614a')
        face([[-25,-7],[-20,-12],[23,-12],[19,-7]],'#ac9270')
        face([[-25,-7],[-20,-12],[-20,-2],[-25,3]],'#b59a74')
        g.strokeStyle='#796047';g.lineWidth=.9;g.beginPath();g.moveTo(-23,-6);g.lineTo(-21,-9);g.lineTo(-21,-3);g.stroke()
        g.strokeStyle='#c8ab7e88';g.beginPath();g.moveTo(-17,-5);g.bezierCurveTo(-6,-7,3,-3,15,-5);g.moveTo(-10,0);g.lineTo(17,-1);g.stroke()
        g.strokeStyle='#544237';g.beginPath();g.moveTo(14,-7);g.lineTo(9,-3);g.lineTo(17,-2);g.stroke()
        g.beginPath();g.ellipse(-4,-3,2.5,1,0,0,Math.PI*2);g.stroke()
        if(p.kind===1){g.fillStyle='#57535a';g.fillRect(-15,-11,3,12);g.fillRect(11,-11,3,12);g.fillStyle='#a79a78';g.fillRect(-14,-7,1,2);g.fillRect(12,-7,1,2)}
        g.restore()
      }
    }
    // 露出的浅色断口与零散木屑让废木区别于承重摆件。
    // 薄木屑有卷曲纤维与暗面，断口不再铺成几片同色三角形。
    for(let i=0;i<7;i++){
      const x=-24+i*8,y=4+Math.sin(p.x*.17+i*2.3)*2
      g.save();g.translate(x,y);g.rotate(Math.sin(p.y+i)*.45)
      g.strokeStyle='#30262b';g.lineWidth=1
      face([[-3,0],[1,-1.5],[5,-.5],[3,1.5],[-2,1]],i%2?'#967958':'#745b45')
      g.strokeStyle='#c1a37999';g.lineWidth=.65;g.beginPath();g.moveTo(-2,-.1);g.quadraticCurveTo(1,-1,4,0);g.stroke()
      g.restore()
    }
    g.restore()
  }
}
