package networking

import (
	"github.com/SMGameDev/visibio/ecs"
	"github.com/SMGameDev/visibio/fbs"
	"time"
	"sync"
	"github.com/google/flatbuffers/go"
	"go.uber.org/zap"
	"github.com/jakecoffman/cp"
	"github.com/SMGameDev/visibio/colliding"
	"github.com/SMGameDev/visibio/moving"
	"github.com/SMGameDev/visibio/perceiving"
	"github.com/SMGameDev/visibio/network"
)

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

}

func (s *System) Add(conn network.Connection) {
	s.Lock()
	defer s.Unlock()

	s.clients[conn] = &client{
		inputs:     new(fbs.Inputs),
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
				s.logger.Info("handling inputs packet")
				client.inputs.Init(packetTable.Bytes, packetTable.Pos)
			default:
				s.logger.Info("unknown packet", zap.Uint8("type", message.PacketType()))
				s.RemoveClient(conn)
				return
			}
		} else {
			s.logger.Info("malformed packet")
		}
	}
}

func (s *System) newPlayer(conn network.Connection, name string, inputs *fbs.Inputs) ecs.Index {
	var id = s.manager.NextIndex()
	var health = 100
	body := cp.NewBody(0, 0)
	body.SetPosition(cp.Vector{0, 0})
	playerShape := cp.NewCircle(body, 28, cp.Vector{})
	playerShape.SetElasticity(0)
	playerShape.SetFriction(1)
	playerShape.SetFilter(cp.NewShapeFilter(uint(id), uint(colliding.Perceivable|colliding.Damageable), cp.ALL_CATEGORIES))
	body.AddShape(playerShape)
	body.UserData = id
	for _, system := range s.manager.Systems() {
		switch sys := system.(type) {
		case *moving.System:
			sys.Add(id, inputs, body, 3)
		case *perceiving.System:
			sys.AddPerceiver(id, conn, body, &health)
			sys.AddPerceivable(id, network.PerceivableFunc(func(introduce bool, builder *flatbuffers.Builder) flatbuffers.UOffsetT {
				var n flatbuffers.UOffsetT
				if introduce {
					n = builder.CreateString(name)
				}
				posn := fbs.CreatePoint(builder, int32(body.Position().X), int32(body.Position().Y))
				fbs.PlayerStart(builder)
				fbs.PlayerAddId(builder, id)
				fbs.PlayerAddPosition(builder, posn)
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
		case *colliding.System:
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
