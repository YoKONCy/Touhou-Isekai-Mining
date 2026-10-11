import { svgIcon,type GroundDropView } from '../../../types'
import { SpriteCache,bakeSprite,drawSprite } from '../../../../../core/rendering/SpriteCache'
import { drawStoneSpear,SPEAR_LENGTH_SCALE } from '../spearStone/appearance'

const heads=new SpriteCache(2,32*1024)

/** 黑曜石以深黑底、紫色贝壳状断面与窄亮棱表现，强化版嵌入钻石般的透亮切面。 */
function obsidianHead(reinforced:boolean){
  return heads.get(reinforced?'reinforced':'plain',()=>bakeSprite(51,-10,38,20,g=>{
    g.lineJoin='bevel';g.lineWidth=.8;g.strokeStyle='#24202d'
    g.fillStyle=reinforced?'#514258':'#403b45';g.beginPath();g.moveTo(53,-2.5);g.lineTo(66,-3);g.lineTo(66,3);g.lineTo(53,2.4);g.closePath();g.fill();g.stroke()
    g.strokeStyle='#b79e7d';g.lineWidth=.7
    for(let x=54;x<=61;x+=2.4){g.beginPath();g.moveTo(x,-2.6);g.lineTo(x+1.1,2.6);g.stroke()}
    const blade=new Path2D('M63 .2L66-4.2L70-6.1L74-4.4L80-2.6L86 0L77 3.5L71 5.9L67 4.1L62 2Z')
    g.fillStyle=reinforced?'#40244f':'#1b1728';g.fill(blade);g.strokeStyle='#14131e';g.lineWidth=1;g.stroke(blade)
    g.save();g.clip(blade)
    g.fillStyle=reinforced?'#9c66b5':'#62516e';g.fill(new Path2D('M64 .1L70-5.3L74-3.6L84-.3L73-.9L68 1Z'))
    g.fillStyle=reinforced?'#20172f':'#0d111b';g.fill(new Path2D('M68 1L74-1.7L85 0L71 5.9L73 2Z'))
    g.fillStyle=reinforced?'#704383':'#3c304b';g.fill(new Path2D('M64 .2L69-.6L72 .6L68 3.2L65 2.7Z'))
    g.strokeStyle=reinforced?'#cba2e0':'#8d769a';g.lineWidth=.55;g.stroke(new Path2D('M66-2.5Q70-1.2 73-2.8M68 2.5Q70 .7 75 .8M75-3.4L82-1'))
    g.strokeStyle=reinforced?'#ecd7fa':'#b29bbd';g.lineWidth=.65;g.stroke(new Path2D('M67-3.9L70-5.4L74-3.8L84-.4M74 3.8L82 1.3'))
    if(reinforced){
      g.fillStyle='#ddbbef';g.fill(new Path2D('M69-3.9L72-2.2L70 .2L68-1Z'))
      g.fillStyle='#f5e7f6';g.fill(new Path2D('M69-3.9L70-1.2L72-2.2Z'))
      g.fillStyle='#96bacf';g.fill(new Path2D('M70-1.2L70 .2L72-2.2Z'))
      g.fillStyle='#ba7ed2';g.fill(new Path2D('M74 .7L78 1.1L74.7 3.2L73.7 2Z'))
      g.strokeStyle='#f0d5f7';g.lineWidth=.5;g.stroke(new Path2D('M76-2.1L81-.8M75.4 1.1L76.6 1.5'))
    }
    g.restore()
  },2))
}

export function drawObsidianHead(g:CanvasRenderingContext2D,reinforced:boolean):void {
  g.save();g.scale(SPEAR_LENGTH_SCALE,1);drawSprite(g,obsidianHead(reinforced));g.restore()
}
export function drawObsidianSpear(g:CanvasRenderingContext2D,reinforced:boolean):void {
  g.save();g.beginPath();g.rect(-32*SPEAR_LENGTH_SCALE,-10,88*SPEAR_LENGTH_SCALE,20);g.clip();drawStoneSpear(g);g.restore()
  drawObsidianHead(g,reinforced)
}
export function drawGroundObsidianSpear({ctx:g,x,y}:GroundDropView,reinforced:boolean):void {
  g.save();g.translate(x,y);g.rotate(-.45);g.scale(.55,.55);g.translate(-28*SPEAR_LENGTH_SCALE,0);drawObsidianSpear(g,reinforced);g.restore()
}

export function obsidianSpearIcon(reinforced:boolean){
  const key=reinforced?'reinforced-obsidian':'obsidian',body=reinforced?'#573264':'#211b30',upper=reinforced?'#a975c1':'#675675',lower=reinforced?'#281a3a':'#111421',edge=reinforced?'#e2c6ef':'#b39dc2'
  return svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
    <defs><linearGradient id="${key}-wood" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#baa080"/><stop offset=".4" stop-color="#8c674e"/><stop offset="1" stop-color="#4a3630"/></linearGradient></defs>
    <g transform="translate(15 49) rotate(-45) scale(${SPEAR_LENGTH_SCALE} 1)" stroke-linejoin="bevel">
      <path d="M-3-2L45-2.3L46 2.3L-3 2Z" fill="url(#${key}-wood)" stroke="#302832" stroke-width="1.2"/>
      <path d="M0-1H16M30-1H39" stroke="#d4bc96" stroke-width=".65"/>
      <path d="M17-2.6H29V2.6H17Z" fill="#514036"/><path d="M18-2L19.5 2M22-2L23.5 2M26-2L27.5 2" stroke="#bca17e" stroke-width=".9"/>
      <path d="M40-3H49V3H40Z" fill="#4e4352" stroke="#252230" stroke-width="1"/><path d="M41-2.6L42 2.6M44-2.6L45 2.6M47-2.6L48 2.6" stroke="#b7a183" stroke-width=".8"/>
      <path d="M47 .2L50-4.2L54-6.8L58-4.9L63-2.6L68 0L61 3.8L55 6.5L51 4.6L46 2Z" fill="${body}" stroke="#171522" stroke-width="1.2"/>
      <path d="M48 0L54-5.9L58-4.1L66-.3L57-.8L51 1Z" fill="${upper}"/>
      <path d="M52 1L58-1.8L67 0L55 6L57 2Z" fill="${lower}"/>
      <path d="M51-3.8L54-5.9L58-4.1L66-.4M58 4.2L64 1.5" stroke="${edge}" stroke-width=".7" fill="none"/>
      <path d="M51-2Q55-1 57-2.6M53 2.5Q55 .8 59 .9" stroke="${upper}" stroke-width=".65" fill="none"/>
      ${reinforced?'<path d="M53-4.3L56-2.4L54 .1L52-1.4Z" fill="#d8a7ed"/><path d="M53-4.3L54-1.3L56-2.4Z" fill="#f3e3f5"/><path d="M54-1.3L54 .1L56-2.4Z" fill="#91b7cf"/><path d="M59 .8L62 1.1L59.2 3.5L58 2Z" fill="#b377d0"/>':''}
      <path d="M-1-2L0 2M2-2L3 2" stroke="#b49c7b" stroke-width=".8"/>
    </g></svg>`)
}
