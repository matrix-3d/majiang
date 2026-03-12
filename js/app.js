(function () {
  const hand = [];
  let analysis = [];

  function suitClass(id) {
    if (id >= 31) return 'zi';
    if (id >= 21) return 'tong';
    if (id >= 11) return 'tiao';
    return 'wan';
  }

  function renderHand() {
    const area = document.getElementById('handArea');
    const countEl = document.getElementById('handCount');
    countEl.textContent = hand.length;
    area.classList.toggle('empty', hand.length === 0);

    document.getElementById('btnSort').disabled = hand.length === 0;
    document.getElementById('btnClear').disabled = hand.length === 0;

    if (hand.length === MahjongRules.handCount) runAnalysis();

    area.querySelectorAll('.hand-tile').forEach(el => el.remove());
    if (hand.length === 0) return;

    const sorted = [...hand].sort((a, b) => a.id - b.id);
    sorted.forEach((tile) => {
      const chip = document.createElement('div');
      chip.className = `tile-chip hand-tile ${suitClass(tile.id)}`;
      chip.innerHTML = '<img class="tile-img" src="' + tileSvgUrl(tile.id) + '" alt="' + tileDisplayName(tile.id) + '" title="' + tileDisplayName(tile.id) + '"><span class="remove">×</span>';
      chip.addEventListener('click', (e) => {
        e.preventDefault();
        const i = hand.indexOf(tile);
        if (i !== -1) { hand.splice(i, 1); renderHand(); refreshPickerBadges(); hideResults(); }
      });
      area.appendChild(chip);
    });
  }

  function hideResults() {
    document.getElementById('resultsSection').hidden = true;
    document.getElementById('resultsPlaceholder').classList.remove('hidden');
  }
  function showResults() {
    document.getElementById('resultsSection').hidden = false;
    document.getElementById('resultsPlaceholder').classList.add('hidden');
  }
  function removeFromHand(idx) {
    hand.splice(parseInt(idx, 10), 1);
    renderHand();
    refreshPickerBadges();
    hideResults();
  }

  function addToHand(id) {
    if (hand.length >= MahjongRules.handCount) return;
    const count = hand.filter(t => t.id === id).length;
    if (count >= MahjongRules.maxCopiesPerTileType) return;
    hand.push({ id });
    hand.sort((a, b) => a.id - b.id);
    renderHand();
    refreshPickerBadges();
  }

  function initPicker() {
    const grid = document.getElementById('pickerGrid');
    grid.innerHTML = '';
    ALL_TILE_IDS.forEach(id => {
      const wrap = document.createElement('div');
      wrap.className = 'picker-tile';
      const chip = document.createElement('div');
      chip.className = `tile-chip ${suitClass(id)}`;
      chip.innerHTML = '<img class="tile-img" src="' + tileSvgUrl(id) + '" alt="' + tileDisplayName(id) + '" title="' + tileDisplayName(id) + '">';
      chip.dataset.tileId = id;
      const badge = document.createElement('span');
      badge.className = 'badge';
      wrap.appendChild(chip);
      wrap.appendChild(badge);
      chip.addEventListener('click', () => {
        addToHand(id);
        refreshPickerBadges();
      });
      grid.appendChild(wrap);
    });
  }

  function refreshPickerBadges() {
    const grid = document.getElementById('pickerGrid');
    grid.querySelectorAll('.picker-tile').forEach((wrap, i) => {
      const id = ALL_TILE_IDS[i];
      const n = hand.filter(t => t.id === id).length;
      wrap.querySelector('.badge').textContent = n > 0 ? `×${n}` : '';
      wrap.classList.toggle('disabled', hand.length >= MahjongRules.handCount || n >= MahjongRules.maxCopiesPerTileType);
    });
  }

  function runAnalysis() {
    const includeSevenPairs = document.getElementById('includeSevenPairs').checked;
    const hand14 = hand.map(t => ({ id: t.id }));

    if (isAgari(hand14, includeSevenPairs)) {
      showResults();
      showAgariOnly();
      return;
    }

    analysis = analyzeHand(hand14, includeSevenPairs);
    const rec = recommended(analysis);
    showResults();

    const recCard = document.getElementById('recommendedCard');
    const agariCard = document.getElementById('agariOnlyCard');
    if (agariCard) agariCard.hidden = true;
    if (rec) {
      recCard.hidden = false;
      const agariCnt = rec.agariTilesCount != null ? rec.agariTilesCount : rec.tenpaiTotalTiles;
      recCard.innerHTML = `
        <span class="star">★</span>
        <div class="text">
          <strong>推荐打 <img class="tile-img tile-img-inline" src="${tileSvgUrl(rec.tile.id)}" alt="${tileDisplayName(rec.tile.id)}" title="${tileDisplayName(rec.tile.id)}"></strong>
          <small>${rec.shanten === 0 ? `已听牌，胡 ${agariCnt} 张` : `差 ${rec.shanten} 张上听，摸 ${rec.tenpaiTotalTiles} 张可上听`}</small>
        </div>
      `;
    } else {
      recCard.hidden = true;
    }

    const list = document.getElementById('resultsList');
    list.hidden = false;
    list.innerHTML = '';
    analysis.forEach(opt => {
      const isRec = rec && rec.tile.id === opt.tile.id;
      const card = document.createElement('div');
      card.className = 'result-card' + (isRec ? ' recommended' : '');
      const isTenpai = opt.shanten === 0;
      const tenpaiTotalText = opt.tenpaiTiles.length ? (isTenpai ? ` · 听 ${opt.tenpaiTotalTiles} 张` : ` · 能上听共 ${opt.tenpaiTotalTiles} 张`) : '';
      const tenpaiLabel = isTenpai ? '胡这些牌' : '摸这些牌可上听';
      card.innerHTML = `
        <div class="head">
          <span>打</span>
          <div class="tile-chip ${suitClass(opt.tile.id)}"><img class="tile-img" src="${tileSvgUrl(opt.tile.id)}" alt="${tileDisplayName(opt.tile.id)}" title="${tileDisplayName(opt.tile.id)}"></div>
          <span>→</span>
          <span class="shanten">${opt.shanten === 0 ? '已听牌' : `差 ${opt.shanten} 张上听`}</span>
          <span class="tenpai-total">${tenpaiTotalText}</span>
        </div>
        ${opt.tenpaiTiles.length ? `
          <div class="label">${tenpaiLabel}</div>
          <div class="tiles-row" id="tenpai-${opt.tile.id}"></div>
        ` : ''}
        ${getImprovementOnly(opt).length ? `
          <div class="label">摸到能改善的牌</div>
          <div class="tiles-row" id="improve-${opt.tile.id}"></div>
        ` : ''}
      `;
      list.appendChild(card);

      function addTileWithCount(containerId, tile) {
        const inHand = opt.tileCountInHand[tile.id] || 0;
        const remain = Math.max(0, MahjongRules.maxCopiesPerTileType - inHand);
        const div = document.createElement('div');
        div.className = 'tile-with-count';
        div.innerHTML = `
          <div class="tile-chip ${suitClass(tile.id)}"><img class="tile-img" src="${tileSvgUrl(tile.id)}" alt="${tileDisplayName(tile.id)}" title="${tileDisplayName(tile.id)}"></div>
          <span class="remain">剩${remain}/共${MahjongRules.maxCopiesPerTileType}</span>
        `;
        document.getElementById(containerId).appendChild(div);
      }
      if (opt.tenpaiTiles.length) {
        opt.tenpaiTiles.forEach(t => addTileWithCount(`tenpai-${opt.tile.id}`, t));
      }
      getImprovementOnly(opt).forEach(t => addTileWithCount(`improve-${opt.tile.id}`, t));
    });
  }

  function showAgariOnly() {
    const recCard = document.getElementById('recommendedCard');
    const list = document.getElementById('resultsList');
    const agariCard = document.getElementById('agariOnlyCard');
    if (recCard) recCard.hidden = true;
    if (list) { list.hidden = true; list.innerHTML = ''; }
    if (agariCard) {
      agariCard.hidden = false;
      agariCard.innerHTML = `
        <span class="agari-icon" aria-hidden="true">🀄</span>
        <div class="text">
          <strong>已和了</strong>
          <small>当前 14 张已构成和牌，无需出牌</small>
        </div>
      `;
    }
  }

  function getImprovementOnly(opt) {
    const tenpaiIds = new Set(opt.tenpaiTiles.map(t => t.id));
    return opt.improvementTiles.filter(t => !tenpaiIds.has(t.id));
  }

  document.getElementById('includeSevenPairs').addEventListener('change', () => {
    if (hand.length === MahjongRules.handCount) runAnalysis();
  });
  document.getElementById('btnSort').addEventListener('click', () => {
    hand.sort((a, b) => a.id - b.id);
    renderHand();
    refreshPickerBadges();
  });
  document.getElementById('btnClear').addEventListener('click', () => {
    hand.length = 0;
    renderHand();
    refreshPickerBadges();
    hideResults();
  });

  renderHand();
  initPicker();
})();
