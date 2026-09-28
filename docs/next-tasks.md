# Next tasks (queued 2026-09-28)

## 1. Fact-check fixes — confirmed by the lead + ChatGPT review (units 1–10)
Apply only confirmed fixes; never change ids. Add a regression test for each.

| File | Issue | Fix |
|---|---|---|
| u01.ts | `wo hen hao , ni ne ?` accepts "jag mår bra än du" (än = than — wrong Swedish) | Remove the "än du" variants (also in `ni ne ?`). Keep "…och du", "…och du då", "…hur mår du". |
| u01.ts | 对不起 note says literally "kan inte möta din blick" as fact | Mark it as a memory hook ("Minnesknep: …"), or drop it. Meaning stays förlåt/ursäkta. |
| u02.ts (jiao) + u02/u05 zh/ch notes | j and zh both described as Swedish "dj"; ch compared with "tj" in *tjugo* (Swedish tj = [ɕ], wrong) | Separate descriptions: j = tongue tip down behind the lower teeth, soft; zh = tongue tip curled up to the roof of the mouth, no puff of air; ch = like zh but with a strong puff of air; q = like j with a puff of air. Say Swedish comparisons are only rough. |
| u04.ts | 丈夫 glossed "man/make/äkta man" | "make/man" (make first). |
| u04.ts | 和 "binder bara ihop substantiv" | "Binder främst ihop substantiv (du och jag) – inte hela meningar." |

Still to do: a full review of units 1–15 (ChatGPT only saw 1–10), plus the new small-talk/food content.

## 2. Restaurangrusch (game) — menu draft from ChatGPT
Check against course.words and reuse existing words. Pinyin must follow OUR convention: base tones, no written sandhi (yī fèn, bù yào — ChatGPT wrote yí/bú).

Dishes and drinks: 炒饭 chǎo fàn · 米饭 mǐ fàn · 面条 miàn tiáo · 炒面 chǎo miàn · 饺子 jiǎo zi · 馄饨汤 hún tún tāng · 包子 bāo zi · 小笼包 xiǎo lóng bāo · 春卷 chūn juǎn · 北京烤鸭 Běi jīng kǎo yā · 宫保鸡丁 gōng bǎo jī dīng · 鸡肉饭 jī ròu fàn · 牛肉面 niú ròu miàn · 麻婆豆腐 má pó dòu fu · 糖醋里脊 táng cù lǐ jǐ · 红烧肉 hóng shāo ròu · 番茄炒蛋 fān qié chǎo dàn · 炒青菜 chǎo qīng cài · 清蒸鱼 qīng zhēng yú · 火锅 huǒ guō · 米粉 mǐ fěn · 肉夹馍 ròu jiā mó · 沙拉 shā lā · 蛋花汤 dàn huā tāng · 水 shuǐ · 茶 chá · 绿茶 lǜ chá · 奶茶 nǎi chá · 豆浆 dòu jiāng · 橙汁 chéng zhī

Customer orders: wǒ yào chǎo fàn · wǒ yào yī fèn jiǎo zi · wǒ yào niú ròu miàn · qǐng gěi wǒ liǎng bēi nǎi chá · bù yào là jiāo · bù yào tài là · kě yǐ gěi wǒ shuǐ ma? · wǒ yào gōng bǎo jī dīng hé mǐ fàn · qǐng gěi wǒ men zhàng dān (more common: mǎi dān) · hěn hǎo chī!

Game idea: you are the chef; a customer orders in Chinese (audio + pinyin); tap the ingredients or dish to serve before a patience timer runs out; serving correctly earns tips and XP.
