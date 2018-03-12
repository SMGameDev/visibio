const KEY_LEFT = 37, KEY_UP = 38, KEY_RIGHT = 39, KEY_DOWN = 40

class Canvas extends EventEmitter {
    constructor (params) {
        super()
        this.inputs = {left: false, right: false, up: false, down: false, rotation: 0, shooting: false}
        this.target = params.target
        this.cv = document.getElementById('canvas')
        this.cv.width = $(window).width()
        this.cv.height = $(window).height()
        this.cv.addEventListener('mousemove', (e) => this.__mousemove(e), false)
        this.cv.addEventListener('keyup', (e) => this.__keyup(e), false)
        this.cv.addEventListener('keydown', (e) => this.__keydown(e), false)
    }

    __mousemove (mouse) {

    }

    __keyup (event) {
        this.__key(event, false)
    }

    __keydown (event) {
        this.__key(event, true)
    }

    __key (event, state) {
        state = !!state
        let key = event.which || event.keyCode
        switch (key) {
            case KEY_LEFT:
                this.inputs.left = state
                this.changed()
                break;
            case KEY_RIGHT:
                this.inputs.right = state
                this.changed()
                break;
            case KEY_UP:
                this.inputs.up = state
                this.changed()
                break;
            case KEY_DOWN:
                this.inputs.down = state
                this.changed()
                break;
            default:
                break;
        }
    }

    changed () {
        this.emit('inputs', this.inputs)
    }
}