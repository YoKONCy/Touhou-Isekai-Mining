import baseArtworkLayout from '../../../public/scenes/base/layout.json'
import { drawCampArtworkGround, drawCampArtworkEntity, drawCampArtworkShadow, drawCampArtworkAtmosphere } from './campArtwork'

/** 营地场景：占地、交互与绘制共用校准后的接地点，高度不参与地面碰撞。 */
export const CAMP_OUTLINE: Array<[number, number]> = baseArtworkLayout.outline.map(([x,y])=>[x,y])
export const CAMP_NPC_ANCHOR = baseArtworkLayout.npc
/** 地面上两块较大的独立岩石有真实占地，墙脚碎石仍属于装饰。 */
export const CAMP_SCENERY_SOLIDS = baseArtworkLayout.scenerySolids
export interface CampEntity { id: string; x: number; y: number; w: number; d: number; title: string; text: string; kind: 'box'|'bed'|'board'|'stove'|'pot'|'table'|'fire'|'rope'|'exit'|'radio'|'woodpile' }
const CAMP_ENTITY_DEFINITIONS: CampEntity[] = [
  {id:'bed',x:920,y:220,w:114,d:58,title:'base.bed.name',text:'base.bed.text',kind:'bed'},
  {id:'box1',x:315,y:565,w:62,d:38,title:'base.box1.name',text:'base.box1.text',kind:'box'},
  {id:'box2',x:375,y:606,w:54,d:34,title:'base.box2.name',text:'base.box2.text',kind:'box'},
  {id:'box3',x:294,y:637,w:68,d:36,title:'base.box3.name',text:'base.box3.text',kind:'box'},
  {id:'board',x:775,y:400,w:72,d:18,title:'base.board.name',text:'base.board.text',kind:'board'},
  {id:'stove',x:995,y:360,w:100,d:56,title:'base.stove.name',text:'base.stove.text',kind:'stove'},
  {id:'woodpile',x:1052,y:426,w:100,d:34,title:'base.woodpile.name',text:'base.woodpile.text',kind:'woodpile'},
  {id:'pot',x:700,y:395,w:48,d:34,title:'base.pot.name',text:'base.pot.text',kind:'pot'},
  {id:'table',x:520,y:490,w:66,d:32,title:'base.table.name',text:'base.table.text',kind:'table'},
  {id:'fire',x:660,y:445,w:76,d:44,title:'base.fire.name',text:'base.fire.text',kind:'fire'},
  // 收音机：首次正常撤离后经剧情落地（未解锁前 BaseModule 按 flag 过滤，不画不碰）
  {id:'radio',x:588,y:502,w:34,d:20,title:'base.radio.name',text:'base.radio.text',kind:'radio'},
  {id:'rope',x:520,y:262,w:212,d:12,title:'base.rope.name',text:'base.rope.text',kind:'rope'},
  {id:'exit',x:1240,y:470,w:0,d:0,title:'base.exit.name',text:'',kind:'exit'}
]
export const CAMP_ENTITIES: CampEntity[] = CAMP_ENTITY_DEFINITIONS.map(entity => ({
  ...entity,
  ...baseArtworkLayout.anchors[entity.id as keyof typeof baseArtworkLayout.anchors],
  ...(entity.kind==='rope'?{w:198}:{})
}))
/** 箱组是一个逻辑实体，三个绘制部件和三个子占地保留原样。 */
export const CAMP_STORAGE = { id:'storage', title:'base.storage.name', parts:CAMP_ENTITIES.filter(e=>e.kind==='box') }
export const CAMP_FACILITIES = [
  ...CAMP_ENTITIES.filter(e=>e.kind!=='box').map(e=>({id:e.id,title:e.title,text:e.text,kind:e.kind,parts:[e]})),
  {id:CAMP_STORAGE.id,title:CAMP_STORAGE.title,text:'',kind:'box' as const,parts:CAMP_STORAGE.parts}
]
export function campInside(x:number,y:number):boolean {
  let hit=false
  for(let i=0,j=CAMP_OUTLINE.length-1;i<CAMP_OUTLINE.length;j=i++) {const a=CAMP_OUTLINE[i],b=CAMP_OUTLINE[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit}
  return hit
}
/** 整个碰撞圆必须留在岩壁内侧，斜边和凹角也按真实线段检测。 */
export function campContainsCircle(x:number,y:number,r:number):boolean {
  if(!campInside(x,y))return false
  for(let i=0;i<CAMP_OUTLINE.length;i++){
    const a=CAMP_OUTLINE[i],b=CAMP_OUTLINE[(i+1)%CAMP_OUTLINE.length]
    const dx=b[0]-a[0],dy=b[1]-a[1]
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/(dx*dx+dy*dy)))
    if((x-a[0]-t*dx)**2+(y-a[1]-t*dy)**2<(r+2)**2)return false
  }
  return true
}
function polygon(g:CanvasRenderingContext2D, pts:Array<[number,number]>):void {g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath()}
function ellipse(g:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,color:string):void {g.beginPath();g.ellipse(x,y,rx,ry,0,0,Math.PI*2);g.fillStyle=color;g.fill()}
function rect(g:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,color:string,r=3):void {g.beginPath();g.roundRect(x,y,w,h,r);g.fillStyle=color;g.fill()}
/** 岩壁露出顶面与立面；前缘剖切压低，不把玩家遮在墙后。 */
export function drawCampGround(g:CanvasRenderingContext2D,time:number):void {
  if(drawCampArtworkGround(g))return
  polygon(g,CAMP_OUTLINE)
  const floor=g.createLinearGradient(0,180,0,800);floor.addColorStop(0,'#51494e');floor.addColorStop(1,'#39363f');g.fillStyle=floor;g.fill()
  g.save();g.clip()
  // 分区用低对比材料和磨损边，不画功能色块框。
  for(const [x,y,r,c] of [[641,459,250,'#98734b30'],[994,369,120,'#17182430'],[340,600,140,'#7d5d3820']] as const){const patch=g.createRadialGradient(x,y,0,x,y,r);patch.addColorStop(0,c);patch.addColorStop(1,'#00000000');g.fillStyle=patch;g.fillRect(x-r,y-r,r*2,r*2)}
  // 木板沿地面横向铺排，板缝与年轮服从同一平面，不与后墙竖纹混淆。
  polygon(g,[[822,175],[1014,179],[1040,277],[815,277]]);g.fillStyle='#201c2780';g.fill()
  for(let i=0;i<7;i++){
    const y=178+i*13,l=826-i*1.1,r=1014+i*3.2
    polygon(g,[[l,y],[r,y+3],[r+3,y+14],[l-1,y+11]]);g.fillStyle=i%2?'#806348':'#8b6c4d';g.fill()
    g.strokeStyle='#392c3299';g.lineWidth=1;g.stroke()
    for(let k=0;k<4;k++){g.beginPath();g.moveTo(l+12+k*44,y+5);g.quadraticCurveTo(l+30+k*44,y+3,l+47+k*44,y+7);g.strokeStyle='#c3a07933';g.stroke()}
    ellipse(g,l+5,y+7,1,0.7,'#302b32');ellipse(g,r-6,y+8,1,0.7,'#302b32')
  }
  rect(g,815,271,225,6,'#4d382d',1)
  // 踩实的土路由错落短痕组成，避免一根光滑色带横穿营地。
  g.lineCap='round'
  for(let i=0;i<180;i++){
    const t=i/179,x=410+850*t,y=630-167*t-29*Math.sin(t*Math.PI),spread=Math.sin(i*2.399)*34
    g.beginPath();g.moveTo(x-4,y+spread);g.lineTo(x+7+i%8,y+spread-2)
    g.strokeStyle=i%4?'#b3977220':'#26222d24';g.lineWidth=2+i%5;g.stroke()
  }
  // 岩层裂线服从地面平面，颜色低于物件轮廓。
  g.lineWidth=1
  for(const [x,y] of [[430,365],[903,634],[1100,417],[480,730],[260,477]]){
    g.beginPath();g.moveTo(x-19,y-5);g.lineTo(x,y);g.lineTo(x+17,y-3);g.lineTo(x+32,y+6);g.moveTo(x,y);g.lineTo(x+5,y+13)
    g.strokeStyle='#211e2d55';g.stroke()
  }
  // 寝铺入口的旧编织地垫属于地面装饰，不额外阻挡人物。
  polygon(g,[[865,284],[977,285],[985,311],[857,309]]);g.fillStyle='#796a534a';g.fill()
  g.save();g.clip();g.lineWidth=1
  for(let y=286;y<311;y+=4){g.beginPath();g.moveTo(854,y);g.lineTo(987,y+1);g.strokeStyle='#c0a77a45';g.stroke()}
  for(let x=860;x<985;x+=6){g.beginPath();g.moveTo(x,283);g.lineTo(x-3,313);g.strokeStyle='#352c324d';g.stroke()}
  g.restore()
  for(let i=0;i<330;i++){const x=185+(i*137%1130),y=145+(i*89%650);ellipse(g,x,y,1+i%3,0.6+i%2,i%3?'#b5a18b12':'#17182426')}
  // 小片碎石沿墙脚聚集，中央留空以突出家具。
  for(let i=0;i<CAMP_OUTLINE.length;i++){const [x,y]=CAMP_OUTLINE[i];for(let k=0;k<4;k++)ellipse(g,x+(k-1)*13,y+18+(k%2)*7,6+k,3,'#6c606a')}
  const warm=g.createRadialGradient(660,440,8,660,440,330);warm.addColorStop(0,`rgba(255,188,100,${0.24+Math.sin(time*2)*0.015})`);warm.addColorStop(0.6,'#d78b4324');warm.addColorStop(1,'#d78b4300');g.fillStyle=warm;g.fillRect(150,100,1200,740)
  g.restore()
  for(let i=0;i<CAMP_OUTLINE.length;i++) {
    const a=CAMP_OUTLINE[i],b=CAMP_OUTLINE[(i+1)%CAMP_OUTLINE.length]
    const height=i>=6&&i<=8?92:((a[1]+b[1])/2<390?65:((a[1]+b[1])/2>690?16:38))
    polygon(g,[[a[0],a[1]-height],[b[0],b[1]-height],b,a]);const wall=g.createLinearGradient(0,a[1]-height,0,a[1]);wall.addColorStop(0,'#696171');wall.addColorStop(1,'#36313f');g.fillStyle=wall;g.fill()
    g.strokeStyle='#231f2e';g.lineWidth=2;g.stroke()
    // 立面分成错落的岩层折面，而非均匀墙砖。
    const seg=Math.hypot(b[0]-a[0],b[1]-a[1]);const count=Math.max(1,Math.floor(seg/55))
    for(let k=0;k<count;k++){const t=k/count,u=(k+1)/count,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,xx=a[0]+(b[0]-a[0])*u,yy=a[1]+(b[1]-a[1])*u;polygon(g,[[x,y-height+5],[xx,yy-height+9],[xx-5,yy-12],[x+7,y-5]]);g.fillStyle=(k+i)%2?'#81758b18':'#201c2b28';g.fill();g.beginPath();g.moveTo(x+3,y-height*0.5);g.lineTo(xx-8,yy-height*0.45);g.strokeStyle='#afa0b222';g.lineWidth=1;g.stroke()}
    polygon(g,[[a[0],a[1]-height],[b[0],b[1]-height],[b[0]+(b[0]-720)*0.025,b[1]-height-20],[a[0]+(a[0]-720)*0.025,a[1]-height-20]])
    g.fillStyle=i%3?'#514a5e':'#60596b';g.fill();g.strokeStyle='#81768c66';g.lineWidth=1;g.stroke()
    const mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2
    g.beginPath();g.moveTo(mx-17,my-height+10);g.lineTo(mx+4,my-height+18);g.lineTo(mx-2,my-8);g.strokeStyle='#2b273680';g.lineWidth=2;g.stroke()
    g.beginPath();g.moveTo(a[0],a[1]+3);g.lineTo(b[0],b[1]+3);g.strokeStyle='#15141d55';g.lineWidth=9;g.stroke()
    // 岩层薄亮边与分叉裂隙打破规则折面；碎石下暗上亮，贴合墙脚。
    for(let k=0;k<count;k++){
      const t=(k+0.35)/count,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t
      g.beginPath();g.moveTo(x-13,y-height*0.7);g.lineTo(x+3,y-height*0.66);g.lineTo(x+10,y-height*0.52)
      g.strokeStyle='#b0a0ad32';g.lineWidth=1;g.stroke()
      g.beginPath();g.moveTo(x+3,y-height*0.66);g.lineTo(x-2,y-height*0.3);g.lineTo(x+7,y-6)
      g.strokeStyle='#201d2c66';g.stroke()
      ellipse(g,x+2,y+6,10,3,'#17152055')
      polygon(g,[[x-7,y+4],[x-3,y-3],[x+6,y-1],[x+10,y+5],[x,y+8]])
      g.fillStyle=(i+k)%2?'#756975':'#655d69';g.fill()
      g.beginPath();g.moveTo(x-3,y-2);g.lineTo(x+5,y);g.strokeStyle='#b5a4ab44';g.stroke()
    }
  }
  // 寝铺后布帘有折面与暗边，作为生活凹室的背景。
  rect(g,853,91,154,6,'#4e352a');for(let i=0;i<7;i++){rect(g,858+i*20,97,21,51+Math.sin(i)*4,i%2?'#88715f':'#9a816a',2)}
  g.strokeStyle='#c0a48655';g.lineWidth=1;for(let i=0;i<7;i++){g.beginPath();g.moveTo(862+i*20,99);g.lineTo(861+i*20,139);g.stroke()}
  // 墙根苔痕、柴堆、矿灯、散落工具与灰烬提供生活痕迹，全部进入静态缓存。
  for(const [x,y] of [[802,210],[1062,281],[215,395],[1142,673],[405,701]]){
    for(let k=0;k<6;k++)ellipse(g,x+k*6,y+(k%3)*3,8,2.5,k%2?'#626c493b':'#a3a18b20')
  }
  rect(g,346,553,4,31,'#a48662',1);rect(g,333,550,30,5,'#827b7b',1)
  for(let i=0;i<36;i++){const a=i*2.4,r=43+i%9*3;ellipse(g,660+Math.cos(a)*r,447+Math.sin(a)*r*0.52,1+i%3,0.8,'#1c1a2540')}
  for(const [x,y] of [[423,615],[1157,519]]){rect(g,x-8,y-12,16,17,'#514534');rect(g,x-5,y-10,10,12,'#d1ae72');g.strokeStyle='#90816b';g.lineWidth=2;g.beginPath();g.arc(x,y-13,6,Math.PI,Math.PI*2);g.stroke()}
  g.strokeStyle='#918a7555';g.lineWidth=2;for(let i=0;i<4;i++){g.beginPath();g.ellipse(353,661,19-i*3,8-i,0,0,Math.PI*2);g.stroke()}
  rect(g,954,265,28,10,'#5a4442',2);rect(g,958,263,20,4,'#a59a83',1)
  // 洞口纵深、轨道和门架。
  ellipse(g,1271,450,66,74,'#12121d');rect(g,1221,367,12,152,'#513c32');rect(g,1306,370,13,150,'#513c32');rect(g,1217,360,108,16,'#886449')
  g.strokeStyle='#ba896055';g.lineWidth=3;g.strokeRect(1223,368,7,141)
  g.strokeStyle='#75665b';g.lineWidth=3;for(const y of [452,479]){g.beginPath();g.moveTo(1203,y+18);g.lineTo(1310,y);g.stroke()}
  for(let i=0;i<4;i++){g.beginPath();g.moveTo(1220+i*23,464-i*4);g.lineTo(1222+i*23,486-i*4);g.strokeStyle='#493d38';g.lineWidth=6;g.stroke()}
  for(const y of [397,508]){const l=g.createRadialGradient(1216,y,0,1216,y,44);l.addColorStop(0,'#ffd28b77');l.addColorStop(1,'#ffd28b00');g.fillStyle=l;g.fillRect(1172,y-44,88,88);rect(g,1210,y-8,10,18,'#c89a55');rect(g,1212,y-5,6,10,'#ffe0a0')}
}
export function drawCampShadow(g:CanvasRenderingContext2D,e:CampEntity):void {
  if(drawCampArtworkShadow(g,e))return
  if(!e.w)return
  g.save();g.filter='blur(5px)'
  if(e.kind==='rope'){
    // 绳索悬空，接地阴影只落在两端支撑脚下。
    for(const x of [-e.w/2+6,e.w/2-6])ellipse(g,e.x+x+4,e.y+1,15,5,'#13121e60')
  }else ellipse(g,e.x+5,e.y-3,e.w*0.53,e.d*0.32,'#13121e40')
  g.restore()
}
/** 实体基准点在地面后沿，绘制高度向上；按同一基准点排序遮挡。 */
export function drawCampEntity(g:CanvasRenderingContext2D,e:CampEntity,time:number,potRepaired=false):void {
  if(drawCampArtworkEntity(g,e,time,potRepaired))return
  g.save();g.translate(e.x,e.y)
  if(e.kind==='box'&&e.id==='box2') {
    // —— 破旧小工具箱：盖子向后翻开竖起着（刚开过箱），铁锤与短凿插在敞开的箱口里 ——
    // 2.5D 遮挡铁律（y 越小越远）：翻开的盖（最远）→ 内腔 → 工具 → 侧壁/前壁（最近，吃掉工具根部）
    const w=e.w,d=e.d
    // ① 最远：向后翻开的箱盖（暗木背面 + 两道板缝 + 盖顶厚度亮边）
    polygon(g,[[-w/2,-d-24],[w/2,-d-24],[w/2-5,-d-74],[-w/2+5,-d-74]]);g.fillStyle='#7a5a3d';g.fill()
    g.strokeStyle='#5a4029';g.lineWidth=1
    g.beginPath();g.moveTo(-10,-d-27);g.lineTo(-8,-d-71);g.moveTo(10,-d-27);g.lineTo(8,-d-71);g.stroke()
    polygon(g,[[-w/2+5,-d-74],[w/2-5,-d-74],[w/2-3,-d-78],[-w/2+3,-d-78]]);g.fillStyle='#b8915f';g.fill()
    // 铰链两只旧铁件
    for(const hx of [-w/2+6,w/2-11])rect(g,hx,-d-27,5,5,'#47433f',1)
    // ② 箱口内腔（远沿 -d-32 到前壁上沿 -d，深处压暗，工具下半截没入其中）
    polygon(g,[[-w/2+3,-d+2],[w/2-3,-d+2],[w/2-6,-d-32],[-w/2+6,-d-32]]);g.fillStyle='#221915';g.fill()
    polygon(g,[[-w/2+7,-d-30],[w/2-7,-d-30],[w/2-9,-d-24],[-w/2+9,-d-24]]);g.fillStyle='#140f0d';g.fill()
    // ③ 工具（层级高于后盖、低于前壁）：根部起点都在前壁上沿 -d 以下
    g.lineCap='round'
    g.strokeStyle='#7a5236';g.lineWidth=3
    g.beginPath();g.moveTo(-3,-d+4);g.lineTo(-14,-d-54);g.stroke()
    rect(g,-20,-d-58,11,5,'#565358',1);rect(g,-18,-d-57,3,3,'#837b74',0)
    g.strokeStyle='#958c83';g.lineWidth=2.2
    g.beginPath();g.moveTo(10,-d+2);g.lineTo(15,-d-40);g.stroke()
    rect(g,12,-d-44,5,4,'#6e675f',1)
    g.lineCap='butt'
    // ④ 左右侧壁帮沿（连接前壁与远沿，夹在工具与后盖之间的近侧结构）
    polygon(g,[[-w/2,-d],[-w/2+5,-d-31],[-w/2+8,-d-29],[-w/2+2,-d+2]]);g.fillStyle='#5c3d2b';g.fill()
    polygon(g,[[w/2,-d],[w/2-5,-d-31],[w/2-8,-d-29],[w/2-2,-d+2]]);g.fillStyle='#5c3d2b';g.fill()
    // 侧立面先于前壁绘制，箱内工具仍被近侧口沿遮住。
    polygon(g,[[w/2,-d],[w/2+7,-d-10],[w/2+7,-10],[w/2,0]]);g.fillStyle='#483326';g.fill()
    g.strokeStyle='#b18b5955';g.lineWidth=1
    for(let i=1;i<4;i++){const y=-d+i*d/4;g.beginPath();g.moveTo(w/2,y);g.lineTo(w/2+7,y-10);g.stroke()}
    // ⑤ 最近：前壁（彻底遮住工具根部）+ 磨亮的口沿
    const face=g.createLinearGradient(0,-d,0,0);face.addColorStop(0,'#94704b');face.addColorStop(1,'#59402e')
    rect(g,-w/2,-d,w,d,'#6c4933');g.fillStyle=face;g.fill()
    for(let i=1;i<4;i++)rect(g,-w/2+4,-d+i*d/4,w-8,1,'#402e2d88',0)
    rect(g,-w/2,-d,w,3,'#8a6242',1)
    // 旧铁包角 + 锁扣 + 锈迹
    for(const sx of [-w/2+1,w/2-8]){rect(g,sx,-d+1,7,5,'#46413dd9',0);rect(g,sx,-7,7,5,'#46413dd9',0)}
    rect(g,-4,-d-3,8,12,'#353540',1);rect(g,-1,-d+1,2,3,'#b5aa8e',0)
    ellipse(g,12,-d-10,3.2,2,'#6b3f2a66');ellipse(g,-16,-d-8,2.6,1.6,'#6b3f2a55');ellipse(g,-2,-d-18,2,1.3,'#7b4a2b44')
    g.lineWidth=0.8;g.beginPath();g.moveTo(-w/2+13,-d+8);g.bezierCurveTo(-8,-d+6,8,-d+11,w/2-13,-d+9);g.strokeStyle='#d2aa7440';g.stroke();g.lineWidth=1
  } else if(e.kind==='box') {
    const w=e.w,d=e.d
    // 顶、前、右三个面共享透视偏移，侧面压暗，木板与铁箍跨面连续。
    polygon(g,[[w/2,-d-24],[w/2+7,-d-34],[w/2+7,-10],[w/2,0]]);g.fillStyle='#503828';g.fill()
    for(let i=0;i<4;i++){const y=-d-20+i*(d+20)/4;g.strokeStyle='#271f22';g.lineWidth=1;g.beginPath();g.moveTo(w/2,y);g.lineTo(w/2+7,y-10);g.stroke()}
    const front=g.createLinearGradient(0,-d-24,0,0);front.addColorStop(0,e.id==='box3'?'#99764e':'#ac8154');front.addColorStop(1,'#65462f')
    rect(g,-w/2,-d-24,w,d+24,'#6c4933');g.fillStyle=front;g.fill()
    polygon(g,[[-w/2,-d-24],[w/2,-d-24],[w/2+7,-d-34],[-w/2+7,-d-34]]);g.fillStyle='#bb9466';g.fill()
    g.strokeStyle='#725036';g.lineWidth=.8
    for(let i=1;i<4;i++){const x=-w/2+i*w/4;g.beginPath();g.moveTo(x,-d-24);g.lineTo(x+7,-d-34);g.stroke()}
    for(const x of [-w/2+6,w/2-10]){
      polygon(g,[[x,-d-24],[x+4,-d-24],[x+11,-d-34],[x+7,-d-34]]);g.fillStyle='#625e54';g.fill()
      for(const y of [-d-20,-6]){rect(g,x,y,4,7,'#53504a',0);ellipse(g,x+2,y+2,1,.8,'#c0ad87')}
    }
    g.strokeStyle='#e5c68c77';g.beginPath();g.moveTo(-w/2+2,-d-24);g.lineTo(w/2,-d-24);g.lineTo(w/2+7,-d-34);g.stroke()
    for(let i=1;i<4;i++){rect(g,-w/2+4,-d+i*d/4,w-8,1,'#402e2d88',0)}
    for(const x of [-w/2+6,w/2-10]){rect(g,x,-d-22,4,d+20,'#c29b67',0);rect(g,x,-d-32,4,8,'#d4b17c',0)}
    rect(g,-4,-d-3,8,12,'#353540',1);rect(g,-1,-d+1,2,3,'#b5aa8e',0)
    g.lineWidth=0.8
    for(let i=0;i<3;i++){
      const y=-d+6+i*d/4
      g.beginPath();g.moveTo(-w/2+13,y);g.bezierCurveTo(-8,y-2,8,y+3,w/2-13,y+1);g.strokeStyle='#d2aa7440';g.stroke()
      for(const x of [-w/2+8,w/2-8])ellipse(g,x,y,1,1,'#3b3336')
    }
    ellipse(g,w/4,-d/2,4,1.7,'#4b332b77');ellipse(g,w/4,-d/2,2,0.7,'#bf966044')
    g.beginPath();g.moveTo(-w/2+8,-d-26);g.lineTo(w/2-4,-d-26);g.strokeStyle='#e1b78377';g.stroke()
    // 箱面灰化不均：经常接触的边沿露出浅木，底板受潮发暗。
    polygon(g,[[-w/2+2,-d-22],[-6,-d-20],[-12,-d-5],[-w/2+3,-d-2]]);g.fillStyle='#a9a28a35';g.fill()
    polygon(g,[[-w/2+3,-9],[2,-12],[w/2-3,-6],[w/2-3,-1],[-w/2+3,-1]]);g.fillStyle='#302b304f';g.fill()
    polygon(g,[[w/2-9,-d-24],[w/2,-d-24],[w/2,-d-17],[w/2-5,-d-20]]);g.fillStyle='#d0b58a';g.fill()
    g.beginPath();g.moveTo(-w/2+16,-d-20);g.lineTo(-w/2+19,-d-11);g.lineTo(-w/2+15,-d-5);g.strokeStyle='#382b2de0';g.lineWidth=1;g.stroke()
    rect(g,-3,-d-2,3,7,'#9b6549',0);ellipse(g,3,-d+4,2,1,'#bd81534d')
    // 留下半张旧货签，各箱位置固定，不让磨损随帧随机闪动。
    const tagX=e.id==='box3'?-12:-19
    polygon(g,[[tagX,-d-17],[tagX+12,-d-18],[tagX+11,-d-7],[tagX+6,-d-9],[tagX,-d-6]]);g.fillStyle='#b9ab866e';g.fill()
    rect(g,tagX+2,-d-14,7,1,'#65564677',0)
  } else if(e.kind==='bed') {
    rect(g,-57,-58,114,58,'#563c31');rect(g,-53,-62,106,54,'#b89977',6);rect(g,-48,-58,96,48,'#c7ba9a',7)
    rect(g,-47,-54,31,39,'#e5d8ba',6);rect(g,-11,-58,57,49,'#7b8990',5);rect(g,-6,-58,5,49,'#abb8b0',1)
    g.strokeStyle='#505b6866';g.lineWidth=1;for(let i=0;i<4;i++){g.beginPath();g.moveTo(7+i*9,-54);g.quadraticCurveTo(1+i*9,-35,9+i*9,-14);g.stroke()}
    // 布料靠折面和缝线表达柔软，床沿保留木质硬边。
    polygon(g,[[9,-56],[44,-56],[42,-41],[28,-37],[18,-43]]);g.fillStyle='#b3c1ba36';g.fill()
    polygon(g,[[0,-18],[43,-20],[42,-10],[4,-10]]);g.fillStyle='#404b5b55';g.fill()
    g.setLineDash([2,3]);g.strokeStyle='#d2d5bd88';g.lineWidth=0.8;g.beginPath();g.moveTo(3,-54);g.lineTo(3,-14);g.lineTo(41,-14);g.stroke();g.setLineDash([])
    rect(g,25,-37,13,11,'#a99e8555',1);g.strokeStyle='#48545c88';g.strokeRect(27,-35,9,7)
    g.beginPath();g.moveTo(-42,-48);g.quadraticCurveTo(-32,-54,-22,-48);g.moveTo(-43,-21);g.quadraticCurveTo(-33,-16,-23,-21);g.strokeStyle='#b3a28366';g.stroke()
    rect(g,-52,-7,104,3,'#a07b5266',1);for(const x of [-48,46])ellipse(g,x,-5,1,1,'#2f2b31')
    // 被子晒褪的大片色差比污点更能说明年岁，枕头仍保持干净。
    polygon(g,[[12,-52],[34,-53],[40,-40],[30,-28],[13,-32],[6,-41]]);g.fillStyle='#b8b6a637';g.fill()
    g.strokeStyle='#d2c6a076';g.lineWidth=0.7
    for(let i=0;i<7;i++){const x=5+i*6;g.beginPath();g.moveTo(x,-11);g.lineTo(x+(i%2?1:-1),-8+i%3);g.stroke()}
    g.beginPath();g.moveTo(-48,-3);g.lineTo(-35,-4);g.moveTo(31,-5);g.lineTo(43,-4);g.strokeStyle='#c1a77988';g.lineWidth=1.5;g.stroke()
    rect(g,-53,-26,5,13,'#786654',1);g.strokeStyle='#342c31';g.lineWidth=0.8;g.beginPath();g.moveTo(-51,-24);g.lineTo(-51,-16);g.stroke()
  } else if(e.kind==='table') {
    for(const x of [-26,21])rect(g,x,-17,6,17,'#50392e');rect(g,-35,-34,70,19,'#5c3e2d');rect(g,-35,-39,70,15,'#af8355')
    rect(g,-31,-33,61,1,'#e0b37b66',0);ellipse(g,-15,-32,8,4,'#dfccb0');rect(g,-20,-39,10,7,'#d6c5aa');ellipse(g,-15,-39,5,2,'#806454');rect(g,10,-38,15,9,'#eee0bb',1);rect(g,15,-37,2,6,'#b45248',0)
    g.strokeStyle='#d8bd8555';g.lineWidth=0.8;g.beginPath();g.moveTo(-30,-36);g.lineTo(26,-36);g.moveTo(-28,-28);g.lineTo(-2,-29);g.stroke()
    g.beginPath();g.ellipse(-15,-31,11,5,0,0,Math.PI*2);g.strokeStyle='#68463355';g.stroke()
    g.beginPath();g.arc(-8,-36,4,-Math.PI/2,Math.PI/2);g.strokeStyle='#ddc6a5';g.lineWidth=1.5;g.stroke()
    polygon(g,[[-33,-38],[-21,-38],[-24,-33],[-32,-32]]);g.fillStyle='#cbb68b7a';g.fill()
    g.beginPath();g.moveTo(2,-35);g.lineTo(7,-32);g.lineTo(17,-34);g.moveTo(-28,-22);g.lineTo(-15,-24);g.strokeStyle='#46322b99';g.lineWidth=0.8;g.stroke()
    rect(g,21,-14,6,5,'#8c795b',0);rect(g,21,-9,6,2,'#3b3030',0)
    polygon(g,[[-19,-39],[-15,-39],[-16,-37]]);g.fillStyle='#71604b';g.fill()
  } else if(e.kind==='board') {
    for(const x of [-26,25])rect(g,x,-49,6,49,'#5a3d2c');rect(g,-47,-86,94,53,'#62442f');rect(g,-43,-82,86,46,'#96734c')
    for(let i=1;i<3;i++)rect(g,-42,-82+i*15,84,1,'#5d4235',0)
    for(const [x,y,r] of [[-22,-73,-0.07],[10,-67,0.12],[-2,-49,-0.05]]) {g.save();g.translate(x,y);g.rotate(r);rect(g,-10,-7,20,15,'#dac9a4',1);rect(g,-7,-3,13,1,'#947b63',0);rect(g,-7,1,10,1,'#947b63',0);ellipse(g,0,-6,1,1,'#524438');g.restore()}
    polygon(g,[[-41,-80],[-30,-80],[-33,-58],[-40,-52]]);g.fillStyle='#afa58a38';g.fill()
    g.beginPath();g.moveTo(30,-79);g.lineTo(25,-70);g.lineTo(29,-62);g.lineTo(24,-54);g.strokeStyle='#3a2c2caa';g.lineWidth=1;g.stroke()
    polygon(g,[[32,-39],[42,-39],[42,-34],[37,-36]]);g.fillStyle='#c1a57b';g.fill()
    for(const x of [-23,28]){rect(g,x,-10,3,9,'#2e2c324d',0);ellipse(g,x+1,-77,1.5,1,'#9c6347')}
  } else if(e.kind==='woodpile') {
    // 三层错缝叠柴；右端切面、年轮与裂纹沿同一透视方向。
    for(let row=0;row<3;row++)for(let col=0;col<3-row;col++){
      const x=-31+col*25+row*12,y=-5-row*10
      rect(g,x-9,y-9,36,11,row%2?'#65442f':'#795137',3)
      g.strokeStyle='#332821';g.lineWidth=1
      for(let k=0;k<3;k++){g.beginPath();g.moveTo(x-6,y-7+k*3);g.quadraticCurveTo(x+8,y-9+k*3,x+23,y-7+k*3);g.stroke()}
      ellipse(g,x+25,y-4,6,5,'#3d2e26');ellipse(g,x+25,y-4,4.7,4,'#bc9560')
      g.strokeStyle='#78543b';g.lineWidth=.7;g.beginPath();g.ellipse(x+25,y-4,2.7,2.3,0,0,Math.PI*2);g.stroke()
      g.beginPath();g.moveTo(x+25,y-4);g.lineTo(x+28,y-7);g.stroke()
      g.strokeStyle='#b78a5755';g.beginPath();g.moveTo(x-5,y-9);g.lineTo(x+20,y-9);g.stroke()
    }
    for(const x of [-34,34])rect(g,x,-12,3,13,'#59412e',1)
  } else if(e.kind==='stove') {
    // 炉体右立面与上层台面先画，砖缝延续到侧面，不点火、不冒烟。
    polygon(g,[[38,-64],[49,-76],[49,-12],[38,0]]);g.fillStyle='#443e48';g.fill()
    polygon(g,[[-38,-64],[38,-64],[49,-76],[-27,-76]]);g.fillStyle='#93847c';g.fill()
    g.strokeStyle='#b9a89977';g.lineWidth=1;g.beginPath();g.moveTo(-36,-64);g.lineTo(38,-64);g.lineTo(49,-76);g.stroke()
    for(let i=0;i<4;i++){g.strokeStyle='#211f2b';g.beginPath();g.moveTo(39,-60+i*14);g.lineTo(49,-72+i*14);g.stroke()}
    rect(g,-18,-112,21,70,'#3b3740');rect(g,-17,-112,5,68,'#665961');rect(g,-42,-49,84,48,'#56505a');rect(g,-38,-64,76,47,'#76696a')
    for(let r=0;r<3;r++)for(let c=0;c<4;c++)rect(g,-36+c*19+(r%2)*3,-61+r*14,17,12,c%2?'#82736f':'#685c60',2)
    g.beginPath();g.roundRect(-20,-43,40,35,[18,18,2,2]);g.fillStyle='#1c1b25';g.fill();rect(g,-16,-12,34,3,'#a2998a');rect(g,38,-29,24,22,'#74503b');for(let i=0;i<4;i++)rect(g,40+i*5,-27,2,17,'#b08b5b',0)
    g.strokeStyle='#2a273866';g.lineWidth=1;g.beginPath();g.moveTo(-27,-59);g.lineTo(-23,-50);g.lineTo(-28,-44);g.moveTo(24,-31);g.lineTo(29,-25);g.lineTo(26,-18);g.stroke()
    for(let i=0;i<12;i++)ellipse(g,-25+i*5,-8+(i%3)*2,1.4,0.7,'#c3aaa02d')
    rect(g,-13,-110,10,4,'#262431',1)
    // 烟熏集中在烟道接缝和炉门上沿，剥落露出浅色耐火石。
    polygon(g,[[-15,-104],[-5,-108],[-8,-63],[-17,-54]]);g.fillStyle='#1717206b';g.fill()
    polygon(g,[[-24,-49],[0,-54],[25,-48],[22,-39],[11,-43],[-16,-40]]);g.fillStyle='#26222b66';g.fill()
    polygon(g,[[-35,-58],[-27,-59],[-29,-54],[-34,-52]]);g.fillStyle='#b3a38b9a';g.fill()
    polygon(g,[[26,-22],[35,-25],[36,-17],[30,-16]]);g.fillStyle='#a293806e';g.fill()
    g.beginPath();g.moveTo(-13,-11);g.lineTo(-2,-10);g.moveTo(10,-10);g.lineTo(18,-11);g.strokeStyle='#a26945';g.lineWidth=1.5;g.stroke()
    // 炉口厚石拱、灰床与冷铁炉栅。
    g.strokeStyle='#a59585';g.lineWidth=4;g.beginPath();g.ellipse(0,-32,22,18,0,Math.PI,Math.PI*2);g.stroke()
    for(let i=0;i<5;i++){rect(g,-15+i*7,-14,3,4,'#46434a',0);ellipse(g,-19+i*9,-7,3,1,'#ac9c853f')}
    // 风箱：木质上下板夹住皮革褶皱，连接炉体的旧铁风管。
    rect(g,34,-21,12,5,'#38343a',1)
    polygon(g,[[43,-30],[68,-34],[73,-28],[48,-23]]);g.fillStyle='#a68054';g.fill()
    polygon(g,[[43,-23],[69,-27],[70,-9],[43,-5]]);g.fillStyle='#493a32';g.fill()
    for(let i=0;i<5;i++){const x=45+i*5;g.strokeStyle=i%2?'#a0866155':'#221d23';g.lineWidth=2;g.beginPath();g.moveTo(x,-24);g.lineTo(x+2,-17);g.lineTo(x,-8);g.stroke()}
    polygon(g,[[42,-8],[70,-12],[74,-6],[45,-1]]);g.fillStyle='#775138';g.fill()
    rect(g,53,-43,4,12,'#8e6948',1);rect(g,49,-45,15,4,'#b08a5a',1)
    for(const x of [45,66])ellipse(g,x,-26,1.1,1,'#b7a281')
    g.strokeStyle='#33242b';g.lineWidth=1;g.beginPath();g.moveTo(62,-26);g.lineTo(58,-19);g.lineTo(63,-13);g.stroke()
  } else if(e.kind==='pot'&&potRepaired) {
    const glow=g.createRadialGradient(0,-3,2,0,-3,44)
    glow.addColorStop(0,'#fba24a38');glow.addColorStop(1,'#fba24a00');g.fillStyle=glow;g.fillRect(-44,-47,88,88)
    ellipse(g,0,2,26,8,'#211d2377')
    for(let i=0;i<8;i++){
      const a=i*Math.PI/4,x=Math.cos(a)*22,y=3+Math.sin(a)*7
      polygon(g,[[x-5,y],[x-3,y-4],[x+4,y-3],[x+6,y+2],[x,y+4]]);g.fillStyle=i%2?'#81776b':'#645d59';g.fill()
      g.strokeStyle='#b6a48a66';g.lineWidth=1;g.beginPath();g.moveTo(x-3,y-3);g.lineTo(x+3,y-2);g.stroke()
    }
    g.lineCap='round';g.lineWidth=6;g.strokeStyle='#503527';g.beginPath();g.moveTo(-15,0);g.lineTo(14,6);g.moveTo(-13,7);g.lineTo(14,-1);g.stroke()
    g.lineWidth=1;g.strokeStyle='#c76e3966';g.stroke()
    for(let i=0;i<5;i++)ellipse(g,-12+i*6,3+i%2,2,1,'#eb8345')
    for(const [w,h,color] of [[12,27,'#c9512c'],[8,22,'#f5a13d'],[3,14,'#ffe3a0']] as const){
      const sway=Math.sin(time*6+h)*2
      g.beginPath();g.moveTo(sway,-h);g.bezierCurveTo(w,-12,w,7,0,6);g.bezierCurveTo(-w,7,-w,-8,sway,-h);g.fillStyle=color;g.fill()
    }
    for(const x of [-20,18])rect(g,x,-45,4,45,'#403139')
    rect(g,-23,-50,49,5,'#806353');g.strokeStyle='#655e5c';g.lineWidth=2;g.beginPath();g.moveTo(0,-47);g.lineTo(0,-34);g.stroke()
    const metal=g.createLinearGradient(-23,0,23,0)
    metal.addColorStop(0,'#333943');metal.addColorStop(.23,'#90999c');metal.addColorStop(.42,'#626d75');metal.addColorStop(.78,'#424951');metal.addColorStop(1,'#272d36')
    g.beginPath();g.moveTo(-23,-26);g.bezierCurveTo(-23,-10,-17,-5,0,-4);g.bezierCurveTo(17,-5,23,-10,23,-26);g.closePath();g.fillStyle=metal;g.fill()
    g.strokeStyle='#232934';g.lineWidth=1.4;g.stroke()
    g.beginPath();g.ellipse(-5,-17,14,9,0,Math.PI*.65,Math.PI*1.2);g.strokeStyle='#d2c9b366';g.lineWidth=1;g.stroke()
    g.beginPath();g.ellipse(0,-9,15,4,0,0,Math.PI);g.strokeStyle='#de874366';g.stroke()
    for(const x of [-25,25]){g.beginPath();g.ellipse(x,-23,5,4,0,0,Math.PI*2);g.strokeStyle='#a4a8a4';g.lineWidth=2;g.stroke();ellipse(g,x<0?-21:21,-22,1.3,1.3,'#c1bcab')}
    ellipse(g,0,-26,23,8,'#a0a7a3');ellipse(g,0,-26,20.5,6.3,'#292f38')
    const water=g.createLinearGradient(0,-32,0,-20);water.addColorStop(0,'#596e78');water.addColorStop(.6,'#87958b');water.addColorStop(1,'#b6b49a')
    g.save();g.beginPath();g.ellipse(0,-26,19,5.4,0,0,Math.PI*2);g.clip();g.fillStyle=water;g.fillRect(-20,-32,40,12)
    for(let i=0;i<9;i++){
      const phase=(time*1.3+i*.37)%1,x=-15+(i*13%30),y=-29+(i*7%6),r=.5+phase*2.5
      g.globalAlpha=Math.sin(phase*Math.PI)*.75;g.strokeStyle='#e3ddc0';g.lineWidth=.7
      g.beginPath();g.ellipse(x,y,r,r*.44,0,0,Math.PI*2);g.stroke();ellipse(g,x-.4,y-.4,.7,.4,'#f4edd2')
    }
    g.restore()
    g.beginPath();g.ellipse(0,-26,22,7,0,0,Math.PI);g.strokeStyle='#c8c4b3';g.lineWidth=1.5;g.stroke()
    polygon(g,[[3,-21],[10,-20],[9,-12],[3,-13]]);g.fillStyle='#8e9696';g.fill()
    g.strokeStyle='#c6c4b366';g.lineWidth=.6;g.stroke();for(const y of [-19,-14])ellipse(g,5,y,.8,.8,'#d7d2bc')
    for(let i=0;i<5;i++){
      const p=(time*.32+i*.21)%1,x=-13+i*6+Math.sin(time*.8+i+p*4)*4,y=-29-p*44
      g.save();g.globalAlpha=Math.sin(p*Math.PI)*.22;g.strokeStyle='#ddd9cc';g.lineCap='round';g.lineWidth=2+p*4
      g.beginPath();g.moveTo(x,y+12);g.bezierCurveTo(x-7,y+3,x+8,y-5,x+3,y-14);g.stroke();g.restore()
    }
  } else if(e.kind==='pot') {
    for(const x of [-20,18])rect(g,x,-45,4,45,'#403139');rect(g,-23,-50,49,5,'#806353');g.strokeStyle='#51444b';g.lineWidth=2;g.beginPath();g.moveTo(0,-47);g.lineTo(0,-34);g.stroke()
    ellipse(g,0,-15,23,15,'#35343d');ellipse(g,0,-24,23,8,'#7a7274');ellipse(g,0,-24,18,5,'#22232c');g.strokeStyle='#af9990';g.lineWidth=1;g.beginPath();g.moveTo(5,-28);g.lineTo(2,-22);g.stroke()
    g.beginPath();g.ellipse(-5,-17,14,9,0,Math.PI*0.65,Math.PI*1.2);g.strokeStyle='#a8998b66';g.lineWidth=1;g.stroke()
    for(const x of [-25,25]){g.beginPath();g.arc(x,-22,5,0,Math.PI*2);g.strokeStyle='#5a5055';g.lineWidth=2;g.stroke()}
    g.beginPath();g.moveTo(8,-24);g.lineTo(5,-20);g.lineTo(10,-16);g.strokeStyle='#191923';g.lineWidth=1;g.stroke()
    polygon(g,[[-19,-16],[-7,-13],[9,-14],[18,-17],[14,-5],[0,-1],[-14,-5]]);g.fillStyle='#19192270';g.fill()
    polygon(g,[[12,-22],[19,-21],[17,-17],[12,-18]]);g.fillStyle='#a16c4c99';g.fill()
    ellipse(g,-17,-24,4,1.2,'#c3b29b88');ellipse(g,9,-24,3,1,'#453638')
    g.strokeStyle='#8d685365';g.lineWidth=1;g.beginPath();g.moveTo(-17,-12);g.lineTo(-11,-9);g.moveTo(10,-10);g.lineTo(14,-12);g.stroke()
  } else if(e.kind==='rope') {
    const left=-e.w/2+6,right=e.w/2-6
    // 木桩用顶面、亮面和暗侧面交代厚度，脚边碎石压住底座。
    for(const x of [left,right]){
      ellipse(g,x,1,10,3,'#27232975')
      rect(g,x-5,-41,10,41,'#806044',0)
      rect(g,x-5,-40,3,37,'#b18a60',0)
      rect(g,x+3,-39,3,39,'#513d30',0)
      polygon(g,[[x-5,-41],[x+5,-41],[x+7,-44],[x-3,-44]]);g.fillStyle='#c09b6c';g.fill()
      g.strokeStyle='#49382e';g.lineWidth=0.8
      g.beginPath();g.moveTo(x,-38);g.lineTo(x-1,-23);g.moveTo(x+1,-18);g.lineTo(x,-5);g.stroke()
      rect(g,x-6,-4,13,4,'#4d463e',0)
      ellipse(g,x-7,2,4,2,'#786d60');ellipse(g,x+7,1,3,2,'#a19179')
    }
    // 主绳连接木桩上部并自然下垂，暗底与亮线保留旧麻绳的体积。
    g.lineCap='round'
    g.beginPath();g.moveTo(left,-31);g.quadraticCurveTo(0,-11,right,-31)
    g.strokeStyle='#5d4632';g.lineWidth=4;g.stroke()
    g.strokeStyle='#c9a775';g.lineWidth=2.6;g.stroke()
    g.strokeStyle='#e4c89799';g.lineWidth=0.7
    for(let i=1;i<12;i++){
      const t=i/12,x=left+(right-left)*t,y=-31+40*t*(1-t)
      g.beginPath();g.moveTo(x-1,y-1);g.lineTo(x+1,y+1.5);g.stroke()
    }
    // 绳头绕桩三圈并留短尾，避免绳索端点像直接粘在木头上。
    for(const [x,side] of [[left,-1],[right,1]]){
      g.strokeStyle='#49362d';g.lineWidth=3
      g.beginPath();g.moveTo(x-6,-34);g.lineTo(x+6,-32);g.moveTo(x-6,-31);g.lineTo(x+6,-29);g.moveTo(x-6,-28);g.lineTo(x+6,-26);g.stroke()
      g.strokeStyle='#d3b382';g.lineWidth=1.6;g.stroke()
      g.beginPath();g.moveTo(x+side*5,-29);g.quadraticCurveTo(x+side*11,-24,x+side*8,-19);g.stroke()
      ellipse(g,x+side*5,-30,2.6,2,'#b79262')
    }
  } else if(e.kind==='fire') {
    for(let i=0;i<11;i++){const a=i/11*Math.PI*2;ellipse(g,Math.cos(a)*34,Math.sin(a)*16,8,6,'#84776c');ellipse(g,Math.cos(a)*34-2,Math.sin(a)*16-2,5,3,'#b1a08a')}
    g.strokeStyle='#65432e';g.lineWidth=9;g.beginPath();g.moveTo(-23,-5);g.lineTo(22,5);g.moveTo(-22,6);g.lineTo(21,-6);g.stroke()
    for(const [w,h,color] of [[19,58,'#d75e33'],[12,43,'#ffac49'],[5,26,'#ffe9ac']] as const){const s=Math.sin(time*7+h)*3;g.beginPath();g.moveTo(s,-h);g.bezierCurveTo(w,-25,w,8,0,7);g.bezierCurveTo(-w,8,-w,-20,s,-h);g.fillStyle=color;g.fill()}
    for(let i=0;i<5;i++){const t=(time*24+i*19)%95;ellipse(g,Math.sin(i+t*0.08)*12,-30-t,1,1.5,`rgba(255,200,113,${(1-t/95)*0.7})`)}
    for(let i=0;i<3;i++){const t=(time*13+i*35)%110;ellipse(g,Math.sin(t*0.03+i)*14,-58-t,6+t*0.11,3+t*0.06,`rgba(180,165,156,${(1-t/110)*0.09})`)}
  } else if(e.kind==='radio') {
    // 旧收音机：矮木盒身 + 左喇叭布网（同心纹）+ 右侧调频刻度与旋钮 + 短天线
    rect(g,-20,-34,40,34,'#5e4130',3);rect(g,-20,-34,40,7,'#8a6443',3)
    rect(g,-19,-33,38,2,'#b08a5f55',1)
    // 喇叭布网：暖灰底 + 同心椭圆织纹
    ellipse(g,-7,-16,10,11,'#6b6258');ellipse(g,-7,-16,8,9,'#57504a')
    g.strokeStyle='#8b827666';g.lineWidth=0.7
    for(let r=3;r<=9;r+=3){g.beginPath();g.ellipse(-7,-16,r,r*1.1,0,0,Math.PI*2);g.stroke()}
    g.beginPath();g.moveTo(-7,-25);g.lineTo(-7,-7);g.moveTo(-15,-16);g.lineTo(1,-16);g.stroke()
    // 调频段：刻线 + 红色小指示窗（随音乐轻呼吸）
    rect(g,5,-29,12,7,'#3a2c28',1)
    for(let i=0;i<4;i++)rect(g,6+i*3,-28,1,3,'#a9936f',0)
    ellipse(g,15,-26,1.6,1.6,`rgba(214,96,66,${0.55+Math.sin(time*3)*0.2})`)
    // 旋钮：大圆钮 + 缺口
    ellipse(g,11,-13,5,5,'#4b3a30');ellipse(g,11,-13,3.4,3.4,'#7a6450')
    g.strokeStyle='#cab99c';g.lineWidth=1;g.beginPath();g.moveTo(11,-13);g.lineTo(14,-16);g.stroke()
    // 短天线：细杆斜出
    g.strokeStyle='#9a9285';g.lineWidth=1.4;g.beginPath();g.moveTo(15,-33);g.lineTo(24,-52);g.stroke()
    ellipse(g,24,-52,1.4,1.4,'#b8b0a2')
    // 盒身底沿磨损与脚垫
    rect(g,-19,-3,38,2,'#3c2a20',1);rect(g,-17,-1,7,2,'#2e221a',0);rect(g,10,-1,7,2,'#2e221a',0)
  }
  g.restore()
}
/** 固定光晕以二倍分辨率烘焙，呼吸只改变绘制透明度，缩放后仍保持清晰。 */
let campGlow: HTMLCanvasElement | null = null
function getCampGlow(): HTMLCanvasElement {
  if (campGlow) return campGlow
  const canvas = document.createElement('canvas')
  canvas.width = 580; canvas.height = 580
  const context = canvas.getContext('2d')!
  context.scale(2, 2)
  const glow = context.createRadialGradient(145, 145, 8, 145, 145, 145)
  glow.addColorStop(0, '#ffc17c15'); glow.addColorStop(1, '#ffc17c00')
  context.fillStyle = glow; context.fillRect(0, 0, 290, 290)
  campGlow = canvas
  return canvas
}
const CAMP_LAMP_POSITIONS = [[1216, 397], [1216, 508]] as const

/** 少量漂浮尘屑和火光呼吸；不使用逐帧模糊滤镜。 */
export function drawCampAtmosphere(g:CanvasRenderingContext2D,time:number):void {
  if(drawCampArtworkAtmosphere(g,time))return
  g.save();g.globalAlpha=0.55+Math.sin(time*2)*0.1
  g.drawImage(getCampGlow(),515,289,290,290)
  // 尘屑共用一次路径提交，避免每粒尘屑各自切换样式与填充。
  g.beginPath()
  for(let i=0;i<22;i++){
    const x=380+(i*97%760)+Math.sin(time*0.2+i)*12,y=300+(i*61+time*3)%330
    g.moveTo(x+0.7,y);g.ellipse(x,y,0.7,0.7,0,0,Math.PI*2)
  }
  g.fillStyle='#d8c4a740';g.fill()
  // 洞口矿灯轻微错峰呼吸；暖色反射只落在靠火的岩面，不给废炉伪造工作状态。
  for(const [x,y] of CAMP_LAMP_POSITIONS){
    g.globalAlpha=0.3+Math.sin(time*2.1+y)*0.07
    ellipse(g,x,y,8,12,'#ffe1a82a')
  }
  g.globalAlpha=0.14+Math.sin(time*3.7)*0.025
  polygon(g,[[645,194],[731,186],[731,220],[645,228]]);g.fillStyle='#eeb477';g.fill()
  g.restore()
}
