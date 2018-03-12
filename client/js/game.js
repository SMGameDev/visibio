(function () {
  var state = 0, // 0 = not connected/connecting, 1 = connected, 2 = playing, 3 = dead
    entities = [],
    map = [],
    websocket = null,
    me = {
      id: null,
      health: null
    },
    mapWidth = null,
    mapHeight = null,
    inputs = {
      up: false,
      down: false,
      left: false,
      right: false,
      rotation: 0,
      shooting: false
    },
    address = "ws://localhost:8080/"; // todo matchmaking

  /* Globals */

  var overlayContainer = null,
    nameField = null,
    canvas = null,
    ctx = null,
    loop = null,
    menuShown = true;

  window.onload = function () {
    console.log('initializing game');
    overlayContainer = document.getElementById("overlay");
    nameField = document.getElementById("name");
    canvas = document.getElementById('canvas');
    resizeCanvas();
    hideCanvas();
    connect(address);
  };

  window.onkeydown = onKeyDown;
  window.onkeyup = (e) => onMoveKeys(true, event);

  function reset() {
    console.log('resetting game');
    cancelRequestAnimFrame(loop);
    mapWidth, mapHeight, me.id, me.health = null;
    entities, map = [];
    clearCanvas();
    hideCanvas();
    showMenu()
  }

  window.play = function (name) {
    sendRespawn(name);
  };

  window.hideMenu = () => {
    $(overlayContainer).fadeOut('slow', function () {
      menuShown = false;
    });
  };
  window.showMenu = () => {
    menuShown = true;
    $(overlayContainer).fadeIn('slow');
  };

  window.hideCanvas = () => $(canvas).hide();
  window.showCanvas = () => $(canvas).show();

  window.onresize = e => resizeCanvas();

  function onKeyDown(event) {
    if (event.keyCode === 13) { // enter key
      if (state === 1) {
        play(nameField.value);
      } else {
        console.log('tried to respawn while not connected')
      }
    } else {
      onMoveKeys(false, event);
    }
  }

  /* Game */

  function tick() {
    renderGame();
    loop = requestAnimFrame(tick);
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

  /* Rendering */

  function renderGame() {
    if (state !== 2) return;
    drawGrid()
  }

  function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  function drawGrid() {
    // Grid and bg color
    ctx.fillStyle = '#CCCCCC';
    ctx.fillRect(0, 0, mapWidth, mapHeight);

    ctx.strokeStyle = '#C2C2C2';
    ctx.lineWidth = 1;

    for (let x = 0; x < mapWidth; x += 25) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, mapHeight);
      ctx.stroke();
    }
    for (let y = 0; y < mapHeight; y += 25) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(mapWidth, y);
      ctx.stroke();
    }
  }

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    renderGame()
  }

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

  /* Networking */

  function connect(addr) {
    websocket = new WebSocket(addr);
    websocket.binaryType = 'arraybuffer';
    websocket.onopen = function () {
      console.log('connected to server');
      state = 1
    };
    websocket.onerror = function (e) {
      console.log('connection error', e);
      state = 0
    };
    websocket.onmessage = handle;
    websocket.onclose = function () {
      console.log('connection closed');
      state = 0;
      reset()
    }
  }

  function handle(bytes) {
    let message = visibio.Message.getRootAsMessage(new flatbuffers.ByteBuffer(bytes));
    switch (message.packetType()) {
      case visibio.Packet.World:
        state = 2;
        let world = message.packet(new visibio.World());
        mapWidth = world.width();
        mapHeight = world.height();
        tick();
        // todo process the map--walls, etc.
        break;
      case visibio.Packet.Perception:
        let perception = message.packet(new visibio.Perception());
        me.health = perception.health();
        let known = [];
        for (let i = 0; i < perception.snapshotsLength(); i++) {
          let snapshot = perception.snapshots(i);
          switch (snapshot.entityType()) {
            case visibio.Entity.Player:
              let player = snapshot.entity(new visibio.Player());
              let playerIndex = entities.findIndex(e => e.id === player.id().toFloat64());
              if (playerIndex === -1) {
                entities.push({
                  id: player.id().toFloat64(),
                  type: visibio.Entity.Player,
                  x: player.position().x(),
                  y: player.position().y(),
                  rotation: player.rotation(),
                  name: player.name()
                })
              } else {
                entities[playerIndex].x = player.position.x();
                entities[playerIndex].y = player.position.y();
                entities[playerIndex].rotation = player.rotation();
              }
              known.push(player.id().toFloat64());
              break;
            case visibio.Entity.Bullet:
              let bullet = snapshot.entity(new visibio.Bullet());
              let bulletIndex = entities.findIndex(b => b.id === bullet.id().toFloat64());
              if (bulletIndex === -1) {
                entities.push({
                  id: bullet.id().toFloat64(),
                  type: visibio.Entity.Bullet,
                  x: bullet.position().x(),
                  y: bullet.position().y(),
                  vx: bullet.velocity().vx(),
                  vy: bullet.velocity().vy(),
                  ox: bullet.origin().x(),
                  oy: bullet.origin().y(),
                })
              } else {
                entities[bulletIndex].x = bullet.position().x();
                entities[bulletIndex].y = bullet.position().y();
                entities[bulletIndex].vx = bullet.velocity().x();
                entities[bulletIndex].vy = bullet.velocity().y()
              }
              known.push(bullet.id().toFloat64());
              break;
          }
        }
        entities.filter(e => known.findIndex(k => e.id === k) !== -1);
        break;
      case visibio.Packet.Death:
        reset();
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
    send(builder, visibio.Inputs.endInputs(builder), visibio.Packet.Inputs)
  }, 5, {leading: false});

  function sendRespawn(name) {
    let builder = new flatbuffers.Builder(64);
    let n = builder.createString(name);
    visibio.Respawn.startRespawn(builder);
    visibio.Respawn.addName(builder, n);
    send(builder, visibio.Respawn.endRespawn(builder), visibio.Packet.Respawn)
  }

  function send(builder, packet, type) {
    visibio.Message.startMessage(builder);
    visibio.Message.addPacketType(builder, type);
    visibio.Message.addPacket(builder, packet);
    let message = visibio.Message.endMessage(builder);
    builder.finish(message);
    if (isConnected()) {
      websocket.send(builder.asUint8Array());
      return true;
    }
    return false;
  }

  function isConnected() {
    return websocket && websocket.readyState === WebSocket.OPEN;
  }

})();