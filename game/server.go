package game

import (
	"github.com/SMGameDev/visibio/world"
	"github.com/SMGameDev/visibio/net"
	"github.com/SMGameDev/visibio/fbs"
	"sync"
	"time"
	"github.com/google/flatbuffers/go"
	"fmt"
	"github.com/SMGameDev/visibio/moving"
	"github.com/SMGameDev/visibio/perceiving"
	"github.com/jakecoffman/cp"
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
}

func New(width, height float64) *Game {
	w := world.NewWorld(width, height)
	return &Game{
		world:   w,
		mov:     moving.New(w),
		per:     perceiving.New(w),
		dead:    make(chan uint64, 100),
		clients: make(map[net.Connection]*client),
		Mutex:   new(sync.Mutex),
	}
}

func (g *Game) Remove(conn net.Connection) {
	g.Lock()
	if client, ok := g.clients[conn]; ok {
		client.Lock()
		if client.entityId != nil {
			g.dead <- *client.entityId
		}
		client.entityId = nil
		client.Unlock()
		delete(g.clients, conn)
	}
	g.Unlock()
	conn.Close()
}

func (g *Game) Handle(conn net.Connection) {
	g.Lock()
	defer g.Unlock()

	fmt.Println("here")

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
		fmt.Println("reader")
		messageBytes, err := conn.Read()
		if err != nil {
			go g.Remove(conn)
			return
		}
		go g.handleMessage(conn, messageBytes)
	}
}

func (g *Game) handleMessage(conn net.Connection, bytes []byte) {
	fmt.Printf("handling incoming message: %v\n", bytes)
	if _, ok := g.clients[conn]; !ok {
		return // client encountered an error on read and err'd out.
	}

	client := g.clients[conn]
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
			if client.entityId != nil {
				fmt.Println("received respawn packet from client while player was alive")
				go g.Remove(conn)
				return
			}
			respawnPacket := new(fbs.Respawn)
			respawnPacket.Init(packetTable.Bytes, packetTable.Pos)
			go g.newPlayer(string(respawnPacket.Name()), client.inputs, conn)
			fmt.Println("new player created")
			return
		case fbs.PacketInputs:
			client.inputs.Init(packetTable.Bytes, packetTable.Pos)
		default:
			fmt.Println("received unknown packet from client")
			go g.Remove(conn)
			return
		}
	} else {
		fmt.Println("received malformed packet from client")
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
	playerShape.SetFilter(cp.NewShapeFilter(uint(id), world.Perceivable|world.Damageable, cp.ALL_CATEGORIES))
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
	g.Lock()
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
