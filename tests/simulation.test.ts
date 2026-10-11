import test from 'node:test'
import assert from 'node:assert/strict'
import '../src/content/vanillaPack'
import { FixedStep } from '../src/core/simulation/FixedStep'
import { RandomStreams, withRandomStreams, withGenerationSeed, randomCombat, randomGeneration, randomVisual } from '../src/core/simulation/random'
import { SimulationSession, ReplayRecorder, replayHeadless, stateChecksum, sessionChecksum } from '../src/core/simulation/SimulationSession'
import { emptyCommand } from '../src/core/simulation/InputCommand'
import { SnapshotCodec } from '../src/core/simulation/snapshot'
import { InputManager } from '../src/core/InputManager'
import { ModuleManager } from '../src/core/ModuleManager'
import type { EngineContext } from '../src/core/types'
import { BattleSimulation, simulateBattle, simulationContentVersion, type BattleCommand } from '../src/game/simulation/BattleSimulation'
import { RoomRuntime } from '../src/game/cave/RoomRuntime'
import { Player } from '../src/game/Player'
import { KedamaBoss } from '../src/game/KedamaBoss'
import { GrimmBoss } from '../src/game/GrimmBoss'
import { getItemDef } from '../src/shared/itemDefs'
import * as ids from '../src/content/items/vanilla/ids'
import { simulationReadOnly } from '../src/core/simulation/persistence'
import type { StatusDefinition } from '../src/shared/statusEffects'
import { Registry } from '../src/content/core/Registry'

const clone = <T>(value:T):T => JSON.parse(JSON.stringify(value))
function battleFixture(weapon=ids.SCP127_ID, natural=false, boss=false) {
  const session=new SimulationSession(123456),battle=new BattleSimulation()
  session.run(()=>{
    battle.profile.setFlag('prologue.done',true)
    battle.profile.equipment.set('weaponA',weapon)
    battle.profile.selected=0
    battle.profile.inventory.add(ids.WOOD_ARROW_ID,300)
    battle.player=new Player(600,500)
    battle.player.setMelee(getItemDef(weapon).melee??null,weapon)
    battle.player.scp127.bind(battle.profile)
    battle.player.ammoInventory=battle.profile.inventory
    battle.player.maxHp=10000;battle.player.hp=10000
    battle.room=new RoomRuntime({id:0,sx:0,sy:0,kind:'normal',depth:1,floor:boss?4:2,exitDist:1,doors:[]},600,500,natural?undefined:{noOre:true,noProps:true,noNature:true,noFissure:true,spawns:boss?[]:[{id:'touhou:kedama',x:850,y:500}],aggressive:true},true)
    if(boss){const enemy=new KedamaBoss(950,480);enemy.beginBattle();battle.room.addEnemy(enemy);battle.room.beginBossSecondStage()}
  })
  return {session,battle}
}
function firing(tick:number):BattleCommand {
  const command=emptyCommand(tick)
  if(tick%60!==0){command.actionsDown=['attack'];command.down=['Mouse0']}
  if(tick%60===1){command.actionsPressed=['attack'];command.pressed=['Mouse0']}
  if(tick%60===0){command.actionsReleased=['attack'];command.released=['Mouse0']}
  command.worldPointer={x:950,y:480}
  return command
}
function advance(session:SimulationSession,battle:BattleSimulation,count:number) {
  for(let i=0;i<count;i++)session.step(()=>battle.update(FixedStep.DT,firing(session.tick)))
}

test('60、144、240Hz 运行十秒得到相同逻辑步数',()=>{
  for(const hz of [60,144,240]){
    const fixed=new FixedStep();let ticks=0
    for(let i=0;i<hz*10;i++)fixed.advance(1/hz,()=>{ticks++;return true})
    assert.equal(ticks,600)
  }
})
test('积压限幅、时间缩放和停止步不会补算旧时间',()=>{
  const fixed=new FixedStep();let ticks=0
  assert.equal(fixed.advance(30,()=>{ticks++;return true}),8)
  assert.ok(fixed.droppedTime>29)
  fixed.reset();fixed.timeScale=.5
  for(let i=0;i<60;i++)fixed.advance(1/60,()=>{ticks++;return true})
  assert.equal(ticks,38)
  fixed.advance(.1,()=>false);assert.equal(fixed.alpha,0)
})
test('随机流可以恢复，视觉随机不影响战斗，房间种子独立',()=>{
  const a=new RandomStreams(9),b=new RandomStreams(9)
  withRandomStreams(a,()=>{for(let i=0;i<300;i++)randomVisual()})
  assert.equal(withRandomStreams(a,randomCombat),withRandomStreams(b,randomCombat))
  const saved=a.snapshot(),next=a.next('loot');a.restore(saved);assert.equal(a.next('loot'),next)
  const room=()=>withGenerationSeed(6,()=>Array.from({length:20},randomGeneration))
  const first=room();a.next('generation');assert.deepEqual(room(),first)
})
test('输入跨零步帧保留，一次边沿只消费一个逻辑步',()=>{
  const input=new InputManager(),device=input as any
  device.onKeyDown({code:'KeyD',preventDefault(){}})
  input.captureFrame();input.endFrame();input.captureFrame()
  const first=input.beginTick(1);assert.ok(first.actionsPressed.includes('moveRight'));input.endTick()
  const second=input.beginTick(2);assert.equal(second.actionsPressed.length,0);assert.ok(second.actionsDown.includes('moveRight'));input.endTick()
  device.onKeyUp({code:'KeyD'});input.captureFrame()
  assert.ok(input.beginTick(3).actionsReleased.includes('moveRight'));input.endTick()
})
test('同帧快速点按仍保留按下和松开，恢复录像的世界指针',()=>{
  const input=new InputManager(),device=input as any
  device.onMouseDown({button:0});device.onMouseUp({button:0});input.captureFrame()
  const tap=input.beginTick(1);assert.ok(tap.actionsPressed.includes('attack'));assert.ok(tap.actionsReleased.includes('attack'));assert.equal(tap.actionsDown.includes('attack'),false);input.endTick()
  input.setCommandSource(()=>({...emptyCommand(2),worldPointer:{x:101,y:202}}));input.beginTick(2)
  assert.deepEqual(input.resolveWorldPointer(0,0),{x:101,y:202});input.endTick()
})
test('快照保留集合、无穷数、实体身份，拒绝不兼容字段',()=>{
  const entity={entityId:'a'},codec=new SnapshotCodec();codec.add(entity)
  const source={hits:new Set([entity]),timer:Infinity,values:new Float32Array([1,2])}
  const target={hits:new Set(),timer:0,values:new Float32Array()}
  codec.restore(target,clone(codec.capture(source)))
  assert.ok(target.hits.has(entity));assert.equal(target.timer,Infinity);assert.deepEqual([...target.values],[1,2])
  assert.throws(()=>codec.restore(target,{missing:1}),/不兼容/)
})

for(const weapon of [ids.SCP127_ID,ids.WOOD_BOW_ID,ids.TSUKINAGA_AI_TAROT_ID,ids.DUAL_BLADES_ID,ids.NUNCHAKU_ID,ids.DOOMSDAY_ID]) {
  test(`${weapon} 实际战斗快照经 JSON 恢复并继续得到相同结果`,()=>{
    const {session,battle}=battleFixture(weapon)
    advance(session,battle,70)
    const state=clone(battle.snapshot()),timing=clone(session.snapshot())
    const restored=new BattleSimulation();session.run(()=>restored.restore(state));session.restore(timing)
    assert.equal(stateChecksum(restored.snapshot()),stateChecksum(state),'恢复后状态应完全一致')
    advance(session,battle,120)
    const expected=battle.snapshot(),expectedTiming=session.snapshot()
    const actual=simulateBattle(state,timing,120,tick=>firing(tick))
    assert.equal(stateChecksum(actual.state),stateChecksum(expected),'恢复后战斗不能偏离')
    assert.equal(sessionChecksum(actual.session),sessionChecksum(expectedTiming),'恢复后不能额外消耗玩法随机流或实体编号')
  })
}
test('随机矿洞资源、采集物、碰撞物和敌人可以恢复',()=>{
  const {session,battle}=battleFixture(ids.SCP127_ID,true)
  advance(session,battle,15)
  const initial=clone(battle.snapshot()),timing=clone(session.snapshot())
  const restored=new BattleSimulation();session.run(()=>restored.restore(initial));session.restore(timing)
  assert.equal(stateChecksum(restored.snapshot()),stateChecksum(initial))
  advance(session,battle,180)
  assert.equal(stateChecksum(simulateBattle(initial,timing,180,tick=>firing(tick)).state),stateChecksum(battle.snapshot()))
})
test('毛玉酱二阶段护卫、技能和弹幕恢复后继续一致',()=>{
  const {session,battle}=battleFixture(ids.SCP127_ID,false,true)
  advance(session,battle,250)
  const initial=clone(battle.snapshot()),timing=clone(session.snapshot())
  advance(session,battle,600)
  const actual=simulateBattle(initial,timing,600,tick=>firing(tick))
  assert.equal(stateChecksum(actual.state),stateChecksum(battle.snapshot()))
  assert.equal(sessionChecksum(actual.session),sessionChecksum(session.snapshot()))
})
test('格林实体引用、专属弹幕与状态可以恢复并推进',()=>{
  const {session,battle}=battleFixture()
  session.run(()=>{for(const enemy of battle.room.snapshotEnemies)battle.room.removeStoryEnemy(enemy);battle.room.addEnemy(new GrimmBoss(950,500))})
  advance(session,battle,300)
  const state=clone(battle.snapshot()),timing=clone(session.snapshot())
  advance(session,battle,300)
  assert.equal(stateChecksum(simulateBattle(state,timing,300,tick=>firing(tick)).state),stateChecksum(battle.snapshot()))
})
test('带定时回复的状态恢复后仍绑定当前角色',()=>{
  const {session,battle}=battleFixture()
  const healing:StatusDefinition={id:'测试:回复',kind:'buff',nameKey:'测试',descriptionKey:'测试',icon:'',duration:5,interval:.2,onTick:({owner})=>owner.heal(55)}
  new Registry<StatusDefinition>('测试状态').register(healing)
  battle.player.hp=100
  battle.player.effects.add(healing,'测试状态',5)
  advance(session,battle,90)
  const state=clone(battle.snapshot()),timing=clone(session.snapshot())
  advance(session,battle,120)
  const restored=simulateBattle(state,timing,120,tick=>firing(tick))
  assert.equal(stateChecksum(restored.state),stateChecksum(battle.snapshot()))
  assert.ok(battle.player.hp>100,'状态应确实回复生命，而非空状态的往返')
})
test('录制实际战斗可无头回放，检查点偏离会拒绝',()=>{
  const {session,battle}=battleFixture(),recorder=new ReplayRecorder<ReturnType<BattleSimulation['snapshot']>>()
  const content=simulationContentVersion();recorder.start(battle.snapshot(),session.snapshot(),content)
  for(let i=0;i<180;i++){
    const command=firing(session.tick+1)
    session.step(()=>battle.update(FixedStep.DT,command));recorder.record(command)
    if(i%30===29)recorder.checkpoint(battle.snapshot(),session.snapshot())
  }
  const replay=clone(recorder.finish()!)
  assert.equal(replayHeadless(replay,content,new BattleSimulation()).checksum,stateChecksum(battle.snapshot()))
  replay.checkpoints[0]!.checksum='bad'
  assert.throws(()=>replayHeadless(replay,content,new BattleSimulation()),/偏离/)
  assert.equal(simulationReadOnly(),false)
})
test('绘制骨骼姿态不应改变玩法快照和录像校验',()=>{
  const {session,battle}=battleFixture()
  advance(session,battle,25)
  const before=battle.snapshot()
  ;(battle.player as any).animator.build(battle.player.facing)
  assert.equal(stateChecksum(battle.snapshot()),stateChecksum(before))
})

function managerFixture() {
  const input=new InputManager(),manager=new ModuleManager();let hitStop=0
  const engine:EngineContext={input,viewW:1000,viewH:800,shakeAmount:0,hitStop:t=>{hitStop=t},shake(){},worldDt:dt=>dt,captureTiming:()=>({hitStop}),restoreTiming:state=>{hitStop=state.hitStop}}
  const module={id:'测试',value:0,steps:0,profile:0,onEnter(){},onExit(){},render(){},
    update(dt:number,engine:EngineContext){this.steps++;this.value+=dt;if(engine.input.actionPressed('attack'))this.value+=1},
    captureSimulation(){return {value:this.value,steps:this.steps,profile:this.profile}},
    captureInputState(){return this.captureSimulation()},
    restoreSimulation(state:any){if(state.invalid)throw new Error('非法测试快照');Object.assign(this,state)}}
  manager.enter(engine);manager.register(module);manager.switchTo(module.id)
  const frame=(dt=FixedStep.DT)=>{manager.update(dt,engine);input.endFrame()}
  frame()
  return {manager,input,engine,module,frame}
}
test('统一暂停冻结玩法、恢复首帧丢弃后台时间',()=>{
  const {manager,module,frame}=managerFixture()
  frame();const before=manager.captureSimulation()
  manager.setPaused('背包',true);manager.setPaused('后台',true)
  for(let i=0;i<100;i++)frame(1)
  assert.equal(module.steps,1);assert.equal(manager.clock.time,before.time)
  manager.setPaused('背包',false);frame(100);assert.equal(module.steps,1)
  manager.setPaused('后台',false);frame(100);assert.equal(module.steps,1)
  frame();assert.equal(module.steps,2)
})
test('SCP-127 的补弹与武器冷却在背包暂停期间冻结',()=>{
  const {session,battle}=battleFixture(),input=new InputManager(),manager=new ModuleManager()
  const engine:EngineContext={input,viewW:1000,viewH:800,shakeAmount:0,hitStop(){},shake(){},worldDt:dt=>dt}
  let fire=true
  const module={id:'战斗计时测试',onEnter(){},onExit(){},render(){},update(dt:number){battle.update(dt,fire?firing(manager.simulation.tick):emptyCommand(manager.simulation.tick))}}
  manager.simulation=session;manager.enter(engine);manager.register(module);manager.switchTo(module.id)
  manager.update(FixedStep.DT,engine)
  for(let i=0;i<60;i++)manager.update(FixedStep.DT,engine)
  assert.ok(battle.profile.livingGun.ammo<60)
  fire=false;manager.setPaused('背包',true)
  const before=battle.snapshot()
  for(let i=0;i<100;i++)manager.update(1,engine)
  assert.equal(stateChecksum(battle.snapshot()),stateChecksum(before))
  manager.setPaused('背包',false);manager.update(100,engine)
  assert.equal(stateChecksum(battle.snapshot()),stateChecksum(before))
  for(let i=0;i<301;i++)manager.update(FixedStep.DT,engine)
  assert.equal(battle.profile.livingGun.ammo,Number((before.profile.livingGun as any).fields.ammo)+3)
})
test('管理器录像包含外部修改，回放结束恢复原状态且不保留只读锁',()=>{
  const {manager,module,frame,input}=managerFixture()
  manager.startRecording()
  for(let i=0;i<400;i++){
    if(i===150)module.profile=8
    if(i===180){(input as any).onMouseDown({button:0});(input as any).onMouseUp({button:0})}
    frame()
  }
  const replay=clone(manager.finishRecording()!),recorded=module.captureSimulation()
  assert.equal(replay.commands.length,400);assert.ok(replay.commands.some(c=>c.external))
  module.value=123;module.profile=99
  const before=manager.captureSimulation();let failure:unknown
  manager.onReplayError=error=>{failure=error}
  manager.playReplay(replay)
  for(let i=0;i<400;i++)frame()
  assert.equal(failure,undefined)
  assert.deepEqual(module.captureSimulation(),recorded)
  frame();assert.equal(manager.replaying,false);assert.deepEqual(manager.captureSimulation(),before);assert.equal(simulationReadOnly(),false)
})
test('导入失败回滚，版本不兼容拒绝',()=>{
  const {manager,frame}=managerFixture();frame()
  const before=manager.captureSimulation(),bad=clone(before);bad.state={invalid:true}
  assert.throws(()=>manager.restoreSimulation(bad),/非法测试快照/)
  assert.deepEqual(manager.captureSimulation(),before)
  bad.contentVersion='不同版本';assert.throws(()=>manager.restoreSimulation(bad),/不兼容/)
})
