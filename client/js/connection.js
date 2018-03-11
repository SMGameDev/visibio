class Connection extends EventEmitter {
    constructor (params) {
        super()
        var self = this;
        this.addr = params.addr;
        this.open = false;
        this.callbacks = params.callbacks;
        let ws = this.ws = new WebSocket("ws://localhost:8080");
        ws.binaryType = 'arraybuffer';
        ws.onopen = this.onopen;
        ws.onclose = this.onclose;
        ws.onerror = this.onerror;
        ws.onmessage = function (e) {
            let buf = new Uint8Array(e.data);
            let m = visibio.Message.getRootAsMessage(new flatbuffers.ByteBuffer(buf), null);
            self.__handle(m)
        };
    }

    onopen () {
        console.log('connection opened');
    }

    onclose () {
        console.log('connection closed');
    }

    onerror (e) {
        console.log('connection error');
        console.log(e)
    }

    __handle (message) {
        let packetType = message.packetType();
        switch (packetType) {
            case visibio.Packet.Perception: {
                this.__handlePerception(message)
                break;
            }
            case visibio.Packet.World: {
                this.__handleWorld(message)
                break;
            }
        }
    }

    __handlePerception (message) {
        let perception = message.packet(new visibio.Perception())
        let evt = {
            health: perception.health(),
            entities: [],
        }
        for (let i = 0; i < perception.snapshotsLength(); i++) {
            let snap = perception.snapshots(i)
            switch (snap.entityType()) {
                case visibio.Entity.Bullet: {
                    let bullet = snap.entity(new visibio.Bullet());
                    evt.entities.push({
                        id: bullet.id(),
                        kind: visibio.Entity.Bullet,
                        x: bullet.position().x(),
                        y: bullet.position().y(),
                        vx: bullet.velocity().x(),
                        vy: bullet.velocity().y()
                    })
                    break;
                }
                case visibio.Entity.Player: {
                    let player = snap.entity(new visibio.Player());
                    evt.entities.push({
                        id: player.id(),
                        kind: visibio.Entity.Player,
                        x: player.position().x(),
                        y: player.position().y(),
                        vx: player.velocity().x(),
                        vy: player.velocity().y(),
                        rotation: player.rotation(),
                        name: player.name()
                    })
                    break;
                }
            }
        }
        this.emit('perception', evt)
    }

    __handleWorld (message) {
        let world = message.packet(new visibio.World())
        let width = world.width()
        let height = world.height()
        let map = world.map() // map is [row1..., row2...] in packed bit form
        let terrain = []
        for (let i = 0; i < height; i++) { // each row
            terrain[i] = []
            for (let j = 0; j < width; j++) { // each column in row
                let index = i * width + j
                terrain[i][j] = map[index >> 6] & (1 << (index & 7))
            }
        }
        let evt = {
            id: world.id(),
            width: world.width(),
            height: world.height(),
            terrain: terrain
        }
        this.emit('world', evt)
    }

    async sendInputs (left, right, up, down, rotation, shooting) {
        let builder = new flatbuffers.Builder(8)
        visibio.Inputs.startInputs(builder)
        visibio.Inputs.addLeft(builder, left)
        visibio.Inputs.addRight(builder, right)
        visibio.Inputs.addUp(builder, up)
        visibio.Inputs.addDown(builder, down)
        visibio.Inputs.addRotation(builder, rotation)
        visibio.Inputs.addShooting(builder, shooting)
        let inputs = visibio.Inputs.endInputs(builder)
        visibio.Message.startMessage(builder)
        visibio.Message.addPacketType(builder, visibio.Packet.Inputs)
        visibio.Message.addPacket(builder, inputs)
        let message = visibio.Message.endMessage(builder)
        builder.finish(message)
        this.ws.send(builder.asUint8Array())
    }

    async sendRespawn (name) {
        let builder = new flatbuffers.Builder(name.length * 4)
        let n = builder.createString(name)
        visibio.Respawn.startRespawn(builder)
        visibio.Respawn.addName(builder, n)
        let respawn = visibio.Respawn.endRespawn(builder)
        visibio.Message.startMessage(builder)
        visibio.Message.addPacketType(builder, visibio.Packet.Respawn)
        visibio.Message.addPacket(builder, respawn)
        let message = visibio.Message.endMessage(builder)
        builder.finish(message)
        this.ws.send(builder.asUint8Array());
    }
}