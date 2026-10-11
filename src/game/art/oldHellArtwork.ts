import { hash2 } from './artPalette'
import { drawMineSprite,mineFloorTexture } from './mineAssets'
import { bakeSprite,drawSprite,type RasterSprite } from '../../core/rendering/SpriteCache'
import { hellStonePalette,paintHellStoneGrain } from './oldHellStoneMaterial'

let soilMaterial:RasterSprite|undefined

type Point={x:number;y:number}
function polygon(g:CanvasRenderingContext2D,points:readonly Point[],color:string):void {
  g.fillStyle=color;g.beginPath();points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.fill()
}

/** 坐标固定在世界上；低对比的大块岩土、碎粒和少量细裂纹替代逐格重复的椭圆。 */
export function drawHellSoil(g:CanvasRenderingContext2D,left:number,top:number,width:number,height:number,seed:number):void {
  g.fillStyle='#39281f';g.fillRect(left,top,width,height)
  const material=mineFloorTexture()
  if(material&&!soilMaterial){
    // 共用正式岩土纹理，但把原图四边羽化掉，不能把有明暗边界的整张图片直接平铺。
    soilMaterial=bakeSprite(-192,-192,384,384,c=>{
      c.drawImage(material,-192,-192,384,384);c.globalCompositeOperation='destination-in'
      const fade=c.createRadialGradient(0,0,30,0,0,188)
      fade.addColorStop(0,'#000');fade.addColorStop(.6,'#000c');fade.addColorStop(1,'#0000')
      c.fillStyle=fade;c.fillRect(-192,-192,384,384)
    },1)
  }
  if(soilMaterial){
    g.save();g.globalCompositeOperation='soft-light';g.globalAlpha=.25
    const spacing=272
    for(let row=Math.floor((top-300)/spacing);row<=Math.ceil((top+height+300)/spacing);row++)for(let col=Math.floor((left-300)/spacing);col<=Math.ceil((left+width+300)/spacing);col++){
      g.save();g.translate(col*spacing+(hash2(seed+col,row)-.5)*75,row*spacing+(hash2(row,seed+col)-.5)*60)
      g.rotate(Math.floor(hash2(seed+row,col)*4)*Math.PI/2);drawSprite(g,soilMaterial);g.restore()
    }
    g.restore()
  }
  const step=124
  for(let row=Math.floor((top-150)/step);row<=Math.ceil((top+height+150)/step);row++)for(let col=Math.floor((left-150)/step);col<=Math.ceil((left+width+150)/step);col++){
    const h=hash2(seed+col*17,row*31),x=(col+h*.8)*step,y=(row+hash2(row,seed+col)*.8)*step
    const radius=37+hash2(seed+row,col+19)*77,points:Point[]=[]
    for(let k=0;k<10;k++){
      const a=k*Math.PI/5,r=radius*(.6+hash2(col*11+k,seed+row)*.4)
      points.push({x:x+Math.cos(a)*r,y:y+Math.sin(a)*r*.42})
    }
    polygon(g,points,h<.4?'#ad7e460a':'#160e0a14')
    if(h<.12){
      g.strokeStyle='#21170f55';g.lineWidth=.65;g.lineCap='butt';g.beginPath()
      g.moveTo(x-17,y);g.lineTo(x-4,y-3);g.lineTo(x+9,y+1);g.lineTo(x+23,y-1)
      g.moveTo(x+9,y+1);g.lineTo(x+12,y+8);g.stroke()
    }
    for(let i=0;i<12;i++){
      const px=x+(hash2(seed+col*7+i,row)-.5)*130,py=y+(hash2(row*13+i,seed+col)-.5)*85
      g.fillStyle=i%3?'#17110c28':'#a87e4928';g.fillRect(px,py,.7+hash2(i+col,seed)*1.6,.6)
    }
  }
}

/** 凹陷裂口采用宽窄不一的两岸和内壁，发光只在深处断续出现，不画荧光管描边。 */
export function drawGeothermalCrack(g:CanvasRenderingContext2D,points:readonly Point[],seed:number,scale=1):void {
  if(points.length<2)return
  const samples:Array<Point&{nx:number;ny:number;width:number}>=[]
  for(let i=0;i<points.length-1;i++){
    const a=points[i]!,b=points[i+1]!,dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy)||1
    for(let j=0;j<4;j++){
      const p=(i+j/4)/(points.length-1),t=j/4,jitter=(hash2(i*17+j,seed*113)-.5)*4*scale
      samples.push({x:a.x+dx*t-dy/length*jitter,y:a.y+dy*t+dx/length*jitter,nx:-dy/length,ny:dx/length,
        width:(.6+Math.sin(p*Math.PI)*(2.2+hash2(seed+i,j)*5))*scale})
    }
  }
  const tail=points[points.length-1]!,last=samples[samples.length-1]!
  samples.push({...tail,nx:last.nx,ny:last.ny,width:.25})
  const edge=(side:number,expand:number)=>samples.map((p,i)=>({x:p.x+p.nx*side*(p.width+expand*(.7+hash2(i,seed)*.3)),y:p.y+p.ny*side*(p.width+expand*.55)}))
  g.save();g.lineJoin='miter'
  polygon(g,[...edge(1,7*scale),...edge(-1,7*scale).reverse()],'#40333b66')
  polygon(g,[...edge(1,3*scale),...edge(-1,3*scale).reverse()],'#71564b')
  polygon(g,[...edge(1,0),...edge(-1,0).reverse()],'#1c1923')
  // 朝上岸壁暗、下岸薄受光，沿破碎边缘形成嵌入地面的深度。
  g.lineWidth=.8*scale
  for(let i=1;i<samples.length-2;i++){
    if(hash2(seed,i)>.52)continue
    const a=samples[i]!,b=samples[i+1]!
    g.strokeStyle=i%3?'#aa80615c':'#cca17b48';g.beginPath();g.moveTo(a.x+a.nx*(a.width+2),a.y+a.ny*(a.width+2));g.lineTo(b.x+b.nx*(b.width+2),b.y+b.ny*(b.width+2));g.stroke()
    if(i%3===0){g.strokeStyle='#b45e3866';g.lineWidth=.75;g.beginPath();g.moveTo(a.x,a.y+1);g.lineTo(b.x,b.y+1);g.stroke()}
  }
  // 细支缝与岩屑只在岸上出现，不给每条支缝添加等宽的粗描边。
  for(let i=3;i<points.length-1;i+=2){
    const p=points[i]!,side=i%4===1?-1:1
    const branch=[p,{x:p.x+9,y:p.y+side*12},{x:p.x+24,y:p.y+side*17},{x:p.x+32,y:p.y+side*29}]
    if(scale>.6)drawGeothermalCrack(g,branch,seed+i,.4)
    for(let j=0;j<3;j++){
      const x=p.x+(hash2(seed+i,j)-.5)*33,y=p.y+side*(11+j*4),r=1.3+hash2(j,seed)*2
      polygon(g,[{x:x-r,y},{x,y:y-r*.7},{x:x+r*1.4,y:y+.5},{x:x+.7,y:y+r*.55}],j%2?'#887363':'#4a3d49')
    }
  }
  g.restore()
}

/** 石柱粗根与结节错落衔接，沿纵向保留土灰色矿脉和受光面。 */
export function drawHangingLimestone(g:CanvasRenderingContext2D,width:number,height:number,seed:number):void {
  const palette=hellStonePalette(seed)
  g.save();g.lineJoin='round'
  for(let i=0;i<3;i++){
    const h=height*(i===1?1:.48+hash2(seed,i)*.25),w=width*(i===1?.64:.3),cx=(i-1)*width*.53
    const outline=new Path2D()
    outline.moveTo(cx-w,-9)
    for(let k=1;k<=9;k++){
      const y=k/9*h,taper=Math.pow(1-k/10,1.2),rough=.77+hash2(seed+i,k)*.3
      outline.lineTo(cx-w*taper*rough+(k%2?1:-1),y)
    }
    outline.lineTo(cx+width*.025,h+4)
    for(let k=9;k>=0;k--){const y=k/10*h,taper=Math.pow(1-k/10,1.35);outline.lineTo(cx+w*taper*(.66+hash2(seed+i+19,k)*.4),y)}
    outline.closePath()
    g.save();g.clip(outline)
    const shade=g.createLinearGradient(cx-w,0,cx+w,h*.25)
    shade.addColorStop(0,palette.light);shade.addColorStop(.43,palette.base);shade.addColorStop(1,palette.dark)
    g.fillStyle=shade;g.fillRect(cx-w-3,-12,w*2+8,h+22)
    polygon(g,[{x:cx+w*.1,y:0},{x:cx+w,y:h*.05},{x:cx+w*.03,y:h}],`${palette.dark}60`)
    polygon(g,[{x:cx-w*.62,y:h*.08},{x:cx-w*.25,y:h*.29},{x:cx-w*.1,y:h*.74},{x:cx-w*.36,y:h*.41}],`${palette.edge}2e`)
    paintHellStoneGrain(g,cx-w*1.3,-12,w*2.7,h+25,seed,.65)
    g.restore();g.strokeStyle=`${palette.dark}70`;g.lineWidth=.7;g.stroke(outline)
  }
  // 根部是与岩顶连成一体的破碎岩檐，不再用几颗圆石当吊钩。
  const root=new Path2D()
  const points=[[-1.8,-34],[-1.45,-52],[-.8,-60],[-.3,-53],[.3,-61],[1.1,-48],[1.65,-45],[1.85,-24],[1.3,-9],[.55,1],[-.15,-5],[-.85,4],[-1.55,-13]] as const
  points.forEach(([x,y],i)=>i?root.lineTo(x*width,y):root.moveTo(x*width,y));root.closePath()
  g.save();g.clip(root)
  const shade=g.createLinearGradient(-width,-60,width,4)
  shade.addColorStop(0,palette.top);shade.addColorStop(.5,palette.base);shade.addColorStop(1,palette.dark)
  g.fillStyle=shade;g.fillRect(-width*2,-64,width*4,76)
  paintHellStoneGrain(g,-width*2,-65,width*4,82,seed,.8);g.restore()
  g.strokeStyle=`${palette.dark}70`;g.lineWidth=.8;g.stroke(root)
  g.restore()
}

export { drawRuinedTimberHouse } from './oldHellRuins'
