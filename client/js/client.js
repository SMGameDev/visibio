var ws = new WebSocket("ws://localhost:8080");
ws.binaryType = 'arraybuffer';

var open = false;

var game = {
    health: 0
};

ws.onopen = function () {
    console.log("connection opened");
    open = true;
    respawn('meyer');
};
ws.onmessage = function (e) {
    var buf = new Uint8Array(e.data);
    var m = visibio.Message.getRootAsMessage(new flatbuffers.ByteBuffer(buf), null);
    handle(m)
};
ws.onerror = function (e) {
    console.log("connection error: " + e)
};
ws.onclose = function () {
    console.log("connection closed")
};

function handle(m) {
    var packetType = m.packetType();
    switch (packetType) {
        case visibio.Packet.Perception: {
            game.health = m.packet(new visibio.Perception()).health();
        }
    }
}

function respawn(name) {
    if (!open) {
        throw new Error("cannot send message before connection is open")
    }
    var builder = new flatbuffers.Builder(name.length * 4);
    var n = builder.createString('meyer');
    visibio.Respawn.startRespawn(builder);
    visibio.Respawn.addName(builder, n);
    var r = visibio.Respawn.endRespawn(builder);
    visibio.Message.startMessage(builder);
    visibio.Message.addPacketType(builder, visibio.Packet.Respawn);
    visibio.Message.addPacket(builder, r);
    var m = visibio.Message.endMessage(builder);
    builder.finish(m);
    var buf = builder.asUint8Array();
    console.log("sending: " + buf);
    ws.send(buf);
}

function tick(timestamp) {
    window.document.getElementById("health").innerHTML = "<p>health: " + game.health + "</p>";
    window.requestAnimationFrame(tick);
}

window.requestAnimationFrame(tick);