// Escenas de fondo en 3D (CSS) y animación de entrada por servidor. El catálogo elige cuál con `scene`.
// Cada escena da: theme (variables CSS, incluida la fuente de títulos), background() y enter(msg).
// La animación de entrada la hace la propia escena cuando #app tiene la clase `open` (styles.css).

const faces = '<i></i><i></i><i></i><i></i><i></i><i></i>'
const mote = (left, top, z, t, d, dx, gold) =>
  `<div class="mote${gold ? ' gold' : ''}" style="left:${left}px;top:${top}px;--z:${z}px;--t:${t}s;--d:${d}s;--dx:${dx}px"></div>`

// Cristal que orbita la grieta: ángulo en el anillo, altura, tamaño y radio.
const shard = (a, y, w, h, r) =>
  `<div class="shard" style="--a:${a}deg;--r:${r}px;left:${-w / 2}px;top:${y}px;width:${w}px;height:${h}px"><b></b><b></b></div>`
const dust = (a, y, z, r) => `<div class="dust" style="--a:${a}deg;--r:${r}px;--z:${z}px;top:${y}px"></div>`

// Lucky blocks: uno que cae al fondo y uno que flota a cierta profundidad.
const falling = (left, s, t, d, r) =>
  `<div class="drop" style="left:${left}px;--s:${s}px;--t:${t}s;--d:${d}s"><div class="cube tumble" style="--r:${r}s">${faces}</div></div>`
const mini = (left, top, z, t, r) =>
  `<div class="mini" style="left:${left}px;top:${top}px;--s:56px;--z:${z}px;--t:${t}s"><div class="cube turn" style="--r:${r}s">${faces}</div></div>`

const enterOverlay = (msg, flash, color, delay) => `<div style="--fd:${delay}s">
  <div class="flash" style="background:${flash}"></div>
  <p class="enter-msg" style="color:${color}">${msg}</p>
  <p class="enter-sub" style="color:${color}">ABRIENDO MINECRAFT</p>
</div>`

const SCENES = {
  gang: {
    theme: {
      bg: '#06050b', accent: '#7c3aed', 'accent-border': '#a78bfa', 'accent-glow': 'rgba(124,58,237,.45)',
      'on-accent': '#ffffff', line: 'rgba(196,181,253,.3)', kicker: '#c4b5fd', quote: '#cbc3dc',
      display: "'Bebas Neue', Inter, sans-serif", 'display-weight': '400',
      h1: '150px', 'h1-leading': '.86', 'h1-spacing': '.02em', 'btn-size': '30px',
    },
    background: () => `<div class="scene gang"><div class="cam">
      <div class="stars" style="left:0;top:0;animation:twinkle 3s ease-in-out infinite"></div>
      <div class="stars" style="left:70px;top:40px;animation:twinkle 4.4s ease-in-out infinite;animation-delay:-2s"></div>
      <div class="g-glow pulse"></div>
      <div class="g-floor"></div>
      <div class="stage3d g-stage">
        <div class="rift-sway"><div class="rift-body">
          <div class="rift-glow pulse"><div class="rift-edge"></div></div>
          <div class="rift-edge"></div>
          <div class="rift-core">
            <div class="rift-sun"></div>
            <svg width="420" height="170" viewBox="0 0 420 170"><path fill="#5b21b6" d="M0 170V110h30V70l14-22 14 22v40h34V84h26v26h30V40l16-28 16 28v70h28V76h22v34h36V56l12-20 12 20v54h30V90h28v20h32V64l14-24 14 24v46h22v60z"/><path fill="#3b0f8a" d="M0 170v-34h50v-16h40v16h60v-24h46v24h70v-18h50v18h60v-14h44v48z"/></svg>
          </div>
          <div class="rift-heart"></div>
        </div></div>
        <div class="orbit"><div class="orbit-tilt">
          <div class="orbit-ring">
            ${shard(0, -190, 30, 84, 240)}${shard(64, 40, 22, 60, 220)}${shard(128, -80, 36, 100, 250)}
            ${shard(190, 110, 20, 56, 230)}${shard(250, -150, 28, 76, 215)}${shard(310, 0, 24, 66, 245)}
          </div>
          <div class="orbit-ring rev">
            ${dust(20, -120, 6, 150)}${dust(110, 60, 4, 170)}${dust(200, -30, 6, 140)}${dust(290, 150, 4, 160)}${dust(340, -200, 5, 120)}
          </div>
        </div></div>
      </div>
      ${mote(760, 420, 4, 4.2, 0, -20)}${mote(800, 460, 3, 5, -1.2, 14)}${mote(830, 400, 5, 3.6, -2.1, 30)}${mote(720, 380, 3, 4.8, -3, -34)}
      ${mote(870, 440, 4, 4.4, -0.6, 22)}${mote(790, 340, 2, 3.8, -1.8, -10)}${mote(850, 360, 3, 5.4, -3.6, 8)}${mote(740, 470, 4, 4.6, -2.7, -16)}
      <div class="rain"></div>
      <div class="thunder"></div>
      <svg class="g-skyline" width="1120" height="230" viewBox="0 0 1120 230"><path fill="#0b0912" d="M0 230V150h40v-30h18v30h30v-60l12-20 12 20v60h40v-40h24v40h36v-90l14-26 14 26v90h30v-50h20v-24h10v24h20v50h44v-34h30v34h30V60l16-30 16 30v90h28v-46h22v46h46v-70l10-18 10 18v70h38v-30h40v30h34v-100l14-24 14 24v100h30v-40h26v40h44v-60l12-22 12 22v60h50v-36h28v36h40v-80l16-28 16 28v80h40v-28h30v28h40v-50h22v50h38v80z"/><path fill="#a78bfa" opacity=".5" d="M86 112h3v5h-3zM216 92h3v5h-3zM333 120h3v5h-3zM498 104h3v5h-3zM640 112h3v5h-3zM808 100h3v5h-3zM935 118h3v5h-3z"/><path fill="#100d19" d="M0 230v-40h60v-20h40v20h70v-30h50v30h90v-24h60v24h80v-36h70v36h90v-20h60v20h100v-30h80v30h90v-24h70v24h80v-16h70v76z"/></svg>
    </div></div>`,
    enter: (msg) => enterOverlay(msg, '#f5f3ff', '#2e1065', 1.7),
    enterMessage: 'La grieta te reclama…',
  },

  lucky: {
    theme: {
      bg: '#0f0c06', accent: '#f5b301', 'accent-border': '#fcd34d', 'accent-glow': 'rgba(234,179,8,.45)',
      'on-accent': '#241700', line: 'rgba(252,211,77,.28)', kicker: '#fcd34d', quote: '#e7d9b5',
      display: "'Pixelify Sans', Inter, sans-serif", 'display-weight': '700',
      h1: '84px', 'h1-leading': '.95', 'h1-spacing': '0', 'btn-size': '26px',
    },
    background: () => `<div class="scene lucky"><div class="cam">
      <div class="l-glow"></div>
      ${falling(560, 34, 7, -1, 5)}${falling(760, 40, 6.4, -0.4, 6)}${falling(930, 30, 7.6, -5, 5.5)}${falling(1060, 38, 6.8, -1.6, 5)}
      <div class="stage3d l-stage">
        <div class="l-floor"></div>
        <div class="l-shadow"></div>
        ${mini(60, 120, -260, 5, 9)}${mini(520, 90, -180, 6, 11)}${mini(540, 400, 60, 4.4, 8)}
        <div class="l-beam"></div>
        <div class="l-block"><div class="l-spin turn">
          <div class="cube l-big" style="--s:190px">${faces}</div>
          <div class="l-frags">
            ${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `<div class="cube piece q${n}" style="--s:95px">${faces}</div>`).join('')}
          </div>
        </div></div>
      </div>
      ${mote(780, 470, 4, 4, 0, -18, true)}${mote(840, 480, 3, 4.8, -1.4, 16, true)}${mote(890, 460, 4, 3.8, -2.4, 26, true)}${mote(810, 440, 2, 4.4, -3.2, -8, true)}${mote(750, 490, 3, 5, -0.8, -26, true)}
    </div></div>`,
    enter: (msg) => enterOverlay(msg, '#fff4cc', '#3a2600', 1.5),
    enterMessage: '¡Que la suerte te acompañe!',
  },
}

window.SCENES = SCENES
