package colliding

import (
	"github.com/jakecoffman/cp"
	"sync"
	"github.com/SMGameDev/visibio/dying"
)

func New(space *cp.Space, width, height float64) *System {
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
		seg.SetFilter(cp.NewShapeFilter(0, uint(Static), uint(cp.WILDCARD_COLLISION_TYPE)))
	}

	damageHandler := space.NewCollisionHandler(cp.CollisionType(Damageable), cp.CollisionType(Damager))
	damageHandler.PreSolveFunc = func(arb *cp.Arbiter, space *cp.Space, userData interface{}) bool {
		damageableBody, damagerBody := arb.Bodies()
		damageable := damageableBody.UserData.(dying.Damageable)
		damager := damagerBody.UserData.(dying.Damager)
		damageable.Damage(damager.DamageAmount())
		return true
	}

	return &System{
		space:    space,
		entities: make(map[uint64]*cp.Body),
		mu:       &sync.RWMutex{},
	}
}

type System struct {
	space    *cp.Space
	entities map[uint64]*cp.Body
	mu       *sync.RWMutex
}

func (s *System) Update(dt float64) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	s.space.Step(dt)
}

func (s *System) Remove(id uint64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.space.RemoveBody(s.entities[id])
	delete(s.entities, id)
}
