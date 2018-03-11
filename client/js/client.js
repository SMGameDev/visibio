var ws = new WebSocket("ws://localhost:8080");
ws.binaryType = 'arraybuffer';

var open = false;

var game = {
    health: 0,
    entities: {}
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
    console.log("connection error");
    console.log(e)
};
ws.onclose = function () {
    console.log("connection closed")
};

function handle (m) {
    var packetType = m.packetType();
    switch (packetType) {
        case visibio.Packet.Perception: {
            var p = m.packet(new visibio.Perception());
            game.health = p.health();
            for (var i = 0; i < p.snapshotsLength(); i++) {
                var snap = p.snapshots(i);

                switch (snap.entityType()) {
                    case visibio.Entity.Bullet: {
                        var bullet = snap.entity(new visibio.Bullet());
                        game.entities[bullet.id()] = {
                            type: visibio.Entity.Bullet,
                            position: {
                                x: bullet.position().x(),
                                y: bullet.position().y()
                            }
                        };
                        break;
                    }
                    case visibio.Entity.Player: {
                        var player = snap.entity(new visibio.Player());
                        game.entities[player.id()] = game.entities[player.id()] || {};
                        game.entities[player.id()].type = visibio.Entity.Player;
                        if (player.name() != null) {
                            game.entities[player.id()].name = player.name();
                        }
                        game.entities[player.id()].position = {};
                        game.entities[player.id()].position.x = player.position().x();
                        game.entities[player.id()].position.y = player.position().y();
                        game.entities[player.id()].rotation = player.rotation();
                        game.entities[player.id()].velocity = {};
                        game.entities[player.id()].velocity.x = player.velocity().x();
                        game.entities[player.id()].velocity.y = player.velocity().y();
                        break;
                    }
                }
            }
        }
    }
}

function respawn (name) {
    if (!open) {
        throw new Error("cannot send message before connection is open")
    }
    let builder = new flatbuffers.Builder(name.length * 4);
    let n = builder.createString('meyer');
    visibio.Respawn.startRespawn(builder);
    visibio.Respawn.addName(builder, n);
    let r = visibio.Respawn.endRespawn(builder);
    visibio.Message.startMessage(builder);
    visibio.Message.addPacketType(builder, visibio.Packet.Respawn);
    visibio.Message.addPacket(builder, r);
    let m = visibio.Message.endMessage(builder);
    builder.finish(m);
    let buf = builder.asUint8Array();
    console.log("sending: " + buf);
    ws.send(buf);
}

function tick (timestamp) {
    window.document.getElementById("health").innerHTML = "<p>health: " + game.health + "</p>";
    window.document.getElementById("entityCount").innerHTML = "<p>" + Object.keys(game.entities).length + "</p>";
    window.requestAnimationFrame(tick);
}

window.requestAnimationFrame(tick);