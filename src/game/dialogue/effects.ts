/**
 * 对话效果执行器 + 具名动作注册表
 *
 * 声明式效果（flagSet/giveItem/equipSlot/heal）操作角色档案/玩家实体；
 * 'action' 效果查具名动作表——复杂演出由玩法侧注册（序章导演、未来事件、基地 NPC）。
 * 注册表是开放扩展点：加新演出不用改内核。
 */
import type { CharacterProfile } from '../../shared/profile'
import type { DialogueEffect } from './types'
import type { EquipSlot } from '../../shared/itemDefs'

/** 需要触达引擎实体的系统钩子（组合根在启动时注入实现） */
export interface SystemHooks {
  /** 给玩家回血（回复道具事件等；返回实际回复量） */
  healPlayer: (amount: number) => number
}

/** 具名动作的执行上下文（档案 + 系统钩子；演出需要更多引擎对象时在注册处闭包捕获） */
export interface ActionContext {
  profile: CharacterProfile
  hooks: SystemHooks
}

type ActionHandler = (ctx: ActionContext) => void

const actions = new Map<string, ActionHandler>()
let hooks: SystemHooks | null = null

/** 注入系统钩子（main/App 启动一次） */
export function setDialogueHooks(h: SystemHooks): void {
  hooks = h
}

/** 注册具名剧情动作（重复注册覆盖，等价资源包） */
export function registerDialogueAction(name: string, handler: ActionHandler): void {
  actions.set(name, handler)
}

/** 执行一条声明式效果 */
export function applyEffect(effect: DialogueEffect, profile: CharacterProfile): void {
  switch (effect.type) {
    case 'flagSet':
      profile.setFlag(effect.key, effect.value ?? true)
      break
    case 'giveItem':
      profile.inventory.add(effect.item, effect.qty ?? 1)
      break
    case 'equipSlot': {
      const qty = effect.qty ?? 1
      if (effect.slot.startsWith('quick')) {
        const i = Number(effect.slot.slice(5))
        if (Number.isInteger(i) && i >= 0 && i < profile.quickSlots.slots.length) {
          profile.quickSlots.set(i, { id: effect.item, qty })
        }
      } else {
        // 非 quick* 前缀即装备槽（类型联合在运行时已排除快捷槽）
        profile.equipment.set(effect.slot as EquipSlot, effect.item)
      }
      break
    }
    case 'heal':
      hooks?.healPlayer(effect.amount)
      break
    case 'action': {
      const handler = actions.get(effect.name)
      if (!handler) {
        console.warn(`[对话] 未注册的剧情动作「${effect.name}」，已忽略`)
        break
      }
      if (!hooks) {
        console.warn('[对话] 系统钩子未注入，剧情动作无法执行')
        break
      }
      handler({ profile, hooks })
      break
    }
  }
}
