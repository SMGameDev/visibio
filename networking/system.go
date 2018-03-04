package networking

import (
	"sync"
	"github.com/jakecoffman/cp"
	"github.com/SMGameDev/visibio/fbs"
	"fmt"
	"time"
	"github.com/google/flatbuffers/go"
	"github.com/SMGameDev/visibio/entity"
)

type System struct {
	clients map[Connection]*Client
	remover func(uint64)
	cursor  func() uint64
	space   *cp.Space
	mu      *sync.RWMutex
}

func New(remover func(uint64), cursor func() uint64, space *cp.Space) *System {
	return &System{
		clients: make(map[Connection]*Client),
		remover: remover,
		cursor:  cursor,
		space:   space,
		mu:      new(sync.RWMutex),
	}
}

func (s *System) Update() {
	s.mu.RLock()
	defer s.mu.RUnlock()
}

func (s *System) Add(conn Connection) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.clients[conn] = &Client{
		player:       nil,
		inputs:       new(fbs.Inputs),
		lastReceived: time.Now(),
		spawned:      time.Now(),
		mu:           new(sync.Mutex),
	}
	go s.recv(conn)
}

func (s *System) recv(conn Connection) {
	for {
		data, err := conn.Read()
		if err != nil {
			return
		}
		s.handle(conn, data)
	}
}

func (s *System) handle(conn Connection, data []byte) {
	s.mu.RLock() // read-only because we aren't modifying clients itself, just the specific client
	defer s.mu.RUnlock()

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
			client.player = entity.NewPlayer(s.cursor(), s.space, string(respawnPacket.Name()))
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

func (s *System) Close(conn Connection) error {
	s.mu.Lock()
	defer s.mu.Unlock()

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

func (s *System) Remove(id uint64) {
	s.mu.RLock() // rlock here because this only affects one client, not the index of clients; different than other systems
	defer s.mu.RUnlock()

	for conn, client := range s.clients {
		if client.player != nil && client.player.Id == id {
			builder := flatbuffers.NewBuilder(8)
			fbs.DeathStart(builder)
			fbs.DeathAddAlive(builder, uint64(time.Now().Sub(client.spawned).Nanoseconds()/1000000))
			death := fbs.DeathEnd(builder)
			builder.Finish(death)
			go conn.Send(builder.FinishedBytes())
			client.player = nil
		}
	}
}
