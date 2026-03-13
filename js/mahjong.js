/**
 * 麻将规则与常量
 */
const MahjongRules = {
  handCount: 14,
  handCountAfterDiscard: 13,
  maxCopiesPerTileType: 4,
  tileTypeCount: 34
};

/** Unicode 麻将牌块 U+1F000：东1F000 南1F001 西1F002 北1F003 中1F004 发1F005 白1F006；万1-9: 1F007-1F00F；条1-9: 1F010-1F018；筒1-9: 1F019-1F021 */
function tileUnicode(id) {
  if (id >= 31) return String.fromCodePoint(0x1F000 + (id - 31));
  if (id <= 9) return String.fromCodePoint(0x1F007 + (id - 1));
  if (id <= 19) return String.fromCodePoint(0x1F010 + (id - 11));
  return String.fromCodePoint(0x1F019 + (id - 21));
}

/** 牌名（辅助/无障碍）：id -> 文字名 */
function tileDisplayName(id) {
  if (id >= 31) {
    const names = ['', '东', '南', '西', '北', '中', '发', '白'];
    return names[id - 30];
  }
  const n = ((id - 1) % 10) + 1;
  const suit = id <= 9 ? '万' : id <= 19 ? '条' : '筒';
  return n + suit;
}

/**
 * 麻将牌 SVG 图标 URL（来自 FluffyStuff/riichi-mahjong-tiles，MIT/CC-PDDC）
 * 使用 jsDelivr CDN 加速
 */
const TILE_ICONS_BASE = 'https://cdn.jsdelivr.net/gh/FluffyStuff/riichi-mahjong-tiles@master/Regular';
function tileSvgUrl(id) {
  if (id >= 31) {
    const names = ['Ton', 'Nan', 'Shaa', 'Pei', 'Chun', 'Hatsu', 'Haku'];
    return TILE_ICONS_BASE + '/' + names[id - 31] + '.svg';
  }
  if (id <= 9) return TILE_ICONS_BASE + '/Man' + id + '.svg';
  if (id <= 19) return TILE_ICONS_BASE + '/Sou' + (id - 10) + '.svg';
  return TILE_ICONS_BASE + '/Pin' + (id - 20) + '.svg';
}

/**
 * 34 种牌各一张（id 列表）
 */
const ALL_TILE_IDS = [
  ...Array.from({ length: 9 }, (_, i) => i + 1),
  ...Array.from({ length: 9 }, (_, i) => 11 + i),
  ...Array.from({ length: 9 }, (_, i) => 21 + i),
  ...Array.from({ length: 7 }, (_, i) => 31 + i)
];

/**
 * 向听数计算（13 张）：标准型 + 可选七对子
 */
function calculateShanten(hand, includeSevenPairs = false) {
  if (hand.length !== MahjongRules.handCountAfterDiscard) return 8;
  const counts = Array(38).fill(0);
  hand.forEach(t => { counts[t.id] = (counts[t.id] || 0) + 1; });

  const best = { mentsu: 0, tatsu: 0, atama: 0 };
  search(counts, 1, 0, 0, 0, best);

  const m = best.mentsu;
  const t = Math.min(best.tatsu, 4 - m);
  let shanten = 8 - 2 * m - t - (best.atama >= 1 ? 1 : 0);
  shanten = Math.max(0, Math.min(shanten, 8));

  if (includeSevenPairs) {
    let pairCount = 0;
    for (let i = 1; i < 38; i++) if (counts[i] >= 2) pairCount++;
    const shanten7 = Math.max(0, 6 - pairCount);
    shanten = Math.min(shanten, shanten7);
  }
  return shanten;
}

function search(c, start, mentsu, tatsu, atama, best) {
  const score = 2 * mentsu + Math.min(tatsu, 4 - mentsu) + (atama >= 1 ? 1 : 0);
  const bestScore = 2 * best.mentsu + Math.min(best.tatsu, 4 - best.mentsu) + (best.atama >= 1 ? 1 : 0);
  if (score > bestScore) {
    best.mentsu = mentsu;
    best.tatsu = tatsu;
    best.atama = atama;
  }
  for (let i = start; i < 38; i++) {
    if (!c[i]) continue;
    if (c[i] >= 3) {
      c[i] -= 3;
      search(c, i, mentsu + 1, tatsu, atama, best);
      c[i] += 3;
    }
    if (i <= 27) {
      const base = Math.floor((i - 1) / 10) * 10 + 1;
      const n = i - base + 1;
      if (n <= 7 && c[i] > 0 && c[i + 1] > 0 && c[i + 2] > 0) {
        c[i]--; c[i + 1]--; c[i + 2]--;
        search(c, i, mentsu + 1, tatsu, atama, best);
        c[i]++; c[i + 1]++; c[i + 2]++;
      }
    }
    if (c[i] >= 2 && atama === 0) {
      c[i] -= 2;
      search(c, i, mentsu, tatsu, atama + 1, best);
      c[i] += 2;
    }
    if (i <= 27) {
      const base = Math.floor((i - 1) / 10) * 10 + 1;
      const n = i - base + 1;
      if (n <= 8 && c[i] > 0 && c[i + 1] > 0) {
        c[i]--; c[i + 1]--;
        search(c, i, mentsu, tatsu + 1, atama, best);
        c[i]++; c[i + 1]++;
      }
      if (n <= 7 && c[i] > 0 && c[i + 2] > 0) {
        c[i]--; c[i + 2]--;
        search(c, i, mentsu, tatsu + 1, atama, best);
        c[i]++; c[i + 2]++;
      }
    }
  }
}

function tileCounts(hand) {
  const counts = {};
  hand.forEach(t => { counts[t.id] = (counts[t.id] || 0) + 1; });
  return counts;
}

/** 将手牌转为长度 38 的计数数组（下标 1..34 为牌型） */
function handToCounts(hand) {
  const c = Array(38).fill(0);
  hand.forEach(t => { c[t.id] = (c[t.id] || 0) + 1; });
  return c;
}

/**
 * 14 张是否和了（四面子一雀头，或可选七对子）
 * @param {Array<{id: number}>} hand - 14 张手牌
 * @param {boolean} [includeSevenPairs=false] - 是否算七对子
 */
function isAgari(hand, includeSevenPairs = false) {
  if (hand.length !== 14) return false;
  const c = handToCounts(hand);
  if (includeSevenPairs) {
    let pairs = 0;
    for (let i = 1; i < 38; i++) if (c[i] >= 2) pairs++;
    if (pairs === 7) return true;
  }
  for (let i = 1; i < 38; i++) {
    if (c[i] >= 2) {
      c[i] -= 2;
      if (canForm4Meld(c)) { c[i] += 2; return true; }
      c[i] += 2;
    }
  }
  return false;
}

/** 12 张能否组成 4 个面子（递归：尝试所有面子取法） */
function canForm4Meld(c) {
  const sum = c.reduce((a, b) => a + b, 0);
  if (sum === 0) return true;
  for (let i = 1; i < 38; i++) {
    if (c[i] >= 3) {
      c[i] -= 3;
      if (canForm4Meld(c)) { c[i] += 3; return true; }
      c[i] += 3;
    }
    if (i <= 27) {
      const base = Math.floor((i - 1) / 10) * 10 + 1;
      const n = i - base + 1;
      if (n <= 7 && c[i] > 0 && c[i + 1] > 0 && c[i + 2] > 0) {
        c[i]--; c[i + 1]--; c[i + 2]--;
        if (canForm4Meld(c)) { c[i]++; c[i + 1]++; c[i + 2]++; return true; }
        c[i]++; c[i + 1]++; c[i + 2]++;
      }
    }
  }
  return false;
}

/**
 * 13 张听牌手牌：和了总张数（可胡的牌 × 各自剩余张数）
 * countInHand: 当前 13 张中每种牌的张数
 */
function agariTilesCount(hand13, countInHand) {
  let total = 0;
  for (const drawId of ALL_TILE_IDS) {
    const withDraw = [...hand13, { id: drawId }];
    if (!isAgari(withDraw)) continue;
    const remain = MahjongRules.maxCopiesPerTileType - (countInHand[drawId] || 0);
    total += Math.max(0, remain);
  }
  return total;
}

function removeOne(hand, tile) {
  let found = false;
  return hand.filter(t => {
    if (t.id === tile.id && !found) { found = true; return false; }
    return true;
  });
}

function isHandValid(hand) {
  const counts = {};
  for (const t of hand) {
    counts[t.id] = (counts[t.id] || 0) + 1;
    if (counts[t.id] > MahjongRules.maxCopiesPerTileType) return false;
  }
  return true;
}

/**
 * 分析 14 张手牌，返回每个打牌方案
 */
function analyzeHand(hand, includeSevenPairs = false) {
  if (hand.length !== MahjongRules.handCount || !isHandValid(hand)) return [];
  const grouped = {};
  hand.forEach(t => {
    if (!grouped[t.id]) grouped[t.id] = [];
    grouped[t.id].push(t);
  });

  const results = [];
  for (const id of Object.keys(grouped).map(Number).sort((a, b) => a - b)) {
    const tiles = grouped[id];
    const toDiscard = tiles[0];
    const oneLess = removeOne(hand, toDiscard);
    if (oneLess.length !== MahjongRules.handCountAfterDiscard) continue;

    const baseShanten = calculateShanten(oneLess, includeSevenPairs);
    const improvement = [];
    const tenpai = [];
    const countInHand = tileCounts(oneLess);

    for (const drawId of ALL_TILE_IDS) {
      const draw = { id: drawId };
      const withDraw = [...oneLess, draw];
      let minShanten = 8;
      withDraw.forEach(d => {
        const after = removeOne(withDraw, d);
        const s = calculateShanten(after, includeSevenPairs);
        if (s < minShanten) minShanten = s;
      });
      if (minShanten < baseShanten) improvement.push(draw);
      if (minShanten === 0) tenpai.push(draw);
    }

    const tenpaiTotal = tenpai.reduce((sum, t) => sum + (MahjongRules.maxCopiesPerTileType - (countInHand[t.id] || 0)), 0);

    // 深一层：一向听时，上听后的「和了张数」合计，用于同水平时比较谁更好
    let tenpaiAgariSum = tenpaiTotal;
    if (baseShanten === 1 && tenpai.length > 0) {
      tenpaiAgariSum = 0;
      for (const drawT of tenpai) {
        const hand14 = [...oneLess, drawT];
        let bestAgari = 0;
        hand14.forEach(d => {
          const afterDiscard = removeOne(hand14, d);
          if (calculateShanten(afterDiscard, includeSevenPairs) !== 0) return;
          const cnt = tileCounts(afterDiscard);
          const agari = agariTilesCount(afterDiscard, cnt);
          if (agari > bestAgari) bestAgari = agari;
        });
        tenpaiAgariSum += bestAgari;
      }
    }

    // 听牌时显式和了张数（与 tenpaiTotalTiles 一致，便于展示）
    const agariCount = baseShanten === 0 ? agariTilesCount(oneLess, countInHand) : 0;

    // 多向听时：进张面总张数（摸到能改善的牌 × 剩余枚数之和），用于同向听数时的比较
    const improvementTotalTiles = improvement.reduce((sum, t) => sum + (MahjongRules.maxCopiesPerTileType - (countInHand[t.id] || 0)), 0);

    results.push({
      tile: toDiscard,
      shanten: baseShanten,
      improvementTiles: improvement,
      tenpaiTiles: tenpai,
      tileCountInHand: countInHand,
      tenpaiTotalTiles: tenpaiTotal,
      tenpaiAgariSum: tenpaiAgariSum,
      agariTilesCount: agariCount,
      improvementTotalTiles: improvementTotalTiles
    });
  }
  return results.sort((a, b) => a.tile.id - b.tile.id);
}

/**
 * 推荐打牌：从多个打牌方案中选出最优
 * 场景区分：
 * - 已听牌（shanten=0）：比和了张数，越多越优
 * - 一向听（shanten=1）：比上听总张数，再比上听后的和了张数合计
 * - 多向听（shanten≥2）：比向听数，再比进张面总张数
 */
function recommended(options) {
  if (!options.length) return null;
  return options.reduce((best, opt) => {
    if (opt.shanten !== best.shanten) return opt.shanten < best.shanten ? opt : best;
    if (opt.tenpaiTotalTiles !== best.tenpaiTotalTiles) return opt.tenpaiTotalTiles > best.tenpaiTotalTiles ? opt : best;
    const aSum = opt.tenpaiAgariSum != null ? opt.tenpaiAgariSum : 0;
    const bSum = best.tenpaiAgariSum != null ? best.tenpaiAgariSum : 0;
    if (aSum !== bSum) return aSum > bSum ? opt : best;
    // 多向听时：上听相关均为 0，用进张面总张数比较
    const aImp = opt.improvementTotalTiles != null ? opt.improvementTotalTiles : 0;
    const bImp = best.improvementTotalTiles != null ? best.improvementTotalTiles : 0;
    return aImp > bImp ? opt : best;
  });
}
