import { bakeSprite, drawSprite, type RasterSprite } from '../../core/rendering/SpriteCache'
let grill:RasterSprite|null=null
/** 营火升级的实体外观独立缓存，保留原营火动态火焰。 */
export function drawCampGrill(g:CanvasRenderingContext2D,x:number,y:number):void{
  grill??=bakeSprite(-47,-86,94,92,c=>{
    c.lineJoin='round';c.lineCap='round'
    c.strokeStyle='#292431';c.lineWidth=6
    for(const [a,b] of [[-32,-60],[26,-66]] as const){c.beginPath();c.moveTo(a,b);c.lineTo(a-8,0);c.moveTo(a,b);c.lineTo(a+12,0);c.stroke()}
    c.strokeStyle='#8a8381';c.lineWidth=2
    for(const [a,b] of [[-32,-60],[26,-66]] as const){c.beginPath();c.moveTo(a,b);c.lineTo(a-8,0);c.moveTo(a,b);c.lineTo(a+12,0);c.stroke()}
    c.beginPath();c.moveTo(-39,-62);c.lineTo(21,-76);c.lineTo(42,-58);c.lineTo(-18,-43);c.closePath();c.fillStyle='#3b3544cc';c.fill();c.strokeStyle='#b2a495';c.lineWidth=2.5;c.stroke()
    c.lineWidth=1.3;c.strokeStyle='#9a8b7d'
    for(let i=1;i<8;i++){c.beginPath();c.moveTo(-39+i*7.5,-62-i*1.75);c.lineTo(-18+i*7.5,-43-i*1.875);c.stroke()}
    for(let i=1;i<4;i++){c.beginPath();c.moveTo(-39+i*5.25,-62+i*4.75);c.lineTo(21+i*5.25,-76+i*4.5);c.stroke()}
    c.fillStyle='#bba486';c.fillRect(-34,-62,3,3);c.fillRect(26,-69,3,3)
  })
  g.save();g.translate(x,y);drawSprite(g,grill);g.restore()
}
