/**
 * MC Mod 式 i18n 内核（零依赖自研，不引入 vue-i18n 等三方库）
 *
 * 约定（对标 Minecraft 资源包/Mod 语言文件）：
 * - 语言载体 = JSON 扁平键值表，语言码沿用 MC 命名：zh_cn / en_us / ja_jp …
 * - 官方内容的语言文件在 src/content/vanilla/lang/；每个 MOD 自带 mods/<id>/lang/，
 *   加载时注册合并（后注册的包可覆盖先注册的同名键，等价资源包覆写）
 * - 内容名键约定：`<种类>.<全限定内容id>.name`（描述再加 .desc），
 *   例：item.touhou:ore_copper.name / item.sample:lucky_coin.name
 * - 插值占位用 {name} 形式：t('ui.x', { n: 3 })
 * - 缺键回退链：当前语言 → zh_cn → 键名字本身（任何残缺翻译都不会炸 UI）
 *
 * 当前仅提供 zh_cn 全量中文；切到其他语言只需再丢一份对应 JSON 并 setLang()。
 */
import { ref } from 'vue'
import { keymap, keyLabel, MOUSE_LEFT, MOUSE_RIGHT, type ActionId } from '../core/keymap'

export type LangCode = string
export type I18nParams = Record<string, string | number>

/** 兜底语言：任何语言缺失的键都回退到这里 */
export const FALLBACK_LANG: LangCode = 'zh_cn'

/** 当前语言（ref：组件内 t() 读取它即建立响应式依赖，setLang 后全局自动重渲） */
export const currentLang = ref<LangCode>(FALLBACK_LANG)
let playerNameProvider:()=>string=()=>''
/** 名字由当前档案提供，普通台词中的第一人称不参与替换。 */
export function setPlayerNameProvider(provider:()=>string):void{playerNameProvider=provider}

/** 各语言词条表（合并存储；同一语言可被官方包 + 多个 MOD 多次注册） */
const messages = new Map<LangCode, Record<string, string>>()
const messageSources = new Map<LangCode, Record<string, string | undefined>>()

/** 开发期缺键告警去重（刷缺失只报一次，不刷屏） */
const missingWarned = new Set<string>()

/**
 * 注册一份语言词条（合并进对应语言；后注册覆盖同名键）
 * @param lang 语言码，如 'zh_cn'
 * @param entries 扁平键值表
 */
export function registerLang(lang: LangCode, entries: Record<string, string>, source?: string): void {
  messages.set(lang, { ...(messages.get(lang) ?? {}), ...entries })
  messageSources.set(lang,{...(messageSources.get(lang)??{}),...Object.fromEntries(Object.keys(entries).map(key=>[key,source]))})
}

/** 保存语言资源注册状态；包失败时恢复原词条，避免覆盖官方或其他包的文案。 */
export function createLangCheckpoint(): () => void {
  const previous = new Map(messages)
  const previousSources = new Map(messageSources)
  const lang = currentLang.value
  return () => {
    messages.clear()
    for (const [code, entries] of previous) messages.set(code, entries)
    messageSources.clear()
    for (const [code, entries] of previousSources) messageSources.set(code, entries)
    currentLang.value = lang
  }
}

/** 切换语言（Vue 侧立即生效；Canvas 等非响应式调用点在下一帧自然取到新值） */
export function setLang(lang: LangCode): void {
  currentLang.value = lang
}

export function getLang(): LangCode {
  return currentLang.value
}

export function hasLang(lang: LangCode): boolean {
  return messages.has(lang)
}

/** 某键在当前语言（或兜底语言）是否有翻译 */
export function hasKey(key: string): boolean {
  return key in (messages.get(currentLang.value) ?? {}) || key in (messages.get(FALLBACK_LANG) ?? {})
}

function rawLookup(lang: LangCode, key: string): string | undefined {
  return messages.get(lang)?.[key]
}

export interface TextSource {key:string;value:string;language:LangCode;source:string|null}
/** 查询未插值的原文及其实际来源，遵循与 t() 相同的语言回退和覆盖规则。 */
export function findTextSource(key:string,lang:LangCode=currentLang.value):TextSource|undefined{
  const language=rawLookup(lang,key)!==undefined?lang:FALLBACK_LANG,value=rawLookup(language,key)
  return value===undefined?undefined:{key,value,language,source:messageSources.get(language)?.[key]??null}
}
/** 按台词片段或文案键检索来源，用于定位剧情、NPC 对白和界面文案。 */
export function searchText(query:string,limit=50):TextSource[]{
  const needle=query.trim().toLocaleLowerCase()
  if(!needle)return []
  const entries={...messages.get(FALLBACK_LANG),...messages.get(currentLang.value)},results:TextSource[]=[]
  const cap=Number.isFinite(limit)?Math.max(1,Math.min(200,Math.floor(limit))):50
  for(const [key,value]of Object.entries(entries)){
    if(key.toLocaleLowerCase().includes(needle)||value.toLocaleLowerCase().includes(needle))results.push(findTextSource(key)!)
    if(results.length>=cap)break
  }
  return results
}

/**
 * 翻译主入口
 * @param key 语言键
 * @param params 插值参数（{name} → params.name）
 */
export function t(key: string, params?: I18nParams): string {
  // 读 ref 建立响应式依赖（非组件环境调用同样安全，只是不触发重渲）
  const lang = currentLang.value
  let raw = rawLookup(lang, key)
  if (raw === undefined && lang !== FALLBACK_LANG) raw = rawLookup(FALLBACK_LANG, key)
  if (raw === undefined) {
    if (import.meta.env.DEV && !missingWarned.has(key)) {
      missingWarned.add(key)
      console.warn(`[i18n] 缺少语言键：${key}（语言 ${lang}）`)
    }
    return key
  }
  raw = raw.replace(/\{([^{}]+)\}/g, (m, name: string) => {
    if(params&&Object.hasOwn(params,name))return String(params[name])
    if(name==='主角')return playerNameProvider().trim()||rawLookup(lang,'story.player.default_name')||rawLookup(FALLBACK_LANG,'story.player.default_name')||'我'
    return m
  })
  return raw
}

/** Canvas 等纯文字提示解析实际绑定；教程仍保留原始记号交给键帽组件绘制。 */
export function formatKeyBindings(text:string):string{
  return text.replace(/\{key:([a-zA-Z0-9_]+)\}/g,(marker,action:string)=>{
    if(!Object.hasOwn(keymap.bindings,action))return marker
    const token=keymap.primary(action as ActionId)
    if(token===MOUSE_LEFT)return t('ui.key.mouse_left')
    if(token===MOUSE_RIGHT)return t('ui.key.mouse_right')
    return token?keyLabel(token):t('ui.key.unbound')
  })
}

/* ---------------- 内容名速查（种类.全限定id.name/.desc） ---------------- */

export type ContentKind =
  | 'item'
  | 'enemy'
  | 'mineral'
  | 'prop'
  | 'projectile'
  | 'biome'

/** 通用内容词条：`<kind>.<id>.<field>` */
export function contentText(kind: ContentKind, id: string, field = 'name'): string {
  return t(`${kind}.${id}.${field}`)
}

export const itemName = (id: string): string => contentText('item', id)
export const itemDesc = (id: string): string => contentText('item', id, 'desc')
export const enemyName = (id: string): string => contentText('enemy', id)
export const mineralName = (id: string): string => contentText('mineral', id)
export const propName = (id: string): string => contentText('prop', id)
export const projectileName = (id: string): string => contentText('projectile', id)
export const biomeName = (id: string): string => contentText('biome', id)
