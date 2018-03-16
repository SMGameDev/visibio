var state = 0, // 0 = not connected/connecting, 1 = connected, 2 = playing, 3 = dead
  entities = [],
  metadata = {},
  map = [],
  me = {
    id: null,
    health: null
  },
  mapWidth = null,
  mapHeight = null;

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
  mapWidth = mapHeight = me.id = me.health = websocket = null;
  entities = map = [];
  metadata = {};
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

/* Game */

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

/* Rendering */

let overlayContainer = null,
  nameEl = null,
  // two = null,
  canvas = null,
  ctx = null;

function render() {
  loop = requestAnimFrame(render);

  let myPlayer = entities[entities.findIndex((e) => e.id === me.id)];
  if (!myPlayer) {
    return
  }
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

  ctx.setTransform(1, 0, 0, 1, -Math.floor((myPlayer.x - canvas.width / 2)), -Math.floor((myPlayer.y - canvas.height / 2)));
  // drawBackground();
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
        ctx.arc(e.x, e.y, 24, 0, 2 * Math.PI);
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
  // ctx.translate(-((canvas.width / 2.0) - myPlayer.x), -((canvas.height / 2.0) - myPlayer.y));
  // let rect = viewport.getBoundingClientRect();
  // two.scene.translation.set((-mapWidth / 2) + (rect.width / 2) - me.x, (-mapHeight / 2) + (rect.height / 2) - me.y);
  // two.render();
}

function worldToLocal(x, y) {
  return {x: x + (mapWidth / 2), y: y + mapHeight / 2}
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  render();
}

// function drawBackground() {
//   two.scene.fill = '#ededed'
//   // draw grid
//   let linesArr = [];
//   linesArr.push();
//   for (let x = 10; x < mapWidth; x += 17) {
//     linesArr.push(two.makeLine(x, 0, x, mapHeight));
//   }
//   for (let y = 10; y < mapHeight; y += 17) {
//     linesArr.push(two.makeLine(0, y, mapWidth, y));
//   }
//   let group = two.makeGroup(linesArr);
//   group.stroke = '#C2C2C2';
//   group.linewidth = 0.5;
//   // draw borders
//   let top = two.makeLine(mapWidth, 0, 0, 0);
//   let left = two.makeLine(0, 0, 0, mapHeight);
//   let bottom = two.makeLine(0, mapHeight, mapWidth, mapHeight);
//   let right = two.makeLine(mapWidth, mapHeight, mapWidth, 0);
//   let borders = two.makeGroup(top, left, bottom, right);
//   borders.stroke = '#7c7c7c';
//   borders.linewidth = 3;
// }


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

// function newPlayerBody(v) {
//   let circle = two.makeCircle(v.x, v.y, 17);
//   circle.fill = '#ababab';
//   circle.stroke = '#000000';
//   circle.linewidth = 2;
//   return circle
// }

function handle(bytes) {
  let msg = visibio.Message.getRootAsMessage(new flatbuffers.ByteBuffer(bytes));
  switch (msg.packetType()) {
    case visibio.Packet.World:
      console.log('received world packet');
      state = 2;
      let world = msg.packet(new visibio.World());
      mapWidth = world.width() * 64;
      mapHeight = world.height() * 64;
      me.id = world.id().toFloat64();
      showCanvas();
      // todo process the map--walls, etc.
      break;
    case visibio.Packet.Perception:
      let perception = msg.packet(new visibio.Perception());
      me.health = perception.health();
      entities = [];
      console.log(perception.snapshotsLength())
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

