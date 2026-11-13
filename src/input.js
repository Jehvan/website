// Mouse, touch and keyboard input, Kingsroad style:
//   click / tap the ground  -> walk there (hold to keep walking towards the pointer)
//   click / tap an enemy    -> target it: the hero walks into range and attacks until it falls
//   1 2 3 skills, F potion, Shift+click or Space attack in place, WASD also moves, wheel zooms, Esc pauses.
export function createInput(root) {
  const input = {
    mx: 0, my: 0, aim: null, dest: null, targetId: 0, attack: false, skills: [false, false, false], potion: false,
    touch: false, onPause: () => {}, enabled: false, view: null, game: null,
  };
  const keys = new Set();
  const ptr = { x: innerWidth / 2, y: innerHeight / 2, has: false, down: false, moveHold: false, shift: false, id: null };
  let spaceDown = false;

  const setTouch = (v) => { if (input.touch !== v) { input.touch = v; document.body.classList.toggle('touch', v); } };
  try { if (matchMedia('(pointer: coarse)').matches) setTouch(true); } catch (e) { /* ignore */ }

  addEventListener('keydown', (e) => {
    const k = e.code;
    if (k === 'Escape' || k === 'KeyP') { if (!e.repeat) input.onPause(); e.preventDefault(); return; }
    if (!input.enabled) return;
    if (k === 'Space') { spaceDown = true; e.preventDefault(); }
    else if (k === 'Digit1' || k === 'Numpad1') { if (!e.repeat) input.skills[0] = true; }
    else if (k === 'Digit2' || k === 'Numpad2') { if (!e.repeat) input.skills[1] = true; }
    else if (k === 'Digit3' || k === 'Numpad3') { if (!e.repeat) input.skills[2] = true; }
    else if (k === 'KeyF' || k === 'KeyQ') { if (!e.repeat) input.potion = true; }
    else if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) { keys.add(k); e.preventDefault(); }
  });
  addEventListener('keyup', (e) => { keys.delete(e.code); if (e.code === 'Space') spaceDown = false; });
  addEventListener('blur', () => { keys.clear(); spaceDown = false; ptr.down = false; });

  const el = root.game;
  const press = (x, y, shift) => {
    const v = input.view, g = input.game;
    if (!v || !g || !g.p || g.p.dead) return;
    ptr.shift = shift;
    if (shift) { ptr.moveHold = false; input.dest = null; return; }
    const id = v.pickEnemy(g, x, y, input.touch ? 1.5 : 1);
    if (id) { input.targetId = id; input.dest = null; ptr.moveHold = false; return; }
    const w = v.screenToWorld(x, y);
    if (!w) return;
    input.targetId = 0; input.dest = w; ptr.moveHold = true;
    v.showClick(w.x, w.y);
  };
  el.addEventListener('pointerdown', (e) => {
    if (!input.enabled) return;
    setTouch(e.pointerType !== 'mouse');
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (ptr.id !== null && ptr.id !== e.pointerId) return;
    ptr.id = e.pointerId; ptr.x = e.clientX; ptr.y = e.clientY; ptr.has = true; ptr.down = true;
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    press(e.clientX, e.clientY, e.shiftKey);
    e.preventDefault();
  });
  el.addEventListener('pointermove', (e) => {
    if (ptr.id !== null && e.pointerId !== ptr.id) return;
    ptr.x = e.clientX; ptr.y = e.clientY; ptr.has = true;
  });
  const up = (e) => { if (e.pointerId === ptr.id) { ptr.down = false; ptr.id = null; } };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
  el.addEventListener('wheel', (e) => { if (input.enabled) { input.view?.zoom(Math.sign(e.deltaY) * 1.2); e.preventDefault(); } }, { passive: false });

  // on-screen buttons (delegated; data-act on HUD elements)
  root.hud.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const act = b.dataset.act;
    if (act === 'pause') { input.onPause(); e.preventDefault(); return; }
    if (!input.enabled) return;
    if (act.startsWith('skill')) input.skills[+act.slice(5)] = true;
    else if (act === 'potion') input.potion = true;
    e.preventDefault(); e.stopPropagation();
  });

  input.update = () => {
    let x = 0, y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    if (x || y) { const l = Math.hypot(x, y); x /= l; y /= l; }
    input.mx = x; input.my = y;
    const v = input.view, g = input.game;
    if (v && ptr.has) {
      const w = v.screenToWorld(ptr.x, ptr.y);
      if (w) {
        input.aim = w;
        if (ptr.down && ptr.moveHold && input.enabled) input.dest = w;
      }
      v.setHover(!input.touch && g ? v.pickEnemy(g, ptr.x, ptr.y) : 0);
    }
    input.attack = input.enabled && (spaceDown || (ptr.down && ptr.shift));
  };
  input.reset = () => {
    keys.clear(); spaceDown = false; ptr.down = false; ptr.id = null; ptr.moveHold = false;
    input.skills = [false, false, false]; input.potion = false; input.mx = input.my = 0; input.dest = null; input.targetId = 0; input.attack = false;
  };
  return input;
}
