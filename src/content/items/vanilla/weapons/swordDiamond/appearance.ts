import { svgIcon,type HeldWeaponView,type GroundDropView } from '../../../types'
import { SpriteCache,bakeSprite,drawSprite } from '../../../../../core/rendering/SpriteCache'
import { radialStamp } from '../../../../../core/rendering/RadialStamp'

const sprites=new SpriteCache(1,32*1024)

/** 半透明底与明暗错开的切面共同形成凹凸晶体表面，所有静态材质一次烘焙。 */
function diamondSwordSprite(){
  return sprites.get('diamond-sword',()=>bakeSprite(-10,-9,60,18,g=>{
    g.lineJoin='bevel';g.lineWidth=.75;g.strokeStyle='#3a495e'
    g.fillStyle='#96bccd';g.beginPath();g.moveTo(-9,0);g.lineTo(-6,-2.7);g.lineTo(-3,0);g.lineTo(-6,2.7);g.closePath();g.fill();g.stroke()
    g.fillStyle='#e5f4f5';g.fill(new Path2D('M-9 0L-6-2.7L-6 .2Z'))
    g.fillStyle='#3b4058';g.fillRect(-4,-1.7,7,3.4);g.strokeRect(-4,-1.7,7,3.4)
    g.strokeStyle='#9fa7bf';g.lineWidth=.55;g.stroke(new Path2D('M-3-1.4L-1.8 1.4M-.8-1.4L.4 1.4'))
    g.fillStyle='#b7d2de';g.strokeStyle='#526c838f';g.lineWidth=.7
    g.fill(new Path2D('M2-6.2L4-5.7L5-2.7L5 2.7L4 5.7L2 6.2L1.7 3.2L2.4 0L1.7-3.2Z'))
    g.stroke(new Path2D('M2-6.2L4-5.7L5-2.7L5 2.7L4 5.7L2 6.2L1.7 3.2L2.4 0L1.7-3.2Z'))
    g.strokeStyle='#ecf8fb';g.lineWidth=.6;g.stroke(new Path2D('M2.5-5.1L3.5-2.7L3.5 2.7L2.5 5.1'))
    // 钢剑尖位于四十像素，晶刃延伸到四十六像素，保持窄直剑的比例。
    const blade=new Path2D('M5-2.7L34-2.2L40-1.6L46 0L40 1.6L34 2.2L5 2.7Z')
    g.fillStyle='#a6d8ef70';g.fill(blade);g.strokeStyle='#5b89ac87';g.lineWidth=.65;g.stroke(blade)
    g.save();g.clip(blade)
    g.fillStyle='#ecfbffa3';g.fill(new Path2D('M5-2.7L15-2.5L11-.4L19 .3L28-2.3L34-2.2L29 .1L39-.7L46 0L34 .8L23 .4L16 1.1L5 .2Z'))
    g.fillStyle='#6eafd57d';g.fill(new Path2D('M5 .2L11-.4L16 1.1L23 .4L29 .1L25 2.4L16 2.5L12 1.3L5 2.7Z'))
    g.fillStyle='#b4ddef9c';g.fill(new Path2D('M17-2.5L21-.7L27-2.3L24 .5L19 .3L14-1Z'))
    g.fillStyle='#78b7d28c';g.fill(new Path2D('M29 .1L34-2.2L39-.7L34 .8L38 2L29 2.3Z'))
    g.fillStyle='#f5fcffb8';g.fill(new Path2D('M8-2.5L11-.4L14-1L12-2.5ZM23 .4L26 .2L24 1.8L20 2.4ZM35-.9L40-1.6L43-.6L39-.7Z'))
    g.strokeStyle='#f4fdffc9';g.lineWidth=.45;g.stroke(new Path2D('M6-2.2L15-2M19-2.1L27-1.9M32-1.8L39-1.2L44-.1M7 2.2L14 2.1M27 1.8L33 1.5'))
    g.strokeStyle='#5b91b359';g.lineWidth=.35;g.stroke(new Path2D('M11-.4L15-2.2M19 .3L17-2.4M23 .4L20 2.4M29 .1L32 1.8M34 .8L39-.7'))
    g.restore()
  },2))
}

export function drawDiamondSwordBody(g:CanvasRenderingContext2D):void {drawSprite(g,diamondSwordSprite())}

/** 闪光随模拟时间交替亮起，保持小而锐利，暂停时不会继续闪动。 */
export function drawDiamondSword(g:CanvasRenderingContext2D,view:HeldWeaponView={}):void {
  drawDiamondSwordBody(g)
  const time=view.motion?.time??view.time??0
  const glow=radialStamp('diamond-sword-glint',0,[[0,'#f6fdffb8'],[.3,'#c9ecfa66'],[.7,'#a6d7f21f'],[1,'#a6d7f200']])
  for(let i=0;i<3;i++){
    const pulse=Math.max(0,(Math.sin(time*(2.4+i*.27)+i*2.15)-.45)/.55)
    if(pulse<=.01)continue
    const x=12+i*13,y=i===1 ? .6 : -.9,radius=2+pulse*1.8
    g.save();g.translate(x,y);g.globalAlpha*=pulse;g.globalCompositeOperation='lighter'
    g.save();g.scale(radius/128,radius/128);drawSprite(g,glow);g.restore()
    g.strokeStyle='#f5fdff';g.lineWidth=.5;g.beginPath();g.moveTo(-radius*.65,0);g.lineTo(radius*.65,0);g.moveTo(0,-radius);g.lineTo(0,radius);g.stroke();g.restore()
  }
}
export function drawGroundDiamondSword({ctx:g,x,y,bob}:GroundDropView):void {
  g.save();g.translate(x,y);g.rotate(-.7);g.scale(.55,.55);g.translate(-18,0);drawDiamondSword(g,{time:bob});g.restore()
}

export const DIAMOND_SWORD_ICON=svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <g transform="translate(13 51) rotate(-45)" stroke-linejoin="bevel">
    <path d="M-9 0L-6-3L-3 0L-6 3Z" fill="#a1c7d9" stroke="#4c6077" stroke-width="1"/>
    <path d="M-9 0L-6-3L-6 0Z" fill="#edf8fa"/>
    <path d="M-4-2H4V2H-4Z" fill="#43465e" stroke="#3d4358"/><path d="M-3-1.7L-1.6 1.7M0-1.7L1.4 1.7" stroke="#a9b4cb" stroke-width=".8"/>
    <path d="M3-7L6-6L7-3V3L6 6L3 7L3.4 3L4 0L3.4-3Z" fill="#bdd7e1" stroke="#59778b" stroke-width=".9"/>
    <path d="M4-5.4L5.4-2.8V2.8L4 5.4" fill="none" stroke="#f3fcff" stroke-width=".8"/>
    <path d="M7-3.3L45-2.6L52-1.7L60 0L52 1.7L45 2.6L7 3.3Z" fill="#addcf080" stroke="#79a6c2ba" stroke-width=".8"/>
    <path d="M7-3.3L18-3L14-.4L25 .4L37-2.7L45-2.6L39 .2L52-.7L60 0L45 1L30 .5L21 1.5L7 .3Z" fill="#effbffb0"/>
    <path d="M7 .3L14-.4L21 1.5L30 .5L39 .2L33 2.8L21 3L17 1.7L7 3.3Z" fill="#76b5d68c"/>
    <path d="M22-3L28-1L35-2.7L31 .5L25 .4L19-1.2Z" fill="#b4def0b3"/>
    <path d="M39 .2L45-2.6L52-.7L45 1L49 2.1L39 2.6Z" fill="#87bad2a1"/>
    <path d="M11-3L14-.4L19-1.2L16-3ZM30 .5L34 .3L31 2.3L26 2.9ZM46-1.3L52-1.7L56-.5L52-.7Z" fill="#f7fdffcc"/>
    <path d="M8-2.8L18-2.5M24-2.5L36-2.3M42-2.1L51-1.2L58-.2M9 2.8L18 2.6M36 2.2L44 1.9" fill="none" stroke="#f4fdff" stroke-width=".7"/>
  </g>
  <g fill="#f5fdff" stroke="#d4f4ff" stroke-width=".4"><path d="M27 26L28 29L31 30L28 31L27 34L26 31L23 30L26 29Z"/><path d="M45 13L45.6 15L48 15.6L45.6 16.2L45 18.2L44.4 16.2L42 15.6L44.4 15Z"/></g>
</svg>`)
