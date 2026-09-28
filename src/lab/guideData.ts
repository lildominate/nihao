// OWNER: Speech/Lab agent. Content for "Uttalsguide" (pinyin chart). Swedish explanations.
import type { Tone } from '../types'

export interface GuideSound {
  symbol: string
  /** example syllable in pinyin */
  example: string
  /** one hanzi for TTS */
  hanzi: string
  /** Swedish gloss of the example */
  meaning: string
  /** short Swedish pronunciation hint */
  sv: string
  tricky?: boolean
}

export interface GuideGroup { title: string; items: GuideSound[] }

const s = (symbol: string, example: string, hanzi: string, meaning: string, sv: string, tricky = false): GuideSound =>
  ({ symbol, example, hanzi, meaning, sv, tricky })

export const initialGroups: GuideGroup[] = [
  { title: 'Läppar', items: [
    s('b', 'bā', '八', 'åtta', 'Som ett mjukt p – utan luftpuff (som p:et i "spel").'),
    s('p', 'pà', '怕', 'vara rädd', 'Som p med en tydlig luftpuff.'),
    s('m', 'mā', '妈', 'mamma', 'Som svenskt m.'),
    s('f', 'fēi', '飞', 'flyga', 'Som svenskt f.'),
  ] },
  { title: 'Tungspetsen', items: [
    s('d', 'dà', '大', 'stor', 'Som ett mjukt t – utan luftpuff (som t:et i "stor").'),
    s('t', 'tā', '他', 'han', 'Som t med en tydlig luftpuff.'),
    s('n', 'nǐ', '你', 'du', 'Som svenskt n.'),
    s('l', 'lái', '来', 'komma', 'Som svenskt l.'),
  ] },
  { title: 'Bak i munnen', items: [
    s('g', 'gē', '哥', 'storebror', 'Som ett mjukt k – utan luftpuff.'),
    s('k', 'kàn', '看', 'titta', 'Som k med en tydlig luftpuff.'),
    s('h', 'hǎo', '好', 'bra', 'Raspigare än svenskt h, nästan som "ch" i tyskans "Bach".'),
  ] },
  { title: 'Platt tunga (le!)', items: [
    s('j', 'jī', '鸡', 'höna', 'Ett mjukt "tj" utan luft – tungspetsen bakom nedre framtänderna, läpparna i ett leende. Inte engelskt j!', true),
    s('q', 'qī', '七', 'sju', 'Som j men med en kraftig luftpuff: ungefär "tjh". Aldrig som k!', true),
    s('x', 'xī', '西', 'väster', 'Ett ljust, mjukt sje-ljud – som "tj" i "tjugo" med tungan platt och ett brett leende.', true),
  ] },
  { title: 'Bakåtböjd tunga', items: [
    s('zh', 'zhōng', '中', 'mitten', 'Böj tungspetsen bakåt mot gommen och säg ett kort, ostämt "dsj" – som sh men med ett t-slag först.', true),
    s('ch', 'chī', '吃', 'äta', 'Som zh men med en kraftig luftpuff.', true),
    s('sh', 'shì', '是', 'vara', 'Som "rs" i svenska "fors" eller "kors" – tungan bakåtböjd.', true),
    s('r', 'rì', '日', 'dag/sol', 'Som sh men tonande, med surr – ungefär som "r" i engelska "run". Aldrig rullande!', true),
  ] },
  { title: 'Tänderna', items: [
    s('z', 'zài', '在', 'finnas i', 'Som "ds" i "godsak" – ostämt, utan luft.', true),
    s('c', 'cài', '菜', 'maträtt', 'Som "ts" i "plats" + en luftpuff. Aldrig som k eller s!', true),
    s('s', 'sì', '四', 'fyra', 'Som svenskt s.'),
  ] },
  { title: 'Halvvokaler', items: [
    s('y', 'yī', '一', 'ett', 'Som svenskt j. "yu" uttalas som svenskt y.'),
    s('w', 'wǒ', '我', 'jag', 'Som engelskt w – ett kort u-ljud.'),
  ] },
]

export const guideInitials: GuideSound[] = initialGroups.flatMap((g) => g.items)

export const finalGroups: GuideGroup[] = [
  { title: 'Enkla vokaler', items: [
    s('a', 'ā', '啊', 'ah', 'Som ett öppet svenskt a.'),
    s('o', 'wǒ', '我', 'jag', 'Som "wo" – ett kort u glider in i o.'),
    s('e', 'è', '饿', 'hungrig', 'Inte svenskt e! Ett ljud långt bak i munnen – säg "ö" med orundade läppar, ungefär som engelskt "uh".', true),
    s('i', 'yī', '衣', 'kläder', 'Som svenskt i. (Men se -i efter z c s zh ch sh r!)'),
    s('u', 'wǔ', '五', 'fem', 'Som svenskt o i "sko".'),
    s('ü', 'yú', '鱼', 'fisk', 'Som svenskt y! Efter j, q, x och y skrivs ü bara som u: ju, qu, xu, yu = y-ljud.', true),
    s('er', 'èr', '二', 'två', 'Ett "ö" med tungan bakåtböjd, som amerikanskt "are".', true),
  ] },
  { title: 'Dubbelvokaler', items: [
    s('ai', 'ài', '爱', 'älska', 'Som "aj".'),
    s('ei', 'běi', '北', 'norr', 'Som "ej" i "hej".'),
    s('ao', 'hǎo', '好', 'bra', 'Som "ao" – nästan "ao" i "kaos".'),
    s('ou', 'gǒu', '狗', 'hund', 'Som "åo" – ett o som glider mot u.'),
  ] },
  { title: 'Nasaler', items: [
    s('an', 'sān', '三', 'tre', 'a + n, tungan fram.'),
    s('en', 'rén', '人', 'människa', 'Ett kort, dovt "ön".'),
    s('ang', 'máng', '忙', 'upptagen', 'a + ng som i "lång".'),
    s('eng', 'lěng', '冷', 'kall', 'Dovt "öng".'),
    s('ong', 'dōng', '东', 'öster', 'Som "ong" med o som i "sko".'),
  ] },
  { title: 'Med i-', items: [
    s('ia', 'jiā', '家', 'hem', 'Som "ja".'),
    s('ie', 'xiè', '谢', 'tacka', 'Som "je" i "jet".'),
    s('iao', 'xiǎo', '小', 'liten', 'Som "jao".'),
    s('iu', 'liù', '六', 'sex', 'Egentligen "iou": "ljoo".', true),
    s('ian', 'tiān', '天', 'himmel/dag', 'Uttalas "jän" – a:et blir nästan ett ä!', true),
    s('in', 'xīn', '心', 'hjärta', 'Som "in".'),
    s('iang', 'xiǎng', '想', 'vilja/tänka', 'Som "jang".'),
    s('ing', 'tīng', '听', 'lyssna', 'Som "ing" i "ring".'),
    s('iong', 'xióng', '熊', 'björn', 'Som "jong".'),
  ] },
  { title: 'Med u-', items: [
    s('ua', 'huā', '花', 'blomma', 'Som "wa".'),
    s('uo', 'duō', '多', 'många', 'Som "wo".'),
    s('uai', 'kuài', '快', 'snabb', 'Som "waj".'),
    s('ui', 'duì', '对', 'rätt', 'Egentligen "uei": "wej".', true),
    s('uan', 'wǎn', '晚', 'sen/kväll', 'Som "wan". (Efter j q x y: "yän"!)'),
    s('un', 'chūn', '春', 'vår', 'Som "won". (Efter j q x y: "yn"!)'),
    s('uang', 'huáng', '黄', 'gul', 'Som "wang".'),
  ] },
  { title: 'Med ü-', items: [
    s('üe', 'xué', '学', 'studera', 'y + e: "yä". Skrivs "ue" efter j q x y.', true),
    s('üan', 'yuǎn', '远', 'långt bort', 'y + än: "yän".', true),
    s('ün', 'yún', '云', 'moln', 'Som "yn".', true),
  ] },
]

export const guideFinals: GuideSound[] = finalGroups.flatMap((g) => g.items)

/** Longer explanations of the sounds Swedes find hardest. */
export const trickyNotes: { title: string; hanzi: string; example: string; text: string }[] = [
  { title: 'j, q, x – le när du säger dem', hanzi: '鸡七西', example: 'jī qī xī',
    text: 'Tungspetsen vilar bakom de nedre framtänderna och tungryggen trycks mot gommen. Läpparna är breda, som i ett leende. j = mjukt "tj" utan luft, q = samma med luftpuff, x = ett ljust sje-ljud. Efter dem kommer alltid i eller ü.' },
  { title: 'zh, ch, sh, r – böj tungan bakåt', hanzi: '中吃是日', example: 'zhōng chī shì rì',
    text: 'Svenska har redan ljudet: "rs" i "fors" är nästan exakt sh. Böj tungspetsen bakåt på samma sätt för zh (ostämt "dsj"), ch (samma + luft) och r (tonande sh, aldrig rullande).' },
  { title: 'ü – det är bara svenskt y', hanzi: '鱼女绿', example: 'yú nǚ lǜ',
    text: 'Svenskar har tur: ü är vårt y. Efter j, q, x och y skrivs prickarna inte ut – "qù" och "xué" har också y-ljud. Bara efter n och l syns prickarna: nǚ, lǜ.' },
  { title: '-i efter z, c, s – inget i-ljud', hanzi: '字次四', example: 'zì cì sì',
    text: 'Här är i:et bara ett surrande förlängt konsonantljud. sì låter ungefär som ett långt "sss" med röst, inte "si".' },
  { title: '-i efter zh, ch, sh, r – ett surr', hanzi: '知吃十日', example: 'zhī chī shí rì',
    text: 'Samma sak med bakåtböjd tunga: shì låter nästan som "shr". Säg sh och låt rösten fortsätta utan att flytta tungan.' },
  { title: 'b/p, d/t, g/k – luften gör skillnaden', hanzi: '八怕大他', example: 'bā pà dà tā',
    text: 'I kinesiska skiljer luftpuffen, inte tonen i rösten. b, d, g låter som svenska p, t, k efter s (spel, stor, skal). p, t, k har kraftig luft – håll handen framför munnen och känn.' },
]

export interface ToneGuide { tone: Tone; name: string; mark: string; example: string; hanzi: string; meaning: string; sv: string }

export const TONES_GUIDE: ToneGuide[] = [
  { tone: 1, name: 'Första tonen', mark: 'ˉ', example: 'mā', hanzi: '妈', meaning: 'mamma', sv: 'Hög och rak, som när du sjunger en ton. Håll den!' },
  { tone: 2, name: 'Andra tonen', mark: 'ˊ', example: 'má', hanzi: '麻', meaning: 'hampa', sv: 'Stiger från mitten till högt, som när du frågar "va?"' },
  { tone: 3, name: 'Tredje tonen', mark: 'ˇ', example: 'mǎ', hanzi: '马', meaning: 'häst', sv: 'Låg. Går ner i botten av rösten (ofta lite knarrigt) och upp igen om den står sist.' },
  { tone: 4, name: 'Fjärde tonen', mark: 'ˋ', example: 'mà', hanzi: '骂', meaning: 'skälla', sv: 'Faller snabbt från högt till lågt, som ett bestämt "Nej!"' },
  { tone: 5, name: 'Neutral ton', mark: '', example: 'ma', hanzi: '吗', meaning: '(frågeord)', sv: 'Kort och lätt, utan eget tonfall. Skrivs utan tecken.' },
]

export const SANDHI_RULES: { title: string; text: string; example: string; hanzi: string; said: string }[] = [
  { title: 'Två tredjetoner i rad', text: 'Den första blir en andra ton (stigande).', example: 'nǐ hǎo', hanzi: '你好', said: 'ní hǎo' },
  { title: 'Tredje ton före andra toner', text: 'Mitt i en fras går trean bara ner – den kommer aldrig upp igen. Låg och kort.', example: 'hěn máng', hanzi: '很忙', said: 'hěn (bara låg) máng' },
  { title: '不 bù före fjärde ton', text: 'bù blir bú före en fjärde ton.', example: 'bù shì', hanzi: '不是', said: 'bú shì' },
  { title: '一 yī före fjärde ton', text: 'yī blir yí före en fjärde ton …', example: 'yī gè', hanzi: '一个', said: 'yí ge' },
  { title: '一 yī före andra toner', text: '… och yì före första, andra och tredje ton. Ensam eller i siffror: yī.', example: 'yī tiān', hanzi: '一天', said: 'yì tiān' },
]
