// v3 picture themes. Words are reused from the course where they exist (matched by hanzi,
// they only gain an `emoji`); the rest are NEW words defined here. New words are not
// introduced in any lesson – that is allowed for theme words.
import type { Course, Theme, Word } from '../types'

/** [id, hanzi, pinyin, sv ("a/b" = primary/alternatives), emoji] — all nouns. */
type NewWord = [id: string, hanzi: string, pinyin: string, sv: string, emoji: string]

export const THEME_NEW_WORDS: NewWord[] = [
  // food
  ['xia-shrimp', '虾', 'xiā', 'räka', '🦐'],
  ['ji-rou', '鸡肉', 'jī ròu', 'kycklingkött', '🍗'],
  ['cheng-zi', '橙子', 'chéng zi', 'apelsin', '🍊'],
  ['xi-gua', '西瓜', 'xī guā', 'vattenmelon/melon', '🍉'],
  ['tu-dou', '土豆', 'tǔ dòu', 'potatis', '🥔'],
  ['xi-hong-shi', '西红柿', 'xī hóng shì', 'tomat', '🍅'],
  ['huang-gua', '黄瓜', 'huáng guā', 'gurka', '🥒'],
  ['hu-luo-bo', '胡萝卜', 'hú luó bo', 'morot', '🥕'],
  ['qi-shui', '汽水', 'qì shuǐ', 'läsk/kolsyrad dryck', '🥤'],
  ['dan-gao', '蛋糕', 'dàn gāo', 'tårta/kaka', '🍰'],
  // vehicles
  ['qi-che', '汽车', 'qì chē', 'bil', '🚗'],
  ['zi-xing-che', '自行车', 'zì xíng chē', 'cykel', '🚲'],
  ['mo-tuo-che', '摩托车', 'mó tuō chē', 'motorcykel/mc', '🏍️'],
  ['gong-gong-qi-che', '公共汽车', 'gōng gòng qì chē', 'buss', '🚌'],
  ['gao-tie', '高铁', 'gāo tiě', 'snabbtåg/höghastighetståg', '🚄'],
  ['chuan-boat', '船', 'chuán', 'båt/skepp/fartyg', '🚢'],
  ['ka-che', '卡车', 'kǎ chē', 'lastbil', '🚚'],
  ['jiu-hu-che', '救护车', 'jiù hù chē', 'ambulans', '🚑'],
  ['jing-che', '警车', 'jǐng chē', 'polisbil', '🚓'],
  ['xiao-fang-che', '消防车', 'xiāo fáng chē', 'brandbil', '🚒'],
  ['tuo-la-ji', '拖拉机', 'tuō lā jī', 'traktor', '🚜'],
  ['zhi-sheng-ji', '直升机', 'zhí shēng jī', 'helikopter', '🚁'],
  // animals
  ['xiong-mao', '熊猫', 'xióng māo', 'panda/jättepanda', '🐼'],
  ['tu-zi', '兔子', 'tù zi', 'kanin/hare', '🐰'],
  ['ma-horse', '马', 'mǎ', 'häst', '🐴'],
  ['niu-cow', '牛', 'niú', 'ko/oxe', '🐮'],
  ['zhu-pig', '猪', 'zhū', 'gris/svin', '🐷'],
  ['ji-chicken', '鸡', 'jī', 'höna/tupp', '🐔'],
  ['ya-zi', '鸭子', 'yā zi', 'anka/and', '🦆'],
  ['lao-hu', '老虎', 'lǎo hǔ', 'tiger', '🐯'],
  ['shi-zi', '狮子', 'shī zi', 'lejon', '🦁'],
  ['da-xiang', '大象', 'dà xiàng', 'elefant', '🐘'],
  ['hou-zi', '猴子', 'hóu zi', 'apa/markatta', '🐵'],
  ['chang-jing-lu', '长颈鹿', 'cháng jǐng lù', 'giraff', '🦒'],
  ['qi-e', '企鹅', 'qǐ é', 'pingvin', '🐧'],
  ['she-snake', '蛇', 'shé', 'orm', '🐍'],
  ['wu-gui', '乌龟', 'wū guī', 'sköldpadda', '🐢'],
  ['hu-die', '蝴蝶', 'hú dié', 'fjäril', '🦋'],
  // home
  ['men-door', '门', 'mén', 'dörr/port', '🚪'],
  ['chuang-hu', '窗户', 'chuāng hu', 'fönster', '🪟'],
  ['yi-zi', '椅子', 'yǐ zi', 'stol', '🪑'],
  ['chuang-bed', '床', 'chuáng', 'säng', '🛏️'],
  ['sha-fa', '沙发', 'shā fā', 'soffa', '🛋️'],
  ['deng-lamp', '灯', 'dēng', 'lampa/ljus', '💡'],
  ['pan-zi', '盘子', 'pán zi', 'tallrik/fat', '🍽️'],
  ['xie-zi', '鞋子', 'xié zi', 'sko', '👟'],
  ['yu-san', '雨伞', 'yǔ sǎn', 'paraply', '☂️'],
  ['jing-zi', '镜子', 'jìng zi', 'spegel', '🪞'],
  ['ma-tong', '马桶', 'mǎ tǒng', 'toalett/toalettstol', '🚽'],
  ['yu-gang', '浴缸', 'yù gāng', 'badkar', '🛁'],
]

/** Emoji for words that already exist in the course (matched by hanzi). */
export const THEME_EMOJI_FOR_EXISTING: Record<string, string> = {
  yu: '🐟', 'ji-dan': '🥚', 'mi-fan': '🍚', 'mian-tiao': '🍜', 'jiao-zi': '🥟', 'tang-soup': '🍲',
  'mian-bao': '🍞', 'ping-guo': '🍎', 'xiang-jiao': '🍌', shui: '💧', cha: '🍵', 'niu-nai': '🥛',
  'ka-fei': '☕', 'guo-zhi': '🧃', 'shou-si': '🍣', 'pi-jiu': '🍺',
  'huo-che': '🚂', 'di-tie': '🚇', 'fei-ji': '✈️', 'chu-zu-che': '🚕',
  mao: '🐱', gou: '🐶', niao: '🐦',
  'fang-zi': '🏠', 'dian-shi': '📺', 'shou-ji': '📱', 'dian-nao': '💻', shu: '📖', 'yao-shi': '🔑',
}

export const themes: Theme[] = [
  {
    id: 't-food',
    title: 'Mat & dryck',
    emoji: '🍜',
    words: [
      'shui', 'cha', 'niu-nai', 'ka-fei', 'ping-guo', 'xiang-jiao', 'mi-fan', 'mian-bao', 'ji-dan', 'mian-tiao',
      'jiao-zi', 'tang-soup', 'yu', 'guo-zhi', 'xi-gua', 'cheng-zi', 'tu-dou', 'xi-hong-shi', 'huang-gua', 'hu-luo-bo',
      'xia-shrimp', 'ji-rou', 'qi-shui', 'dan-gao', 'shou-si', 'pi-jiu',
    ],
  },
  {
    id: 't-vehicles',
    title: 'Fordon',
    emoji: '🚗',
    words: [
      'qi-che', 'zi-xing-che', 'gong-gong-qi-che', 'huo-che', 'fei-ji', 'chuan-boat', 'chu-zu-che', 'di-tie',
      'mo-tuo-che', 'gao-tie', 'ka-che', 'jiu-hu-che', 'jing-che', 'xiao-fang-che', 'zhi-sheng-ji', 'tuo-la-ji',
    ],
  },
  {
    id: 't-animals',
    title: 'Djur',
    emoji: '🐼',
    words: [
      'mao', 'gou', 'xiong-mao', 'tu-zi', 'ma-horse', 'niu-cow', 'zhu-pig', 'ji-chicken', 'ya-zi', 'niao',
      'yu', 'lao-hu', 'shi-zi', 'da-xiang', 'hou-zi', 'chang-jing-lu', 'qi-e', 'she-snake', 'wu-gui', 'hu-die',
    ],
  },
  {
    id: 't-home',
    title: 'Hemma',
    emoji: '🏠',
    words: [
      'fang-zi', 'men-door', 'chuang-hu', 'chuang-bed', 'yi-zi', 'sha-fa', 'deng-lamp', 'dian-shi', 'shou-ji', 'dian-nao',
      'shu', 'pan-zi', 'xie-zi', 'yao-shi', 'yu-san', 'jing-zi', 'ma-tong', 'yu-gang',
    ],
  },
]

/** Wires themes into a built course: adds new words, sets emoji on theme words. Throws on id clashes. */
export function applyThemes(base: Course): Course {
  const words: Record<string, Word> = { ...base.words }
  for (const [id, hanzi, pinyin, svRaw, emoji] of THEME_NEW_WORDS) {
    if (words[id]) throw new Error(`theme word id "${id}" already exists in the course`)
    const [sv, ...alt] = svRaw.split('/')
    const w: Word = { id, hanzi, pinyin, sv, pos: 'noun', emoji }
    if (alt.length) w.svAlt = alt
    words[id] = w
  }
  for (const [id, emoji] of Object.entries(THEME_EMOJI_FOR_EXISTING)) {
    if (!words[id]) throw new Error(`theme emoji for unknown word "${id}"`)
    words[id] = { ...words[id], emoji }
  }
  return { ...base, words, themes }
}
