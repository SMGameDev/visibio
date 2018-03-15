var state = 0, // 0 = not connected/connecting, 1 = connected, 2 = playing, 3 = dead
    entities = [],
    map = [],
    websocket = null,
    me = {
        id: null,
        health: null,
        x: null,
        y: null,
        rotation: null,
        name: null
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


function reset() {
    console.log('resetting game');
    cancelRequestAnimFrame(loop);
    mapWidth, mapHeight, me.id, me.health = null;
    entities, map = [];
    clearCanvas();
    hideCanvas();
    showMenu()
}

window.play = (name) => {
    me.name = name;
    sendRespawn(name);
};

function hideMenu() {
    $(overlayContainer).hide()
}

function showMenu() {
    $(overlayContainer).show();
}

function hideCanvas() {
    $(canvas).hide();
}

function showCanvas() {
    $(canvas).show();
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
    var myplayerIndex = entities.findIndex((p) => p.id === me.id);
    if (myplayerIndex === -1) {
        return
    }
    let myplayer = entities[myplayerIndex];
    clearCanvas();
    drawBackground();
    drawGrid();
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawBackground() {
    ctx.fillStyle = '#B8B8B8';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
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

/* Networking */

var heartbeatLoop = null;
var heartbeat = (function () {
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
    }
}

function handle(bytes) {
    let msg = visibio.Message.getRootAsMessage(new flatbuffers.ByteBuffer(bytes));
    switch (msg.packetType()) {
        case visibio.Packet.World:
            console.log('received world packet')
            state = 2;
            let world = msg.packet(new visibio.World());
            mapWidth = world.width();
            mapHeight = world.height();
            me.id = world.id().toFloat64();
            tick();
            hideMenu();
            showCanvas();
            // todo process the map--walls, etc.
            break;
        case visibio.Packet.Perception:
            let perception = msg.packet(new visibio.Perception());
            me.health = perception.health();
            let known = [];
            for (let i = 0; i < perception.snapshotsLength(); i++) {
                let snapshot = perception.snapshots(i);
                switch (snapshot.entityType()) {
                    case visibio.Entity.Player:
                        let player = snapshot.entity(new visibio.Player());
                        if (player.id().toFloat64() === me.id) {
                            me.x = player.position().x();
                            me.y = player.position().y();
                            me.rotation = player.rotation();
                            break;
                        }
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
                            entities[playerIndex].x = player.position().x();
                            entities[playerIndex].y = player.position().y();
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

    $(window).resize(resizeCanvas);
    $(window).keypress((e) => {
        if (e.which == 13) { // enter key
            if (state == 1) {
                play(nameField.value);
            } else {
                console.log('tried to respawn while not connected')
            }
        }
    });
    $(window).keyup(e => onMoveKeys(true, e));
    $(window).keydown(e => onMoveKeys(false, e));

    console.log('initializing game');
    overlayContainer = document.getElementById("overlay");
    nameField = document.getElementById("name");
    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    hideCanvas();
    showMenu();
    console.log('connecting to server');
    connect(address);
});

