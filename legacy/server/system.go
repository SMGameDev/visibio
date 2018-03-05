package server

import (
	"sync"
	"github.com/SMGameDev/visibio/fbs"
	"fmt"
	"time"
	"github.com/google/flatbuffers/go"
	"github.com/SMGameDev/visibio/legacy/entity"
	"github.com/SMGameDev/visibio/net"
	"github.com/SMGameDev/visibio/world"
	"github.com/jakecoffman/cp"
)

//
//type System struct {
//	clients map[net.Connection]*Client
//	remover func(uint64)
//	world   *world.World
//	moving  *moving.System
//	dying   *dying.System
//	*sync.RWMutex
////}
//
//func New(world *world.World, remover func(uint64)) *System {
//	return &System{
//		clients: make(map[net.Connection]*Client),
//		remover: remover,
//		world:   world,
//		RWMutex: new(sync.RWMutex),
//	}
//}

func (s *Server) Update() {
	s.RLock()
	defer s.RUnlock()

	builder := flatbuffers.NewBuilder(100)
	for conn, client := range s.clients {
		client.mu.Lock()
		if client.player != nil {
			builder.Reset()
			// find all perceivable entities within viewing range
			perceivables := make(map[net.Perceivable]struct{}, 0)
			s.world.Lock()
			s.world.Space.BBQuery(
				cp.NewBBForExtents(client.player.Body.Position(), 200, 200),
				cp.NewShapeFilter(cp.NO_GROUP, 0, uint(world.Perceivable)),
				func(shape *cp.Shape, _ interface{}) {
					perceivables[shape.Body().UserData.(net.Perceivable)] = struct{}{}
				},
				nil,
			)
			s.world.Unlock()
			var perceptions = make([]flatbuffers.UOffsetT, 0, len(perceivables))
			for perceivable := range perceivables {
				_, known := client.known[perceivable]
				perceptions = append(perceptions, perceivable.Snapshot(known, builder))
			}
			fbs.PerceptionStartSnapshotsVector(builder, len(perceivables))
			for i := len(perceptions) - 1; i >= 0; i-- {
				builder.PrependUOffsetT(perceptions[i])
			}
			snapshots := builder.EndVector(len(perceivables))
			fbs.PerceptionStart(builder)
			fbs.PerceptionAddHealth(builder, uint16(*client.player.Health))
			fbs.PerceptionAddSnapshots(builder, snapshots)
			perception := fbs.PerceptionEnd(builder)
			fbs.MessageStart(builder)
			fbs.MessageAddPacketType(builder, fbs.PacketPerception)
			fbs.MessageAddPacket(builder, perception)
			message := fbs.MessageEnd(builder)
			builder.Finish(message)
			data := make([]byte, 0, len(builder.FinishedBytes()))
			copy(data, builder.FinishedBytes()[:])
			go conn.Send(data)
		}
		client.mu.Unlock()
	}
}

func (s *Server) Connect(conn net.Connection) {
	s.Lock()
	defer s.Unlock()

	s.clients[conn] = &Client{
		player:       nil,
		inputs:       new(fbs.Inputs),
		lastReceived: time.Now(),
		spawned:      time.Now(),
		mu:           new(sync.Mutex),
		known:        make(map[net.Perceivable]struct{}),
	}
	go s.recv(conn)
}

func (s *Server) recv(conn net.Connection) {
	for {
		data, err := conn.Read()
		if err != nil {
			return
		}
		s.handle(conn, data)
	}
}

func (s *Server) handle(conn net.Connection, data []byte) {
	s.RLock() // read-only because we aren't modifying clients itself, just the specific client
	defer s.RUnlock()

	if _, ok := s.clients[conn]; !ok {
		return // client encountered an error on read and err'd out.
	}

	client := s.clients[conn]
	client.mu.Lock()
	defer client.mu.Unlock()
	// update last packet received time
	client.lastReceived = time.Now()
	// parse packet
	message := fbs.GetRootAsMessage(data, 0)
	var packetTable flatbuffers.Table
	fmt.Println(message)
	fmt.Println(*message)
	fmt.Println(data)
	if message.Packet(&packetTable) {
		switch message.PacketType() {
		case fbs.PacketNONE:
			// heartbeat
		case fbs.PacketRespawn:
			if client.player != nil {
				fmt.Println("received respawn packet from client while player was alive")
				go s.Close(conn)
				return
			}
			// todo: respawn logic
			respawnPacket := new(fbs.Respawn)
			respawnPacket.Init(packetTable.Bytes, packetTable.Pos)
			client.player = s.NewPlayer(string(respawnPacket.Name()))
		case fbs.PacketInputs:
			client.inputs.Init(packetTable.Bytes, packetTable.Pos)
		default:
			fmt.Println("received unknown packet from client")
			go s.Close(conn)
			return
		}
	} else {
		fmt.Println("received malformed packet from client")
	}
}

func (s *Server) Close(conn net.Connection) error {
	s.Lock()
	defer s.Unlock()

	if client, ok := s.clients[conn]; ok {
		client.mu.Lock()
		if client.player != nil {
			go s.remover(client.player.Id)
		}
		client.mu.Unlock()
		delete(s.clients, conn)
	}
	return conn.Close()
}

func (s *Server) Remove(id uint64) {
	s.RLock() // rlock here because this only affects one client, not the index of clients; different than other systems
	defer s.RUnlock()

	for conn, client := range s.clients {
		client.mu.Lock()
		if client.player != nil && client.player.Id == id {
			builder := flatbuffers.NewBuilder(8)
			fbs.DeathStart(builder)
			fbs.DeathAddAlive(builder, uint64(time.Now().Sub(client.spawned).Nanoseconds()/1000000))
			death := fbs.DeathEnd(builder)
			builder.Finish(death)
			go conn.Send(builder.FinishedBytes())
			client.player = nil
		}
		client.mu.Unlock()
	}
}
