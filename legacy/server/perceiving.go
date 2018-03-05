package server

import (
	"github.com/google/flatbuffers/go"
)

//
//const (
//	VisibleToNone    uint = 1 << iota
//	VisibleToGhosts
//	VisibleToHunters
//	VisibleToAll     = VisibleToGhosts | VisibleToHunters
//)


//
//type perceivingEntity struct {
//	conn   net.Connection
//	body   *cp.Body
//	health *int
//	known  map[Perceivable]struct{}
//}

//type System struct {
	//perceivers map[uint64]perceivingEntity
	//world      *game.World
	//*sync.RWMutex
//}

//func New(world *game.World) *System {
//	return &System{
//		perceivers: make(map[uint64]perceivingEntity),
//		world:      world,
//		RWMutex:    new(sync.RWMutex),
//	}
//}

//func (s *System) Add(id uint64, conn net.Connection, body *cp.Body, health *int) {
//	s.Lock()
//	defer s.Unlock()
//
//	s.perceivers[id] = perceivingEntity{
//		conn:   conn,
//		body:   body,
//		health: health,
//	}
//}

//func (s *System) Remove(id uint64) {
//	s.RWMutex.Lock()
//	defer s.RWMutex.Unlock()
//
//	delete(s.perceivers, id)
//}
//
//func (s *System) Update() {
//
//
//}
