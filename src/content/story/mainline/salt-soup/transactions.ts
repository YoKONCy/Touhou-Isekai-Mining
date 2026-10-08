import type { CharacterProfile } from '../../../../shared/profile'
import { SALT_SOUP_ID } from '../../../items/vanilla/ids'
import { t, itemName } from '../../../../i18n'
import { spendMaterials } from '../../../../shared/production'

export function deliverSaltSoup(c:CharacterProfile):string{
  if(!c.flagBool('recipe.saltSoup.unlocked'))return t('quest.reimu_cooking.unavailable')
  if(c.flagBool('quest.saltSoup.done'))return t('ui.camp.done')
  if(!spendMaterials(c,[[SALT_SOUP_ID,1]]))return t('quest.reimu_cooking.need_soup',{item:itemName(SALT_SOUP_ID)})
  c.setFlag('quest.saltSoup.done',true)
  return t('ui.progress.salt_delivered')
}
