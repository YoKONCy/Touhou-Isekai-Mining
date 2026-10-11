import { hash2 } from './artPalette'
import { drawMineSprite } from './mineAssets'
import { paintHellStoneGrain } from './oldHellStoneMaterial'

type Point={x:number;y:number}
function shape(points:readonly Point[]):Path2D {
  const path=new Path2D();points.forEach((p,i)=>i?path.lineTo(p.x,p.y):path.moveTo(p.x,p.y));path.closePath();return path
}
function fill(g:CanvasRenderingContext2D,points:readonly Point[],color:string):void {g.fillStyle=color;g.fill(shape(points))}
function beam(g:CanvasRenderingContext2D,a:Point,b:Point,width:number):void {
  g.save();g.translate(a.x,a.y);g.rotate(Math.atan2(b.y-a.y,b.x-a.x))
  const length=Math.hypot(b.x-a.x,b.y-a.y)
  g.fillStyle='#332319';g.fillRect(0,-width/2,length,width)
  drawMineSprite(g,'timber-beam',0,-width/2,length,width,'#664426',.38)
  g.fillStyle='#c8995733';g.fillRect(0,-width/2,length,1);g.restore()
}

/** 屋脊高于两侧檐口；远坡先画、近坡遮住远坡，不能把远坡翻成竖起的瓦板。 */
function roof(g:CanvasRenderingContext2D,width:number,height:number,tile:number,variant:0|1,seed:number):void {
  const left=-width/2,right=width/2,back=-height-94,front=-tile-98,ridge=Math.min(back,front)-54-variant*12
  const ridgeL={x:left+23,y:ridge},ridgeR={x:right-23,y:ridge-4}
  const backL={x:left-8,y:back},backR={x:right+8,y:back-4},frontL={x:left-29,y:front},frontR={x:right+29,y:front-4}
  // 山墙的三角高点与屋脊一致，先给凸起屋顶明确的结构轮廓。
  fill(g,[backL,ridgeL,frontL,{x:left,y:front+22},{x:left,y:back+30}],'#463326')
  fill(g,[backR,ridgeR,frontR,{x:right,y:front+19},{x:right,y:back+27}],'#2d241d')
  beam(g,backL,ridgeL,10);beam(g,ridgeL,frontL,12);beam(g,backR,ridgeR,10);beam(g,ridgeR,frontR,11)
  const slope=(a:Point,b:Point,c:Point,d:Point,far:boolean)=>{
    const point=(u:number,v:number):Point=>({x:(a.x*(1-u)+b.x*u)*(1-v)+(d.x*(1-u)+c.x*u)*v,y:(a.y*(1-u)+b.y*u)*(1-v)+(d.y*(1-u)+c.y*u)*v})
    const contour=far?[a,b,point(1,.72),point(.8,.78),point(.68,1),d]:
      [a,b,point(1,variant ? .32 : .42),point(.86,.44),point(.77,variant ? .25 : .37),point(.59,.43),point(.65,.63),point(variant ? .47 : .54,.83),point(variant ? .49 : .6,1),d]
    const mask=shape(contour)
    const hole=far?[]:[point(.18,.22),point(.33,.17),point(.43,.33),point(.4,.51),point(.28,.59),point(.19,.45)]
    if(hole.length)mask.addPath(shape(hole))
    // 塌毁处只留下断椽，不铺一整片实心底板把残屋重新补完整。
    const rafters=Math.max(6,Math.floor(width/42))
    for(let i=0;i<=rafters;i++){
      const u=i/rafters,end=hash2(seed+i,far?6:9)>.5 ? .98 : .67
      beam(g,point(u,0),point(u,end),far?5:7)
      if(!far&&i%3===1){const p=point(u,end);fill(g,[p,{x:p.x-4,y:p.y-5},{x:p.x+3,y:p.y-2},{x:p.x+5,y:p.y+4}],'#a8794366')}
    }
    for(let i=1;i<4;i++)beam(g,point(0,i/4),point(i===3 ? .64 : .94,i/4),5)
    g.save();g.clip(mask,'evenodd');g.fillStyle=far?'#25241f':'#36312b';g.fill(shape([a,b,c,d]))
    const rows=Math.max(3,Math.ceil(Math.abs(d.y-a.y)/22)),cols=Math.ceil(width/25)
    for(let row=0;row<rows;row++)for(let col=-1;col<=cols;col++){
      const h=hash2(seed+col*11,row+(far?71:0)),patch=hash2(seed+Math.floor(col/3),Math.floor(row/2)+81)
      const offset=row%2 ? .47 : 0,u=(col+offset)/cols,v=row/rows,du=.97/cols,dv=1.12/rows
      if(h>.93||h>.86&&row>rows*.65)continue
      const p0=point(u+.025/cols,v),p1=point(u+du,v),p2=point(u+du+.025/cols,Math.min(1,v+dv)),p3=point(u-.02/cols,Math.min(1,v+dv))
      const mid={x:(p2.x+p3.x)/2,y:(p2.y+p3.y)/2+(far?-1:1.4)}
      const slab=new Path2D();slab.moveTo(p0.x,p0.y);slab.lineTo(p1.x,p1.y);slab.lineTo(p2.x,p2.y);slab.quadraticCurveTo(mid.x,mid.y+1.5,p3.x,p3.y);slab.closePath()
      g.fillStyle=far?(patch<.4?'#3d3b34':'#34342e'):(patch<.2?'#494a43':patch<.48?'#625e53':patch<.8?'#71685b':'#7a6a50');g.fill(slab)
      // 瓦尾压住下一排，暗断面、受光凸棱和积灰分成三层。
      fill(g,[p3,{x:mid.x,y:mid.y+1.8},p2,{x:p2.x,y:p2.y+2.2},{x:mid.x,y:mid.y+3.4},{x:p3.x,y:p3.y+2.4}],far?'#1a1d1a':'#292921')
      if(h<.7){g.strokeStyle=far?'#9b957733':'#c0af8866';g.lineWidth=.8;g.beginPath();g.moveTo(p3.x+2,p3.y-.4);g.quadraticCurveTo(mid.x,mid.y,p2.x-3,p2.y-.4);g.stroke()}
      if(h<.13){
        const q=point(u+.53/cols,v+.65/rows)
        fill(g,[{x:q.x-4,y:q.y-3},{x:q.x+2,y:q.y-1},{x:q.x+4,y:q.y+3},{x:q.x-2,y:q.y+2}],'#2c2a24b0')
      }
    }
    paintHellStoneGrain(g,left-45,ridge-30,width+90,front-ridge+65,seed,.34)
    // 少量烟熏与土黄积灰跨越数片瓦，避免每一片瓦都像同一张新瓦。
    for(let i=0;i<3;i++){
      const u=.12+hash2(seed,i+301)*.75,v=.1+hash2(seed,i+311)*.7,p=point(u,v),r=25+hash2(seed,i+321)*30
      const stain=g.createRadialGradient(p.x,p.y,2,p.x,p.y,r)
      stain.addColorStop(0,i%2?'#17191338':'#aa794825');stain.addColorStop(1,'#261e1400')
      g.fillStyle=stain;g.fillRect(p.x-r,p.y-r,r*2,r*2)
    }
    g.restore()
    if(!far){
      const end=point(variant ? .49 : .6,1)
      beam(g,d,end,11)
      for(let u=.02;u<(variant ? .48 : .59);u+=23/width){
        const p=point(u,1)
        g.fillStyle='#393a31';g.beginPath();g.ellipse(p.x,p.y+5,7.7,4,0,0,Math.PI);g.fill()
        g.strokeStyle='#a9997370';g.lineWidth=.8;g.beginPath();g.ellipse(p.x,p.y+3,7,3.4,0,0,Math.PI);g.stroke()
      }
      // 露出的崩口承接残瓦厚度，几根断椽从缺口伸出。
      for(let i=3;i<contour.length-2;i++){
        const p=contour[i]!,q=contour[i+1]!
        fill(g,[p,q,{x:q.x-1,y:q.y+4},{x:p.x+1,y:p.y+3}],'#2b2319')
      }
    }
  }
  slope(backL,backR,ridgeR,ridgeL,true)
  slope(ridgeL,ridgeR,frontR,frontL,false)
  beam(g,ridgeL,ridgeR,10)
  for(let x=ridgeL.x;x<ridgeR.x;x+=23){
    const u=(x-ridgeL.x)/(ridgeR.x-ridgeL.x)
    if(u>.65&&u<.84||hash2(seed,Math.floor(x)+401)>.9)continue
    const y=ridge-4*u
    fill(g,[{x:x-2,y:y+1},{x:x+2,y:y-7},{x:x+17,y:y-8},{x:x+21,y:y+1}],'#7b705b')
    fill(g,[{x:x+2,y:y-7},{x:x+17,y:y-8},{x:x+16,y:y-6},{x:x+3,y:y-5}],'#b8a17b91')
    fill(g,[{x:x+17,y:y-8},{x:x+21,y:y+1},{x:x+18,y:y+2},{x:x+15,y:y-4}],'#37352b')
  }
}

/** 残屋先有明确的墙、门洞与立柱，杂物只聚集在坍塌一侧，保留入口净空。 */
export function drawRuinedTimberHouse(g:CanvasRenderingContext2D,width:number,height:number,tile:number,variant:0|1,seed:number):void {
  const left=-width/2,right=width/2,front=-tile+16,wallTop=front-112,doorX=tile*.5,doorWidth=tile*3
  const doorL=doorX-doorWidth/2,doorR=doorX+doorWidth/2
  g.save();g.lineJoin='round'
  const panel=(x:number,base:number,w:number,h:number,broken:boolean,index:number)=>{
    const outline=shape([{x,y:base},{x,y:base-h},{x:x+w*.35,y:base-h-3},{x:x+w*.65,y:base-h+(broken?h*.32:1)},{x:x+w,y:base-h+(broken?h*.52:3)},{x:x+w,y:base}])
    g.save();g.clip(outline);g.fillStyle='#36271c';g.fillRect(x,base-h-5,w,h+5)
    for(let row=0;row<Math.ceil(h/18);row++){
      const y=base-h+row*18,wood=hash2(seed+index,row)<.5?'wood-remnant-0':'wood-remnant-2'
      drawMineSprite(g,wood,x-3,y,w+6,19,'#6a482b',.4)
      g.fillStyle='#1c170f60';g.fillRect(x,y+16,w,2)
    }
    g.restore()
    beam(g,{x,y:base},{x:x+w,y:base},7)
  }
  // 后墙与两侧残墙构成屋腔，支撑点和真实建筑占地一致。
  const backBase=-height+tile*.7
  panel(left+12,backBase,width-24,130,variant===1,1)
  for(const side of [-1,1]){
    const x=side<0?left+13:right-13
    beam(g,{x,y:backBase+4},{x,y:front+3},13)
    for(let y=backBase;y<front-12;y+=48){
      if(side>0&&y>front-height*.45)continue
      panel(x-10,y+24,20,80+hash2(seed,Math.floor(y))*25,side>0,side+3)
    }
    beam(g,{x,y:backBase},{x,y:backBase-127},17)
    beam(g,{x,y:front},{x,y:wallTop-5},18)
  }
  roof(g,width,height,tile,variant,seed)
  // 正面只保留两片残墙和一个宽门洞，门内暗部与外侧墙板明确分开。
  panel(left+12,front,Math.max(8,doorL-left-20),104,false,6)
  panel(doorR+8,front,Math.max(8,right-doorR-20),variant?65:96,true,7)
  const cavity=g.createLinearGradient(0,wallTop+15,0,front)
  cavity.addColorStop(0,'#100d0bd9');cavity.addColorStop(.65,'#1d160fb0');cavity.addColorStop(1,'#39271940')
  g.fillStyle=cavity;g.fillRect(doorL+5,wallTop+13,doorWidth-10,front-wallTop-13)
  beam(g,{x:doorL-4,y:front},{x:doorL-4,y:wallTop+4},17)
  beam(g,{x:doorR+4,y:front},{x:doorR+4,y:wallTop+6},17)
  beam(g,{x:doorL-15,y:wallTop+8},{x:doorR+15,y:wallTop+9},16)
  beam(g,{x:doorL-3,y:front+1},{x:doorR+3,y:front+1},7)
  if(doorL-left>65){
    const x=left+33,y=wallTop+34
    g.fillStyle='#17120e';g.fillRect(x,y,27,31)
    beam(g,{x:x-2,y:y-2},{x:x+29,y:y-2},5);beam(g,{x:x-2,y:y+33},{x:x+29,y:y+33},5)
    beam(g,{x:x+13,y:y},{x:x+13,y:y+14},3)
  }
  // 少量基石沿墙脚排列，不向门洞里堆满石头和重复木板。
  for(const [start,end] of [[left+4,doorL-15],[doorR+15,right-5]] as const){
    for(let x=start;x<end;x+=42)drawMineSprite(g,'stone-sandstone',x,front-10,36,23,'#5f4b35',.35)
  }
  // 倒塌梁木从受损屋角斜落到墙边碎瓦堆，避免横悬在完好的瓦面上。
  const debrisX=right+4
  beam(g,{x:right-45,y:-tile-110},{x:debrisX+22,y:front+8},11)
  for(let i=0;i<9;i++){
    const x=debrisX-35+hash2(seed,i+501)*64,y=front+hash2(seed,i+511)*27
    if(i%3===0){g.save();g.translate(x,y);g.rotate((hash2(seed,i+521)-.5)*1.7);drawMineSprite(g,'wood-remnant-2',-16,-4,32,8,'#70502d',.38);g.restore()}
    else fill(g,[{x:x-9,y},{x:x-3,y:y-5},{x:x+9,y:y-3},{x:x+5,y:y+4},{x:x-6,y:y+5}],i%2?'#625e50':'#3d3d34')
  }
  g.restore()
}
