package world

import (
	"github.com/jakecoffman/cp"
	"sync/atomic"
)

type World struct {
	Space    *cp.Space
	entities map[uint64]*cp.Body
	maxId    uint64
}

func (w *World) NextId() uint64 {
	return atomic.AddUint64(&w.maxId, 1) - 1
}

func NewWorld(width, height float64) *World {
	space := cp.NewSpace()
	hw, hh := width/2, height/2
	sides := []cp.Vector{
		// outer walls
		{-hw, -hh}, {-hw, hh}, // left
		{hw, -hh}, {hw, hh},   // right
		{-hw, -hh}, {hw, -hh}, // bottom
		{-hw, hh}, {hw, hh},   // top
	}
	for i := 0; i < len(sides); i += 2 {
		seg := space.AddShape(cp.NewSegment(space.StaticBody, sides[i], sides[i+1], 1))
		seg.SetElasticity(1)
		seg.SetFriction(0)
		// filter indicates it is not perceivable, i.e. is not communicated on connection
		seg.SetFilter(cp.NewShapeFilter(0, uint(StaticBody), uint(cp.WILDCARD_COLLISION_TYPE)))
	}

	damageHandler := space.NewCollisionHandler(cp.CollisionType(DamageableBody), cp.CollisionType(DamagerBody))
	damageHandler.PreSolveFunc = func(arb *cp.Arbiter, space *cp.Space, userData interface{}) bool {
		damageableBody, damagerBody := arb.Bodies()
		damageable := damageableBody.UserData.(Damageable)
		damager := damagerBody.UserData.(Damager)
		damageable.Damage(damager.DamageAmount())
		return arb.Ignore() // bullets go through
	}

	return &World{
		Space:    space,
		entities: make(map[uint64]*cp.Body),
		maxId:    0,
	}
}

func (w *World) Add(id uint64, body *cp.Body) {
	w.Space.AddBody(body)
	w.entities[id] = body
}

func (w *World) Update(dt float64) {
	w.Space.Step(dt)
}

func (w *World) Remove(id uint64) {
	if b, ok := w.entities[id]; ok {
		w.Space.RemoveBody(b)
		delete(w.entities, id)
	}
}

//
//import (
//	"net/http"
//	"fmt"
//	"github.com/SMGameDev/visibio/colliding"
//	"github.com/SMGameDev/visibio/dying"
//	"github.com/SMGameDev/visibio/perceiving"
//	"github.com/SMGameDev/visibio/moving"
//	"sync"
//	"github.com/SMGameDev/visibio/networking"
//	"sync/atomic"
//	"github.com/gorilla/websocket"
//)
//
//type Game struct {
//	colliding  *colliding.System
//	networking *networking.System
//	dying      *dying.System
//	perceiving *perceiving.System
//	moving     *moving.System
//	*sync.RWMutex
//	maxId      uint64
//
//	upgrader websocket.Upgrader
//}
//
//func New(width, height float64, upgrader websocket.Upgrader) *Game {
//	var g = &Game{
//		RWMutex:  new(sync.RWMutex),
//		upgrader: upgrader,
//	}
//	g.colliding = colliding.New(width, height)
//	g.networking = networking.New(g.remover, g.cursor, g.colliding)
//	g.perceiving = perceiving.New(g.colliding)
//	g.moving = moving.New(g.colliding)
//	g.dying = dying.New(g.remover)
//	return g
//}
//
//func (g *Game) Tick(dt float64) {
//	g.RLock() // no entities can be added/deleted during a tick
//	defer g.RUnlock()
//
//	g.moving.Update()
//	g.colliding.Update(dt)
//	g.perceiving.Update()
//	g.networking.Update()
//	g.dying.Update()
//}
//
//func (g *Game) remover(id uint64) {
//	g.Lock()
//	defer g.Unlock()
//	g.colliding.Remove(id)
//	g.networking.Remove(id)
//	g.dying.Remove(id)
//	g.perceiving.Remove(id)
//	g.moving.Remove(id)
//}
//
//func (g *Game) cursor() uint64 {
//	return atomic.AddUint64(&g.maxId, 1) - 1
//}
//
//func (g *Game) Connect(w http.ResponseWriter, r *http.Request) {
//	conn, err := g.upgrader.Upgrade(w, r, nil)
//	if err != nil {
//		fmt.Printf("could not upgrade connection: %v\n", err)
//		return
//	}
//	fmt.Printf("handling incoming connection\n")
//	g.networking.Add(networking.HandleWebsocket(conn))
//}
