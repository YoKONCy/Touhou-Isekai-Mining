/** 塌方的岩块、碎屑和新裂口独立烘焙，配色沿用矿洞的灰岩、板岩与浅褐断面。 */
const hash=(n:number)=>{const x=Math.sin(n*127.1+53.7)*43758.5453;return x-Math.floor(x)}
const clamp=(n:number)=>Math.max(0,Math.min(1,n))
const palettes=[
  {base:'#777b79',top:'#a4aaa0',side:'#515957',edge:'#c4c7b6',crack:'#414947'},
  {base:'#857b69',top:'#b4a58a',side:'#60584c',edge:'#d4c2a0',crack:'#51483c'},
  {base:'#707b7c',top:'#a0aba7',side:'#4a585b',edge:'#bdc5bb',crack:'#3e4c4e'}
]
type Point=readonly [number,number]
export interface CollapseRock {x:number;y:number;r:number;seed:number;rotation:number;delay:number}
/** 大块错层压住细料，轮廓向左侧逐渐散开，不再用整片不透明底板填缝。 */
export const COLLAPSE_ROCKS:readonly CollapseRock[]=Array.from({length:40},(_,i)=>{
  const row=Math.floor(i/5),col=i%5
  return {x:23+col*44+(row%2?9:0)+(hash(i+12)-.5)*17,
    y:-202+row*60+(hash(i+32)-.5)*24,r:col===0?26+hash(i+52)*10:30+hash(i+52)*18,
    seed:i+9,rotation:(hash(i+72)-.5)*1.5,delay:(i%7)*.078}
}).sort((a,b)=>a.y-b.y)

const bounds={left:-92,top:-274,width:356,height:574}
const sprites=new Map<number,HTMLCanvasElement>()
let ground:HTMLCanvasElement|undefined,approach:HTMLCanvasElement|undefined,settled:HTMLCanvasElement|undefined,fork:HTMLCanvasElement|undefined
function layer(paint:(g:CanvasRenderingContext2D)=>void,box=bounds):HTMLCanvasElement{
  const image=document.createElement('canvas');image.width=box.width*2;image.height=box.height*2
  const g=image.getContext('2d')!;g.scale(2,2);g.translate(-box.left,-box.top);g.lineJoin='round';paint(g);return image
}
function polygon(g:CanvasRenderingContext2D,points:readonly Point[],color:string):void{
  g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=color;g.fill()
}
function rockSprite(seed:number):HTMLCanvasElement{
  const variant=seed%14,saved=sprites.get(variant);if(saved)return saved
  const image=document.createElement('canvas');image.width=224;image.height=192
  const g=image.getContext('2d')!;g.scale(2,2);g.translate(56,44);g.lineJoin='round'
  const p=palettes[variant%3]!,flat=variant%4===1,r=30,rx=flat?1.22:.93+hash(variant+3)*.18,ry=flat?.57:.85+hash(variant+6)*.13
  const outline:Point[]=[[-.95,-.13],[-.72,-.54],[-.21,-.78],[.43,-.59],[.95,-.13],[.73,.46],[.11,.72],[-.69,.53]]
    .map(([x,y],i)=>[(x!+(hash(variant*13+i)-.5)*.14)*r*rx,(y!+(hash(variant*17+i+8)-.5)*.12)*r*ry] as Point)
  polygon(g,outline,p.base)
  const center:Point=[-3+hash(variant+24)*10,2+hash(variant+26)*5]
  polygon(g,[outline[3]!,outline[4]!,outline[5]!,outline[6]!,center],p.side)
  polygon(g,[outline[0]!,outline[1]!,outline[2]!,outline[3]!,center,[-13,6]],p.top)
  g.save();g.globalAlpha*=.25;polygon(g,[outline[6]!,outline[7]!,outline[0]!,[-13,6],center],'#414942');g.restore()
  g.save();g.beginPath();outline.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.clip()
  // 错开的锻裂、砂眼和剥落薄边保持哑光，不把每一块画成同一个亮面多边形。
  g.strokeStyle=p.crack;g.lineWidth=.85;g.beginPath();g.moveTo(-6,-r*.59*ry);g.lineTo(-10,-r*.3*ry);g.lineTo(-3,-r*.12*ry);g.lineTo(-6,r*.16*ry)
  if(variant%2===0){g.moveTo(-9,-r*.29*ry);g.lineTo(-19,-r*.16*ry)}g.stroke()
  g.strokeStyle=p.edge;g.globalAlpha*=.3;g.lineWidth=.6;g.beginPath();g.moveTo(-4.8,-r*.57*ry);g.lineTo(-8.8,-r*.3*ry);g.lineTo(-1.8,-r*.12*ry);g.stroke();g.globalAlpha/=.3
  if(flat||variant%3===1){
    for(let i=0;i<3;i++){
      const y=2+i*4*ry;g.globalAlpha=.23;g.strokeStyle=p.crack;g.lineWidth=.7;g.beginPath();g.moveTo(-30,y);g.lineTo(-9,y-2);g.lineTo(10,y+.6);g.lineTo(30,y-1);g.stroke()
      g.globalAlpha=.16;g.strokeStyle=p.edge;g.beginPath();g.moveTo(-20,y-1.1);g.lineTo(2,y-1.6);g.stroke()
    }
    g.globalAlpha=1
  }
  for(let i=0;i<19;i++){
    const x=(hash(variant*47+i+90)-.5)*62*rx,y=(hash(variant*31+i+120)-.5)*42*ry,size=.45+hash(i+135)*.85
    g.fillStyle=i%3===0?p.edge:p.crack;g.globalAlpha=i%3===0?.3:.21;g.fillRect(x,y,size*1.6,size)
  }
  g.restore()
  g.beginPath();outline.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.strokeStyle='#343c3b';g.lineWidth=.85;g.stroke()
  g.strokeStyle=p.edge;g.lineWidth=.65;g.globalAlpha*=.6;g.beginPath();g.moveTo(outline[1]![0]+1,outline[1]![1]+1);g.lineTo(outline[2]![0],outline[2]![1]+1);g.lineTo(outline[3]![0]-1,outline[3]![1]+1);g.stroke()
  sprites.set(variant,image);return image
}
export function drawCollapseRock(g:CanvasRenderingContext2D,x:number,y:number,r:number,seed:number,rotation=0):void{
  const s=r/30;g.save();g.translate(x,y);g.rotate(rotation);g.drawImage(rockSprite(seed),-56*s,-44*s,112*s,96*s);g.restore()
}
function contact(g:CanvasRenderingContext2D,rock:CollapseRock,strength=1):void{
  g.save();g.globalAlpha*=.2*strength;g.fillStyle='#383730';g.beginPath();g.ellipse(rock.x+3,rock.y+rock.r*.56,rock.r*1.05,rock.r*.26,rock.rotation*.3,0,Math.PI*2);g.fill();g.restore()
}
function timber(g:CanvasRenderingContext2D,x:number,y:number,length:number,angle:number,seed:number):void{
  g.save();g.translate(x,y);g.rotate(angle)
  polygon(g,[[0,-4],[length-7,-5],[length,-1],[length-5,1],[length-1,4],[0,4]],'#70634c')
  g.strokeStyle='#3b3b31';g.lineWidth=1;g.beginPath();g.moveTo(1,4);g.lineTo(length-8,4);g.stroke()
  g.strokeStyle='#a18f6c';g.lineWidth=.65;g.beginPath();g.moveTo(3,-2);g.lineTo(length-11,-2);g.moveTo(length-14,-3);g.lineTo(length-5,0);g.stroke()
  g.strokeStyle='#4c4638';g.beginPath();g.moveTo(9,1);g.lineTo(length-16,.5);g.stroke()
  if(seed%2===0){g.fillStyle='#8d938b';g.fillRect(9,-3.5,3,7)}g.restore()
}
/** 断岩表面用连续层理、细砂眼与局部剥蚀保持体积，不把每片都切成同样的三角亮面。 */
function fractureFace(g:CanvasRenderingContext2D,points:readonly Point[],seed:number,warm=false):void{
  const p=warm?{base:'#7d7566',hi:'#a99e87',shade:'#555249',edge:'#c4b59a',crack:'#3b3c35'}
    :{base:'#727974',hi:'#9ea398',shade:'#4a5653',edge:'#bfc2ad',crack:'#35423e'}
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]),left=Math.min(...xs),top=Math.min(...ys),width=Math.max(...xs)-left,height=Math.max(...ys)-top
  polygon(g,points,p.base)
  g.save();g.clip()
  g.globalAlpha*=.44
  polygon(g,[[left-2,top+height*.63],[left+width*.23,top+height*.36],[left+width*.55,top+height*.57],[left+width+2,top+height*.42],[left+width+3,top+height+3],[left-3,top+height+3]],p.shade)
  g.globalAlpha*=.56
  polygon(g,[[left,top],[left+width,top],[left+width*.78,top+height*.3],[left+width*.4,top+height*.17],[left,top+height*.35]],p.hi)
  g.restore()
  g.save();g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.clip()
  for(let i=0;i<4;i++){
    const y=top+height*(.2+i*.2),drift=(hash(seed+i+812)-.5)*height*.18
    g.globalAlpha=.24;g.strokeStyle=p.crack;g.lineWidth=.65+hash(seed+i+840)*.6
    g.beginPath();g.moveTo(left-2,y);g.bezierCurveTo(left+width*.28,y-3+drift,left+width*.6,y+2,left+width+2,y-4+drift);g.stroke()
    g.globalAlpha=.17;g.strokeStyle=p.edge;g.lineWidth=.5;g.beginPath();g.moveTo(left+width*.12,y+.8);g.quadraticCurveTo(left+width*.42,y+drift*.5,left+width*.63,y+1);g.stroke()
  }
  const count=Math.min(130,Math.max(22,Math.floor(width*height/29)))
  for(let i=0;i<count;i++){
    const x=left+hash(seed*41+i+900)*width,y=top+hash(seed*37+i+950)*height,r=.35+hash(seed+i+1010)*.9
    g.globalAlpha=i%5===0?.27:.16;g.fillStyle=i%5===0?p.edge:i%3===0?p.crack:p.shade
    g.fillRect(x,y,r*(1+hash(i+1050)),r*.65)
  }
  if(width>22&&height>22){
    const x=left+width*(.25+hash(seed+1080)*.45),y=top+height*.22
    g.globalAlpha=.66;g.strokeStyle=p.crack;g.lineWidth=.9;g.beginPath();g.moveTo(x,y);g.lineTo(x-2,y+height*.18);g.lineTo(x+3,y+height*.32);g.lineTo(x+1,y+height*.49)
    g.moveTo(x-1,y+height*.18);g.lineTo(x-width*.2,y+height*.23);g.stroke()
    g.globalAlpha=.25;g.strokeStyle=p.edge;g.lineWidth=.55;g.beginPath();g.moveTo(x+.8,y+1);g.lineTo(x-.9,y+height*.18);g.stroke()
  }
  g.restore()
  g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.strokeStyle='#343c37';g.lineWidth=.85;g.stroke()
  for(let i=0;i<points.length;i++){
    const a=points[i]!,b=points[(i+1)%points.length]!
    if(b[1]+a[1]>top*2+height*.7||i%3===2)continue
    g.save();g.globalAlpha*=.55;g.strokeStyle=p.edge;g.lineWidth=.7;g.beginPath();g.moveTo(a[0]+(b[0]-a[0])*.12,a[1]+(b[1]-a[1])*.12+1);g.lineTo(a[0]+(b[0]-a[0])*.76,a[1]+(b[1]-a[1])*.76+1);g.stroke();g.restore()
  }
}
/** 路面只画错落的压痕与嵌泥碎石，远处收小收暗，不画规则梯级。 */
function passageFloor(g:CanvasRenderingContext2D,points:readonly Point[],seed:number,nearY:number,farY:number,nearLeft:number,nearRight:number,farLeft:number,farRight:number):void{
  const tone=g.createLinearGradient(0,farY,0,nearY);tone.addColorStop(0,'#303734');tone.addColorStop(.55,'#53574c');tone.addColorStop(1,'#837863')
  g.beginPath();points.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=tone;g.fill()
  g.save();g.clip()
  for(let i=0;i<58;i++){
    const p=hash(seed+i+1160),left=farLeft+(nearLeft-farLeft)*p,right=farRight+(nearRight-farRight)*p
    const x=left+(right-left)*hash(seed+i+1200),y=farY+(nearY-farY)*p,r=.4+p*(1+hash(seed+i+1240)*2.2)
    g.globalAlpha=.25+p*.23;g.fillStyle=i%4?'#9a907b':'#3d453d'
    polygon(g,[[x-r,y],[x-r*.3,y-r*.5],[x+r,y+r*.1],[x+r*.4,y+r*.5]],g.fillStyle as string)
  }
  for(let i=0;i<7;i++){
    const p=.15+i*.115,y=farY+(nearY-farY)*p,left=farLeft+(nearLeft-farLeft)*p,right=farRight+(nearRight-farRight)*p
    g.globalAlpha=.15;g.strokeStyle='#2e3831';g.lineWidth=.6+p*.55;g.beginPath();g.moveTo(left+(right-left)*.2,y);g.bezierCurveTo(left+(right-left)*.36,y-2,right-(right-left)*.32,y+1,right-(right-left)*.1,y-1);g.stroke()
  }
  g.restore()
}
function groundLayer():HTMLCanvasElement{
  return ground??=layer(g=>{
    // 松散细料逐渐过渡到原地面，只留下局部接触阴影，画布其余部分透明。
    for(let i=0;i<76;i++){
      const x=-53+hash(i+300)*299,y=-237+hash(i+340)*492
      const edge=clamp((x+65)/110);g.globalAlpha=.12+edge*.19;g.fillStyle=i%3===0?'#a89471':'#857e6b'
      g.beginPath();g.ellipse(x,y,3+hash(i+380)*14,1.2+hash(i+400)*4,(hash(i+410)-.5)*1.4,0,Math.PI*2);g.fill()
    }
    g.globalAlpha=1
    // 密实的细碎断片托住上层巨石，消除整齐行列之间的空洞，同时保留自然边缘。
    for(let i=0;i<112;i++){
      const row=Math.floor(i/7),col=i%7
      const x=21+col*34+(row%2?10:0)+(hash(i+430)-.5)*18,y=-234+row*31+(hash(i+470)-.5)*17,r=16+hash(i+510)*13
      drawCollapseRock(g,x,y,r,i+74,(hash(i+550)-.5)*2.6)
    }
    for(let i=0;i<58;i++){
      const x=-59+hash(i+580)*300,y=-242+hash(i+620)*505,r=1.3+hash(i+660)*4.5
      polygon(g,[[x-r,y],[x-r*.4,y-r*.7],[x+r*.8,y-r*.35],[x+r,y+r*.3],[x-r*.5,y+r*.5]],i%3===0?'#a7987a':i%3===1?'#7c857f':'#5c665f')
      g.strokeStyle='#b8b19a';g.globalAlpha=.4;g.lineWidth=.5;g.beginPath();g.moveTo(x-r*.4,y-r*.7);g.lineTo(x+r*.7,y-r*.35);g.stroke();g.globalAlpha=1
    }
  })
}
const forkBounds={left:-48,top:88,width:150,height:192}
function forkLayer():HTMLCanvasElement{
  return fork??=layer(g=>{
    // 门槛尘土承接原地面，黑暗只落在岩层裂开的内部。
    g.save();g.globalAlpha=.16;g.fillStyle='#343b32';g.beginPath();g.ellipse(9,242,42,10,-.06,0,Math.PI*2);g.fill();g.restore()
    const mouth:Point[]=[[-23,231],[-20,206],[-14,183],[-7,163],[5,149],[16,153],[22,171],[27,188],[37,216],[32,235],[9,247]]
    const deep=g.createLinearGradient(0,151,0,241);deep.addColorStop(0,'#202a2b');deep.addColorStop(.55,'#293431');deep.addColorStop(1,'#585b4d')
    g.beginPath();mouth.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=deep;g.fill()
    g.save();g.clip()
    // 窄坡向裂缝深处收拢，侧缘有可读的岩层厚度。
    fractureFace(g,[[-24,227],[-14,183],[-7,163],[2,153],[0,187],[-7,217],[-9,237]],241)
    fractureFace(g,[[16,153],[22,171],[27,188],[37,216],[31,232],[22,218],[19,191],[12,173]],252,true)
    passageFloor(g,[[-25,241],[-9,208],[1,183],[7,171],[14,177],[21,204],[35,240],[6,249]],260,244,174,-25,35,6,14)
    g.save();g.globalAlpha=.28;polygon(g,[[-9,208],[1,183],[7,171],[14,177],[12,190],[1,213]],'#26322e');g.restore()
    g.restore()
    // 前缘由大小不等的断片组成，错开的断层夹出裂口，不再是一对平板石柱。
    fractureFace(g,[[-42,155],[-35,125],[-21,112],[-7,121],[-2,139],[-12,157],[-27,170]],271)
    fractureFace(g,[[-43,155],[-26,156],[-12,167],[-18,190],[-24,219],[-41,234],[-46,197]],279)
    fractureFace(g,[[-36,201],[-23,191],[-22,208],[-29,226],[-41,234]],288,true)
    fractureFace(g,[[18,145],[28,125],[47,120],[67,135],[60,155],[38,165],[26,163]],297,true)
    fractureFace(g,[[32,162],[59,151],[66,173],[49,192],[34,213],[29,190]],306)
    fractureFace(g,[[45,190],[59,181],[65,201],[48,219],[34,220],[33,207]],316,true)
    // 顶部新断裂的岩唇在缝内投下短影，层理从岩堆延伸到裂口。
    g.save();g.globalAlpha=.33;polygon(g,[[-6,143],[9,136],[25,145],[23,160],[15,156],[5,156],[-6,169]],'#252e2c');g.restore()
    fractureFace(g,[[-11,132],[1,119],[21,125],[30,142],[18,151],[7,141],[-2,153]],324)
    for(let i=0;i<11;i++){
      const x=-36+hash(i+1300)*91,y=229+hash(i+1320)*20,r=2+hash(i+1340)*4.2
      // 入口中央留出坡面，碎料堆在两侧，避免被画成堵死的小洞。
      if(x>-17&&x<26&&y<241)continue
      drawCollapseRock(g,x,y,r,i+92,(hash(i+1360)-.5)*1.4)
    }
    g.save();g.globalAlpha=.36;g.strokeStyle='#b4a58a';g.lineWidth=.8;g.beginPath();g.moveTo(-18,240);g.quadraticCurveTo(1,247,24,243);g.stroke();g.restore()
  },forkBounds)
}
function blit(g:CanvasRenderingContext2D,image:HTMLCanvasElement,box=bounds):void{g.drawImage(image,box.left,box.top,box.width,box.height)}
export function drawCollapseApproach(g:CanvasRenderingContext2D):void{
  approach??=layer(g=>{
    // 连续的旧岩层绕出矿道，不用圆石等距排成一圈石门。
    const outer:Point[]=[[27,181],[20,102],[27,11],[23,-69],[40,-122],[76,-170],[122,-190],[170,-177],[214,-142],[243,-86],[249,23],[244,118],[254,191]]
    fractureFace(g,outer,402,true)
    const opening:Point[]=[[61,169],[58,68],[61,-61],[75,-102],[103,-126],[142,-140],[181,-125],[209,-91],[221,-36],[218,170],[166,185],[99,180]]
    const depth=g.createLinearGradient(132,-135,140,182);depth.addColorStop(0,'#252c2b');depth.addColorStop(.54,'#303a36');depth.addColorStop(1,'#6b6655')
    g.beginPath();opening.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.closePath();g.fillStyle=depth;g.fill()
    g.save();g.clip()
    fractureFace(g,[[60,-69],[79,-103],[97,-110],[99,0],[78,177],[60,178]],418)
    fractureFace(g,[[197,-101],[215,-68],[226,0],[219,178],[194,176],[177,-26]],431,true)
    passageFloor(g,[[75,181],[110,67],[143,-26],[165,-30],[187,67],[222,187],[155,199]],444,190,-30,75,222,143,165)
    // 深处的岩折面压暗，开口底部逐渐融入已有泥灰地面。
    g.save();g.globalAlpha=.26;polygon(g,[[95,-20],[115,-84],[146,-114],[180,-90],[183,-23],[165,-30],[143,-26]],'#1c2727');g.restore()
    g.restore()
    // 左右立面错开层厚，屋顶有尚未脱落的悬岩，先给塌方留出视觉伏笔。
    fractureFace(g,[[29,42],[25,-62],[45,-121],[69,-141],[82,-110],[60,-52],[64,30],[57,78],[39,88]],459)
    fractureFace(g,[[28,42],[49,59],[62,91],[57,155],[69,186],[35,190],[24,123]],470,true)
    fractureFace(g,[[67,-142],[91,-175],[127,-189],[146,-169],[128,-143],[102,-126],[86,-107]],484,true)
    fractureFace(g,[[129,-182],[163,-179],[188,-155],[179,-136],[159,-143],[147,-122],[134,-144]],496)
    fractureFace(g,[[177,-155],[209,-149],[238,-103],[232,-56],[210,-75],[199,-99],[178,-125]],507,true)
    fractureFace(g,[[228,-69],[246,-35],[247,61],[232,97],[215,59],[213,-5]],521)
    fractureFace(g,[[233,75],[248,100],[251,188],[220,181],[207,143],[218,102]],533,true)
    // 破裂薄片有实际的底缘阴影与缺角，不把预落岩画成一枚完整多边形贴纸。
    g.save();g.globalAlpha=.4;polygon(g,[[101,-127],[124,-140],[146,-117],[140,-104],[115,-108]],'#26302c');g.restore()
    fractureFace(g,[[99,-144],[119,-161],[144,-154],[156,-130],[137,-114],[114,-119]],548)
    fractureFace(g,[[156,-158],[176,-144],[184,-124],[166,-110],[151,-129]],559,true)
    // 风化木架藏在岩壁内侧，木纹、磨损铜箍与露出的裂茬共同承接矿业遗迹风格。
    timber(g,77,-104,276,Math.PI/2+.014,2)
    timber(g,211,-93,266,Math.PI/2-.017,4)
    timber(g,80,-110,128,.075,2)
    timber(g,78,-32,63,-1.08,1)
    g.save();g.strokeStyle='#b5a17b';g.globalAlpha=.35;g.lineWidth=.6
    for(let i=0;i<6;i++){g.beginPath();g.moveTo(76,37+i*20);g.lineTo(77,50+i*20);g.stroke()}
    g.restore()
    for(let i=0;i<12;i++){
      const side=i%2===0,x=side?37+hash(i+1400)*26:218+hash(i+1420)*22,y=164+hash(i+1440)*35
      drawCollapseRock(g,x,y,4+hash(i+1460)*7,i+105,(hash(i+1480)-.5)*1.4)
    }
    g.save();g.globalAlpha=.18;g.fillStyle='#a09075';g.beginPath();g.ellipse(148,188,72,7,.06,0,Math.PI*2);g.fill();g.restore()
  })
  blit(g,approach)
}
export function drawCollapsedPile(g:CanvasRenderingContext2D,age:number):void{
  if(age>=2.4){
    settled??=layer(g=>{
      blit(g,groundLayer());for(const rock of COLLAPSE_ROCKS)contact(g,rock)
      timber(g,88,-207,99,.52,3);timber(g,121,54,112,-.36,2)
      for(const rock of COLLAPSE_ROCKS)drawCollapseRock(g,rock.x,rock.y,rock.r,rock.seed,rock.rotation)
      timber(g,7,248,74,-.23,1);blit(g,forkLayer(),forkBounds)
    })
    blit(g,settled);return
  }
  if(age<.65){g.save();g.globalAlpha*=1-clamp(age/.65);drawCollapseApproach(g);g.restore()}
  g.save();g.globalAlpha*=clamp(age/.8);blit(g,groundLayer());g.restore()
  for(const rock of COLLAPSE_ROCKS){
    const elapsed=age-rock.delay;if(elapsed<0)continue
    const p=clamp(elapsed/.82),drop=(1-p*p)*650
    const bounce=p===1?Math.sin(clamp((elapsed-.82)/.22)*Math.PI)*-8:0
    if(p>.65)contact(g,rock,clamp((p-.65)/.35))
    drawCollapseRock(g,rock.x+(1-p)*(hash(rock.seed+710)-.5)*30,rock.y-drop+bounce,rock.r,rock.seed,rock.rotation+(1-p)*.5)
  }
  if(age>1.1){g.save();g.globalAlpha*=clamp((age-1.1)/1.2);blit(g,forkLayer(),forkBounds);g.restore()}
}
