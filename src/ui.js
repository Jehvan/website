// Screens: title, camp (road map, hero, bag, shop), results, pause. Plain DOM, innerHTML + event delegation.
import {
  CLASSES, STAGES, VAULT, SLOTS, SLOT_LABEL, AFFIXES, MAX_POTIONS, POTION_PRICE, BAG_SIZE, xpToNext, MAX_LEVEL, INTRO_TEXT, ENDING_TEXT, stageById,
} from './data.js';
import { heroStats, itemTotals, itemSellValue, rarityOf, describeAffix } from './items.js';
import { icon, slotIcon } from './icons.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (v) => (Math.round(v * 100) / 100).toString();

export function createUI(root, api) {
  const state = { tab: 'map', sel: null, bagSel: null, floor: 1, view: 'none' };
  const wide = matchMedia('(min-width: 900px)');
  wide.addEventListener?.('change', () => { if (state.view === 'camp') showCamp(); });

  const save = () => api.save();

  /* ---------- title ---------- */
  function showTitle() {
    state.view = 'title';
    const s = save();
    root.className = 'screen title';
    root.innerHTML = `
      <div class="title-wrap">
        <div class="logo"><small>An original tale of the road</small><h1>Highkeep<br><span>Road</span></h1></div>
        <p class="story">${esc(INTRO_TEXT)}</p>
        ${s ? `<button class="btn big primary" data-a="continue">Continue <small>Level ${s.level} ${CLASSES[s.cls].name} &middot; Power ${heroStats(s).power}</small></button>` : ''}
        <h3 class="pick">${s ? 'Or begin a new hero' : 'Choose your class'}</h3>
        <div class="cards">
          ${Object.values(CLASSES).map((c) => `
            <button class="card" data-a="new" data-cls="${c.id}">
              <img class="emblem" src="${icon(c.id, 96)}" alt="">
              <h4>${c.name}</h4>
              <p>${esc(c.blurb)}</p>
              <ul><li>HP ${c.hp}</li><li>MP ${c.mp}</li><li>Dmg ${c.damage}</li><li>Spd ${c.speed}</li></ul>
              <div class="skl">${c.skills.map((k) => `<img src="${icon(k.id, 36)}" title="${esc(k.name)} (Lv ${k.unlock})" alt="${esc(k.name)}">`).join('')}</div>
            </button>`).join('')}
        </div>
        <p class="hint">WASD move &middot; mouse aim &middot; click / Space attack &middot; 1 2 3 skills &middot; F potion &middot; Esc pause</p>
      </div>`;
  }

  /* ---------- camp ---------- */
  function nextStageId(s) { return Math.min(6, s.cleared + 1); }

  function mapSVG(s) {
    const W = 1000, H = 560;
    const pts = [...STAGES.map((st) => st.node), VAULT.node].map(([x, y]) => [x * W, y * H]);
    const start = [-20, pts[0][1] + 40];
    const all = [start, ...pts.slice(0, 6)];
    let d = `M ${all[0][0]} ${all[0][1]}`;
    for (let i = 0; i < all.length - 1; i++) {
      const p0 = all[Math.max(0, i - 1)], p1 = all[i], p2 = all[i + 1], p3 = all[Math.min(all.length - 1, i + 2)];
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`;
    }
    const v = pts[6], h = pts[5];
    const vault = `M ${h[0]} ${h[1]} Q ${(h[0] + v[0]) / 2 + 20} ${(h[1] + v[1]) / 2 + 30}, ${v[0]} ${v[1]}`;
    let deco = '';
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 46; i++) {
      const x = rnd() * W, y = rnd() * H;
      if (pts.some(([px, py]) => Math.hypot(px - x, py - y) < 70)) continue;
      const k = rnd();
      deco += k < 0.6
        ? `<g transform="translate(${x} ${y}) scale(${0.6 + rnd() * 0.6})" opacity=".55"><path d="M0 0 L-8 16 L8 16Z" fill="#5a6a38"/><path d="M0 -8 L-7 8 L7 8Z" fill="#6a7a42"/><rect x="-1.5" y="16" width="3" height="5" fill="#5a4026"/></g>`
        : `<path transform="translate(${x} ${y}) scale(${0.8 + rnd()})" d="M-18 8 Q-8 -14 0 -2 Q8 -18 20 8Z" fill="none" stroke="#7a6a4a" stroke-width="1.6" opacity=".6"/>`;
    }
    const nodes = STAGES.map((st, i) => {
      const [x, y] = pts[i];
      const cleared = s.cleared >= st.id, locked = st.id > s.cleared + 1, cur = st.id === s.cleared + 1;
      const sel = state.sel === st.id;
      return `<g class="node ${cleared ? 'done' : ''} ${locked ? 'locked' : ''} ${cur ? 'cur' : ''} ${sel ? 'sel' : ''}" data-a="stage" data-stage="${st.id}" transform="translate(${x} ${y})" tabindex="0">
        <circle class="halo" r="34"/>
        <path d="M-16 -20 L16 -20 L16 12 L0 24 L-16 12Z" class="flag"/>
        <text y="6" text-anchor="middle" class="num">${locked ? '' : st.id}</text>
        ${locked ? '<path d="M-6 -4 v-4 a6 6 0 0 1 12 0 v4 M-8 -4 h16 v12 h-16z" class="lock"/>' : ''}
        ${cleared ? '<path d="M-7 -14 l5 6 l9 -11" class="tick"/>' : ''}
        <text y="46" text-anchor="middle" class="lbl">${esc(st.name)}</text>
      </g>`;
    }).join('');
    const vUnlocked = s.cleared >= 6, vSel = state.sel === 'vault';
    const vnode = `<g class="node vault ${vUnlocked ? '' : 'locked'} ${vSel ? 'sel' : ''}" data-a="stage" data-stage="vault" transform="translate(${v[0]} ${v[1]})" tabindex="0">
      <circle class="halo" r="34"/><ellipse rx="22" ry="14" class="pit"/><path d="M-22 0 a22 14 0 0 0 44 0" class="pitrim"/>
      ${vUnlocked ? `<text y="5" text-anchor="middle" class="num">${s.vaultBest || '∞'}</text>` : '<path d="M-6 -4 v-4 a6 6 0 0 1 12 0 v4 M-8 -4 h16 v12 h-16z" class="lock"/>'}
      <text y="46" text-anchor="middle" class="lbl">The Deep Vaults</text></g>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="mapsvg" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Road map">
      <defs><radialGradient id="pg" cx=".5" cy=".5" r=".75"><stop offset="0" stop-color="#e2cfa0"/><stop offset=".7" stop-color="#cdb685"/><stop offset="1" stop-color="#a88a58"/></radialGradient></defs>
      <rect width="${W}" height="${H}" fill="url(#pg)" rx="14"/>${deco}
      <path d="${d}" class="road-edge"/><path d="${d}" class="road"/>
      <path d="${vault}" class="road-edge dashed"/>
      ${nodes}${vnode}</svg>`;
  }

  function stageInfo(s, hero) {
    const id = state.sel;
    if (id === 'vault') {
      const un = s.cleared >= 6;
      const max = s.vaultBest + 1;
      state.floor = Math.max(1, Math.min(state.floor, max));
      return `<h3>${VAULT.name}</h3><p>${esc(VAULT.blurb)}</p>
        ${un ? `<div class="row">Best floor <b>${s.vaultBest || '-'}</b></div>
        <div class="row floorsel">Start at floor <button class="btn sm" data-a="floor" data-d="-1">&minus;</button><b>${state.floor}</b><button class="btn sm" data-a="floor" data-d="1">+</button></div>
        <div class="row">Suggested power <b>${VAULT.power + 25 * state.floor}</b> &middot; Yours <b class="${powerClass(hero.power, VAULT.power + 25 * state.floor)}">${hero.power}</b></div>
        <button class="btn primary big" data-a="march" data-stage="vault">Descend</button>` : '<div class="row dim">Defeat the Ashen Regent to unlock the Vaults.</div>'}`;
    }
    const st = STAGES[id - 1];
    const locked = st.id > s.cleared + 1;
    return `<h3>${st.id}. ${esc(st.name)}</h3><p>${esc(st.blurb)}</p>
      <div class="row">Waves <b>${st.waves.length}</b> &middot; Suggested power <b>${st.power}</b> &middot; Yours <b class="${powerClass(hero.power, st.power)}">${hero.power}</b></div>
      <div class="row">${powerLabel(hero.power, st.power)}</div>
      ${locked ? '<div class="row dim">Clear the previous stage first.</div>' : `<button class="btn primary big" data-a="march" data-stage="${st.id}">${s.cleared >= st.id ? 'Replay' : 'March'}</button>`}`;
  }

  const powerClass = (mine, need) => (mine >= need * 1.1 ? 'good' : mine >= need * 0.9 ? 'ok' : 'bad');
  const powerLabel = (mine, need) => (mine >= need * 1.1 ? 'You outmatch this road.' : mine >= need * 0.9 ? 'A fair fight.' : 'Dangerous: you are underpowered.');

  function itemTile(it, extra = '') {
    if (!it) return `<div class="tile empty ${extra}"></div>`;
    const r = rarityOf(it.rarity);
    return `<div class="tile ${extra}" style="--rc:${r.color}"><img src="${icon(slotIcon(it), 48)}" alt=""><i>${it.ilvl}</i></div>`;
  }

  function itemCard(it, compareTo, s) {
    if (!it) return '';
    const r = rarityOf(it.rarity);
    const tot = itemTotals(it), cur = itemTotals(compareTo);
    const lines = [];
    if (it.slot === 'weapon') lines.push(`<div class="base">${fmt(it.base)} Damage</div>`);
    if (it.slot === 'armor') lines.push(`<div class="base">${fmt(it.base)} Armor</div>`);
    for (const a of it.aff) lines.push(`<div class="aff">${esc(describeAffix(a))}</div>`);
    let cmp = '';
    if (compareTo !== undefined && compareTo !== it) {
      const rows = [];
      const labels = { hp: 'Health', mp: 'Mana', damage: 'Damage', armor: 'Armor', crit: 'Crit %', speed: 'Speed %', regen: 'Mana/s' };
      for (const k of Object.keys(labels)) {
        const dlt = Math.round((tot[k] - cur[k]) * 100) / 100;
        if (dlt) rows.push(`<span class="${dlt > 0 ? 'up' : 'dn'}">${dlt > 0 ? '+' : ''}${fmt(dlt)} ${labels[k]}</span>`);
      }
      const pNow = heroStats(s).power, pNew = heroStats(s, { ...s.equip, [it.slot]: it }).power;
      cmp = `<div class="cmp"><h5>${compareTo ? 'vs equipped ' + esc(compareTo.name) : 'vs empty slot'}</h5>${rows.join('') || '<span>No change</span>'}<div class="pw ${pNew > pNow ? 'up' : pNew < pNow ? 'dn' : ''}">Power ${pNow} &rarr; ${pNew} (${pNew - pNow >= 0 ? '+' : ''}${pNew - pNow})</div></div>`;
    }
    return `<div class="icard" style="--rc:${r.color}"><h4>${esc(it.name)}</h4><div class="sub">${r.name} ${esc(it.kind)} &middot; ${SLOT_LABEL[it.slot]} &middot; ilvl ${it.ilvl}</div>${lines.join('')}${cmp}</div>`;
  }

  function heroPanel(s, hero) {
    const c = CLASSES[s.cls];
    const need = s.level >= MAX_LEVEL ? 0 : xpToNext(s.level);
    const stat = (k, v) => `<div><span>${k}</span><b>${v}</b></div>`;
    return `<div class="hero-head"><img src="${icon(c.id, 72)}" alt=""><div><h3>${c.name}</h3><div class="xpbar"><i style="width:${need ? (100 * s.xp / need) : 100}%"></i></div><small>Level ${s.level}${need ? ` &middot; ${s.xp} / ${need} XP` : ' (max)'}</small></div><div class="powerbadge"><small>Power</small><b>${hero.power}</b></div></div>
      <div class="stats">${stat('Health', hero.maxHp)}${stat('Mana', hero.maxMp)}${stat('Damage', fmt(hero.damage))}${stat('Armor', hero.armor)}${stat('Crit', fmt(hero.crit) + '%')}${stat('Speed', Math.round(hero.speed))}${stat('Mana regen', fmt(hero.regen) + '/s')}${stat('Reduction', Math.round(100 - 12000 / (120 + hero.armor)) + '%')}</div>
      <h4>Equipment</h4>
      <div class="equip">${SLOTS.map((sl) => {
    const it = s.equip[sl];
    return `<div class="eslot ${it ? '' : 'none'}" ${it ? `data-a="eq-inspect" data-slot="${sl}"` : ''}>${itemTile(it)}<div><small>${SLOT_LABEL[sl]}</small><b style="color:${it ? rarityOf(it.rarity).color : 'inherit'}">${it ? esc(it.name) : 'Empty'}</b></div></div>`;
  }).join('')}</div>
      <div id="eq-detail">${state.eqSel && s.equip[state.eqSel] ? itemCard(s.equip[state.eqSel]) + `<button class="btn" data-a="unequip" data-slot="${state.eqSel}">Unequip</button>` : ''}</div>
      <h4>Skills</h4>
      <ul class="skills">${c.skills.map((k) => `<li class="${s.level < k.unlock ? 'lock' : ''}"><img src="${icon(k.id, 40)}" alt=""><div><b>${k.name}</b> <small>${s.level < k.unlock ? 'Unlocks at Lv ' + k.unlock : `${k.cost} MP &middot; ${k.cd}s`}</small><p>${esc(k.desc)}</p></div></li>`).join('')}</ul>`;
  }

  function bagPanel(s) {
    const cells = [];
    for (let i = 0; i < BAG_SIZE; i++) {
      const it = s.bag[i];
      cells.push(it ? `<button class="slot ${state.bagSel === it.id ? 'sel' : ''}" data-a="bag-sel" data-id="${it.id}">${itemTile(it)}</button>` : '<div class="slot"><div class="tile empty"></div></div>');
    }
    const it = s.bag.find((x) => x.id === state.bagSel);
    const sellCommon = s.bag.filter((x) => x.rarity === 'common');
    return `<div class="bagtop"><span>Bag ${s.bag.length} / ${BAG_SIZE}</span><button class="btn sm" data-a="sell-common" ${sellCommon.length ? '' : 'disabled'}>Sell all Common (${sellCommon.reduce((a, b) => a + itemSellValue(b), 0)}g)</button></div>
      <div class="baggrid">${cells.join('')}</div>
      <div class="bagdetail">${it ? itemCard(it, s.equip[it.slot], s) + `<div class="btns"><button class="btn primary" data-a="equip" data-id="${it.id}">Equip</button><button class="btn" data-a="sell" data-id="${it.id}">Sell ${itemSellValue(it)}g</button></div>` : '<p class="dim">Select an item to compare it with what you are wearing.</p>'}</div>`;
  }

  function shopPanel(s) {
    const full = s.potions >= MAX_POTIONS;
    const can = s.gold >= POTION_PRICE && !full;
    const toFull = MAX_POTIONS - s.potions;
    return `<div class="shop"><div class="vendor"><img src="${icon('potion', 72)}" alt=""><div><h3>Hedge-Apothecary</h3><p>Red tonic. Heals half your health. Carry up to ${MAX_POTIONS}.</p></div></div>
      <div class="row">Potions <b>${s.potions} / ${MAX_POTIONS}</b></div>
      <div class="btns"><button class="btn primary" data-a="buy" data-n="1" ${can ? '' : 'disabled'}>Buy 1 &middot; ${POTION_PRICE}g</button>
      <button class="btn" data-a="buy" data-n="${toFull}" ${s.gold >= POTION_PRICE && toFull > 1 ? '' : 'disabled'}>Fill up${toFull > 1 ? ` (${toFull}) &middot; ${toFull * POTION_PRICE}g` : ''}</button></div>
      <p class="dim">Gold: ${s.gold}. Sell spare equipment from the Bag.</p></div>`;
  }

  function showCamp() {
    state.view = 'camp';
    const s = save();
    if (state.sel == null) state.sel = nextStageId(s);
    const hero = heroStats(s);
    const isWide = wide.matches;
    const tab = state.tab === 'map' && isWide ? 'hero' : state.tab;
    root.className = 'screen camp';
    const tabs = [['map', 'Road'], ['hero', 'Hero'], ['bag', `Bag`], ['shop', 'Shop']];
    root.innerHTML = `
      <header class="camp-top">
        <div class="brand">Highkeep Road <small>Camp</small></div>
        <div class="res"><span class="gold"><img src="${icon('coin', 32)}" alt="">${s.gold}</span><span class="pots"><img src="${icon('potion', 32)}" alt="">${s.potions}/${MAX_POTIONS}</span><span class="pw">Power <b>${hero.power}</b></span></div>
        <button class="btn sm" data-a="menu">Menu</button>
      </header>
      <nav class="tabs">${tabs.map(([k, n]) => `<button class="${tab === k ? 'on' : ''} ${k === 'map' ? 'tab-map' : ''}" data-a="tab" data-tab="${k}">${n}${k === 'bag' && s.bag.length ? ` <i>${s.bag.length}</i>` : ''}</button>`).join('')}</nav>
      <main>
        <section class="panel p-map ${tab === 'map' || isWide ? 'show' : ''}">
          ${mapSVG(s)}
          <div class="stageinfo">${stageInfo(s, hero)}</div>
        </section>
        <section class="side">
          <nav class="tabs tabs-wide">${tabs.filter(([k]) => k !== 'map').map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-a="tab" data-tab="${k}">${n}${k === 'bag' && s.bag.length ? ` <i>${s.bag.length}</i>` : ''}</button>`).join('')}</nav>
          <div class="panel p-hero ${tab === 'hero' ? 'show' : ''}">${heroPanel(s, hero)}</div>
          <div class="panel p-bag ${tab === 'bag' ? 'show' : ''}">${bagPanel(s)}</div>
          <div class="panel p-shop ${tab === 'shop' ? 'show' : ''}">${shopPanel(s)}</div>
        </section>
      </main>`;
  }

  /* ---------- results ---------- */
  function showResult(res) {
    state.view = 'result';
    const { won, stage, run } = res;
    const s = save();
    const isVault = stage.id === 'vault';
    const ending = won && stage.id === 6 && run.firstClear;
    root.className = 'screen result';
    root.innerHTML = `<div class="rbox ${won ? 'win' : 'lose'}">
      <h2>${won ? (isVault ? `Floor ${stage.floor} cleared` : ending ? 'The Heir is Free' : 'Victory') : 'Defeated'}</h2>
      <p class="sub">${esc(stage.name)}</p>
      ${ending ? `<p class="story">${esc(ENDING_TEXT)}</p>` : ''}
      <div class="rstats"><div><b>${run.kills}</b><span>Foes slain</span></div><div><b>${run.xp}</b><span>XP</span></div><div><b>${run.gold}</b><span>Gold</span></div>${won && run.bonus ? `<div><b>+${run.bonus}</b><span>Clear bonus</span></div>` : ''}</div>
      ${run.levels ? `<div class="lvlup">Level ${run.startLevel} &rarr; ${s.level}</div>` : ''}
      ${isVault ? `<div class="lvlup">Best floor ${s.vaultBest}</div>` : ''}
      ${run.items.length ? `<h4>Loot</h4><div class="loot">${run.items.map((it) => `<div class="lootitem" style="--rc:${rarityOf(it.rarity).color}"><img src="${icon(slotIcon(it), 36)}" alt=""><span>${esc(it.name)}</span></div>`).join('')}</div>` : ''}
      ${run.potions ? `<p class="dim">Potions found: ${run.potions}</p>` : ''}
      <div class="btns">
        ${won && isVault ? `<button class="btn primary big" data-a="march" data-stage="vault" data-floor="${stage.floor + 1}">Descend to floor ${stage.floor + 1}</button>` : ''}
        ${!won ? `<button class="btn primary big" data-a="march" data-stage="${stage.id}" data-floor="${stage.floor || 1}">Try again</button>` : ''}
        <button class="btn ${won && !isVault ? 'primary big' : ''}" data-a="camp">Return to camp</button>
      </div></div>`;
  }

  /* ---------- pause ---------- */
  function showPause(gfx) {
    const el = api.pauseEl;
    el.classList.remove('hidden');
    el.innerHTML = `<div class="pbox"><h2>Paused</h2>
      <button class="btn primary big" data-a="resume">Resume</button>
      <div class="gfx">Graphics <button class="btn sm ${gfx === 'low' ? 'on' : ''}" data-a="gfx" data-v="low">Low</button><button class="btn sm ${gfx === 'high' ? 'on' : ''}" data-a="gfx" data-v="high">High</button></div>
      <button class="btn" data-a="quit">Abandon stage</button></div>`;
  }
  function hidePause() { api.pauseEl.classList.add('hidden'); api.pauseEl.innerHTML = ''; }

  /* ---------- modal ---------- */
  function confirm(text, yes) {
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<div class="mbox"><p>${esc(text)}</p><div class="btns"><button class="btn primary" data-m="y">Yes</button><button class="btn" data-m="n">Cancel</button></div></div>`;
    m.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      m.remove();
      if (b.dataset.m === 'y') yes();
    });
    document.body.appendChild(m);
  }

  /* ---------- events ---------- */
  function handle(e) {
    const b = e.target.closest('[data-a]');
    if (!b) return;
    const a = b.dataset.a;
    const s = save();
    switch (a) {
      case 'continue': api.toCamp(); break;
      case 'new': {
        const go = () => api.newGame(b.dataset.cls);
        if (s) confirm('Starting a new hero will overwrite your current save. Continue?', go); else go();
        break;
      }
      case 'tab': state.tab = b.dataset.tab; showCamp(); break;
      case 'stage': {
        const id = b.dataset.stage === 'vault' ? 'vault' : +b.dataset.stage;
        state.sel = id; if (state.tab !== 'map' && !wide.matches) state.tab = 'map';
        showCamp(); break;
      }
      case 'floor': state.floor = Math.max(1, Math.min(s.vaultBest + 1, state.floor + +b.dataset.d)); showCamp(); break;
      case 'march': {
        const id = b.dataset.stage === 'vault' ? 'vault' : +b.dataset.stage;
        api.marchWithLoading(id, id === 'vault' ? +(b.dataset.floor || state.floor) : 0);
        break;
      }
      case 'camp': api.toCamp(); break;
      case 'menu': api.toTitle(); break;
      case 'bag-sel': state.bagSel = b.dataset.id; showCamp(); break;
      case 'eq-inspect': state.eqSel = state.eqSel === b.dataset.slot ? null : b.dataset.slot; showCamp(); break;
      case 'equip': {
        const idx = s.bag.findIndex((x) => x.id === b.dataset.id);
        if (idx < 0) break;
        const it = s.bag[idx];
        const old = s.equip[it.slot];
        s.equip[it.slot] = it;
        if (old) s.bag[idx] = old; else s.bag.splice(idx, 1);
        state.bagSel = old ? old.id : null;
        api.persist(); showCamp(); break;
      }
      case 'unequip': {
        const sl = b.dataset.slot;
        if (!s.equip[sl] || s.bag.length >= BAG_SIZE) break;
        s.bag.push(s.equip[sl]); s.equip[sl] = null; state.eqSel = null;
        api.persist(); showCamp(); break;
      }
      case 'sell': {
        const idx = s.bag.findIndex((x) => x.id === b.dataset.id);
        if (idx < 0) break;
        s.gold += itemSellValue(s.bag[idx]); s.bag.splice(idx, 1); state.bagSel = null;
        api.persist(); showCamp(); break;
      }
      case 'sell-common': {
        let g = 0; s.bag = s.bag.filter((x) => { if (x.rarity === 'common') { g += itemSellValue(x); return false; } return true; });
        s.gold += g; state.bagSel = null; api.persist(); showCamp(); break;
      }
      case 'buy': {
        const n = Math.min(+b.dataset.n, MAX_POTIONS - s.potions, Math.floor(s.gold / POTION_PRICE));
        if (n > 0) { s.potions += n; s.gold -= n * POTION_PRICE; api.persist(); showCamp(); }
        break;
      }
      case 'resume': api.resume(); break;
      case 'quit': api.quit(); break;
      case 'gfx': api.setGfx(b.dataset.v); showPause(b.dataset.v); break;
      default: break;
    }
  }
  root.addEventListener('click', handle);
  api.pauseEl.addEventListener('click', handle);
  root.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest?.('.node')) { e.preventDefault(); handle(e); } });

  return { showTitle, showCamp, showResult, showPause, hidePause, state, hide() { root.className = 'screen hidden'; root.innerHTML = ''; } };
}
