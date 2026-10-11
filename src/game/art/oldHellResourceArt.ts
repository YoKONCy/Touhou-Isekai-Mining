import { svgIcon,type ItemIcon } from '../../content/items/types'
import { BLACKSTONE_ID,BASALT_ID,CINNABAR_ID,ANCIENT_DEBRIS_ID,OBSIDIAN_ID,SOUL_ROCK_ID,SOLIDIFIED_MAGMA_ID,BONE_FRAGMENT_ID,TURMERIC_ID,SULFUR_ID,FIRE_FLOWER_ID,MAGMA_CREAM_ID,FIRE_CORE_ID,FIRE_CRYSTAL_ID,GUNPOWDER_ID,LEATHER_ID,STRANGE_PORK_ID,RED_LOTUS_ORB_ID } from '../../content/items/vanilla/ids'
import { MINERAL_BLACKSTONE_ID,MINERAL_OBSIDIAN_ID,MINERAL_SOUL_ROCK_ID,MINERAL_SOLIDIFIED_MAGMA_ID } from '../../content/minerals/vanilla/ids'
import { SpriteCache,bakeSprite,drawSprite } from '../../core/rendering/SpriteCache'
import { radialStamp } from '../../core/rendering/RadialStamp'
import { CONFIG } from '../config'
import type { OreTile } from '../tilemap'

interface Layer {d:string;fill?:string;stroke?:string;width?:number}
const layer=(d:string,fill:string,stroke?:string,width=1):Layer=>({d,fill,stroke,width})
const seam=(d:string,stroke:string,width=.9):Layer=>({d,stroke,width})
const art:Record<string,Layer[]>={
  [LEATHER_ID]:[
    layer('M10 8L18 11L25 9L32 12L40 9L37 20L41 28L35 33L36 41L25 38L17 41L13 35L6 33L10 25L7 18Z','#876049','#3b2c2b',1.2),
    layer('M12 11L18 14L25 12L32 15L36 13L33 22L36 28L30 31L32 36L24 34L18 37L16 31L11 30L14 24L11 19Z','#b88b60'),
    layer('M14 17L23 15L32 18L29 25L33 29L25 30L18 34L17 26Z','#a17452'),
    seam('M13 13L18 15M10 31L16 32L18 38M33 14L32 19M28 37L33 38','#e4c496',.8),
    seam('M19 21L23 23L22 28M28 19L26 22M14 28L16 27','#73503d',.65)],
  [STRANGE_PORK_ID]:[
    layer('M7 25Q8 13 22 10Q37 8 41 23L40 34Q31 44 16 39Q6 35 7 25Z','#894c51','#422e36',1.3),
    layer('M8 23Q12 12 25 12Q37 12 40 24Q39 33 28 35Q14 37 8 28Z','#d69a89'),
    layer('M13 24Q14 17 24 16Q34 15 35 23Q36 30 27 31Q17 33 13 27Z','#b76466'),
    layer('M15 22Q21 17 29 20Q21 20 20 25Q19 29 28 29Q16 32 15 26Z','#ecc0a4'),
    seam('M27 17L25 22L31 25M23 32L24 27L20 23','#eeb39d',1.1),
    layer('M9 31Q20 39 37 32L36 36Q22 42 12 36Z','#b16f68'),seam('M12 20Q15 15 22 14','#f4cfb4',1)],
  [RED_LOTUS_ORB_ID]:[
    layer('M24 6Q39 6 42 22Q43 38 27 42Q10 44 6 28Q2 12 18 7Z','#55283a','#2d2230',1.3),
    layer('M10 16Q19 5 32 12Q43 20 36 33Q27 42 14 35Q4 29 10 16Z','#a83843'),
    layer('M12 15Q22 7 32 14Q37 18 35 24Q26 17 16 25L9 26Q7 20 12 15Z','#cf6256'),
    layer('M11 30Q21 38 36 29Q34 40 24 40Q14 40 11 30Z','#75283c'),
    layer('M23 29Q15 26 15 21Q20 21 22 24Q20 16 25 13Q30 19 27 25Q30 21 35 22Q34 29 27 31Z','#efba71'),
    layer('M23 29Q20 26 23 22Q27 23 27 29Z','#f8dda1'),
    layer('M12 16Q17 10 21 12Q22 15 16 18Q12 20 12 16Z','#ffe0b28c'),
    seam('M9 24Q8 17 13 13M30 38Q37 35 39 29','#ecb58e99',.8)],
  [MAGMA_CREAM_ID]:[
    layer('M7 29Q8 22 16 22Q13 14 23 12Q32 11 33 21Q42 23 41 32Q38 40 22 40Q7 39 7 29Z','#9b4933','#422b2b',1.3),
    layer('M9 27Q12 23 20 24Q17 17 23 15Q30 14 30 23Q35 22 39 28Q28 34 16 32Z','#d77c43'),
    layer('M9 33Q22 37 39 30Q39 38 24 39Q12 39 9 33Z','#6e352d'),
    layer('M18 22Q18 17 24 17Q28 17 27 20Q22 19 21 23Z','#f1c37e'),
    seam('M12 29Q16 27 20 29M29 28Q34 26 36 28','#f9c579',1.3),
    layer('M13 34h2v1h-2ZM29 35h2v1h-2Z','#d18c55')],
  [FIRE_CORE_ID]:[
    layer('M11 32Q6 23 15 16Q12 21 19 21Q17 10 26 5Q24 15 32 19Q35 16 35 12Q44 24 38 34Q34 42 24 42Q15 41 11 32Z','#a44231','#4e2c2b',1.2),
    layer('M14 31Q10 25 20 22Q19 16 24 12Q24 20 31 23Q35 23 36 19Q40 30 33 37L21 39Z','#e7843e'),
    layer('M16 31L19 24L27 20L34 26L33 35L25 40L18 36Z','#9d3d32','#5a2d30',1),
    layer('M19 24L27 20L25 30L16 31Z','#ffd483'),layer('M25 30L27 20L34 26L33 35Z','#ef9b4e'),
    layer('M16 31L25 30L25 40L18 36Z','#cc673b'),
    seam('M20 25L25 23M27 33L30 30','#ffe9b7',1.3)],
  [FIRE_CRYSTAL_ID]:[
    layer('M10 31L17 13L28 6L37 20L39 34L26 43L13 39Z','#862f3a','#3f2630',1.3),
    layer('M17 13L28 6L24 27L10 31Z','#e87e55'),layer('M28 6L37 20L39 34L24 27Z','#bd4c3e'),
    layer('M10 31L24 27L26 43L13 39Z','#b94a46'),layer('M24 27L39 34L26 43Z','#612938'),
    layer('M17 17L24 11L21 24L13 28Z','#ffd18a'),
    seam('M14 32L23 29L28 35L25 40M28 35L34 32','#ffc16d',1.1),
    seam('M18 13L27 8M29 10L35 20','#ffe0ad',.9)],
  [GUNPOWDER_ID]:[
    layer('M9 34L13 27L19 24L23 17L30 21L34 28L40 32L42 38L31 42L16 41L6 38Z','#373339','#211f29',1.2),
    layer('M9 34L19 26L23 17L30 21L34 28L24 31L19 36Z','#62554b'),
    layer('M24 31L34 28L40 32L31 37L21 39Z','#4b4141'),
    layer('M17 28L20 25L23 27L20 30ZM25 23L27 21L30 23L28 25ZM11 35L14 32L17 35L14 37ZM28 33L31 31L33 34L30 36Z','#a58e6b'),
    seam('M20 22L23 19L26 20M8 38L13 39M35 37L38 36','#c2ad8566',.8),
    layer('M6 32h2v2H6ZM40 27h2v2h-2ZM33 43h2v1h-2Z','#756252')],
  [BLACKSTONE_ID]:[
    layer('M5 27L11 14L23 9L37 15L43 29L36 39L17 41L6 34Z','#3e3937','#211e24',1.3),
    layer('M5 27L11 14L23 9L37 15L28 24L15 25Z','#64594c'),layer('M28 24L37 15L43 29L36 39L27 33Z','#28262c'),
    layer('M6 34L15 25L27 33L36 39L17 41Z','#49403a'),layer('M11 16L23 12L29 15L19 19L13 23Z','#84715b'),
    seam('M21 22L18 28L22 32L20 38M22 32L30 29','#26242a'),seam('M13 15L22 11L27 13','#ac947452'),
    layer('M10 30h2v1h-2ZM16 34h1v2h-1ZM28 18h2v1h-2ZM31 34h2v1h-2Z','#a1916c36')],
  [BASALT_ID]:[
    layer('M5 30L14 24L39 27L43 35L29 42L9 38Z','#3b3c3c','#292830',1.2),layer('M5 30L14 24L39 27L26 34L9 34Z','#81817a'),
    layer('M9 23L20 14L37 18L40 28L26 33L10 29Z','#4d5051','#292830',1.1),layer('M9 23L20 14L37 18L23 25Z','#939387'),
    layer('M16 14L25 8L34 12L36 20L23 24L14 20Z','#626869','#292830',1),layer('M16 14L25 8L34 12L24 17L14 20Z','#aaad9c'),
    seam('M11 25L24 28L36 23M10 35L26 38L37 34','#a8a99a66')],
  [CINNABAR_ID]:[
    layer('M8 30L10 26L15 25L18 29L15 33L10 33ZM18 33L21 29L26 30L28 34L24 38L19 37ZM30 30L34 28L38 31L37 35L32 35ZM12 37L16 35L19 38L17 41L12 40Z','#25252b','#16171d',.8),
    layer('M15 23L17 19L21 18L24 22L21 26L17 26ZM25 25L28 20L32 21L34 25L31 29L27 29ZM22 16L25 12L29 13L30 17L26 20L23 19Z','#303037','#191a20',.8),
    layer('M8 30L10 26L15 25L13 29ZM18 33L21 29L26 30L23 33ZM15 23L17 19L21 18L19 22ZM25 25L28 20L32 21L29 24ZM22 16L25 12L29 13L26 16Z','#55545a'),
    layer('M30 38L33 36L36 38L34 41L31 41ZM6 35L8 34L10 36L8 38ZM37 25L40 23L42 26L40 28ZM15 15L17 13L19 15L18 17ZM24 41L26 39L28 41L26 43Z','#39383e','#1b1b22',.6),
    layer('M20 27L22 25L24 27L23 29L20 29ZM29 33L31 31L33 33L31 35ZM10 23L12 21L14 23L12 25Z','#989b9e','#4c5059',.6),
    layer('M20 27L22 25L24 27L22 27ZM29 33L31 31L33 33L31 33ZM10 23L12 21L14 23L12 23Z','#e2e2dd'),
    seam('M11 27L14 26M18 20L20 19M26 14L28 14M33 30L35 30','#83828a',.65)],
  [ANCIENT_DEBRIS_ID]:[
    layer('M8 20L23 8L38 16L42 32L30 43L12 36Z','#534038','#2b252c',1.3),layer('M8 20L23 8L38 16L25 28Z','#a47b55'),
    layer('M25 28L38 16L42 32L30 43L24 36Z','#3e3030'),layer('M12 23L23 13L32 17L23 25Z','#75503c'),
    seam('M15 21L23 16L28 18L23 22L20 21M30 27L35 23L37 30L32 36L29 33L32 29','#d8b283',1.8),
    layer('M12 28L17 26L20 30L17 34L13 33Z','#bf9062'),seam('M10 20L23 10L34 16','#e8c49188')],
  [OBSIDIAN_ID]:[
    layer('M6 32L13 14L25 5L34 13L41 32L32 43L13 40Z','#282532','#181820',1.4),layer('M13 14L25 5L23 27L6 32Z','#655671'),
    layer('M25 5L34 13L41 32L23 27Z','#3d334c'),layer('M6 32L23 27L32 43L13 40Z','#44374d'),
    layer('M23 27L41 32L32 43Z','#1d1d29'),layer('M16 16L23 9L21 23L10 30Z','#a291b44d'),
    seam('M14 14L24 7L23 26L8 32M24 28L31 40','#bba6cb88',.8)],
  [SOUL_ROCK_ID]:[
    layer('M5 28Q7 13 20 9L34 13Q43 23 40 35L31 41L13 39Z','#63716a','#2a3836',1.3),
    layer('M6 25L13 14L20 9L34 13L29 21L16 22Z','#96a395'),layer('M29 21L34 13L41 25L40 35L31 41L23 32Z','#3d544e'),
    layer('M12 21Q18 16 20 22Q21 28 15 29Q10 28 12 21ZM26 16Q32 15 32 20Q30 25 26 23ZM23 31Q29 28 31 33Q31 38 25 38Z','#203e3a'),
    seam('M13 27Q18 27 19 23M27 22L30 20M25 36Q29 36 29 33','#8fc9b6',1.2),
    layer('M10 31h2v2h-2ZM23 13h2v1h-2ZM34 28h1v2h-1Z','#c2cbb377')],
  [SOLIDIFIED_MAGMA_ID]:[
    layer('M4 30L11 17L26 12L39 22L43 34L32 41L12 39Z','#4b3934','#211f24',1.3),
    layer('M4 30L11 17L26 12L39 22L26 28L14 28Z','#77604d'),layer('M26 28L39 22L43 34L32 41L23 34Z','#30292b'),
    seam('M12 18L17 25L14 32L21 39M17 25L27 22L32 29L39 30M32 29L28 36','#a95134',2.7),
    seam('M13 19L17 25L15 31M18 25L26 23L31 29L38 30','#e8a562',.85),
    layer('M8 29h2v1H8ZM25 16h2v1h-2ZM22 31h1v2h-1Z','#bb8b6c44')],
  [BONE_FRAGMENT_ID]:[
    layer('M9 30Q3 27 6 23Q8 20 12 23L27 15Q27 10 31 10Q36 10 35 15Q40 15 38 19Q36 22 32 19L16 28Q17 33 12 34Q8 34 9 30Z','#c1baa3','#50494a',1.2),
    seam('M12 25L30 16M11 30L13 29','#eee4c4',2),layer('M22 33L27 26L37 29L39 36L31 41L23 39Z','#9b9685','#50494a'),
    layer('M22 33L27 26L37 29L30 34Z','#ded5b8'),seam('M29 31L30 35L27 38','#645d53')],
  [TURMERIC_ID]:[
    layer('M7 29Q6 23 13 21L19 22L19 14Q22 10 26 15L27 21L34 17Q40 17 39 23L31 28L39 30Q42 36 36 37L25 32L22 40Q17 43 15 38L16 31L10 33Z','#b98032','#62442d',1.2),
    layer('M9 26L15 24L21 26L23 16L25 23L32 21L35 22L26 29L20 28L18 37L17 28Z','#e4b85d'),
    seam('M11 25L13 30M16 23L18 28M22 17L25 18M30 22L32 25M30 31L29 34M18 33L21 34','#8b582e'),
    seam('M10 25L13 24M19 37L20 33M31 21L34 20','#f8da8d',1.3)],
  [SULFUR_ID]:[
    layer('M5 33L11 25L18 27L24 23L36 26L42 35L32 41L13 40Z','#686147','#3e382d',1.2),
    layer('M10 32L12 17L19 12L24 29L18 36Z','#a69842','#5b542f'),layer('M12 17L19 12L18 29L10 32Z','#d0c36b'),
    layer('M23 33L26 12L31 7L37 27L31 36Z','#c0ad45','#5b542f'),layer('M26 12L31 7L31 29L23 33Z','#e5d483'),
    layer('M33 35L38 22L42 20L44 33L39 39Z','#b6a250','#5b542f'),seam('M28 13L30 10M15 18L18 15','#fff0b4',1.1)],
  [FIRE_FLOWER_ID]:[
    seam('M23 42Q27 30 23 21','#65744c',2),layer('M24 34Q11 34 9 25Q20 25 24 34Z','#717e48','#3f5138',.8),
    layer('M25 29Q38 31 40 22Q30 21 25 29Z','#859352','#3f5138',.8),
    layer('M23 23Q10 26 9 16Q11 11 16 14Q11 6 18 6Q23 8 24 14Q29 3 33 8Q36 13 31 17Q42 14 39 22Q33 29 23 23Z','#9f4538','#562c31',1.1),
    layer('M12 17Q17 16 21 20L19 9Q23 13 25 18L31 9L29 20L37 19Q31 27 24 24Z','#ce7047'),
    layer('M21 21L25 16L29 21L27 26L22 26Z','#edba61'),layer('M24 21L26 19L27 22L25 24Z','#f7dda0')]
}
const cache=new SpriteCache(64,1024*1024)
const nodeItems:Readonly<Record<string,string>>={
  [MINERAL_BLACKSTONE_ID]:BLACKSTONE_ID,[MINERAL_OBSIDIAN_ID]:OBSIDIAN_ID,[MINERAL_SOUL_ROCK_ID]:SOUL_ROCK_ID,[MINERAL_SOLIDIFIED_MAGMA_ID]:SOLIDIFIED_MAGMA_ID
}
function paint(g:CanvasRenderingContext2D,id:string,white=false):void {
  g.lineJoin='round';g.lineCap='round'
  for(const l of art[id]??[]){const p=new Path2D(l.d);if(l.fill){g.fillStyle=white?'#fff0d7':l.fill;g.fill(p)}if(l.stroke){g.strokeStyle=white?'#fff0d7':l.stroke;g.lineWidth=l.width??1;g.stroke(p)}}
}
export function oldHellResourceIcon(id:string):ItemIcon {
  return svgIcon(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" stroke-linejoin="round" stroke-linecap="round">${(art[id]??[]).map(l=>`<path d="${l.d}" fill="${l.fill??'none'}" stroke="${l.stroke??'none'}" stroke-width="${l.width??1}"/>`).join('')}</svg>`)
}
export function drawOldHellResource(g:CanvasRenderingContext2D,id:string,x:number,y:number,size=24):void {
  const sprite=cache.get(id,()=>bakeSprite(0,0,48,48,c=>paint(c,id),2))
  g.drawImage(sprite.image,x-size/2,y-size*.7,size,size)
}
/** 采集态保留根部与植物全貌；掉落态仅使用素材本身，不把整株姜黄塞进背包。 */
export function drawOldHellGather(g:CanvasRenderingContext2D,id:string,x:number,y:number,time:number):boolean {
  if(![BONE_FRAGMENT_ID,TURMERIC_ID,SULFUR_ID,FIRE_FLOWER_ID].includes(id))return false
  g.save();g.translate(x,y)
  g.fillStyle='#19171342';g.beginPath();g.ellipse(0,2,13,3.5,0,0,Math.PI*2);g.fill()
  if(id===TURMERIC_ID){
    const leaf=cache.get('turmeric-leaves',()=>bakeSprite(-20,-41,40,47,c=>{
      c.strokeStyle='#52613b';c.lineWidth=1.5;c.beginPath();c.moveTo(0,0);c.lineTo(1,-31);c.stroke()
      for(const [d,color] of [['M0-6Q-20-10-17-28Q-2-26 0-6Z','#738149'],['M1-10Q20-14 17-34Q3-29 1-10Z','#899350'],['M0-15Q-10-27-2-39Q8-28 0-15Z','#a1a45e']] as const){c.fillStyle=color;c.fill(new Path2D(d))}
      c.strokeStyle='#c4bc6c77';c.lineWidth=.7;c.beginPath();c.moveTo(-2,-10);c.lineTo(-14,-25);c.moveTo(3,-15);c.lineTo(14,-30);c.stroke()
    },2))
    g.save();g.rotate(Math.sin(time*1.2+x*.04)*.025);drawSprite(g,leaf)
    g.restore();drawOldHellResource(g,id,0,3,21)
  }else {if(id===FIRE_FLOWER_ID)g.rotate(Math.sin(time*1.6+x)*.025);drawOldHellResource(g,id,0,-2,id===FIRE_FLOWER_ID?38:32)}
  g.restore();return true
}
/** 四种岩体都有独立轮廓；主体与闪白分别缓存，动态只画少量裂纹和孔隙微光。 */
export function drawOldHellMineral(g:CanvasRenderingContext2D,ore:OreTile,time:number):boolean {
  const id=nodeItems[ore.kind];if(!id)return false
  const x=(ore.col+.5)*CONFIG.tile+ore.offsetX,y=(ore.row+.5)*CONFIG.tile+ore.offsetY
  g.save();g.translate(x,y);g.scale(1.25,1.25);g.translate(-24,-26)
  const sprite=cache.get(id,()=>bakeSprite(0,0,48,48,c=>paint(c,id),2))
  drawSprite(g,sprite)
  const wear=1-ore.hp/ore.maxHp
  if(wear>.25){g.strokeStyle=`rgba(18,17,24,${wear*.85})`;g.lineWidth=.9;g.beginPath();g.moveTo(20,20);g.lineTo(17,26);g.lineTo(23,30);g.lineTo(21,37);g.stroke()}
  if(ore.flash>0){g.save();g.globalAlpha*=ore.flash/CONFIG.mine.hitFlash*.38;drawSprite(g,cache.get(`${id}:flash`,()=>bakeSprite(0,0,48,48,c=>paint(c,id,true),2)));g.restore()}
  if(id===SOUL_ROCK_ID||id===SOLIDIFIED_MAGMA_ID){
    const soul=id===SOUL_ROCK_ID,key=soul?'soul-rock-pore':'magma-rock-seam'
    const glow=radialStamp(key,0,[[0,soul?'#c6e9cd99':'#ffd59a99'],[.35,soul?'#7fbba33d':'#c97d3e3d'],[1,'#00000000']])
    g.save();g.translate(soul?15:17,soul?25:26);g.scale(.045,.03);g.globalAlpha*=.4+.2*Math.sin(time*1.9+ore.col*7+ore.row);drawSprite(g,glow);g.restore()
  }
  g.restore();return true
}
export function isOldHellMineral(id:string):boolean{return nodeItems[id]!==undefined}
