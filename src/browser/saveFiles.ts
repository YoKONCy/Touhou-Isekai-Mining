import type { SaveProfile } from '../shared/profile'

/** 文件名保留记录名称与检查点时间，跨设备重复备份也能分辨。 */
export function saveFileName(profile: SaveProfile, slot: number): string {
  const label = (profile.meta.label || profile.character.name || (slot === 0 ? '自动存档' : `记录${slot}`))
    .replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g, '_').trim().slice(0, 40)
  const time = new Date(profile.meta.savedAt).toISOString().replace(/[:.]/g, '-')
  return `Touhou-Isekai-Mine_${label}_${time}.json`
}

export function downloadSaveFile(contents: string, name: string): void {
  const url = URL.createObjectURL(new Blob([contents], { type: 'application/json;charset=utf-8' }))
  const link = document.createElement('a')
  try {
    link.href = url; link.download = name; link.hidden = true
    document.body.append(link); link.click()
  } finally {
    link.remove()
    // 下载交给浏览器后再释放，避免移动浏览器尚未读取文件就失效。
    window.setTimeout(() => URL.revokeObjectURL(url), 60000)
  }
}
