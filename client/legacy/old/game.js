var state = 0, // 0 = not connected/connecting, 1 = connected, 2 = playing, 3 = dead
  entities = [],
  metadata = {},
  map = null,
  me = {
    id: null,
    health: null
  };

let websocket = null,
  inputs = {
    up: false,
    down: false,
    left: false,
    right: false,
    rotation: 0,
    shooting: false
  },
  lastPerception = null,
  address = "ws://localhost:8080/"; // todo matchmaking

/* Globals */

let loop = null;

function reset() {
  map = null;
  me.id = null;
  me.health = null;
  websocket = null;
  entities = null;
  metadata = null;
  lastPerception = null;
  inputs = {
    up: false,
    down: false,
    left: false,
    right: false,
    rotation: 0,
    shooting: false
  };
}

window.play = (name) => {
  me.name = name;
  sendRespawn(name);
};

function showMenu() {
  $(canvas).hide();
  $(overlayContainer).show();
  if (loop) {
    cancelRequestAnimFrame(loop);
  }
}

function showCanvas() {
  $(overlayContainer).hide();
  $(canvas).show();
  resizeCanvas();
}

/* Rendering */

let overlayContainer = null,
  nameEl = null,
  canvas = null,
  ctx = null;

function render() {
  loop = requestAnimFrame(render);

  let myPlayer = entities[entities.findIndex((e) => e.id === me.id)];
  if (!myPlayer) {
    return
  }
  // draw grid
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = '#C2C2C2';
  ctx.lineWidth = 0.5;

  ctx.beginPath();
  for (let x = -(myPlayer.x % 64); x < canvas.width; x += 32) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
  }
  for (let y = -(myPlayer.y % 64); y < canvas.height; y += 32) {
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
  }
  ctx.stroke();
  ctx.setTransform(1, 0, 0, 1, -(myPlayer.x - canvas.width / 2), -(myPlayer.y - canvas.height / 2));

  // draw walls
  drawWalls(myPlayer);
// draw entities
  entities.forEach((e) => {
    ctx.save();
    switch (e.type) {
      case visibio.Entity.Player: {
        ctx.translate(e.x, e.y);
        ctx.rotate(e.rotation);
        ctx.translate(-e.x, -e.y);
        ctx.fillStyle = '#ababab';
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 16, 0, 2 * Math.PI);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        break;
      }
      default: {
      }
    }
    ctx.restore();
  })
}

// function worldToLocal(x, y) {
//   return {x: x + (render.js.js.width*64 / 2), y: y + render.js.js.height*64 / 2}
// }

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  render();
}

function drawWalls(myPlayer) {
  let screen = [];

  let x = Math.floor(-(myPlayer.x - canvas.width) / map.width);
  let y = Math.floor(-(myPlayer.y - canvas.height) / map.height);
  let xspan = Math.ceil(canvas.width / 64); // how many to draw on screen
  let yspan = Math.ceil(canvas.height / 64);

  // first pass: determine tiles
  for (let a = x; a < a + xspan; a++) {
    screen[x] = [];
    for (let b = y; b < b + yspan; b++) {
      let tile = map.get(x, y);
      screen[x][y] = tile
    }
  }

  ctx.strokeStyle = '##636e72';
  ctx.lineWidth = 3;
  // second pass: render.js
  for (let a = x; a < a + xspan; a++) {
    for (let b = y; b < b + yspan; b++) {
      if (!screen[a][b]) break;
      let top = true;
      let left = true;
      let bottom = true;
      let right = true;

      if (a + 1 < xspan && screen[a + 1][b] > 0) {
        right = false;
      }
      if (a - 1 > 0 && screen[a - 1][b] > 0) {
        left = false;
      }
      if (b + 1 < yspan && screen[a][b + 1] > 0) {
        bottom = false;
      }
      if (b - 1 > 0 && screen[a][b - 1] > 0) {
        top = false;
      }
      ctx.beginPath();
      ctx.moveTo(x + a * 64, y + b * 64);
      if (top) {
        ctx.lineTo(x + (a + 1) * 64, y + b * 64);
      } else {
        ctx.moveTo(x + (a + 1) * 64, y + b * 64);
      }
      if (right) {
        ctx.lineTo(x + (a + 1) * 64, y + (b + 1) * 64);
      } else {
        ctx.moveTo(x + (a + 1) * 64, y + (b + 1) * 64);
      }
      if (bottom) {
        ctx.lineTo(x + a * 64, y + (b + 1) * 64)
      } else {
        ctx.moveTo(x + a * 64, y + (b + 1) * 64);
      }
      if (left) {
        ctx.lineTo(x + a * 64, y + b * 64)
      }
      ctx.stroke()
    }
  }
}


/* Networking */

let heartbeatLoop = null;
let heartbeat = (function () {
  let builder = new flatbuffers.Builder(8);
  visibio.Heartbeat.startHeartbeat(builder);
  let hb = visibio.Heartbeat.endHeartbeat(builder);
  let msg = message(builder, hb, visibio.Packet.Heartbeat);
  return () => send(msg)
})();

function connect(addr) {
  websocket = new WebSocket(addr);
  websocket.binaryType = 'arraybuffer';
  websocket.onopen = function () {
    console.log('connected to server');
    state = 1;
    setInterval(heartbeat, 1000)
  };
  websocket.onerror = function (e) {
    console.log('connection error', e);
    state = 0
  };
  websocket.onmessage = (e) => handle(new Uint8Array(e.data));
  websocket.onclose = function () {
    console.log('connection closed');
    state = 0;
    clearInterval(heartbeatLoop);
    reset();
    showMenu();
  }
}

function handle(bytes) {
  let msg = visibio.Message.getRootAsMessage(new flatbuffers.ByteBuffer(bytes));
  switch (msg.packetType()) {
    case visibio.Packet.World:
      console.log('received _world packet');
      state = 2;
      let world = msg.packet(new visibio.World());
      me.id = world.id().toFloat64();
      showCanvas();
      // todo process the render.js.js--walls, etc.
      break;
    case visibio.Packet.Perception:
      let perception = msg.packet(new visibio.Perception());
      me.health = perception.health();
      entities = [];
      console.log(perception.snapshotsLength());
      for (let i = 0; i < perception.snapshotsLength(); i++) {
        let snapshot = perception.snapshots(i);
        switch (snapshot.entityType()) {
          case visibio.Entity.Player: {
            let player = snapshot.entity(new visibio.Player());
            let id = player.id().toFloat64();
            let x = player.position().x();
            let y = player.position().y();
            let rotation = player.rotation();
            let name = player.name();
            entities.push({
              id: id,
              type: visibio.Entity.Player,
              x: x,
              y: y,
              rotation: rotation,
            });
            if (name) {
              metadata[id] = {
                name: name || "unnamed",
              }
            }
            break;
          }
          case visibio.Entity.Bullet: {
            let bullet = snapshot.entity(new visibio.Bullet());
            let id = bullet.id().toFloat64();
            let x = bullet.position().x();
            let y = bullet.position().y();
            let vx = bullet.velocity().x();
            let vy = bullet.velocity().y();
            let ox = bullet.origin().x();
            let oy = bullet.origin().y();

            entities.push({
              id: id,
              type: visibio.Entity.Bullet,
              x: x,
              y: y,
              vx: vx,
              vy: vy,
            });
            if (bullet.origin()) {
              metadata[id] = {
                ox: ox,
                oy: oy
              }
            }
            break;
          }
        }
      }
      lastPerception = Date.now();
      break;
    case visibio.Packet.Death:
      reset();
      showMenu();
      break;
  }
}

const sendInputs = _.throttle(() => {
  let builder = new flatbuffers.Builder(8);
  visibio.Inputs.startInputs(builder);
  visibio.Inputs.addLeft(builder, inputs.left);
  visibio.Inputs.addRight(builder, inputs.right);
  visibio.Inputs.addDown(builder, inputs.down);
  visibio.Inputs.addUp(builder, inputs.up);
  visibio.Inputs.addRotation(builder, inputs.rotation);
  visibio.Inputs.addShooting(builder, inputs.shooting);
  send(message(builder, visibio.Inputs.endInputs(builder), visibio.Packet.Inputs))
}, 5, {leading: false});

function sendRespawn(name) {
  let builder = new flatbuffers.Builder(64);
  let n = builder.createString(name);
  visibio.Respawn.startRespawn(builder);
  visibio.Respawn.addName(builder, n);
  send(message(builder, visibio.Respawn.endRespawn(builder), visibio.Packet.Respawn))
}

function message(builder, packet, type) {
  visibio.Message.startMessage(builder);
  visibio.Message.addPacketType(builder, type);
  visibio.Message.addPacket(builder, packet);
  let msg = visibio.Message.endMessage(builder);
  builder.finish(msg);
  return builder.asUint8Array()
}

function send(data) {
  if (isConnected()) {
    websocket.send(data);
    return true;
  }
  return false;
}

function isConnected() {
  return websocket && websocket.readyState === WebSocket.OPEN;
}

window.onMoveKeys = function (upMode, event) {
  if (state !== 2) {
    return;
  }
  switch (event.keyCode) {
    case 87: // w key
      inputs.up = !upMode;
      sendInputs();
      break;
    case 65: // a key
      inputs.left = !upMode;
      sendInputs();
      break;
    case 83: // s key
      inputs.down = !upMode;
      sendInputs();
      break;
    case 68: // d key
      inputs.right = !upMode;
      sendInputs();
      break;
  }
};

$(document).ready(() => {
  window.requestAnimFrame = (function () {
    return window.requestAnimationFrame ||
      window.webkitRequestAnimationFrame ||
      window.mozRequestAnimationFrame ||
      window.oRequestAnimationFrame ||
      window.msRequestAnimationFrame ||
      function (callback) {
        return window.setTimeout(callback, 1000 / 60);
      };
  })();

  window.cancelRequestAnimFrame = (function () {
    return window.cancelAnimationFrame ||
      window.webkitCancelRequestAnimationFrame ||
      window.mozCancelRequestAnimationFrame ||
      window.oCancelRequestAnimationFrame ||
      window.msCancelRequestAnimationFrame ||
      clearTimeout
  })();

  overlayContainer = document.getElementById("overlay");
  nameEl = document.getElementById("name");
  canvas = document.getElementById("canvas");
  ctx = canvas.getContext('2d');
  // two = new Two({fullscreen: true, type: Two.Types.webgl}).appendTo(document.body);
  // viewport = two.renderer.domElement;

  $(window).resize(resizeCanvas);

  $(window).keypress((e) => {
    if (e.which === 13) { // enter key
      if (state === 1) {
        play(nameEl.value);
      } else {
        console.log('tried to respawn while not connected')
      }
    }
  });
  $(window).keyup(e => onMoveKeys(true, e));
  $(window).keydown(e => onMoveKeys(false, e));

  showMenu();
  connect(address);
});

