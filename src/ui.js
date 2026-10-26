// Screens: title, camp (road map, hero, bag, shop), results, pause. Plain DOM, innerHTML + event delegation.
import {
  CLASSES, STAGES, VAULT, SLOTS, SLOT_LABEL, AFFIXES, MAX_POTIONS, POTION_PRICE, BAG_SIZE, BAG_MAX, BAG_EXPAND, bagExpandCost, MAX_PLUS, RESEARCH_MAX, SETS, SET_BONUS, xpToNext, MAX_LEVEL, INTRO_TEXT, ENDING_TEXT, stageById,
  SKILL_MAX, skillMul, skillCdMul, skillUpCost, TRAITS, TRAIT_MAX, traitPoints, traitSpent, TRAIT_RESET_COST, SIGIL_MAX, SIGIL_PER, SIGIL_BOONS, sigilCost,
  ARTIFACTS, ART_MAX, ART_SLOTS, artValue, artUpCost,
} from './data.js';
import {
  heroStats, itemTotals, itemSellValue, rarityOf, describeAffix, setCounts, forgeInfo, forgeAttempt, reforgeCost, canReforge, reforgeAffix,
  dismantleValue, studyValue, researchLevel, researchNeed, rarityIndex, traitUnlocked,
} from './items.js';
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
    return `<div class="tile ${extra}" style="--rc:${r.color}"><img src="${icon(slotIcon(it), 48)}" alt=""><i>${it.ilvl}</i>${it.plus ? `<u>+${it.plus}</u>` : ''}${it.set != null ? '<b class="setpip"></b>' : ''}${it.lock ? '<em class="lockpip">&#9679;</em>' : ''}</div>`;
  }

  function itemCard(it, compareTo, s) {
    if (!it) return '';
    const r = rarityOf(it.rarity);
    const tot = itemTotals(it), cur = itemTotals(compareTo);
    const lines = [];
    if (it.slot === 'weapon') lines.push(`<div class="base">${fmt(tot.damage)} Damage</div>`);
    if (it.slot === 'armor') lines.push(`<div class="base">${fmt(tot.armor)} Armor</div>`);
    for (const a of it.aff) lines.push(`<div class="aff">${esc(describeAffix({ k: a.k, v: Math.round(a.v * (1 + 0.1 * (it.plus || 0)) * 100) / 100 }))}</div>`);
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
    let setBlock = '';
    if (it.set != null) {
      const have = setCounts(s.equip)[it.set] || 0, t = 1 + 0.35 * it.set;
      const b2 = SET_BONUS[2](t), b3 = SET_BONUS[3](t);
      const fm = (b) => Object.entries(b).map(([k, v]) => `+${v} ${AFFIXES[k] ? AFFIXES[k].label : k}`).join(', ');
      setBlock = `<div class="setblock"><b>${esc(SETS[it.set].name)} Set (${have}/3 worn)</b><div class="${have >= 2 ? 'on' : ''}">(2) ${fm(b2)}</div><div class="${have >= 3 ? 'on' : ''}">(3) ${fm(b3)}</div></div>`;
    }
    return `<div class="icard" style="--rc:${r.color}"><h4>${esc(it.name)}${it.plus ? ` <span class="plus">+${it.plus}</span>` : ''}</h4><div class="sub">${r.name} ${esc(it.kind)} &middot; ${SLOT_LABEL[it.slot]} &middot; ilvl ${it.ilvl}${it.plus ? ` &middot; forged +${it.plus}` : ''}</div>${lines.join('')}${setBlock}${cmp}</div>`;
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
      <div id="eq-detail">${state.eqSel && s.equip[state.eqSel] ? itemCard(s.equip[state.eqSel], undefined, s) + `<button class="btn" data-a="unequip" data-slot="${state.eqSel}">Unequip</button>` : ''}</div>
      <h4>Skills</h4>
      <ul class="skills">${c.skills.map((k) => `<li class="${s.level < k.unlock ? 'lock' : ''}"><img src="${icon(k.id, 40)}" alt=""><div><b>${k.name}</b> <small>${s.level < k.unlock ? 'Unlocks at Lv ' + k.unlock : `${k.cost} MP &middot; ${k.cd}s`}</small><p>${esc(k.desc)}</p></div></li>`).join('')}</ul>`;
  }

  function bagPanel(s) {
    const cells = [];
    const size = s.bagSize || BAG_SIZE;
    for (let i = 0; i < size; i++) {
      const it = s.bag[i];
      cells.push(it ? `<button class="slot ${state.bagSel === it.id ? 'sel' : ''}" data-a="bag-sel" data-id="${it.id}">${itemTile(it)}</button>` : '<div class="slot"><div class="tile empty"></div></div>');
    }
    const it = s.bag.find((x) => x.id === state.bagSel);
    const sellCommon = s.bag.filter((x) => x.rarity === 'common' && !x.lock);
    return `<div class="bagtop"><span>Bag ${s.bag.length} / ${size}</span><span class="bagbtns"><button class="btn sm" data-a="sort">Sort</button><button class="btn sm" data-a="sell-common" ${sellCommon.length ? '' : 'disabled'}>Sell Common (${sellCommon.reduce((a, b) => a + itemSellValue(b), 0)}g)</button></span></div>
      <div class="baggrid">${cells.join('')}</div>
      <div class="bagdetail">${it ? itemCard(it, s.equip[it.slot], s) + `<div class="btns"><button class="btn primary" data-a="equip" data-id="${it.id}">Equip</button><button class="btn" data-a="forge-open" data-id="${it.id}">Forge</button><button class="btn" data-a="lock" data-id="${it.id}">${it.lock ? 'Unlock' : 'Lock'}</button></div><div class="btns"><button class="btn sm" data-a="dismantle" data-id="${it.id}" ${it.lock ? 'disabled' : ''}>Dismantle +${dismantleValue(it)} steel</button><button class="btn sm" data-a="sell" data-id="${it.id}" ${it.lock ? 'disabled' : ''}>Sell ${itemSellValue(it)}g</button></div>` : '<p class="dim">Select an item to compare it with what you are wearing. Lock items you want to keep.</p>'}</div>`;
  }

  const findItem = (s, id) => {
    for (const sl of SLOTS) if (s.equip[sl] && s.equip[sl].id === id) return { it: s.equip[sl], where: sl };
    const i = s.bag.findIndex((x) => x.id === id);
    return i >= 0 ? { it: s.bag[i], where: 'bag', i } : null;
  };

  function forgePanel(s) {
    const all = [...SLOTS.map((sl) => s.equip[sl]).filter(Boolean), ...s.bag];
    if (!state.forgeSel || !findItem(s, state.forgeSel)) state.forgeSel = all[0] ? all[0].id : null;
    const f = state.forgeSel ? findItem(s, state.forgeSel) : null;
    const it = f && f.it;
    const picker = all.map((x) => `<button class="slot ${state.forgeSel === x.id ? 'sel' : ''}" data-a="forge-sel" data-id="${x.id}">${itemTile(x, f && f.where !== 'bag' && x === s.equip[f.where] ? '' : '')}</button>`).join('');
    let body = '<p class="dim">Nothing to forge yet. Gear drops from the road.</p>';
    if (it) {
      const info = forgeInfo(it);
      const gold = info ? info.gold : 0;
      body = itemCard(it, undefined, s) + `<div class="fp"><span>Forge pity</span><div class="xpbar"><i style="width:${it.fp || 0}%"></i></div><small>${it.fp || 0} / 100 &middot; at 100 the next forge cannot fail</small></div>`;
      body += info ? `<div class="forgebox"><h4>Forge +${(it.plus || 0) + 1}</h4><p>Raises every stat on the item by 10%. Success <b>${Math.round(info.chance * 100)}%</b>${info.guaranteed ? ' (guaranteed)' : ''}. A failure never lowers the item.</p>
        <button class="btn primary" data-a="forge" ${s.gold >= gold && s.steel >= info.steel ? '' : 'disabled'}>Forge &middot; ${gold}g &middot; ${info.steel} steel</button></div>` : `<div class="forgebox"><h4>Fully forged (+${MAX_PLUS})</h4></div>`;
      if (canReforge(it)) {
        const rc = reforgeCost(it);
        const fodder = s.bag.find((x) => x.id !== it.id && !x.lock && x.slot === it.slot && x.rarity === it.rarity);
        state.reforgeIdx = Math.min(state.reforgeIdx || 0, it.aff.length - 1);
        body += `<div class="forgebox"><h4>Reforge</h4><p>Replace one effect with a new random one. Consumes a spare unlocked ${rarityOf(it.rarity).name} ${SLOT_LABEL[it.slot]} from your bag.</p>
          <div class="affpick">${it.aff.map((a, i) => `<button class="btn sm ${state.reforgeIdx === i ? 'on' : ''}" data-a="reforge-idx" data-i="${i}">${esc(describeAffix(a))}</button>`).join('')}</div>
          <button class="btn" data-a="reforge" ${fodder && s.gold >= rc.gold && s.steel >= rc.steel ? '' : 'disabled'}>${fodder ? `Reforge &middot; ${rc.gold}g &middot; ${rc.steel} steel` : 'Needs a matching spare item'}</button></div>`;
      }
      if (f.where === 'bag' && it.set != null) body += `<div class="forgebox"><h4>Set research</h4><p>Study this item to add ${studyValue(it)} research to <b>${esc(SETS[it.set].name)}</b>. Researched sets give permanent bonuses even when not worn.</p><button class="btn" data-a="study" ${it.lock ? 'disabled' : ''}>Study (consumes item)</button></div>`;
    }
    const rs = SETS.map((st) => {
      const xp = (s.research || {})[st.id] || 0, L = researchLevel(xp), need = researchNeed(L + 1), prev = researchNeed(L);
      return `<div class="rrow"><span>${esc(st.name)}</span><b>Lv ${L}${L >= RESEARCH_MAX ? ' (max)' : ''}</b><div class="xpbar"><i style="width:${L >= RESEARCH_MAX ? 100 : Math.round(100 * (xp - prev) / (need - prev))}%"></i></div></div>`;
    }).join('');
    return `<div class="forgetop"><span>Steel <b>${s.steel || 0}</b></span><span>Gold <b>${s.gold}</b></span></div>
      ${state.msg ? `<div class="msg ${state.msgOk ? 'ok' : 'bad'}">${esc(state.msg)}</div>` : ''}
      <div class="baggrid forgepick">${picker}</div>${body}
      <h4>Set research</h4><div class="research">${rs}</div><p class="dim">Each level: +6 health, +2 armor, +1 damage. Steel comes from dismantling gear, brutes and bosses.</p>`;
  }

  function advPanel(s) {
    const sub = state.adv || 'skills';
    const c = CLASSES[s.cls];
    const subs = [['skills', 'Skills'], ['traits', 'Traits'], ['sigil', 'Sigil'], ['arts', 'Artifacts']];
    const nav = `<div class="subtabs">${subs.map(([k, n]) => `<button class="${sub === k ? 'on' : ''}" data-a="adv-tab" data-t="${k}">${n}</button>`).join('')}</div>`;
    const head = `<div class="forgetop"><span>Steel <b>${s.steel || 0}</b></span><span>Gold <b>${s.gold}</b></span></div>${state.msg2 ? `<div class="msg ok">${esc(state.msg2)}</div>` : ''}`;
    let body = '';
    if (sub === 'skills') {
      body = '<p class="dim">Each level: +10% skill power and 3% faster cooldown. Skills must be unlocked by hero level first.</p>' + c.skills.map((k, i) => {
        const lv = (s.skillLv || [1, 1, 1])[i] || 1, locked = s.level < k.unlock, cost = skillUpCost(lv);
        return `<div class="advrow ${locked ? 'lock' : ''}"><img src="${icon(k.id, 40)}" alt=""><div><b>${k.name}</b> <small>Lv ${lv}/${SKILL_MAX} &middot; power x${skillMul(lv).toFixed(1)} &middot; cooldown ${(k.cd * skillCdMul(lv)).toFixed(1)}s</small><p>${esc(k.desc)}</p></div>
          ${locked ? `<small>Lv ${k.unlock}</small>` : lv >= SKILL_MAX ? '<small>Max</small>' : `<button class="btn sm" data-a="skill-up" data-i="${i}" ${s.gold >= cost.gold && s.steel >= cost.steel ? '' : 'disabled'}>${cost.gold}g ${cost.steel}&#9874;</button>`}</div>`;
      }).join('');
    } else if (sub === 'traits') {
      const left = traitPoints(s) - traitSpent(s);
      body = `<div class="forgetop"><span>Trait points <b>${left}</b></span><button class="btn sm" data-a="trait-reset" ${traitSpent(s) ? '' : 'disabled'}>Reset ${TRAIT_RESET_COST(s)}g</button></div><p class="dim">One point per hero level after the first. Each deeper node needs 3 points spent above it.</p>` +
        TRAITS.map((br) => `<h4>${br.name}</h4><div class="traitrow">${br.nodes.map((n, i) => {
          const rank = (s.traits || {})[n.id] || 0, open = traitUnlocked(s, br, i);
          return `<button class="trait ${open ? '' : 'lock'} ${rank ? 'has' : ''}" data-a="trait-up" data-id="${n.id}" ${open && left > 0 && rank < TRAIT_MAX ? '' : 'disabled'}><b>${n.name}</b><small>${n.text}</small><span>${rank}/${TRAIT_MAX}</span></button>`;
        }).join('')}</div>`).join('');
    } else if (sub === 'sigil') {
      const lv = s.sigil || 0, cost = sigilCost(lv);
      body = `<div class="sigilbox"><img src="${icon(s.cls, 96)}" alt=""><div><h3>House Sigil</h3><p>Level <b>${lv}</b> / ${SIGIL_MAX}</p>
        <p class="dim">Per level: +${SIGIL_PER.dmgPct}% damage, +${SIGIL_PER.hpPct}% health, +${SIGIL_PER.armor} armor.</p></div></div>
        <ul class="boons">${Object.entries(SIGIL_BOONS).map(([l, b]) => `<li class="${lv >= +l ? 'on' : ''}">Level ${l}: ${b.text}</li>`).join('')}</ul>
        ${lv >= SIGIL_MAX ? '<p class="dim">Your sigil is fully raised.</p>' : `<button class="btn primary" data-a="sigil-up" ${s.gold >= cost.gold && s.steel >= cost.steel ? '' : 'disabled'}>Raise sigil &middot; ${cost.gold}g &middot; ${cost.steel} steel</button>`}`;
    } else {
      const slots = (s.artSlots || [null, null, null]).slice(0, ART_SLOTS);
      body = '<p class="dim">Relics from bosses (and rarely brutes). Finding a duplicate raises it one level. Equip up to three.</p><div class="artslots">' + slots.map((id, i) => {
        const a = ARTIFACTS.find((x) => x.id === id);
        return `<div class="artslot ${a ? 'has' : ''}">${a ? `<b>${a.name}</b><small>+${artValue(a, s.artifacts[id].lv)}${a.text}</small><button class="btn sm" data-a="art-unequip" data-i="${i}">Remove</button>` : '<small>Empty slot</small>'}</div>`;
      }).join('') + '</div>' + ARTIFACTS.map((a) => {
        const own = (s.artifacts || {})[a.id];
        if (!own) return `<div class="advrow lock"><img src="${icon('charm', 40)}" alt=""><div><b>???</b><p>Not yet found</p></div></div>`;
        const cost = artUpCost(own.lv), worn = (s.artSlots || []).includes(a.id);
        return `<div class="advrow"><img src="${icon('charm', 40)}" alt=""><div><b>${a.name}</b> <small>Lv ${own.lv}/${ART_MAX}</small><p>+${artValue(a, own.lv)}${a.text}</p></div><span class="advbtns">
          <button class="btn sm" data-a="art-equip" data-id="${a.id}" ${worn ? 'disabled' : ''}>${worn ? 'Worn' : 'Equip'}</button>
          ${own.lv < ART_MAX ? `<button class="btn sm" data-a="art-up" data-id="${a.id}" ${s.gold >= cost.gold && s.steel >= cost.steel ? '' : 'disabled'}>${cost.gold}g ${cost.steel}&#9874;</button>` : ''}</span></div>`;
      }).join('');
    }
    return head + nav + body;
  }

  function shopPanel(s) {
    const full = s.potions >= MAX_POTIONS;
    const can = s.gold >= POTION_PRICE && !full;
    const toFull = MAX_POTIONS - s.potions;
    return `<div class="shop"><div class="vendor"><img src="${icon('potion', 72)}" alt=""><div><h3>Hedge-Apothecary</h3><p>Red tonic. Heals half your health. Carry up to ${MAX_POTIONS}.</p></div></div>
      <div class="row">Potions <b>${s.potions} / ${MAX_POTIONS}</b></div>
      <div class="btns"><button class="btn primary" data-a="buy" data-n="1" ${can ? '' : 'disabled'}>Buy 1 &middot; ${POTION_PRICE}g</button>
      <button class="btn" data-a="buy" data-n="${toFull}" ${s.gold >= POTION_PRICE && toFull > 1 ? '' : 'disabled'}>Fill up${toFull > 1 ? ` (${toFull}) &middot; ${toFull * POTION_PRICE}g` : ''}</button></div>
      <div class="row">Bag slots <b>${s.bagSize || BAG_SIZE} / ${BAG_MAX}</b></div>
      <div class="btns"><button class="btn" data-a="expand" ${(s.bagSize || BAG_SIZE) < BAG_MAX && s.gold >= bagExpandCost(s.bagSize || BAG_SIZE) ? '' : 'disabled'}>${(s.bagSize || BAG_SIZE) >= BAG_MAX ? 'Bag is full size' : `+${BAG_EXPAND} slots &middot; ${bagExpandCost(s.bagSize || BAG_SIZE)}g`}</button></div>
      <p class="dim">Gold: ${s.gold}. Sell or dismantle spare equipment from the Bag.</p></div>`;
  }

  function showCamp() {
    state.view = 'camp';
    const s = save();
    if (state.sel == null) state.sel = nextStageId(s);
    const hero = heroStats(s);
    const isWide = wide.matches;
    const tab = state.tab === 'map' && isWide ? 'hero' : state.tab;
    root.className = 'screen camp';
    const tabs = [['map', 'Road'], ['hero', 'Hero'], ['bag', `Bag`], ['forge', 'Forge'], ['adv', 'Advance'], ['shop', 'Shop']];
    root.innerHTML = `
      <header class="camp-top">
        <div class="brand">Highkeep Road <small>Camp</small></div>
        <div class="res"><span class="gold"><img src="${icon('coin', 32)}" alt="">${s.gold}</span><span class="pots"><img src="${icon('potion', 32)}" alt="">${s.potions}/${MAX_POTIONS}</span><span class="steel" title="Forging steel">&#9874; ${s.steel || 0}</span><span class="pw">Power <b>${hero.power}</b></span></div>
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
          <div class="panel p-forge ${tab === 'forge' ? 'show' : ''}">${forgePanel(s)}</div>
          <div class="panel p-adv ${tab === 'adv' ? 'show' : ''}">${advPanel(s)}</div>
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
      <div class="rstats"><div><b>${run.kills}</b><span>Foes slain</span></div><div><b>${run.xp}</b><span>XP</span></div><div><b>${run.gold}</b><span>Gold</span></div>${run.steel ? `<div><b>${run.steel}</b><span>Steel</span></div>` : ''}${won && run.bonus ? `<div><b>+${run.bonus}</b><span>Clear bonus</span></div>` : ''}</div>
      ${run.levels ? `<div class="lvlup">Level ${run.startLevel} &rarr; ${s.level}</div>` : ''}
      ${isVault ? `<div class="lvlup">Best floor ${s.vaultBest}</div>` : ''}
      ${run.items.length ? `<h4>Loot</h4><div class="loot">${run.items.map((it) => `<div class="lootitem" style="--rc:${rarityOf(it.rarity).color}"><img src="${icon(slotIcon(it), 36)}" alt=""><span>${esc(it.name)}</span></div>`).join('')}</div>` : ''}
      ${run.potions ? `<p class="dim">Potions found: ${run.potions}</p>` : ''}${run.artifacts ? `<p class="lvlup">Artifact: ${run.artifacts.map(esc).join(', ')}</p>` : ''}
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
      case 'adv-tab': state.adv = b.dataset.t; state.msg2 = ''; showCamp(); break;
      case 'skill-up': {
        const i = +b.dataset.i, lv = s.skillLv[i] || 1, c = skillUpCost(lv);
        if (lv >= SKILL_MAX || s.gold < c.gold || s.steel < c.steel) break;
        s.gold -= c.gold; s.steel -= c.steel; s.skillLv[i] = lv + 1; api.persist(); showCamp(); break;
      }
      case 'trait-up': {
        const br = TRAITS.find((t) => t.nodes.some((n) => n.id === b.dataset.id)); const idx = br.nodes.findIndex((n) => n.id === b.dataset.id);
        const rank = s.traits[b.dataset.id] || 0;
        if (!traitUnlocked(s, br, idx) || rank >= TRAIT_MAX || traitSpent(s) >= traitPoints(s)) break;
        s.traits[b.dataset.id] = rank + 1; api.persist(); showCamp(); break;
      }
      case 'trait-reset': { const c = TRAIT_RESET_COST(s); if (s.gold >= c) { s.gold -= c; s.traits = {}; state.msg2 = 'Traits reset.'; api.persist(); showCamp(); } break; }
      case 'sigil-up': {
        const lv = s.sigil || 0, c = sigilCost(lv);
        if (lv >= SIGIL_MAX || s.gold < c.gold || s.steel < c.steel) break;
        s.gold -= c.gold; s.steel -= c.steel; s.sigil = lv + 1; api.persist(); showCamp(); break;
      }
      case 'art-equip': { const i = s.artSlots.findIndex((x) => !x); const slot = i >= 0 ? i : 0; s.artSlots[slot] = b.dataset.id; api.persist(); showCamp(); break; }
      case 'art-unequip': s.artSlots[+b.dataset.i] = null; api.persist(); showCamp(); break;
      case 'art-up': {
        const own = s.artifacts[b.dataset.id]; if (!own || own.lv >= ART_MAX) break;
        const c = artUpCost(own.lv); if (s.gold < c.gold || s.steel < c.steel) break;
        s.gold -= c.gold; s.steel -= c.steel; own.lv++; api.persist(); showCamp(); break;
      }
      case 'forge-open': state.forgeSel = b.dataset.id; state.tab = 'forge'; state.msg = ''; showCamp(); break;
      case 'forge-sel': state.forgeSel = b.dataset.id; state.msg = ''; showCamp(); break;
      case 'forge': {
        const f = findItem(s, state.forgeSel); if (!f) break;
        const info = forgeInfo(f.it); if (!info || s.gold < info.gold || s.steel < info.steel) break;
        s.gold -= info.gold; s.steel -= info.steel;
        const ok = forgeAttempt(f.it);
        state.msg = ok ? `Forged to +${f.it.plus}!` : `The forge failed (pity ${f.it.fp}/100). Nothing was lost but materials.`; state.msgOk = ok;
        api.persist(); showCamp(); break;
      }
      case 'reforge-idx': state.reforgeIdx = +b.dataset.i; showCamp(); break;
      case 'reforge': {
        const f = findItem(s, state.forgeSel); if (!f || !canReforge(f.it)) break;
        const rc = reforgeCost(f.it);
        const fi = s.bag.findIndex((x) => x.id !== f.it.id && !x.lock && x.slot === f.it.slot && x.rarity === f.it.rarity);
        if (fi < 0 || s.gold < rc.gold || s.steel < rc.steel) break;
        s.bag.splice(fi, 1); s.gold -= rc.gold; s.steel -= rc.steel;
        reforgeAffix(f.it, state.reforgeIdx || 0);
        state.msg = 'Reforged: ' + describeAffix(f.it.aff[state.reforgeIdx || 0]); state.msgOk = true;
        api.persist(); showCamp(); break;
      }
      case 'study': {
        const f = findItem(s, state.forgeSel); if (!f || f.where !== 'bag' || f.it.set == null || f.it.lock) break;
        s.research = s.research || {}; const before = researchLevel(s.research[f.it.set] || 0);
        s.research[f.it.set] = (s.research[f.it.set] || 0) + studyValue(f.it);
        s.bag.splice(f.i, 1); state.forgeSel = null;
        const after = researchLevel(s.research[f.it.set]);
        state.msg = after > before ? `${SETS[f.it.set].name} research reached level ${after}!` : 'Research gained.'; state.msgOk = true;
        api.persist(); showCamp(); break;
      }
      case 'dismantle': {
        const i = s.bag.findIndex((x) => x.id === b.dataset.id); if (i < 0 || s.bag[i].lock) break;
        s.steel = (s.steel || 0) + dismantleValue(s.bag[i]); s.bag.splice(i, 1); state.bagSel = null;
        api.persist(); showCamp(); break;
      }
      case 'lock': { const f = findItem(s, b.dataset.id); if (f) { f.it.lock = !f.it.lock; api.persist(); showCamp(); } break; }
      case 'sort': {
        s.bag.sort((a, c) => rarityIndex(c) - rarityIndex(a) || (c.plus || 0) - (a.plus || 0) || c.ilvl - a.ilvl || a.slot.localeCompare(c.slot));
        api.persist(); showCamp(); break;
      }
      case 'expand': {
        const size = s.bagSize || BAG_SIZE, cost = bagExpandCost(size);
        if (size < BAG_MAX && s.gold >= cost) { s.gold -= cost; s.bagSize = Math.min(BAG_MAX, size + BAG_EXPAND); api.persist(); showCamp(); }
        break;
      }
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
        if (!s.equip[sl] || s.bag.length >= (s.bagSize || BAG_SIZE)) break;
        s.bag.push(s.equip[sl]); s.equip[sl] = null; state.eqSel = null;
        api.persist(); showCamp(); break;
      }
      case 'sell': {
        const idx = s.bag.findIndex((x) => x.id === b.dataset.id);
        if (idx < 0) break;
        if (s.bag[idx].lock) break;
        s.gold += itemSellValue(s.bag[idx]); s.bag.splice(idx, 1); state.bagSel = null;
        api.persist(); showCamp(); break;
      }
      case 'sell-common': {
        let g = 0; s.bag = s.bag.filter((x) => { if (x.rarity === 'common' && !x.lock) { g += itemSellValue(x); return false; } return true; });
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
