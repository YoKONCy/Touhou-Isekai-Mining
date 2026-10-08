import { CONFIG } from '../../config'

// 固定甲片路径只解析一次；动作由局部骨架变换驱动。
const paths = new Map<string, Path2D>()
function path(data: string): Path2D {
  let p = paths.get(data)
  if (!p) { p = new Path2D(data); paths.set(data, p) }
  return p
}

/** 每个实体单独持有显示骨架，时间来自游戏时钟，暂停时不会继续插值。 */
export interface GrimmRigMotion { clock:number; shoulder:number; elbow:number; wrist:number; left:number; leftElbow:number; lean:number; cloth:number }
export function createGrimmRigMotion():GrimmRigMotion { return {clock:-1,shoulder:-.12,elbow:.08,wrist:-.5,left:-.08,leftElbow:0,lean:0,cloth:0} }

/** 原设厚重肩胸、封闭面甲、墨绿盔缨与破败黑红披风；脚底仍为实体锚点。 */
export function drawGrimm(ctx: CanvasRenderingContext2D, x: number, y: number, clock: number, pose: 'walk'|'run'|'roll'|'slash'|'cast', progress: number, flash: number, alpha = 1, motion?:GrimmRigMotion, damageStage=1): void {
  ctx.save()
  try {
    ctx.translate(x,y);ctx.globalAlpha=alpha
    ctx.fillStyle='#040307a8';ctx.beginPath();ctx.ellipse(0,7,43,13,0,0,Math.PI*2);ctx.fill()
    ctx.scale(CONFIG.tile/48,CONFIG.tile/48)
    const moving=pose==='walk'||pose==='run'
    const gait=Math.sin(clock*(pose==='run'?18:5))
    const breath=Math.sin(clock*2.1)*.65
    const sway=Math.sin(clock*2.1-.7)
    const p=Math.max(0,Math.min(1,progress))
    const ease=(v:number)=>{v=Math.max(0,Math.min(1,v));return v*v*(3-2*v)}
    const cast=ease(p/.32),cut=ease((p-.2)/.5),settle=ease((p-.78)/.22)
    const target={
      shoulder:pose==='slash'?-.65- .3*ease(p/.2)+2.05*cut-.2*settle:pose==='run'?-.3+gait*.1:-.12,
      elbow:pose==='slash'?-.5+.95*cut:pose==='run'?-.38:pose==='cast'?.28*cast:.08,
      wrist:pose==='slash'?-.7+.42*ease((p-.3)/.42):pose==='run'?-.65:pose==='cast'?-.18:-.5,
      left:pose==='cast'?1.5*cast-.18*ease((p-.8)/.2):pose==='run'?gait*.2:-.08,
      leftElbow:pose==='cast'?-.65*cast:0,
      lean:pose==='run'?-.06:pose==='slash'?-.08+.15*cut:pose==='cast'?.025*cast:0,
      cloth:pose==='run'?-.13:pose==='slash'?-.16+.3*cut:0
    }
    const m=motion??createGrimmRigMotion()
    const dt=m.clock<0?1/60:Math.max(0,Math.min(.05,clock-m.clock));m.clock=clock
    for(const key of ['shoulder','elbow','wrist','left','leftElbow','lean','cloth'] as const){
      const rate=key==='cloth'?8:pose==='slash'?45:18
      m[key]+=(target[key]-m[key])*(1-Math.exp(-dt*rate))
    }
    // 步态以腿部推进为主，不让沉重躯干像气球一样弹跳。
    ctx.translate(0,moving?-Math.abs(gait)*(pose==='run'?2: .55):0)
    if(pose==='run')ctx.rotate(gait*.018)
    if(pose==='roll'){ctx.translate(0,-32);ctx.rotate(progress*Math.PI*2);ctx.scale(1,.82)}
    const gradient=(x0:number,y0:number,x1:number,y1:number,stops:Array<[number,string]>):CanvasGradient=>{
      const g=ctx.createLinearGradient(x0,y0,x1,y1)
      for(const [at,col] of stops)g.addColorStop(at,col)
      return g
    }
    const steel=gradient(-38,-145,40,-45,[[0,'#848b89'],[.18,'#424b50'],[.44,'#171d25'],[.68,'#39424a'],[1,'#0d1119']])
    const darkSteel=gradient(-22,-85,28,0,[[0,'#535b5e'],[.36,'#252c35'],[.7,'#131923'],[1,'#353a42']])
    const gold=gradient(-24,-130,30,-50,[[0,'#b39a63'],[.28,'#75603b'],[.62,'#33271c'],[1,'#95805a']])
    const shape=(data:string,fill:string|CanvasGradient=steel,edge=true):void=>{
      const p=path(data)
      ctx.fillStyle=fill;ctx.fill(p)
      if(edge){ctx.strokeStyle='#070910';ctx.lineWidth=1.5;ctx.lineJoin='round';ctx.stroke(p)}
      // 受击亮色叠加保留甲片明暗，而非整块替换为白色。
      if(flash>0){ctx.save();ctx.globalAlpha*=Math.min(.7,flash);ctx.fillStyle='#ffe6d4';ctx.fill(p);ctx.restore()}
    }
    const line=(data:string,col:string,width=1):void=>{
      ctx.strokeStyle=col;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke(path(data));ctx.lineCap='butt'
    }
    // 黑红厚布与血红翻折：不等长撕裂布瓣、缺口及细长残条，不做整齐锯齿。
    ctx.save();ctx.translate(sway*.8,-112);ctx.rotate(m.cloth);ctx.translate(0,112)
    const cloth=gradient(-58,-122,55,4,[[0,'#29060d'],[.35,'#140307'],[.75,'#0b0205'],[1,'#050103']])
    shape('M-35-122 Q-57-104-59-67 L-64-4-51-16-49 5-41-2-38-25-34-16-32 8-22-3-19-24-10-9 2-19 12-3 20-12 23-27 29-10 35 4 39-15 46-8 48-29 56-11 61-3 Q57-73 48-98 L34-124Z',cloth)
    shape('M-34-116 Q-53-63-51-16 L-49 5-41-2-38-25 Q-36-70-23-108Z','#410914',false)
    shape('M30-116 Q48-62 56-11 L48-29 46-8 39-15 Q30-64 22-108Z','#2b050d',false)
    shape('M-60-36 L-67 9-63 5-55-31Z','#30050e',false)
    shape('M49-45 L61-15 66 4 62-1 54-20Z','#1e0309',false)
    shape('M-9-113 Q-21-55-23 0 L-15-4 Q-6-55 1-110Z','#10060d',false)
    shape('M11-115 Q9-49 17-2 L24-7 Q16-55 21-106Z','#0c050b',false)
    line('M-28-102 Q-37-57-39-17 M26-101 Q35-63 39-21','#79403355',.8)
    ctx.restore()
    // 腿甲分为大腿、膝盖、胫甲与靴面，增加纵向比例而非缩放整个素材。
    for(const side of[-1,1]){
      ctx.save();ctx.translate(side*16,moving?side*gait*(pose==='run'?5:1.4):0);ctx.scale(1.18,.88);ctx.rotate(moving?side*gait*.045:0)
      shape('M-9-66 L9-66 8-40 0-34-9-40Z',darkSteel)
      shape('M-10-43 L0-49 11-43 9-32 0-27-10-33Z',steel)
      shape('M-8-30 L8-30 7-9 11-2-9-2-9-12Z',darkSteel)
      shape('M-9-7 L7-7 14 1 Q3 6-12 2Z','#242c35')
      shape('M-1-29 L2-29 2-9-1-5Z','#677071',false)
      line('M-8-42 L0-46 8-42 M-8-1 L7-1','#a0a49a66',.8)
      line('M-5-22 L-5-11','#060a11',1.5)
      ctx.restore()
    }
    // 肩胸恢复宽厚体量，缩短纵向比例；躯干从腰部倾转，脚底不跟着漂移。
    ctx.save();ctx.translate(0,-61+breath);ctx.rotate(m.lean);ctx.translate(0,61);ctx.scale(1.22,.92)
    shape('M-24-117 L0-123 24-117 23-91 16-77 0-71-17-78-25-94Z',steel)
    shape('M-20-112 L-3-117-2-83-15-80-20-93Z','#414a50',false)
    shape('M3-117 L20-111 19-93 13-81 2-83Z','#151b24',false)
    shape('M-2-119 L2-119 4-91 0-80-4-91Z','#7a817b',false)
    line('M-20-110 L-6-114 M-18-91 L-9-84 M5-114 L18-110','#b4b7a36b',.8)
    // 胸徽小而集中：旧金包住一枚猩红嵌石，避免全身铺金。
    shape('M0-109 L6-103 0-96-6-103Z',gold)
    shape('M0-106 L3-103 0-99-3-103Z','#821b25',false)
    line('M-15-99 L-9-102 M9-102 L15-99','#a38a5b',.65)
    shape('M-16-78 L16-78 18-70 0-66-18-71Z','#12131a')
    shape('M-5-77 L5-77 5-70-5-70Z',gold)
    shape('M-3-75 L3-75 3-72-3-72Z','#0e0c12',false)
    // 分片裙甲向下纵收，不再横向张成宽腰。
    for(const side of[-1,1]){
      ctx.save();ctx.scale(side,1)
      shape('M3-68 L17-72 23-55 17-47 7-51Z',darkSteel)
      line('M7-65 L18-65 M9-59 L20-59','#75796a55',.8)
      ctx.restore()
    }
    shape('M-5-68 L5-68 8-48 0-42-8-48Z','#242a33')
    line('M0-64 L0-47','#9b84536b',.8)
    // 引导时左肩抬臂，肘部再展开；剑臂留在低位，避免横举长剑抢占施法轮廓。
    ctx.save();ctx.translate(-35,-104);ctx.rotate(m.left)
    shape('M-9-7 L9-7 10 16 4 26-8 20-12 8Z',darkSteel)
    ctx.save();ctx.translate(0,20);ctx.rotate(m.leftElbow);ctx.translate(0,-20)
    shape('M-9 16 L6 20 6 34-3 40-11 33Z',steel)
    shape('M-11 31 L6 31 8 42 1 47-9 42Z','#1b222b')
    line('M-9 25 L4 27 M-7 35 L3 37','#8d96866b',.8)
    if(pose==='cast'){
      line('M-7 40 L-12 48 M-3 43 L-5 52 M1 42 L2 51 M5 39 L9 47','#7b8580',2)
    }
    ctx.restore();ctx.restore()
    // 原设左肩宽厚叠甲：大甲面层层压住，不能缩成独立的小圆盖。
    shape('M-21-119 Q-37-145-49-135 L-62-108-59-85-43-83-28-98Z',steel)
    shape('M-28-122 Q-40-136-48-126 L-57-108-42-99-28-108Z','#505960')
    shape('M-30-109 Q-44-113-56-117 L-62-104 Q-51-94-39-94 L-28-102Z','#39434c')
    if(damageStage<2)shape('M-34-98 L-59-104-61-92 Q-48-81-35-88 L-28-94Z','#29343e')
    else shape('M-34-98 L-49-102-43-96-48-90-36-91-28-94Z','#161b23')
    line('M-29-123 Q-41-139-49-129 M-57-111 Q-46-101-35-102 M-59-98 Q-47-89-36-91','#b2b5a483',1)
    shape(damageStage<3?'M22-120 L32-141 40-130 47-119 44-103 30-101 23-110Z':'M22-120 L30-128 32-121 37-126 47-119 44-103 30-101 23-110Z',darkSteel)
    if(damageStage<3){
      shape('M29-121 L33-135 39-125 42-114 32-110Z','#596268')
      line('M32-137 L39-126 43-117','#a9ada078',1)
    }
    // 铆钉只在结构接合处点到为止。
    ctx.fillStyle='#9a895d'
    for(const [px,py] of [[-39,-119],[-33,-105],[32,-115],[40,-108],[-17,-109],[17,-109]]){
      ctx.beginPath();ctx.arc(px,py,1,0,Math.PI*2);ctx.fill()
    }
    // 持剑骨架：常态斜垂，蓄力收剑，挥砍先蓄后爆发、末段停刀。
    ctx.save();ctx.translate(37,-100);ctx.rotate(m.shoulder)
    shape('M-8-12 L8-11 10 14 5 23-7 20-11 6Z',steel)
    ctx.save();ctx.translate(0,17);ctx.rotate(m.elbow);ctx.translate(0,-17)
    shape('M-9 15 L8 15 10 32 3 38-9 32Z',darkSteel)
    line('M-6 21 L5 21 M-5 27 L6 27','#a7ad9c66',.8)
    // 勇剑沃柏尔：黑钢直身接宽月牙回刃，保留原握点与纵向长度。
    ctx.save();ctx.translate(0,33);ctx.rotate(m.wrist)
    const blade=gradient(-11,20,12,25,[[0,'#17191b'],[.18,'#494740'],[.42,'#9b9581'],[.49,'#d2c6a5'],[.55,'#4c4940'],[.82,'#252626'],[1,'#827760']])
    shape('M-9 15 L9 15 10 84 14 96 8 111-10 114-10 96-14 92-10 88-14 84-10 80Z',blade)
    shape('M-9 17 L-6 20-6 78-10 83-7 88-8 97-7 110-10 114-10 96-14 92-10 88-14 84-10 80Z','#282a28',false)
    line('M2 20 L3 83 8 100','#d8cdb2',1.1)
    line('M-1 25 L0 80','#171a1a',1.5)
    // 月牙的内弧向握柄回卷；外刃宽实填，不能画成细钩或普通尖剑。
    const crescent=gradient(-48,104,15,138,[[0,'#363834'],[.3,'#9e9a89'],[.57,'#d1c9b2'],[.7,'#827e70'],[1,'#242724']])
    shape('M8 95 Q17 93 20 105 L18 119 Q4 141-21 141 Q-44 137-59 96 Q-38 124-12 117 Q2 112 8 95Z',crescent)
    shape('M-59 96 Q-44 137-21 141 Q4 141 18 119 L12 121 Q-6 137-23 133 Q-43 124-59 96Z','#3a3c36',false)
    line('M-55 101 Q-39 133-20 137 Q3 138 16 120','#d9ceb0',1)
    line('M-51 104 Q-30 125-11 120 Q1 115 8 100','#a49778',.9)
    // 剑尖接合处的黑钢包片与旧金环钉。
    shape('M6 94 Q16 92 20 105 L18 119 11 124 Q10 108 1 106Z','#242724')
    line('M7 96 Q16 96 18 105 M3 108 Q11 111 12 121','#a08b5b',1)
    shape('M8 101 Q13 98 16 103 Q17 108 12 110 Q7 109 8 101Z','#79623f')
    shape('M10 103 Q13 101 14 104 Q15 107 12 108 Q9 107 10 103Z','#242724',false)
    // 固定划痕与磨损，不逐帧随机生成，避免金属表面闪烁。
    line('M-5 32 L-2 29 M5 46 L8 42 M-5 61 L-2 57 M4 73 L7 70 M-32 124 L-28 119 M-21 132 L-17 126 M-7 128 L-3 121','#e0d4b14d',.65)
    line('M-7 23 L-7 35 M7 54 L7 64 M-40 117 L-34 125 M-12 133 L-8 130','#9d794969',.8)
    // 向剑身弯曲的双钩护手与中央椭圆座。
    shape('M-7 11 Q-16 3-25 7 L-28 13 Q-20 9-17 20 L-11 17 0 19 11 17 Q17 6 25 13 L23 6 Q15 1 7 11Z','#34332a')
    shape('M-11 11 Q0 5 11 11 L10 17 Q0 21-10 17Z',gold)
    line('M-25 8 Q-18 6-13 12 M13 11 Q19 5 23 8 M-9 12 Q0 8 9 12','#ba9c66',.9)
    shape('M-4-10 L4-10 4 12-4 12Z','#191815')
    line('M-4-6 L4-4 M-4-1 L4 1 M-4 4 L4 6','#a18351',1.2)
    shape('M-6-14 Q-6-21 0-22 Q7-21 7-15 Q6-9 0-9 Q-6-9-6-14Z','#302d24')
    line('M-4-17 Q0-21 4-17','#c0a16a',1)
    // 握剑手最后覆盖握柄，明确抓握关系。
    shape('M-7-3 L3-5 7-1 6 7 0 11-7 7Z','#303944')
    line('M-5 0 L3 0 M-5 3 L4 3 M-4 6 L2 7','#86918b',.75)
    if(pose==='slash'){
      ctx.save();ctx.globalCompositeOperation='lighter';ctx.globalAlpha*=Math.sin(p*Math.PI)*.65
      line('M3 25 L4 83 M-55 101 Q-39 133-20 137 Q3 138 16 120','#ff874b',1.6)
      ctx.restore()
    }
    ctx.restore();ctx.restore();ctx.restore()
    // 原设厚围领环抱下颌，宽褶面与胸甲遮压，头部嵌入甲胄而非细颈悬空。
    shape('M-25-132 Q0-120 26-133 L32-114 Q21-95 0-98 Q-21-97-32-116Z','#15161d')
    shape('M-24-126 Q0-110 25-126 L24-117 Q0-100-25-117Z','#303039',false)
    shape('M-26-115 Q-6-111 19-120 L12-106 Q-6-101-21-110Z','#23232b',false)
    line('M-23-126 Q-5-114 21-123 M-25-117 Q-9-105 14-112 M-16-107 Q0-101 15-109','#85847b70',1.2)
    // 墨绿盔缨与头壳分开：向上延伸的窄缨形成高耸轮廓。
    ctx.save();ctx.translate(sway*.55,breath*.3)
    shape('M-6-151 Q-14-174-3-189 Q8-196 13-182 Q21-166 10-145Z','#172c26')
    shape('M-2-185 Q5-184 8-171 L6-153 1-151Z','#3e5440',false)
    line('M-3-183 Q4-175 3-156 M5-188 Q13-171 8-157','#70806291',.9)
    line('M-6-179 Q-8-169-3-158','#0b1917',1.4)
    ctx.restore()
    // 更小且更长的封闭头盔：眉脊/颊片/鼻梁/下颌明确分面。
    shape('M-17-150 Q-15-165 0-168 Q15-165 17-150 L16-135 9-122 0-116-9-122-17-136Z',steel)
    shape('M-15-151 L-2-157-3-139-12-132Z','#555f63',false)
    shape('M3-157 L15-151 12-133 4-139Z','#111923',false)
    shape('M-17-146 L0-153 17-146 13-140 0-144-13-140Z','#777f78')
    shape('M-12-140 L-3-137-4-131-11-134Z','#030609',false)
    shape('M3-137 L12-140 11-134 4-131Z','#030609',false)
    shape('M-2-145 L2-145 3-124 0-118-3-125Z','#949b8c')
    shape('M-13-133 L-5-129-5-122-10-127Z','#323b43',false)
    shape('M5-129 L13-133 10-127 5-122Z','#161d28',false)
    line('M0-164 L0-156 M-14-147 L-3-151 M-11-132 L-7-130','#d1d0aa8a',.8)
    // 稳定划痕落在具体甲面上，不在空气中随机撒点。
    line('M-16-106 L-13-108 M-14-88 L-11-90 M-42-117 L-40-119 M35-126 L37-123 M9-95 L12-98','#bec0a646',.65)
    if(damageStage>=2){
      line('M-17-110 L-9-103-14-95-4-88-7-80','#050108',4)
      line('M-17-110 L-9-103-14-95-4-88-7-80','#8e1936',1)
      shape('M-24-93 L-18-99-12-92-15-85-23-84Z','#09040b',false)
    }
    if(damageStage>=3){
      shape('M4-112 L18-108 12-99 18-91 9-79 2-86 5-96Z','#08020a',false)
      line('M5-110 L10-100 7-92 12-84','#b62a47',1.2)
    }
    ctx.restore()
  } finally {
    ctx.restore()
  }
}
