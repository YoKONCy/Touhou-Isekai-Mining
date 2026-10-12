import zhCn from './vanilla/lang/zh_cn.json'
import commonZhCn from './story/lang/zh_cn.json'
import { registerLang } from '../i18n'

/** 首页提前取得界面与角色称呼，不因此导入怪物、武器、美术或剧情导演。 */
registerLang('zh_cn', zhCn, 'src/content/vanilla/lang/zh_cn.json')
registerLang('zh_cn', commonZhCn, 'src/content/story/lang/zh_cn.json')
