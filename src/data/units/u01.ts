import type { UnitSpec } from '../builder'

export const u01: UnitSpec = {
  title: 'Hälsningar & artighet',
  description: 'Säg hej, tack och förlåt – och lär dig de fyra tonerna.',
  emoji: '👋',
  lessons: [
    {
      title: 'Hej!',
      words: [
        ['ni-hao', '你好', 'nǐ hǎo', 'hej/hallå/god dag', 'phrase', 'Två tredjetoner i rad: den första uttalas som andra ton, så det låter "ní hǎo".'],
        ['ni', '你', 'nǐ', 'du', 'pron'],
        ['hao', '好', 'hǎo', 'bra/god/okej', 'adj'],
        ['nin', '您', 'nín', 'du (artigt)/ni (artigt)', 'pron', 'Artig form av nǐ – till äldre, kunder och lärare.'],
        ['zai-jian', '再见', 'zài jiàn', 'hej då/adjö/vi ses', 'phrase'],
        ['lao-shi', '老师', 'lǎo shī', 'lärare/fröken', 'noun'],
      ],
      sentences: [
        ['nin hao', 'god dag/hej'],
        ['lao-shi hao', 'hej lärare/god dag lärare'],
        ['lao-shi , zai-jian', 'hej då lärare/adjö lärare'],
        ['ni-hao , lao-shi', 'hej lärare/god dag lärare'],
      ],
      tip: 'Pinyin är kinesiska skrivet med vårt alfabet. Strecken över vokalerna visar tonen – samma stavelse med olika ton är helt olika ord. Kinesiska elever hälsar på läraren med "lǎo shī hǎo".',
    },
    {
      title: 'De fyra tonerna',
      kind: 'tones',
      words: [
        ['ma-ma', '妈妈', 'mā ma', 'mamma', 'noun', 'Första ton: hög och rak, som när man sjunger en ton. Andra stavelsen är neutral.'],
        ['ma-hemp', '麻', 'má', 'hampa/domnad', 'noun', 'Andra ton: stiger, som när man frågar "va?". Ovanligt ord – här för att öva tonen.'],
        ['ma-horse', '马', 'mǎ', 'häst', 'noun', 'Tredje ton: låg, går ner och (om den står sist) upp igen.'],
        ['ma-scold', '骂', 'mà', 'skälla på/skälla ut', 'verb', 'Fjärde ton: faller snabbt och bestämt, som "nej!".'],
        ['ma-q', '吗', 'ma', '(frågeord)/frågepartikel', 'particle', 'Neutral ton: kort och lätt. Sätt ma sist så blir ett påstående en ja/nej-fråga.'],
      ],
      sentences: [
        ['ma-ma hao', 'hej mamma'],
        ['ma-ma , zai-jian', 'hej då mamma'],
        ['ni hao ma-q ?', 'mår du bra/hur mår du'],
        ['ma-ma ma-scold ma-horse ma-q ?', 'skäller mamma på hästen/skäller mamma ut hästen'],
      ],
      tip: 'Mandarin har fyra toner plus en neutral: 1) mā hög och rak, 2) má stigande, 3) mǎ låg och gungande, 4) mà fallande, samt ma kort och lätt. Tonsandhi: när två tredjetoner kommer efter varandra blir den första en andra ton – nǐ hǎo uttalas "ní hǎo". Pinyin skrivs ändå alltid med original­tonen.',
    },
    {
      title: 'Tack & förlåt',
      words: [
        ['xie-xie', '谢谢', 'xiè xie', 'tack', 'phrase', 'x uttalas ungefär som svenskt "sj" i sjö, men med tungan framåt. Andra stavelsen är neutral.'],
        ['bu-ke-qi', '不客气', 'bù kè qi', 'varsågod/ingen orsak/det var så lite', 'phrase', 'bù blir bú före en fjärdeton: "bú kè qi".'],
        ['dui-bu-qi', '对不起', 'duì bu qǐ', 'förlåt/ursäkta', 'phrase'],
        ['mei-guan-xi', '没关系', 'méi guān xi', 'det gör inget/ingen fara', 'phrase'],
        ['qing', '请', 'qǐng', 'var snäll och/snälla', 'verb', 'q uttalas som "tj" i tjugo, med luftpuff.'],
        ['bu-hao-yi-si', '不好意思', 'bù hǎo yì si', 'ursäkta/förlåt', 'phrase', 'Lättare än duì bu qǐ – när man tränger sig förbi eller ber om något.'],
      ],
      sentences: [
        ['xie-xie ni', 'tack ska du ha/tack'],
        ['xie-xie nin', 'tack ska du ha/tack'],
        ['xie-xie lao-shi', 'tack lärare/tack fröken'],
        ['dui-bu-qi , lao-shi', 'förlåt lärare/ursäkta lärare'],
        ['bu-hao-yi-si , lao-shi', 'ursäkta lärare/förlåt lärare'],
        ['mei-guan-xi , zai-jian', 'det gör inget hej då/ingen fara hej då'],
        ['bu-ke-qi , zai-jian', 'ingen orsak hej då/varsågod hej då'],
      ],
      tip: 'Svara på xiè xie med bù kè qi ("ingen orsak") och på duì bu qǐ med méi guān xi ("det gör inget"). Bù hǎo yì si är ett mjukt "ursäkta" som används hela tiden i vardagen.',
    },
    {
      title: 'Jag, du, hon',
      words: [
        ['wo', '我', 'wǒ', 'jag/mig', 'pron'],
        ['ta-he', '他', 'tā', 'han/honom', 'pron'],
        ['ta-she', '她', 'tā', 'hon/henne', 'pron', 'Han och hon uttalas likadant: tā.'],
        ['hen', '很', 'hěn', 'mycket/väldigt', 'adv'],
        ['ye', '也', 'yě', 'också', 'adv'],
        ['ne', '呢', 'ne', 'och … då?/än …?', 'particle', 'Frågar tillbaka: "wǒ hěn hǎo, nǐ ne?" = jag mår bra, och du?'],
        ['ni-men', '你们', 'nǐ men', 'ni', 'pron'],
      ],
      sentences: [
        ['wo hen hao', 'jag mår bra/jag mår mycket bra'],
        ['wo hen hao , ni ne ?', 'jag mår bra och du/jag mår bra än du'],
        ['ni-men hao', 'hej allihop/hej på er'],
        ['ta-she ye hen hao', 'hon mår också bra'],
        ['ta-he hao ma-q ?', 'mår han bra/hur mår han'],
        ['wo ye hen hao , xie-xie', 'jag mår också bra tack/tack jag mår också bra'],
      ],
      tip: 'Kinesiska verb och pronomen böjs aldrig: wǒ = jag/mig, tā = han/hon/honom/henne. Adjektiv som hǎo får oftast hěn framför sig – "wǒ hěn hǎo" betyder bara "jag mår bra", inte "jättebra".',
    },
    {
      title: 'Repetition: hälsningar',
      kind: 'checkpoint',
      sentences: [
        ['ni-men hao ma-q ?', 'mår ni bra/hur mår ni'],
        ['ta-he hen hao', 'han mår bra'],
        ['ma-ma ye hen hao', 'mamma mår också bra'],
        ['ni ne ?', 'och du/än du'],
        ['xie-xie ni , lao-shi', 'tack lärare/tack fröken'],
        ['ni-hao , wo hen hao', 'hej jag mår bra'],
      ],
    },
  ],
}
