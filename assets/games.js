// Simple games loader and Collectathon implementation
(() => {
  function qs(sel, el = document) { return el.querySelector(sel); }
  function qsa(sel, el = document) { return Array.from(el.querySelectorAll(sel)); }

  // Game selection
  const gameButtons = qsa('.game-btn');
  const placeholder = qs('.game-placeholder');
  const chompUI = qs('#collectathon-ui');
  const chompCanvas = qs('#collect-canvas');
  const chompCount = qs('#collect-count');
  const restartBtn = qs('#restart-btn');
  const touchControls = qs('#touch-controls');

  gameButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const game = btn.dataset.game;
      placeholder && (placeholder.style.display = 'none');
      if (game === 'chomp') {
        chompUI.classList.remove('hidden');
        startChomp();
      }
    });
  });

  // --- Responsive canvas helper ---
  function fitCanvasToParent(canvas, baseW=800, baseH=500) {
    function resize() {
      const parent = canvas.parentElement;
      const w = parent.offsetWidth;
      const scale = w/baseW;
      canvas.style.width = w + 'px';
      canvas.style.height = (baseH*scale) + 'px';
    }
    window.addEventListener('resize', resize);
    resize();
  }

  // --- Collectathon game ---
  function startChomp() {
    const canvas = chompCanvas;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const player = { x: 40, y: 40, size: 18, speed: 220 };
    const keys = { ArrowUp:0, ArrowDown:0, ArrowLeft:0, ArrowRight:0, w:0,a:0,s:0,d:0 };
    const pellets = [];
    let last = performance.now();
    let collected = 0;
    let running = true;
    let touchDir = null;

    // focus for keyboard events
    canvas.focus();
    fitCanvasToParent(canvas, W, H);

    // --- Sound effect ---
    let popAudioCtx, popBuffer;
    function makePopBuffer() {
      // Simple pop/chomp sound: short sine burst with envelope
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const dur = 0.09;
      const sampleRate = ctx.sampleRate;
      const len = Math.floor(sampleRate * dur);
      const buf = ctx.createBuffer(1, len, sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sampleRate;
        // Envelope: quick attack/decay
        let env = Math.exp(-18*t);
        // Sine pop, freq 340-180Hz
        let f = 340 - 160*t;
        data[i] = Math.sin(2*Math.PI*f*t) * env * 0.5;
      }
      return {ctx, buf};
    }
    function playPop() {
      if (!popAudioCtx) {
        const o = makePopBuffer();
        popAudioCtx = o.ctx;
        popBuffer = o.buf;
      }
      const src = popAudioCtx.createBufferSource();
      src.buffer = popBuffer;
      src.connect(popAudioCtx.destination);
      src.start();
    }

    // populate pellets
    function spawnPellets(n=20){
      pellets.length = 0;
      for(let i=0;i<n;i++){
        const r = 6 + Math.random()*8;
        pellets.push({
          x: r + Math.random()*(W - 2*r),
          y: r + Math.random()*(H - 2*r),
          r,
          color: `hsl(${Math.random()*360} 80% 60%)`
        });
      }
    }

    spawnPellets(28);
    collected = 0; updateCounter();

    function updateCounter(){
      chompCount.textContent = `Collected: ${collected}`;
    }

    function reset(){
      player.x = W/2; player.y = H/2; collected = 0; spawnPellets(28); updateCounter();
    }

    restartBtn.onclick = () => { reset(); };

    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    // --- Touch controls ---
    if (touchControls) {
      touchControls.style.display = 'flex';
      const dirMap = {up:'ArrowUp',down:'ArrowDown',left:'ArrowLeft',right:'ArrowRight'};
      let active = {};
      function setDir(dir, val) {
        const k = dirMap[dir];
        if (k) keys[k] = val;
      }
      qsa('.touch-btn', touchControls).forEach(btn => {
        btn.addEventListener('touchstart', e => {
          e.preventDefault();
          setDir(btn.dataset.dir, 1);
          active[btn.dataset.dir] = true;
        });
        btn.addEventListener('touchend', e => {
          e.preventDefault();
          setDir(btn.dataset.dir, 0);
          active[btn.dataset.dir] = false;
        });
        btn.addEventListener('touchcancel', e => {
          setDir(btn.dataset.dir, 0);
          active[btn.dataset.dir] = false;
        });
      });
    }

    function onKey(e){
      const k = e.key;
      if (k in keys) { keys[k] = 1; e.preventDefault(); }
    }
    function onKeyUp(e){
      const k = e.key;
      if (k in keys) { keys[k] = 0; e.preventDefault(); }
    }

    function rectCircleColl(px,py,ps, cx,cy,cr){
      // find closest point on rect to circle center
      const rx = Math.max(px-ps/2, Math.min(cx, px+ps/2));
      const ry = Math.max(py-ps/2, Math.min(cy, py+ps/2));
      const dx = rx - cx, dy = ry - cy;
      return (dx*dx + dy*dy) <= cr*cr;
    }

    function update(dt){
      let vx=0, vy=0;
      if (keys.ArrowUp || keys.w) vy -= 1;
      if (keys.ArrowDown || keys.s) vy += 1;
      if (keys.ArrowLeft || keys.a) vx -= 1;
      if (keys.ArrowRight || keys.d) vx += 1;
      const len = Math.hypot(vx,vy) || 1;
      vx = vx/len; vy = vy/len;
      player.x += vx * player.speed * dt;
      player.y += vy * player.speed * dt;
      // clamp
      player.x = Math.max(player.size/2, Math.min(W-player.size/2, player.x));
      player.y = Math.max(player.size/2, Math.min(H-player.size/2, player.y));

      // check pellet collisions
      for (let i=pellets.length-1;i>=0;i--){
        const p = pellets[i];
        if (rectCircleColl(player.x, player.y, player.size, p.x, p.y, p.r)){
          pellets.splice(i,1);
          collected += 1;
          playPop();
          updateCounter();
        }
      }

      // if all collected, respawn
      if (pellets.length === 0){
        spawnPellets(28);
      }
    }

    function draw(){
      ctx.clearRect(0,0,W,H);
      // draw pellets
      for (const p of pellets){
        ctx.beginPath();
        ctx.fillStyle = p.color;
        ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
        ctx.fill();
      }
      // draw player (square with outline)
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(player.x - player.size/2, player.y - player.size/2, player.size, player.size);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.strokeRect(player.x - player.size/2, player.y - player.size/2, player.size, player.size);
    }

    function loop(t){
      if (!running) return;
      const dt = Math.min(0.05, (t - last)/1000);
      last = t;
      update(dt);
      draw();
      requestAnimationFrame(loop);
    }

    // start loop
    last = performance.now();
    running = true;
    requestAnimationFrame(loop);

    // expose a stop method if we switch games later
    return {
      stop(){ running=false; window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKeyUp); }
    };
  }

})();
