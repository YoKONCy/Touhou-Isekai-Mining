import type { EnemyDef, EnemyAppearanceView } from '../types'
import { POISON_GRASS_ID } from '../../items/vanilla/ids'
import { VENOM_PLANT_BULLET_ID } from '../../projectiles/vanilla/venomPlantBullet'

function drawPlant(v:EnemyAppearanceView){
  const {ctx:g,x,y,phase}=v
  g.save();g.translate(x,y);g.lineJoin='round'
  const leaf=(dx:number,dy:number,a:number,s:number)=>{g.save();g.translate(dx,dy);g.rotate(a);g.scale(s,s);g.beginPath();g.moveTo(0,0);g.lineTo(6,-5);g.lineTo(4,-10);g.lineTo(11,-12);g.lineTo(6,-17);g.lineTo(9,-23);g.lineTo(0,-29);g.lineTo(-5,-18);g.lineTo(-3,-11);g.lineTo(-7,-7);g.closePath();const p=g.createLinearGradient(-7,0,10,-25);p.addColorStop(0,'#344c30');p.addColorStop(1,'#809453');g.fillStyle=p;g.fill();g.strokeStyle='#28372b';g.lineWidth=1.1;g.stroke();g.strokeStyle='#a4b57380';g.lineWidth=.8;g.beginPath();g.moveTo(0,0);g.quadraticCurveTo(2,-11,0,-25);g.stroke();g.restore()}
  g.strokeStyle='#5d5339';g.lineWidth=2.8;for(let i=0;i<5;i++){g.beginPath();g.moveTo(0,6);g.quadraticCurveTo((i-2)*5,12,(i-2)*9,9+Math.sin(i)*4);g.stroke()}
  leaf(-3,5,-1.0,.75);leaf(3,4,1.1,.8);leaf(0,7,-.2,.65)
  const a=v.pounceAngle,mx=Math.cos(a)*15,my=-22+Math.sin(a)*7,w=v.windupProgress
  g.strokeStyle='#293d2d';g.lineWidth=11;g.beginPath();g.moveTo(0,6);g.bezierCurveTo(-5,-8,-7,-19,mx,my);g.stroke();g.strokeStyle='#6f8750';g.lineWidth=7;g.stroke();g.strokeStyle='#a7b57470';g.lineWidth=1.2;g.beginPath();g.moveTo(-2,4);g.quadraticCurveTo(-7,-15,mx-2,my-2);g.stroke()
  leaf(-3,-8,-1.25,.6);leaf(0,-14,.95,.55)
  g.save();g.translate(mx,my);g.rotate(a);g.scale(1+w*.15,1+w*.12);const tube=g.createLinearGradient(-10,-9,10,9);tube.addColorStop(0,'#849754');tube.addColorStop(1,'#405c36');g.fillStyle=tube;g.strokeStyle='#2b3c2c';g.lineWidth=1.2;g.beginPath();g.moveTo(-12,-6);g.quadraticCurveTo(-4,-12,7,-10);g.lineTo(11,-4);g.lineTo(9,8);g.quadraticCurveTo(-3,11,-12,5);g.closePath();g.fill();g.stroke();g.fillStyle='#a0b16a';g.beginPath();g.ellipse(8,0,4.8,10,0,0,Math.PI*2);g.fill();g.fillStyle='#243b27';g.beginPath();g.ellipse(9,0,3.3,7.2,0,0,Math.PI*2);g.fill();g.fillStyle='#819b4c';g.beginPath();g.ellipse(9,4,2.4,2,0,0,Math.PI*2);g.fill();g.strokeStyle='#bdc98780';g.lineWidth=.7;g.beginPath();g.moveTo(-8,-5);g.lineTo(3,-7);g.stroke();g.restore()
  g.fillStyle='#a8ba66';g.beginPath();g.ellipse(mx+Math.cos(a)*9,my+8+Math.sin(phase)*1.2,1.3,2.3,0,0,Math.PI*2);g.fill()
  if(v.flash>0){g.globalAlpha*=v.flash/.12*.32;g.fillStyle='#e7ecc9';g.beginPath();g.ellipse(0,-9,10,20,0,0,Math.PI*2);g.fill()}
  g.restore()
}
const def:EnemyDef={id:'touhou:venom_plant',ai:'stationary_shooter',movement:'stationary',hp:80,radius:16,exp:10,
  combat:{contactDamage:0,attackCd:1,contactPad:0,knockback:0,recoil:0,stunResist:1},palette:{body:'#73894c',edge:'#2f452e',death:'#8ca25a',hpBar:'#a8b972'},hitMaterial:'venom',
  turret:{sight:600,interval:.8,windup:.14,burstChance:.2,burstCount:4,burstGap:.07,projectileId:VENOM_PLANT_BULLET_ID},
  spawn: { maxFloor: 3,weight:.4,minFloor:3,rooms:['normal','exit']},drops:[{item:POISON_GRASS_ID,chance:.5,qty:1}],
  visual:{render:drawPlant,fastHop:false,antennae:false},tags:['plant','ranged','venom']}
export default def
