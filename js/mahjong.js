/**
 * 麻将规则与常量
 */
const MahjongRules = {
  handCount: 14,
  handCountAfterDiscard: 13,
  maxCopiesPerTileType: 4,
  tileTypeCount: 34
};

/**
 * 牌名：id -> 显示名
 */
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
    results.push({
      tile: toDiscard,
      shanten: baseShanten,
      improvementTiles: improvement,
      tenpaiTiles: tenpai,
      tileCountInHand: countInHand,
      tenpaiTotalTiles: tenpaiTotal
    });
  }
  return results.sort((a, b) => a.tile.id - b.tile.id);
}

function recommended(options) {
  if (!options.length) return null;
  return options.reduce((best, opt) => {
    if (opt.shanten !== best.shanten) return opt.shanten < best.shanten ? opt : best;
    return opt.tenpaiTotalTiles > best.tenpaiTotalTiles ? opt : best;
  });
}
