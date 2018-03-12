class Client extends EventEmitter {
    constructor () {
        super()
        this.conn = new Connection({
            addr: "ws://localhost:8080/"
        })
        this.game = {}
        this.nameIndex = {}
        this.state = "connecting"
        this.connected = false
        this.conn.on('open', () => {
            this.connected = true
            this.emit('connected')
        })
        this.conn.on('close', () => {
            this.connected = false
            this.emit('disconnected')
        })
        this.conn.on('error', (e) => {
            this.connected = false
            this.emit('disconnected')
            console.log('connection error', e)
        })
        this.conn.on('world', (evt) => {
            this.game.id = evt.id
            this.game.terrain = evt.terrain
            this.emit('respawn')
        })
        this.conn.on('perception', (evt) => {
            this.game.health = evt.health
            evt.entities.filter((e) => {return e.type === visibio.Entity.Player && e.name != null}).every((e) => {
                this.nameIndex[e.id] = e.name
            })
            this.game.entities = evt.entities
        })
    }

    render () {
        let player = this.game.entities.find((e) => {return e.id === this.game.id})
        if (!player) {
            throw new Error("cannot render without player location")
        }
    }

    respawn (name) {
        this.conn.sendRespawn(name)
    }
}

window.client = new Client()
window.play = function() {
    window.client.respawn(document.getElementById('name').value)
    document.getElementById('menu').style.visibility = "hidden";
}

window.canvas = new Canvas()


/// /
// var app = new Vue({
//     el: '#app',
//     data: {
//         state: "connecting",
//         name: "",
//         client: null,
//     },
//     created () {
//         let client = this.client = new Client()
//         client.on('connected', () => {
//             this.state = "connected"
//         })
//         client.on('disconnected', () => {
//             this.state = "disconnected"
//         })
//         client.on('respawn', (e) => {
//             this.state = "playing"
//         })
//     },
//     methods: {
//         respawn: function () {
//             this.client.respawn(this.name)
//             this.state = "playing"
//         }
//     }
// })