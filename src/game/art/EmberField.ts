/** 世界坐标余烬组件：区域、数量、配色独立配置，时钟由场景传入。 */
interface Ember { x:number; y:number; vy:number; size:number; seed:number; freq:number; amp:number; tw:number; spr:number; base:number }
export function makeGlowSprite(rgb:string, size=40):HTMLCanvasElement {
  const cv=document.createElement('canvas');cv.width=cv.height=size
  const g=cv.getContext('2d')!,r=size/2,gradient=g.createRadialGradient(r,r,0,r,r,r)
  gradient.addColorStop(0,`rgba(${rgb},1)`);gradient.addColorStop(.25,`rgba(${rgb},.55)`)
  gradient.addColorStop(.6,`rgba(${rgb},.16)`);gradient.addColorStop(1,`rgba(${rgb},0)`)
  g.fillStyle=gradient;g.fillRect(0,0,size,size);return cv
}
export class EmberField {
  private particles:Ember[]=[]
  private sprites:HTMLCanvasElement[]=[]
  constructor(private readonly bounds:{left:number;right:number;top:number;bottom:number},private readonly count=34,private readonly colors=['255,84,42','255,142,58','255,190,104']) {}
  reset():void {
    const rand=(a:number,b:number)=>a+Math.random()*(b-a)
    const layers=[{size:[3,4.5],vy:[10,16],base:.3},{size:[5,6.5],vy:[16,24],base:.55},{size:[7,9],vy:[24,34],base:.85}]
    this.particles=[]
    for(let i=0;i<this.count;i++){
      const roll=Math.random(),q=layers[roll<.45?0:roll<.8?1:2]
      this.particles.push({x:rand(this.bounds.left,this.bounds.right),y:rand(this.bounds.top+4,this.bounds.bottom-2),vy:rand(q.vy[0],q.vy[1]),size:rand(q.size[0],q.size[1]),seed:rand(0,Math.PI*2),freq:rand(.5,1.1),amp:rand(8,22),tw:rand(2.2,4.6),spr:Math.random()<.6?0:Math.random()<.6?1:2,base:q.base})
    }
  }
  update(dt:number):void {
    for(const p of this.particles){p.y-=p.vy*dt;if(p.y<this.bounds.top){p.y=this.bounds.bottom;p.x=this.bounds.left+Math.random()*(this.bounds.right-this.bounds.left)}}
  }
  render(g:CanvasRenderingContext2D,time:number):void {
    if(!this.sprites.length)this.sprites=this.colors.map(color=>makeGlowSprite(color))
    g.save()
    try{
      g.globalCompositeOperation='lighter'
      for(const p of this.particles){
        const tw=.55+.45*Math.sin(time*p.tw+p.seed),s=p.size*(.85+.15*Math.sin(time*1.7+p.seed*2)),x=p.x+Math.sin(time*p.freq+p.seed)*p.amp
        g.globalAlpha=Math.max(0,Math.min(1,p.base*tw));g.drawImage(this.sprites[p.spr%this.sprites.length],x-s/2,p.y-s/2,s,s)
      }
    }finally{g.restore()}
  }
  dispose():void {this.particles=[];this.sprites=[]}
}
