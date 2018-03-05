var ws = new WebSocket("ws://localhost:8080");
ws.binaryType = "arraybuffer";

var open = false;

ws.onopen = function () {
    console.log("connection opened");
    open = true
};
ws.onmessage = function (message) {
    console.log("received message:")
    console.log(message)
};
ws.onerror = function (e) {
    console.log("error: " + e)
};
ws.onclose = function () {
    console.log("connection closed")
};

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
    buf = builder.asUint8Array();
    console.log("sending: " + buf);
    ws.send(buf)
}