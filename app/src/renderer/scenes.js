// Escenas de fondo y animaciones de entrada por servidor. El catálogo elige cuál con `scene`.
const RIFT = '210,10 228,62 216,98 244,154 222,196 252,246 224,292 244,338 218,388 232,440 210,510 194,440 204,390 178,338 200,292 168,244 194,196 170,154 200,98 188,60'
const RIFT_CORE = '210,44 219,74 212,104 229,156 214,198 233,246 216,292 227,338 212,388 219,436 210,476 203,436 207,390 194,338 205,292 188,246 205,200 190,156 207,106 201,74'
const RIFT_HEART = '210,90 214,108 210,130 218,160 211,200 220,246 211,290 215,336 209,388 205,336 208,290 200,246 208,200 202,160 209,130 206,108'

const faces = '<i></i><i></i><i></i><i></i><i></i><i></i>'
const cube = (left, s, t, d, r, far) =>
  `<div class="drop${far ? ' far' : ''}" style="left:${left}px;--s:${s}px;--t:${t}s;--d:${d}s"><div class="cube" style="--r:${r}s">${faces}</div></div>`
const mote = (left, top, z, t, d, dx, gold) =>
  `<div class="mote${gold ? ' gold' : ''}" style="left:${left}px;top:${top}px;--z:${z}px;--t:${t}s;--d:${d}s;--dx:${dx}px"></div>`
const crystal = (x, y, rot, h, delay) =>
  `<g transform="translate(${x} ${y}) rotate(${rot})"><g class="bob" style="animation-delay:${delay}s"><polygon fill="#4c1d95" points="-${h * 0.2},0 -${h * 0.16},-${h * 0.66} 0,-${h} ${h * 0.16},-${h * 0.66} ${h * 0.2},0"/><polygon fill="#8b5cf6" points="0,-${h} ${h * 0.16},-${h * 0.66} ${h * 0.2},0 0,0"/><line x1="0" y1="-${h}" x2="0" y2="0" stroke="#ddd6fe" stroke-width="1.2"/></g></g>`

const SCENES = {
  gang: {
    theme: {
      bg: '#07060c', accent: '#7c3aed', accentBorder: '#a78bfa', glow: 'rgba(124,58,237,.45)',
      pill: '#6d28d9', kicker: '#c4b5fd', quote: '#cbc3dc',
    },
    background: () => `<div class="scene">
      <div class="stars" style="left:0;top:0;animation:twinkle 3s ease-in-out infinite"></div>
      <div class="stars" style="left:70px;top:40px;animation:twinkle 4.4s ease-in-out infinite;animation-delay:-2s"></div>
      <svg width="420" height="520" viewBox="0 0 420 520" style="position:absolute;left:600px;top:18px;overflow:visible">
        <defs>
          <filter id="blur-l" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="34"/></filter>
          <filter id="blur-m" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="12"/></filter>
          <filter id="blur-s" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
        </defs>
        <ellipse class="pulse" cx="210" cy="260" rx="160" ry="240" fill="#4c1d95" opacity=".55" filter="url(#blur-l)"/>
        <g class="breath">
          <polygon class="pulse" fill="#7c3aed" filter="url(#blur-m)" points="${RIFT}"/>
          <polygon fill="#a78bfa" points="${RIFT}"/>
          <polygon fill="#e9e3ff" points="${RIFT_CORE}"/>
          <polygon class="flick" fill="#ffffff" points="${RIFT_HEART}"/>
        </g>
        <g class="flick" fill="none" stroke="#c4b5fd" stroke-width="2.5">
          <path d="M222 196L266 178L298 188L318 176"/><path d="M178 338L136 356L108 348"/><path d="M244 338L282 362L300 392"/>
          <path d="M194 196L156 178L130 190"/><path d="M228 62L258 44"/><path d="M204 390L176 420L180 448"/>
        </g>
        <g fill="none" stroke="#8b5cf6" stroke-width="6" filter="url(#blur-s)" opacity=".7">
          <path d="M222 196L266 178L298 188"/><path d="M178 338L136 356"/><path d="M244 338L282 362"/><path d="M194 196L156 178"/>
        </g>
        ${crystal(84, 170, -28, 42, 0)}${crystal(346, 112, 22, 34, -1.6)}${crystal(366, 300, 36, 48, -3.1)}${crystal(62, 330, -40, 30, -2.3)}${crystal(150, 60, -12, 24, -0.8)}
      </svg>
      ${mote(760, 420, 4, 4.2, 0, -20)}${mote(800, 460, 3, 5, -1.2, 14)}${mote(830, 400, 5, 3.6, -2.1, 30)}${mote(720, 380, 3, 4.8, -3, -34)}
      ${mote(870, 440, 4, 4.4, -0.6, 22)}${mote(790, 340, 2, 3.8, -1.8, -10)}${mote(850, 360, 3, 5.4, -3.6, 8)}${mote(740, 470, 4, 4.6, -2.7, -16)}
      <div class="rain"></div>
      <div class="thunder"></div>
      <svg width="1120" height="230" viewBox="0 0 1120 230" style="position:absolute;left:0;bottom:88px"><path fill="#0d0b14" d="M0 230V150h40v-30h18v30h30v-60l12-20 12 20v60h40v-40h24v40h36v-90l14-26 14 26v90h30v-50h20v-24h10v24h20v50h44v-34h30v34h30V60l16-30 16 30v90h28v-46h22v46h46v-70l10-18 10 18v70h38v-30h40v30h34v-100l14-24 14 24v100h30v-40h26v40h44v-60l12-22 12 22v60h50v-36h28v36h40v-80l16-28 16 28v80h40v-28h30v28h40v-50h22v50h38v80z"/><path fill="#a78bfa" opacity=".5" d="M86 112h3v5h-3zM216 92h3v5h-3zM333 120h3v5h-3zM498 104h3v5h-3zM640 112h3v5h-3zM808 100h3v5h-3zM935 118h3v5h-3z"/><path fill="#13101c" d="M0 230v-40h60v-20h40v20h70v-30h50v30h90v-24h60v24h80v-36h70v36h90v-20h60v20h100v-30h80v30h90v-24h70v24h80v-16h70v76z"/></svg>
    </div>`,
    enter: (msg) => `<div>
      <div style="position:absolute;inset:0;background:#05040a;animation:darken .6s ease-out both"></div>
      <div style="position:absolute;left:460px;top:90px;width:200px;height:440px;animation:openRift 2.7s cubic-bezier(.7,0,.85,.35) both">
        <svg width="200" height="440" viewBox="160 30 100 460" preserveAspectRatio="none" style="overflow:visible">
          <defs><filter id="e-blur" x="-80%" y="-20%" width="260%" height="140%"><feGaussianBlur stdDeviation="10"/></filter></defs>
          <polygon fill="#7c3aed" filter="url(#e-blur)" points="${RIFT}"/>
          <polygon fill="#a78bfa" points="${RIFT}"/>
          <polygon fill="#f5f3ff" points="${RIFT_CORE}"/>
        </svg>
      </div>
      <div style="position:absolute;left:560px;top:310px">
        ${[[5, -420, -180, .1], [4, 380, -240, .2], [6, -300, 220, .15], [4, 460, 160, .3], [3, -120, -320, .25], [5, 160, 300, .05], [3, -480, 40, .35], [4, 520, -60, .4], [5, 60, -340, .2], [4, -200, 320, .3]]
          .map(([z, dx, dy, d]) => `<div class="spark" style="--z:${z}px;--dx:${dx}px;--dy:${dy}px;animation-delay:${d}s"></div>`).join('')}
      </div>
      <div style="position:absolute;inset:0;background:#f5f3ff;animation:flash 2.9s ease-in both"></div>
      <p class="enter-msg" style="color:#2e1065">${msg}</p>
    </div>`,
    enterMessage: 'La grieta te reclama… abriendo Minecraft',
    sub: '#4c1d95',
  },

  lucky: {
    theme: {
      bg: '#0b0905', accent: '#a16207', accentBorder: '#fcd34d', glow: 'rgba(234,179,8,.45)',
      pill: '#a16207', kicker: '#fcd34d', quote: '#e7d9b5',
    },
    background: () => `<div class="scene" style="background:#0b0905">
      <div style="position:absolute;left:660px;top:90px;width:380px;height:380px;border-radius:50%;background:#92400e;opacity:.45;filter:blur(90px)"></div>
      ${cube(560, 34, 7, -1, 5, true)}${cube(760, 40, 6.4, -0.4, 6, true)}${cube(930, 30, 7.6, -5, 5.5, true)}${cube(1060, 38, 6.8, -1.6, 5, true)}
      <div style="position:absolute;left:790px;top:400px;width:180px;height:36px;border-radius:50%;background:#f59e0b;opacity:.35;filter:blur(18px)"></div>
      <div style="position:absolute;left:810px;top:190px;width:140px;height:140px;animation:hover 4s ease-in-out infinite">
        <div class="drop still" style="--s:140px"><div class="cube slow">${faces}</div></div>
      </div>
      ${cube(640, 58, 5.2, -3.4, 4)}${cube(1000, 64, 4.8, -2.2, 3.6)}${cube(700, 46, 5.8, -4.6, 4.4)}
      ${mote(820, 430, 4, 4, 0, -18, true)}${mote(880, 440, 3, 4.8, -1.4, 16, true)}${mote(930, 420, 4, 3.8, -2.4, 26, true)}${mote(850, 400, 2, 4.4, -3.2, -8, true)}${mote(790, 450, 3, 5, -0.8, -26, true)}
      <div style="position:absolute;left:0;bottom:88px;width:100%;height:110px;background-color:#120e07;background-image:linear-gradient(90deg,rgba(0,0,0,.4) 50%,transparent 50%),linear-gradient(rgba(0,0,0,.3) 50%,transparent 50%);background-size:44px 44px;border-top:1px solid #3a2a0c"></div>
    </div>`,
    enter: (msg) => `<div>
      <div style="position:absolute;inset:0;background:#0a0703;animation:darken .5s ease-out both"></div>
      <div style="position:absolute;left:460px;top:220px;width:200px;height:200px;animation:cubeGrow 2.9s ease-in both">
        <div class="drop still" style="--s:200px"><div class="cube" style="--r:1.4s">${faces}</div></div>
      </div>
      <div style="position:absolute;left:545px;top:305px">
        ${[[34, '0 0', -360, -220, -160], [28, '33% 0', 300, -260, 200], [40, '66% 33%', 420, 120, 140], [30, '100% 66%', -440, 90, -220], [36, '33% 66%', -180, 300, 120],
          [26, '66% 100%', 200, 320, -140], [32, '0 100%', -60, -340, 260], [24, '100% 0', 520, -40, -90], [30, '33% 33%', -520, -60, 180], [22, '66% 66%', 80, 360, 300]]
          .map(([z, bp, dx, dy, rot]) => `<div class="frag" style="--z:${z}px;--bp:${bp};--dx:${dx}px;--dy:${dy}px;--rot:${rot}deg"></div>`).join('')}
      </div>
      <div style="position:absolute;inset:0;background:#fff4cc;animation:flash 2.9s ease-in both"></div>
      <p class="enter-msg" style="color:#5a3c00">${msg}</p>
    </div>`,
    enterMessage: '¡Que la suerte te acompañe! Abriendo Minecraft',
    sub: '#7a5200',
  },
}

window.SCENES = SCENES
