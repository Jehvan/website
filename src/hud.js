// In-game HUD (DOM): bars, level, stage/wave, gold, skill + potion buttons, banner.
import { CLASSES, xpToNext, MAX_LEVEL } from './data.js';
import { icon } from './icons.js';

export function createHUD(el) {
  el.innerHTML = `
    <div class="hud-tl">
      <div class="lvl" id="h-lvl">1</div>
      <div class="bars">
        <div class="bar hp"><i id="h-hp"></i><span id="h-hpt"></span></div>
        <div class="bar mp"><i id="h-mp"></i><span id="h-mpt"></span></div>
        <div class="bar xp"><i id="h-xp"></i></div>
      </div>
    </div>
    <div class="hud-tc"><div id="h-stage"></div><div id="h-wave"></div></div>
    <div class="hud-tr"><div class="gold"><img id="h-coin" alt=""><b id="h-gold">0</b></div><button class="pausebtn" data-act="pause" aria-label="Pause">II</button></div>
    <div class="hud-act">
      <button class="act attack" data-act="attack" aria-label="Attack"><img id="h-atk" alt=""></button>
      <button class="act skill" data-act="skill0"><img alt=""><b>1</b><em></em><u></u></button>
      <button class="act skill" data-act="skill1"><img alt=""><b>2</b><em></em><u></u></button>
      <button class="act skill" data-act="skill2"><img alt=""><b>3</b><em></em><u></u></button>
      <button class="act potion" data-act="potion"><img alt=""><b>F</b><span id="h-pot">3</span></button>
    </div>
    <div id="banner"><h2></h2><p></p></div>`;
  const $ = (s) => el.querySelector(s);
  const q = {
    lvl: $('#h-lvl'), hp: $('#h-hp'), hpt: $('#h-hpt'), mp: $('#h-mp'), mpt: $('#h-mpt'), xp: $('#h-xp'),
    stage: $('#h-stage'), wave: $('#h-wave'), gold: $('#h-gold'), pot: $('#h-pot'), banner: $('#banner'),
    skills: [...el.querySelectorAll('.skill')], atk: $('#h-atk'), potBtn: $('.potion'),
  };
  $('#h-coin').src = icon('coin', 32);
  el.querySelector('.potion img').src = icon('potion', 48);
  const last = {};
  const set = (k, v, fn) => { if (last[k] !== v) { last[k] = v; fn(v); } };
  let bannerKey = '';

  return {
    el,
    setClass(cls) {
      const c = CLASSES[cls];
      q.atk.src = icon(cls === 'knight' ? 'sword' : cls === 'ranger' ? 'bow' : 'staff', 56);
      c.skills.forEach((s, i) => { q.skills[i].querySelector('img').src = icon(s.id, 48); q.skills[i].title = `${s.name}: ${s.desc}`; });
      for (const k in last) delete last[k];
    },
    update(game) {
      const { p, save, hero, stage } = game;
      if (!p) return;
      set('lvl', save.level, (v) => { q.lvl.textContent = v; });
      set('hp', Math.ceil(p.hp) + '/' + hero.maxHp, () => { q.hp.style.transform = `scaleX(${Math.max(0, p.hp / hero.maxHp)})`; q.hpt.textContent = `${Math.ceil(p.hp)} / ${hero.maxHp}`; });
      set('mp', Math.floor(p.mp) + '/' + hero.maxMp, () => { q.mp.style.transform = `scaleX(${p.mp / hero.maxMp})`; q.mpt.textContent = `${Math.floor(p.mp)} / ${hero.maxMp}`; });
      const need = save.level >= MAX_LEVEL ? 1 : xpToNext(save.level);
      set('xp', save.xp + '/' + need, () => { q.xp.style.transform = `scaleX(${save.level >= MAX_LEVEL ? 1 : save.xp / need})`; });
      set('stage', stage.name, (v) => { q.stage.textContent = v; });
      set('wave', stage.waveIdx + '/' + stage.waves.length, () => { q.wave.textContent = `Wave ${Math.max(1, stage.waveIdx + 1)} / ${stage.waves.length}`; });
      set('gold', save.gold, (v) => { q.gold.textContent = v; });
      set('pot', save.potions, (v) => { q.pot.textContent = v; q.potBtn.classList.toggle('empty', v === 0); });
      const c = CLASSES[save.cls];
      c.skills.forEach((s, i) => {
        const b = q.skills[i];
        const locked = save.level < s.unlock;
        const cdp = locked ? 0 : p.cd[i] / s.cd;
        set('sk' + i, `${locked}|${Math.round(cdp * 40)}|${p.mp >= s.cost}`, () => {
          b.classList.toggle('locked', locked);
          b.classList.toggle('nomana', !locked && p.mp < s.cost);
          b.style.setProperty('--cd', cdp.toFixed(3));
          b.querySelector('em').textContent = locked ? `Lv ${s.unlock}` : '';
          b.querySelector('u').textContent = !locked && cdp > 0 ? Math.ceil(p.cd[i]) : '';
        });
      });
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
