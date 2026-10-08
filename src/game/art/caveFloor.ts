import type { BiomeFloorStyle } from '../../content/biomes/types'
import { mineFloorTexture } from './mineAssets'
import { hash2 } from './artPalette'

/** 共用连续岩面：低对比材质和大色面独立于逻辑格，静态内容只在建房时烘焙。 */
export function drawCaveFloor(g: CanvasRenderingContext2D, width: number, height: number, wall: number, seed: number, style: BiomeFloorStyle): void {
  const left=wall-8,top=wall-8,w=width-left*2,h=height-top*2
  g.save();g.beginPath();g.rect(left,top,w,h);g.clip()
  g.fillStyle=style.base;g.fillRect(left,top,w,h)
  const material=mineFloorTexture()
  if(material){
    g.save();g.globalAlpha=.22;g.globalCompositeOperation='soft-light'
    for(let y=top;y<top+h;y+=384)for(let x=left;x<left+w;x+=384)g.drawImage(material,x,y,384,384)
    g.restore()
  }
  for(let i=0;i<26;i++){
    const x=left+hash2(seed+i*31,5)*w,y=top+hash2(i*13,seed+7)*h,r=26+hash2(seed,i+9)*70
    g.beginPath()
    for(let k=0;k<8;k++){const a=k*Math.PI/4,rr=r*(.7+hash2(i*9+k,seed)*.3),px=x+Math.cos(a)*rr,py=y+Math.sin(a)*rr*.45;k?g.lineTo(px,py):g.moveTo(px,py)}
    g.closePath();g.fillStyle=i%3?style.light+'0d':style.dark+'18';g.fill()
  }
  // 小裂隙保持稀疏，中央更安静；不能用连续高对比接缝把岩面画成地砖。
  for(let i=0;i<9*style.detailDensity;i++){
    const x=left+25+hash2(seed+i*17,16)*(w-50),y=top+25+hash2(i*19,seed+12)*(h-50)
    g.beginPath();g.moveTo(x-18,y-3);g.lineTo(x-3,y+1);g.lineTo(x+8,y-2);g.lineTo(x+20,y+4)
    g.moveTo(x+8,y-2);g.lineTo(x+5,y+9);g.strokeStyle=style.dark+'80';g.lineWidth=.8;g.stroke()
  }
  for(let i=0;i<180*style.detailDensity;i++){
    const x=left+hash2(seed+i*37,11)*w,y=top+hash2(i*19,seed+3)*h
    const edge=Math.min(x-left,left+w-x,y-top,top+h-y)
    if(edge>65&&i%4)continue
    g.fillStyle=i%3?style.dark+'32':style.dust+'35';g.fillRect(x,y,1+hash2(i,seed)*2,.6)
  }
  for(const [x0,y0,x1,y1,x,y,rw,rh] of [[left,top,left,top+24,left,top,w,24],[left,top+h,left,top+h-20,left,top+h-20,w,20],[left,top,left+20,top,left,top,20,h],[left+w,top,left+w-20,top,left+w-20,top,20,h]]){
    const shadow=g.createLinearGradient(x0,y0,x1,y1);shadow.addColorStop(0,style.dark+'80');shadow.addColorStop(1,style.dark+'00');g.fillStyle=shadow;g.fillRect(x,y,rw,rh)
  }
  g.restore()
}
