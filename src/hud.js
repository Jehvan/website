// In-game HUD (DOM): action bar flanked by glass health / mana orbs, target and boss frames, banner.
import { CLASSES, xpToNext, MAX_LEVEL, skillCdMul } from './data.js';
import { icon } from './icons.js';
import { enemyById, targetable } from './game.js';

export function createHUD(el) {
  el.innerHTML = `
    <div class="hud-tl plate"><div id="h-stage"></div><div id="h-wave"></div></div>
    <div class="hud-target plate" id="h-target"><b></b><div class="tbar"><i></i></div></div>
    <div class="hud-tr"><div class="gold plate"><img id="h-coin" alt=""><b id="h-gold">0</b></div><button class="pausebtn plate" data-act="pause" aria-label="Pause">II</button></div>
    <div class="hud-bottom">
      <div class="orb hp" id="h-hp"><i></i><span></span></div>
      <div class="actbar plate">
        <div class="lv plate" id="h-lvl">1</div>
        <button class="act skill" data-act="skill0"><img alt=""><b>1</b><em></em><u></u></button>
        <button class="act skill" data-act="skill1"><img alt=""><b>2</b><em></em><u></u></button>
        <button class="act skill" data-act="skill2"><img alt=""><b>3</b><em></em><u></u></button>
        <button class="act potion" data-act="potion"><img alt=""><b>F</b><span id="h-pot">3</span></button>
        <div class="xp"><i id="h-xp"></i></div>
      </div>
      <div class="orb mp" id="h-mp"><i></i><span></span></div>
    </div>
    <div id="banner"><h2></h2><p></p></div>`;
  const $ = (s) => el.querySelector(s);
  const q = {
    lvl: $('#h-lvl'), hp: $('#h-hp'), mp: $('#h-mp'), xp: $('#h-xp'), stage: $('#h-stage'), wave: $('#h-wave'), gold: $('#h-gold'),
    pot: $('#h-pot'), banner: $('#banner'), skills: [...el.querySelectorAll('.skill')], potBtn: $('.potion'), target: $('#h-target'),
  };
  $('#h-coin').src = icon('coin', 32);
  el.querySelector('.potion img').src = icon('potion', 48);
  const last = {};
  const set = (k, v, fn) => { if (last[k] !== v) { last[k] = v; fn(v); } };
  let bannerKey = '';

  return {
    el,
    setClass(cls) {
      CLASSES[cls].skills.forEach((s, i) => { q.skills[i].querySelector('img').src = icon(s.id, 48); q.skills[i].title = `${s.name}: ${s.desc}`; });
      for (const k in last) delete last[k];
    },
    update(game, hoverId = 0) {
      const { p, save, hero, stage } = game;
      if (!p) return;
      set('lvl', save.level, (v) => { q.lvl.textContent = v; });
      set('hp', Math.ceil(p.hp) + '/' + hero.maxHp, (v) => { q.hp.style.setProperty('--f', Math.max(0, p.hp / hero.maxHp).toFixed(3)); q.hp.lastChild.textContent = v.replace('/', ' / '); });
      set('mp', Math.floor(p.mp) + '/' + hero.maxMp, (v) => { q.mp.style.setProperty('--f', Math.max(0, p.mp / hero.maxMp).toFixed(3)); q.mp.lastChild.textContent = v.replace('/', ' / '); });
      const need = save.level >= MAX_LEVEL ? 1 : xpToNext(save.level);
      set('xp', save.xp + '/' + need, () => { q.xp.style.transform = `scaleX(${save.level >= MAX_LEVEL ? 1 : save.xp / need})`; });
      set('stage', stage.name, (v) => { q.stage.textContent = v; });
      set('wave', stage.state + stage.waveIdx, () => { q.wave.textContent = stage.state === 'intro' ? 'Prepare' : `Wave ${Math.max(1, stage.waveIdx + 1)} / ${stage.waves.length}`; });
      set('gold', save.gold, (v) => { q.gold.textContent = v; });
      set('pot', save.potions, (v) => { q.pot.textContent = v; q.potBtn.classList.toggle('empty', v === 0); });
      CLASSES[save.cls].skills.forEach((s, i) => {
        const b = q.skills[i];
        const locked = save.level < s.unlock;
        const cdMax = s.cd * skillCdMul(save.skillLv?.[i] || 1) * (1 - Math.min(0.5, (hero.cdr || 0) / 100));
        const cdp = locked ? 0 : Math.min(1, p.cd[i] / cdMax);
        set('sk' + i, `${locked}|${Math.round(cdp * 40)}|${p.mp >= s.cost}|${Math.ceil(p.cd[i])}`, () => {
          b.classList.toggle('locked', locked);
          b.classList.toggle('nomana', !locked && p.mp < s.cost);
          b.style.setProperty('--cd', cdp.toFixed(3));
          b.querySelector('em').textContent = locked ? `Lv ${s.unlock}` : '';
          b.querySelector('u').textContent = !locked && cdp > 0 ? Math.ceil(p.cd[i]) : '';
        });
      });
      // boss bar, or the clicked / hovered enemy
      const boss = game.enemies.find((e) => e.def.boss && !e.dead);
      let t = boss || enemyById(game, game.targetId);
      if (!targetable(t) && !boss) t = enemyById(game, hoverId);
      const show = !!t && (boss || targetable(t));
      set('tshow', show, (v) => q.target.classList.toggle('show', v));
      if (show) {
        set('tname', t.def.name + (boss ? '|b' : ''), () => { q.target.firstChild.textContent = t.def.name; q.target.classList.toggle('boss', !!boss); });
        set('thp', Math.round(t.hp / t.maxHp * 200), (v) => { q.target.querySelector('i').style.transform = `scaleX(${Math.max(0, v / 200)})`; });
      }
      document.body.classList.toggle('hover-foe', !!hoverId);
      const bn = game.banner;
      const key = bn ? bn.text + '|' + bn.sub : '';
      if (key !== bannerKey) {
        bannerKey = key;
        if (bn) { q.banner.querySelector('h2').textContent = bn.text; q.banner.querySelector('p').textContent = bn.sub || ''; }
      }
      q.banner.classList.toggle('show', !!bn);
      if (bn) q.banner.style.opacity = Math.min(1, bn.t * 2, (bn.dur - bn.t) * 4);
    },
  };
}
