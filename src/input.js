// Keyboard, mouse and touch input. Produces a plain `input` object the sim reads.
export function createInput(root) {
  const input = {
    mx: 0, my: 0, aim: null, auto: false, attack: false, skills: [false, false, false], potion: false,
    touch: false, onPause: () => {}, enabled: false,
  };
  const keys = new Set();
  let mouse = { x: innerWidth / 2, y: innerHeight / 2, has: false };
  let mouseDown = false, spaceDown = false, touchAttack = false;
  const joy = { id: null, ox: 0, oy: 0, x: 0, y: 0 };
  const R = 56;

  const setTouch = (v) => { if (input.touch !== v) { input.touch = v; input.auto = v; document.body.classList.toggle('touch', v); } };
  try { if (matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0) setTouch(true); } catch (e) { /* ignore */ }

  const kd = (e) => {
    if (e.repeat && !['Space'].includes(e.code)) { if (!e.code.startsWith('Digit')) { /* keep key state */ } }
    const k = e.code;
    if (k === 'Escape' || k === 'KeyP') { if (!e.repeat) input.onPause(); e.preventDefault(); return; }
    if (!input.enabled) return;
    if (k === 'Space') { spaceDown = true; e.preventDefault(); }
    else if (k === 'Digit1' || k === 'Numpad1') { if (!e.repeat) input.skills[0] = true; }
    else if (k === 'Digit2' || k === 'Numpad2') { if (!e.repeat) input.skills[1] = true; }
    else if (k === 'Digit3' || k === 'Numpad3') { if (!e.repeat) input.skills[2] = true; }
    else if (k === 'KeyF') { if (!e.repeat) input.potion = true; }
    else if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(k)) { keys.add(k); e.preventDefault(); }
  };
  const ku = (e) => { keys.delete(e.code); if (e.code === 'Space') spaceDown = false; };
  addEventListener('keydown', kd);
  addEventListener('keyup', ku);
  addEventListener('blur', () => { keys.clear(); spaceDown = false; mouseDown = false; });

  const gameEl = root.game;
  gameEl.addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') { mouse = { x: e.clientX, y: e.clientY, has: true }; if (input.touch) setTouch(false); } });
  gameEl.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') {
      if (e.button === 0) mouseDown = true;
      mouse = { x: e.clientX, y: e.clientY, has: true };
    }
  });
  addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse' && e.button === 0) mouseDown = false; });
  gameEl.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---- touch: floating joystick + buttons ----
  const joyZone = root.joyZone, joyBase = root.joyBase, joyKnob = root.joyKnob;
  joyZone.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    setTouch(true);
    if (joy.id !== null) return;
    joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.x = 0; joy.y = 0;
    joyZone.setPointerCapture(e.pointerId);
    joyBase.style.left = `${e.clientX}px`; joyBase.style.top = `${e.clientY}px`;
    joyKnob.style.left = `${e.clientX}px`; joyKnob.style.top = `${e.clientY}px`;
    joyBase.classList.add('on'); joyKnob.classList.add('on');
    e.preventDefault();
  });
  joyZone.addEventListener('pointermove', (e) => {
    if (e.pointerId !== joy.id) return;
    let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy;
    const l = Math.hypot(dx, dy);
    if (l > R) { dx = (dx / l) * R; dy = (dy / l) * R; }
    joy.x = dx / R; joy.y = dy / R;
    joyKnob.style.left = `${joy.ox + dx}px`; joyKnob.style.top = `${joy.oy + dy}px`;
  });
  const joyEnd = (e) => {
    if (e.pointerId !== joy.id) return;
    joy.id = null; joy.x = joy.y = 0;
    joyBase.classList.remove('on'); joyKnob.classList.remove('on');
  };
  joyZone.addEventListener('pointerup', joyEnd);
  joyZone.addEventListener('pointercancel', joyEnd);

  // on-screen buttons (delegated; data-act on HUD elements)
  const held = new Map();
  root.hud.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !input.enabled) return;
    const act = b.dataset.act;
    if (e.pointerType !== 'mouse') setTouch(true);
    if (act === 'attack') { touchAttack = true; held.set(e.pointerId, 'attack'); b.setPointerCapture?.(e.pointerId); }
    else if (act.startsWith('skill')) input.skills[+act.slice(5)] = true;
    else if (act === 'potion') input.potion = true;
    else if (act === 'pause') input.onPause();
    e.preventDefault();
  });
  const rel = (e) => { if (held.get(e.pointerId) === 'attack') { touchAttack = false; held.delete(e.pointerId); } };
  root.hud.addEventListener('pointerup', rel);
  root.hud.addEventListener('pointercancel', rel);
  root.hud.addEventListener('lostpointercapture', rel);

  input.update = (screenToWorld) => {
    let x = 0, y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    if (x || y) { const l = Math.hypot(x, y); x /= l; y /= l; }
    if (joy.id !== null) { x = joy.x; y = joy.y; }
    input.mx = x; input.my = y;
    input.attack = input.enabled && (mouseDown || spaceDown || touchAttack);
    if (!input.touch && mouse.has && screenToWorld) input.aim = screenToWorld(mouse.x, mouse.y);
  };
  input.reset = () => { keys.clear(); mouseDown = spaceDown = touchAttack = false; input.skills = [false, false, false]; input.potion = false; joy.id = null; joy.x = joy.y = 0; input.mx = input.my = 0; joyBase.classList.remove('on'); joyKnob.classList.remove('on'); };
  return input;
}
