import { Registry } from '../core/Registry'
import { createLangCheckpoint } from '../../i18n'
import { dialogue } from '../../game/dialogue/dialogueService'

/** 覆盖同步注册操作；脚本包仍为可信代码，不把注册回滚当作执行沙箱。 */
export function createModCheckpoint(): () => void {
  const restoreRegistries = Registry.createCheckpoint()
  const restoreLang = createLangCheckpoint()
  const restoreDialogue = dialogue.createRegistrationCheckpoint()
  return () => {
    restoreRegistries()
    restoreLang()
    restoreDialogue()
  }
}
