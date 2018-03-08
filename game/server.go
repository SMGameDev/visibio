package game

import (
	"github.com/SMGameDev/visibio/world"
	"github.com/SMGameDev/visibio/net"
	"github.com/SMGameDev/visibio/fbs"
	"sync"
	"time"
	"github.com/google/flatbuffers/go"
	"github.com/SMGameDev/visibio/moving"
	"github.com/SMGameDev/visibio/perceiving"
	"github.com/jakecoffman/cp"
	"go.uber.org/zap"
)

const (
	PlayerAcceleration float64 = 3
)

type client struct {
	inputs     *fbs.Inputs
	entityId   *uint64 // nil if the client has not yet spawned
	lastPacket time.Time
	*sync.Mutex
}

type Game struct {
	world *world.World
	mov   *moving.System
	per   *perceiving.System

	dead chan uint64

	clients map[net.Connection]*client
	*sync.Mutex
	logger  *zap.Logger
}

func New(width, height float64, logger *zap.Logger) *Game {
	w := world.NewWorld(width, height)
	return &Game{
		world:   w,
		mov:     moving.New(w),
		per:     perceiving.New(w),
		dead:    make(chan uint64, 100),
		clients: make(map[net.Connection]*client),
		Mutex:   new(sync.Mutex),
		logger:  logger,
	}
}

func (g *Game) Remove(conn net.Connection) {
	go g.remove(conn)
}

func (g *Game) remove(conn net.Connection) {
	g.Lock()
	defer g.Unlock()

	g.logger.Info("client disconnected")
	if client, ok := g.clients[conn]; ok {
		client.Lock()
		if client.entityId != nil {
			g.dead <- *client.entityId
		}
		client.entityId = nil
		client.Unlock()
		delete(g.clients, conn)
	}
}

func (g *Game) Add(conn net.Connection) {
	go g.add(conn)
}

func (g *Game) add(conn net.Connection) {
	g.Lock()
	defer g.Unlock()

	g.clients[conn] = &client{
		inputs:     new(fbs.Inputs),
		entityId:   nil,
		lastPacket: time.Now(),
		Mutex:      new(sync.Mutex),
	}

	go g.reader(conn)
}

func (g *Game) reader(conn net.Connection) {
	for {
		messageBytes, err := conn.Read()
		if err != nil {
			g.logger.Debug("error reading message from client", zap.Error(err))
			g.Remove(conn)
			return
		}
		g.logger.Debug("handling message from client", zap.ByteString("message", messageBytes))
		go g.handleMessage(conn, messageBytes)
	}
}

func (g *Game) handleMessage(conn net.Connection, bytes []byte) {
	g.Lock()
	defer g.Unlock()

	if client, ok := g.clients[conn]; ok {
		client.Lock()
		defer client.Unlock()
		// update last packet received time
		client.lastPacket = time.Now()
		// parse packet
		message := fbs.GetRootAsMessage(bytes, 0)
		var packetTable flatbuffers.Table
		if message.Packet(&packetTable) {
			switch message.PacketType() {
			case fbs.PacketNONE:
				// heartbeat
			case fbs.PacketRespawn:
				g.logger.Debug("handling respawn packet")
				if client.entityId != nil {
					g.logger.Info("received respawn packet from client while player was alive")
					g.Remove(conn)
					return
				}
				respawnPacket := new(fbs.Respawn)
				respawnPacket.Init(packetTable.Bytes, packetTable.Pos)
				go g.newPlayer(string(respawnPacket.Name()), client.inputs, conn)
				return
			case fbs.PacketInputs:
				g.logger.Info("handling inputs packet")
				client.inputs.Init(packetTable.Bytes, packetTable.Pos)
			default:
				g.logger.Info("unknown packet", zap.Uint8("type", message.PacketType()))
				g.Remove(conn)
				return
			}
		} else {
			g.logger.Info("malformed packet")
		}
	}
}

func (g *Game) newPlayer(name string, inputs *fbs.Inputs, conn net.Connection) uint64 {
	g.Lock()
	defer g.Unlock()

	id := g.world.NextId()
	var health uint16 = 100
	body := cp.NewBody(0, 0)
	playerShape := cp.NewCircle(body, 15, cp.Vector{})
	playerShape.SetElasticity(0)
	playerShape.SetFriction(1)
	playerShape.SetFilter(cp.NewShapeFilter(uint(id), world.PerceivableBody|world.DamageableBody, cp.ALL_CATEGORIES))
	body.AddShape(playerShape)
	body.UserData = perceivable{
		fn: func(introduce bool, builder *flatbuffers.Builder) flatbuffers.UOffsetT {
			fbs.PlayerStart(builder)
			fbs.PlayerAddId(builder, id)
			fbs.PlayerAddPosition(builder, fbs.CreatePoint(builder, int32(body.Position().X), int32(body.Position().Y)))
			fbs.PlayerAddVelocity(builder, fbs.CreateVector(builder, float32(body.Velocity().X), float32(body.Velocity().Y)))
			fbs.PlayerAddRotation(builder, uint16(body.Angle()))
			if introduce {
				fbs.PlayerAddName(builder, builder.CreateString(name))
			}
			return fbs.PlayerEnd(builder)
		},
	}
	g.world.Add(id, body)
	g.mov.Add(id, inputs, body, PlayerAcceleration)
	g.per.Add(id, conn, body, &health)
	return id
}

type perceivable struct {
	fn func(bool, *flatbuffers.Builder) flatbuffers.UOffsetT
}

func (p perceivable) Snapshot(introduce bool, builder *flatbuffers.Builder) flatbuffers.UOffsetT {
	return p.fn(introduce, builder)
}

func (g *Game) Tick(dt float64) {
	g.Lock() // this should block immediately to allow handlers to finish, don't need new goroutine
	defer g.Unlock()

	// kill entities
killEntities:
	for {
		select {
		case id := <-g.dead:
			g.mov.Remove(id)
			g.per.Remove(id)
			g.world.Remove(id)
		default:
			break killEntities
		}
	}

	// update systems
	g.mov.Update()
	g.per.Update()
	g.world.Update(dt)
}
