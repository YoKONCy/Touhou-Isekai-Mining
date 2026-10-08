/**
 * BSP 楼层生成器（真·二分空间分割）
 *
 * 流程：
 * 1. 在槽位网格（默认 8×6）上递归二分矩形区域，叶子数落在 8~12
 * 2. 每个叶子矩形中心安放一个房间节点
 * 3. 自底向上回溯分割树：每个内部节点在两个子树之间开一扇门
 *    （选贴分割线、投影轴最对齐的两片叶子），保证全层连通无孤岛
 * 4. 在近邻分区间补回路，部分楼层偏向产生同墙多门
 * 5. 随机选取内侧入口，再用 BFS 标定最远撤离房与死胡同奖励房
 */
import { CONFIG } from '../../config'
import { oppositeDir, type Dir, type DoorDef, type FloorPlan, type RoomDef } from './types'

interface BspNode {
  x: number
  y: number
  w: number
  h: number
  left: BspNode | null
  right: BspNode | null
  roomId: number | null
}

function randInt(lo: number, hi: number): number {
  return lo + Math.floor(Math.random() * (hi - lo + 1))
}

/** 矩形在 minLeaf 约束下经 guillotine 切分最多能产出的叶数（可达上界） */
function leafCap(w: number, h: number, minW: number, minH: number): number {
  return Math.floor(w / minW) * Math.floor(h / minH)
}

/** 构造尚无房间的叶子节点 */
function mkNode(x: number, y: number, w: number, h: number): BspNode {
  return { x, y, w, h, left: null, right: null, roomId: null }
}

function collectLeaves(root: BspNode): BspNode[] {
  const out: BspNode[] = []
  const stack = [root]
  while (stack.length) {
    const n = stack.pop()!
    if (n.left && n.right) {
      stack.push(n.left, n.right)
    } else {
      out.push(n)
    }
  }
  return out
}

export function generateFloorPlan(): FloorPlan {
  const d = CONFIG.dungeon
  const target = randInt(d.roomsMin, d.roomsMax)
  const preferBranching = Math.random() < d.sameWallDoorBias

  const root: BspNode = { x: 0, y: 0, w: d.slotCols, h: d.slotRows, left: null, right: null, roomId: null }
  let leaves = [root]

  // —— ① 递归二分：枚举所有（叶 × 方向 × 切点），容量感知评分 ——
  // 关键不变量：每刀之后，全体叶子的"剩余可切刀数容量"必须 ≥ 还需刀数，
  // 否则必然提前切死（旧贪心按面积优先会切出 6~7 间的废层）。
  while (leaves.length < target) {
    const need = target - leaves.length // 含本刀在内还差几刀
    let best: { node: BspNode; vertical: boolean; at: number; score: number } | null = null

    for (const node of leaves) {
      // 该叶之外全体叶子的剩余可切刀数容量
      let outerCap = 0
      for (const o of leaves) {
        if (o !== node) outerCap += leafCap(o.w, o.h, d.minLeafW, d.minLeafH) - 1
      }
      const capNode = leafCap(node.w, node.h, d.minLeafW, d.minLeafH)

      const consider = (vertical: boolean): void => {
        const size = vertical ? node.w : node.h
        const min = vertical ? d.minLeafW : d.minLeafH
        if (size < min * 2) return
        for (let at = min; at <= size - min; at++) {
          const lw = vertical ? at : node.w
          const lh = vertical ? node.h : at
          const rw = vertical ? node.w - at : node.w
          const rh = vertical ? node.h : node.h - at
          const cL = leafCap(lw, lh, d.minLeafW, d.minLeafH)
          const cR = leafCap(rw, rh, d.minLeafW, d.minLeafH)
          // 本刀之后全局还能再切多少刀
          const restCap = outerCap + (cL - 1) + (cR - 1)
          if (restCap < need - 1) continue
          // 保持足够叶数容量；倾向分支的楼层允许更多非均衡切点，形成错位邻区。
          const balance = Math.min(cL, cR)
          const waste = cL + cR - capNode // 恒 ≤ 0，等于 0 为无损切分
          const score = preferBranching
            ? balance * 3 + waste * 3 + Math.random() * 22
            : balance * 10 + waste * 100 + Math.random() * 1.5
          if (!best || score > best.score) best = { node, vertical, at, score }
        }
      }
      consider(true)
      consider(false)
    }

    // best 在 consider 闭包内赋值，外层控制流不会收窄，需显式断言
    const choice = best as { node: BspNode; vertical: boolean; at: number; score: number } | null
    if (!choice) break
    const { node, vertical, at } = choice
    if (vertical) {
      node.left = mkNode(node.x, node.y, at, node.h)
      node.right = mkNode(node.x + at, node.y, node.w - at, node.h)
    } else {
      node.left = mkNode(node.x, node.y, node.w, at)
      node.right = mkNode(node.x, node.y + at, node.w, node.h - at)
    }
    leaves = collectLeaves(root)
  }

  // —— ② 叶子 → 房间槽位点 ——
  const used = new Set<string>()
  const rooms: RoomDef[] = []
  leaves.forEach((leaf, i) => {
    let cx = leaf.x + Math.floor(leaf.w / 2)
    let cy = leaf.y + Math.floor(leaf.h / 2)
    if (used.has(`${cx},${cy}`)) {
      // 理论上兄弟矩形中心不重合；极端情况下在叶内另找空槽
      let found = false
      for (let dx = 0; dx < leaf.w && !found; dx++) {
        for (let dy = 0; dy < leaf.h && !found; dy++) {
          const tx = leaf.x + dx
          const ty = leaf.y + dy
          if (!used.has(`${tx},${ty}`)) {
            cx = tx
            cy = ty
            found = true
          }
        }
      }
    }
    used.add(`${cx},${cy}`)
    leaf.roomId = i
    rooms.push({ id: i, sx: cx, sy: cy, kind: 'normal', depth: 0, exitDist: 0, doors: [] })
  })
  const roomById = new Map(rooms.map((r) => [r.id, r]))

  // —— ③ 回溯分割树连接子树 ——
  const doors: DoorDef[] = []
  const edgeSet = new Set<string>()
  let doorSeq = 0

  function directionBetween(a: RoomDef, b: RoomDef, axis?: 'x' | 'y'): Dir {
    const dx=b.sx-a.sx,dy=b.sy-a.sy
    return axis==='x'||!axis&&Math.abs(dx)>=Math.abs(dy) ? dx>=0?'E':'W' : dy>=0?'S':'N'
  }

  function addDoor(aId: number, bId: number, shortcut = false, axis?: 'x' | 'y'): boolean {
    const key = aId < bId ? `${aId}>${bId}` : `${bId}>${aId}`
    if (edgeSet.has(key)) return false
    edgeSet.add(key)
    const ra = roomById.get(aId)!
    const rb = roomById.get(bId)!
    const dirA = directionBetween(ra,rb,axis)
    const dirB = oppositeDir(dirA)
    // 单墙至多三门，保证短墙也能留出完整门框和通行间隔。
    if (shortcut && (ra.doors.filter(d => d.dir === dirA).length >= 3 || rb.doors.filter(d => d.dir === dirB).length >= 3)) {
      edgeSet.delete(key)
      return false
    }
    const id = doorSeq++
    doors.push({ id, a: aId, b: bId, dirA, dirB })
    ra.doors.push({ doorId: id, dir: dirA })
    rb.doors.push({ doorId: id, dir: dirB })
    return true
  }

  function connectSubtrees(L: BspNode[], R: BspNode[], vertical: boolean): void {
    let bestA: BspNode | null = null
    let bestB: BspNode | null = null
    let bestScore = Infinity
    for (const a of L) {
      for (const b of R) {
        const ra = roomById.get(a.roomId!)!
        const rb = roomById.get(b.roomId!)!
        // 投影轴对齐度高权重，槽位间距低权重（逻辑连接不受距离限制，只是选最优对）
        const align = vertical ? Math.abs(ra.sy - rb.sy) : Math.abs(ra.sx - rb.sx)
        const gap = vertical ? Math.abs(rb.sx - ra.sx) : Math.abs(rb.sy - ra.sy)
        const score = align * 8 + gap
        if (score < bestScore) {
          bestScore = score
          bestA = a
          bestB = b
        }
      }
    }
    if (bestA && bestB) addDoor(bestA.roomId!, bestB.roomId!, false, vertical ? 'x' : 'y')
  }

  const walk = (n: BspNode): BspNode[] => {
    if (!n.left || !n.right) return [n]
    const L = walk(n.left)
    const R = walk(n.right)
    // 左叶保持全高 ⇒ 竖切线；左叶保持全宽 ⇒ 横切线
    const vertical = n.left.h === n.h
    connectSubtrees(L, R, vertical)
    return [...L, ...R]
  }
  walk(root)

  // —— ④ 枚举共享边界的邻区，补横向与纵向回路，不再碰运气抽两个房间。 ——
  const candidates: Array<{a:number;b:number;score:number;axis:'x'|'y'}> = []
  for(let i=0;i<leaves.length;i++)for(let j=i+1;j<leaves.length;j++){
    const a=leaves[i],b=leaves[j]
    const sharedX=(a.x+a.w===b.x||b.x+b.w===a.x)&&Math.min(a.y+a.h,b.y+b.h)>Math.max(a.y,b.y)
    const sharedY=(a.y+a.h===b.y||b.y+b.h===a.y)&&Math.min(a.x+a.w,b.x+b.w)>Math.max(a.x,b.x)
    if(sharedX||sharedY)candidates.push({a:a.roomId!,b:b.roomId!,score:Math.random(),axis:sharedX?'x':'y'})
  }
  let loops=0
  const loopTarget=Math.max(d.extraLoopMax,Math.ceil(rooms.length/3))
  // 每补一条回路就重新评分，优先把单门变双门，并分散到不同房间。
  while(loops<loopTarget&&candidates.length){
    let best=-1,bestScore=Infinity
    for(let i=0;i<candidates.length;i++){
      const c=candidates[i]!,key=c.a<c.b?`${c.a}>${c.b}`:`${c.b}>${c.a}`
      if(edgeSet.has(key))continue
      const a=roomById.get(c.a)!,b=roomById.get(c.b)!,dir=directionBetween(a,b,c.axis)
      const na=a.doors.filter(d=>d.dir===dir).length,nb=b.doors.filter(d=>d.dir===oppositeDir(dir)).length
      if(na>=3||nb>=3)continue
      const bonus=preferBranching?((na===1?.8:0)+(nb===1?.8:0)):0
      const score=c.score-bonus
      if(score<bestScore){best=i;bestScore=score}
    }
    if(best<0)break
    const c=candidates.splice(best,1)[0]!
    if(addDoor(c.a,c.b,true,c.axis))loops++
  }
  // 同墙门按对端空间坐标排序，左右/上下位置与地图方位一致。
  for(const r of rooms)r.doors.sort((a,b)=>{
    if(a.dir!==b.dir)return a.dir.localeCompare(b.dir)
    const da=doors[a.doorId],db=doors[b.doorId]
    const ra=roomById.get(da.a===r.id?da.b:da.a)!,rb=roomById.get(db.a===r.id?db.b:db.a)!
    return a.dir==='N'||a.dir==='S'?ra.sx-rb.sx:ra.sy-rb.sy
  })

  // —— ⑤ BFS 深度 + 房间角色标定 ——
  const adj = new Map<number, number[]>()
  const link = (u: number, v: number): void => {
    if (!adj.has(u)) adj.set(u, [])
    adj.get(u)!.push(v)
  }
  for (const door of doors) {
    link(door.a, door.b)
    link(door.b, door.a)
  }

  // 入口优先落在内部，让上、下、左、右都能成为初始探索方向。
  const minX=Math.min(...rooms.map(r=>r.sx)),maxX=Math.max(...rooms.map(r=>r.sx))
  const minY=Math.min(...rooms.map(r=>r.sy)),maxY=Math.max(...rooms.map(r=>r.sy))
  let entrancePool=rooms.filter(r=>r.sx>minX&&r.sx<maxX&&r.sy>minY&&r.sy<maxY)
  if(!entrancePool.length){
    // 两排等布局没有完全内侧房间时，从最靠近地图中心的一圈随机选取。
    const cx=(d.slotCols-1)/2,cy=(d.slotRows-1)/2
    const distance=(r:RoomDef)=>Math.abs(r.sx-cx)+Math.abs(r.sy-cy)
    const nearest=Math.min(...rooms.map(distance))
    entrancePool=rooms.filter(r=>distance(r)===nearest)
  }
  const directionCount=(r:RoomDef)=>new Set(r.doors.map(door=>door.dir)).size
  const mostDirections=Math.max(...entrancePool.map(directionCount))
  entrancePool=entrancePool.filter(r=>directionCount(r)===mostDirections)
  const startId=entrancePool[randInt(0,entrancePool.length-1)].id

  // BFS 深度
  const depthOf = new Map<number, number>([[startId, 0]])
  const queue = [startId]
  while (queue.length) {
    const cur = queue.shift()!
    const nd = depthOf.get(cur)! + 1
    for (const nb of adj.get(cur) ?? []) {
      if (depthOf.has(nb)) continue
      depthOf.set(nb, nd)
      queue.push(nb)
    }
  }
  for (const r of rooms) r.depth = depthOf.get(r.id) ?? 0

  // 末间：BFS 最远（并列随机挑一个，避免每次固定角落）
  let maxDepth = 0
  for (const r of rooms) maxDepth = Math.max(maxDepth, r.depth)
  const far = rooms.filter((r) => r.depth === maxDepth)
  const exitId = far[randInt(0, far.length - 1)].id

  for (const r of rooms) {
    if (r.id === startId) r.kind = 'start'
    else if (r.id === exitId) r.kind = 'exit'
    else if (r.doors.length === 1) r.kind = 'reward'
  }

  // 距撤离点 BFS：越接近裂隙房的房间，刷怪权重范围越大（压力在撤离方向递增）
  const exitDistOf = new Map<number, number>([[exitId, 0]])
  const eq = [exitId]
  while (eq.length) {
    const cur = eq.shift()!
    const nd = exitDistOf.get(cur)! + 1
    for (const nb of adj.get(cur) ?? []) {
      if (exitDistOf.has(nb)) continue
      exitDistOf.set(nb, nd)
      eq.push(nb)
    }
  }
  for (const r of rooms) r.exitDist = exitDistOf.get(r.id) ?? 0

  // 槽位图（小地图用；存 id+1，0 表示空槽）
  const slots = new Int16Array(d.slotCols * d.slotRows)
  for (const r of rooms) slots[r.sy * d.slotCols + r.sx] = r.id + 1

  return { slotCols: d.slotCols, slotRows: d.slotRows, slots, rooms, doors, startId, exitId }
}

/** 沿一扇门找到对端房间 id */
export function otherRoom(plan: FloorPlan, doorId: number, fromRoom: number): number {
  const door = plan.doors.find((x) => x.id === doorId)!
  return door.a === fromRoom ? door.b : door.a
}

/** 取某房间某扇门在本房的朝向 */
export function doorDirOf(room: RoomDef, doorId: number): Dir {
  return room.doors.find((x) => x.doorId === doorId)!.dir
}
