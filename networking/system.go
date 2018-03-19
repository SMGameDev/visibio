package networking

import (
	"github.com/SMGameDev/visibio/ecs"
	"github.com/SMGameDev/visibio/fbs"
	"time"
	"sync"
	"github.com/google/flatbuffers/go"
	"go.uber.org/zap"
	"github.com/jakecoffman/cp"
	"github.com/SMGameDev/visibio/collision"
	"github.com/SMGameDev/visibio/movement"
	"github.com/SMGameDev/visibio/perception"
	"github.com/SMGameDev/visibio/network"
)

const PlayerMovementForce = 256
const PlayerShootingCooldown = 1 * time.Second

type client struct {
	inputs     *fbs.Inputs
	entityId   *ecs.Index // nil if the client has not yet spawned
	lastPacket time.Time
	*sync.Mutex
}

type System struct {
	clients map[network.Connection]*client
	manager *ecs.Manager
	bpool   *sync.Pool
	logger  *zap.Logger
	*sync.RWMutex
}

func New(manager *ecs.Manager, pool *sync.Pool, logger *zap.Logger) ecs.System {
	return &System{
		clients: make(map[network.Connection]*client),
		manager: manager,
		bpool:   pool,
		logger:  logger,
		RWMutex: new(sync.RWMutex),
	}
}

func (s *System) Update(dt float64) {
	s.Lock()
	defer s.Unlock()

	for conn, client := range s.clients {
		if time.Now().Sub(client.lastPacket.Add(time.Duration(dt)*time.Second)) > 5*time.Second { // don't penalize for server lag
			s.RemoveClient(conn)
		}
	}
}

func (s *System) Add(conn network.Connection) {
	s.Lock()
	defer s.Unlock()

	builder := flatbuffers.NewBuilder(0)
	fbs.InputsStart(builder)
	inp := fbs.InputsEnd(builder)
	builder.Finish(inp)
	inputs := new(fbs.Inputs)
	inputs.Init(builder.Bytes, inp)
	s.clients[conn] = &client{
		inputs:     inputs,
		entityId:   nil,
		lastPacket: time.Now(),
		Mutex:      new(sync.Mutex),
	}
	go s.readLoop(conn)
}

func (s *System) readLoop(conn network.Connection) {
	for {
		messageBytes, err := conn.Read()
		if err != nil {
			s.logger.Debug("error reading message from client", zap.Error(err))
			s.RemoveClient(conn)
			return
		}
		s.logger.Debug("handling message from client", zap.Binary("message", messageBytes))
		go s.handleMessage(conn, messageBytes)
	}
}

func (s *System) handleMessage(conn network.Connection, bytes []byte) {
	s.Lock()
	defer s.Unlock()
	defer func() {
		if r := recover(); r != nil {
			s.logger.Error("recovered panic", zap.Any("recovery", r))
		}
	}()

	if client, ok := s.clients[conn]; ok {
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
				return
			case fbs.PacketHeartbeat:
				return
			case fbs.PacketRespawn:
				s.logger.Debug("handling respawn packet")
				if client.entityId != nil {
					s.logger.Info("received respawn packet from client while player was alive")
					s.RemoveClient(conn)
					return
				}
				respawnPacket := new(fbs.Respawn)
				respawnPacket.Init(packetTable.Bytes, packetTable.Pos)
				var id = s.newPlayer(conn, string(respawnPacket.Name()), client.inputs)
				client.entityId = &id
				return
			case fbs.PacketInputs:
				s.logger.Debug("handling inputs packet")
				client.inputs.Init(packetTable.Bytes, packetTable.Pos)
			default:
				s.logger.Debug("unknown packet", zap.Uint8("type", message.PacketType()))
				s.RemoveClient(conn)
				return
			}
		} else {
			s.logger.Debug("malformed packet")
		}
	}
}

func (s *System) newPlayer(conn network.Connection, name string, inputs *fbs.Inputs) ecs.Index {
	var id = s.manager.NextIndex()
	var health = 100
	body := cp.NewBody(1, cp.MomentForCircle(1, 0, 24, cp.Vector{}))
	body.SetPosition(cp.Vector{0, 0})
	body.UserData = id

	playerShape := body.AddShape(cp.NewCircle(body, 16.0, cp.Vector{}))
	playerShape.SetFriction(0.7)
	playerShape.SetFilter(cp.NewShapeFilter(uint(id), uint(collision.Player), uint(collision.Bullet|collision.Wall)))

	for _, system := range s.manager.Systems() {
		switch sys := system.(type) {
		case *movement.System:
			sys.Add(id, movement.ControllerFunc(func() (up, down, left, right bool, rotation float64) {
				return inputs.Up() > 0, inputs.Down() > 0, inputs.Left() > 0, inputs.Right() > 0, float64(inputs.Rotation())
			}), body, PlayerMovementForce)
		case *perception.System:
			sys.AddPerceiver(id, conn, &health)
			sys.AddPerceivable(id, perception.PerceivableFunc(func(builder *flatbuffers.Builder, introduce bool) flatbuffers.UOffsetT {
				var n flatbuffers.UOffsetT
				if introduce {
					n = builder.CreateString(name)
				}
				fbs.PlayerStart(builder)
				fbs.PlayerAddId(builder, id)
				fbs.PlayerAddPosition(builder, fbs.CreateVector(builder, float32(body.Position().X), float32(body.Position().Y)))
				fbs.PlayerAddRotation(builder, uint16(body.Angle()))
				if introduce {
					fbs.PlayerAddName(builder, n)
				}
				player := fbs.PlayerEnd(builder)
				fbs.SnapshotStart(builder)
				fbs.SnapshotAddEntityType(builder, fbs.EntityPlayer)
				fbs.SnapshotAddEntity(builder, player)
				return fbs.SnapshotEnd(builder)
			}))
		case *collision.System:
			sys.Add(id, &health, body)
		}
	}
	return id
}

func (s *System) RemoveClient(conn network.Connection) {
	go s.removeClient(conn)
}

func (s *System) removeClient(conn network.Connection) {
	s.Lock()
	defer s.Unlock()

	if client, ok := s.clients[conn]; ok {
		client.Lock()
		if client.entityId != nil {
			s.manager.Remove(*client.entityId)
		}
		client.entityId = nil
		client.Unlock()
		delete(s.clients, conn)
	}
	conn.Close()
	s.logger.Info("client disconnected")
}

func (s *System) Remove(i ecs.Index) {
	s.RLock()
	defer s.RUnlock()

	for conn, c := range s.clients {
		c.Lock()
		if c.entityId != nil && *c.entityId == i {
			go func(conn network.Connection, c *client) {
				builder := s.bpool.Get().(*flatbuffers.Builder)
				builder.Reset()

				fbs.DeathStart(builder)
				death := fbs.DeathEnd(builder)
				fbs.MessageStart(builder)
				fbs.MessageAddPacketType(builder, fbs.PacketDeath)
				fbs.MessageAddPacket(builder, death)
				message := fbs.MessageEnd(builder)
				builder.Finish(message)
				conn.Send(builder.FinishedBytes())

				builder.Reset() // reset again to avoid any possible leaks
				s.bpool.Put(builder)
				c.Unlock()
			}(conn, c)
			c.entityId = nil
			return
		}
		c.Unlock()
	}
}
