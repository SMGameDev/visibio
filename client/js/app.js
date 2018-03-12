(function (window, $, _) {

    /* Private Variables */

    var verbose = true,
      canvas = null,
      ctx = null,
      websocket = null,
      playing = false,
      connecting = false,
      connected = false,
      loop = null,
      myPlayer = null,
      players = [],
      bullets = [],
      gameWidth = 4608,
      gameHeight = 4608,
      heartbeat = null;

    // render variables
    var friendColor = "#00B4E0",
      friendOutline = "#0085A6",
      enemyColor = "#F04F54",
      enemyOutline = "#B33B3F",
      outlineWidth = 4,
      playerRadius = 27;

    var inputs = {
        'up': false,
        'left': false,
        'down': false,
        'right': false,
        rotation: 0,
        shooting: false,
    };

    /* Rendering */

    function render () {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!isConnected()) {
            // render background?
            return
        }
        drawBackground();
        ctx.translate((canvas.width / 2.0) - myPlayer.position.x, (canvas.height / 2.0) - myPlayer.position.y);
        drawGrid()
    }

    function drawBackground () {
        ctx.fillStyle = '#B8B8B8';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function drawGrid () {
        ctx.fillStyle = '#CCCCCC';
        ctx.fillRect(0, 0, gameWidth, gameHeight);

        ctx.strokeStyle = '#C2C2C2';
        ctx.lineWidth = 1;

        for (var x = 0; x < gameWidth; x++) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, gameHeight);
            ctx.stroke();
        }
        for (var y = 0; y < gameHeight; y += 25) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(gameWidth, y);
            ctx.stroke();
        }
    }

    function drawPlayer (position, rotation, isMine) {
        if (typeof position === 'undefined' ||
          typeof aimAngle === 'undefined') {
            return;
        }
        if (typeof isMine !== 'boolean') {
            isMine = false;
        }

        ctx.save();

        // Gun
        ctx.translate(position.x, position.y);
        ctx.rotate(rotation);
        ctx.translate(-(position.x), -(position.y));
        ctx.fillStyle = '#000000';
        ctx.lineWidth = outlineWidth;
        roundRect(ctx, position.x + (0.5 * playerRadius), position.y - (0.4 * playerRadius), 20, 20, 0.5, true, true);

        // Body
        ctx.beginPath();
        ctx.arc(position.x, position.y, sizes.radius, 0, 2 * Math.PI);
        ctx.closePath();
        if (isMine) {
            ctx.fillStyle = friendColor;
            ctx.strokeStyle = friendOutline;
        } else {
            ctx.fillStyle = enemyColor;
            ctx.strokeStyle = enemyOutline;
        }
        ctx.fill();
        ctx.stroke();

        ctx.restore();
    }

    function drawPlayers () {
        players.forEach(function (player) {
            drawPlayer(player.position, player.rotation, player.id === myPlayer)
        })
    }

    function drawBullets () {
        bullets.forEach(function (bullet) {

        })
    }

    // Draws rounded rectangle on canvas
    function roundRect (ctx, x, y, width, height, radius, fill, stroke) {
        if (typeof stroke === 'undefined') {
            stroke = true;
        }
        if (typeof radius === 'undefined') {
            radius = 5;
        }
        if (typeof radius === 'number') {
            radius = {tl: radius, tr: radius, br: radius, bl: radius};
        } else {
            var defaultRadius = {tl: 0, tr: 0, br: 0, bl: 0};
            for (var side in defaultRadius) {
                radius[side] = radius[side] || defaultRadius[side];
            }
        }
        ctx.beginPath();
        ctx.moveTo(x + radius.tl, y);
        ctx.lineTo(x + width - radius.tr, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
        ctx.lineTo(x + width, y + height - radius.br);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
        ctx.lineTo(x + radius.bl, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
        ctx.lineTo(x, y + radius.tl);
        ctx.quadraticCurveTo(x, y, x + radius.tl, y);
        ctx.closePath();
        if (fill) {
            ctx.fill();
        }
        if (stroke) {
            ctx.stroke();
        }
    }

    function drawMyPlayer () {

    }

    /* Networking Functions */

    function isConnected () {
        return !!(websocket && websocket.readyState === WebSocket.OPEN);
    }

    function sendSafe (data) {
        if (!data) return false;
        if (isConnected()) {
            websocket.send(data);
            return true;
        }
        return false;
    }

    function handleMessage (message) {}

    function connect (callback) {
        if (isConnected()) // double check
            return true;
        connecting = true;
        var server = 'localhost:8080'; //todo matchmaking
        websocket = new WebSocket('ws://' + server);
        websocket.binaryType = 'arraybuffer';
        websocket.onopen = function () {
            log("Opened Socket Connection");
            connecting = false;
            connected = true;
            var builder = new flatbuffers.Builder(1)
            visibio.Heartbeat.startHeartbeat(builder)
            var h = visibio.Heartbeat.endHeartbeat(builder)
            visibio.Message.startMessage(builder)
            visibio.Message.addPacketType(builder, visibio.Packet.Heartbeat)
            visibio.Message.addPacket(builder, h)
            var hb = visibio.Message.endMessage(builder)
            builder.finish(hb)
            console.log(builder.asUint8Array())
            heartbeat = setInterval(function () {
                sendSafe(builder.asUint8Array());
            }, 1000);
            if (typeof callback === 'function') callback();
        };
        websocket.onclose = function (event) {
            log("Closed Socket Connection (" + event.code + ")");
            if (heartbeat) {
                clearInterval(heartbeat);
            }
            // reset();
        };
        websocket.onerror = function () {
            log("Socket Error", true);
            // reset();
        };
        websocket.onmessage = handleMessage;
    }

    var sendInputs = _.throttle(function () {
        var builder = new flatbuffers.Builder(8);
        visibio.Inputs.startInputs(builder);
        visibio.Inputs.addLeft(builder, inputs.left);
        visibio.Inputs.addRight(builder, inputs.right);
        visibio.Inputs.addDown(builder, inputs.down);
        visibio.Inputs.addUp(builder, inputs.up);
        visibio.Inputs.addRotation(builder, inputs.rotation);
        visibio.Inputs.addShooting(builder, inputs.shooting);
        var inputsMessage = visibio.Inputs.endInputs(builder);
        visibio.Message.startMessage(builder);
        visibio.Message.addPacketType(builder, visibio.Packet.Inputs);
        visibio.Message.addPacket(builder, inputsMessage);
        var message = visibio.Message.endMessage(builder);
        builder.finish(message);
        console.log(builder)
        sendSafe(builder.asUint8Array())

    }, 10, {leading: false});

    /* Global Functions */

    window.initGame = function () {
        canvas = document.getElementById('canvas');
        ctx = canvas.getContext('2d');
        canvas.onmousemove = function (e) {
            inputs.rotation = e.clientX - (canvas.width / 2.0), e.clientY - (canvas.height / 2.0);
            sendInputs();
        };
        canvas.onmousedown = function (event) {
            var mouseBtn = event.which || event.button;
            if (mouseBtn == 1) { // left click
                inputs.shooting = true;
            }
        };
        canvas.onmouseup = function (event) {
            var mouseBtn = event.which || event.button;
            if (mouseBtn == 1) { // left click
                onShootKeys(0);
            }
        };
        canvas.onkeydown = function (event) {
            var key = event.which || event.keyCode;
            var self = this.parent;
            switch (key) {
                case 37: {
                    inputs.left = true;
                    sendInputs();
                    break
                }
                case 38: {
                    inputs.up = true;
                    sendInputs();
                    break
                }
                case 3: {
                    inputs.right = true;
                    sendInputs();
                    break;
                }
                case 40: {
                    inputs.down = true;
                    sendInputs();
                    break;
                }
            }
        };
        // canvas.onmouseup = function (event) {
        //
        // };
    };

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

    window.respawn = function (name) {
        var builder = new flatbuffers.Builder(64);
        var n = builder.createString(name);
        visibio.Respawn.startRespawn(builder);
        visibio.Respawn.addName(builder, n);
        var r = visibio.Respawn.endRespawn(builder);
        visibio.Message.startMessage(builder);
        visibio.Message.addPacketType(builder, visibio.Packet.Respawn);
        visibio.Message.addPacket(builder, r);
        var message = visibio.Message.endMessage(builder);
        builder.finish(message);

        if (!isConnected()) {
            connect(function () {
                sendSafe(builder.asUint8Array());
            });
        } else {
            sendSafe(builder.asUint8Array());
        }
    };

    window.resizeGame = function () {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        render();
    };

    function log (msg, override, prefix) {
        if (typeof override !== 'boolean')
            override = verbose;
        if (typeof prefix !== 'boolean')
            prefix = true;
        if (override) {
            if (prefix) {
                console.log('[VisibioClient] ' + msg);
            } else {
                console.log(msg);
            }
        }
    }

})(window, jQuery, _);