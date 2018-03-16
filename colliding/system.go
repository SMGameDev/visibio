package colliding

import (
	"github.com/jakecoffman/cp"
	"github.com/SMGameDev/visibio/ecs"
)

const (
	Static      cp.CollisionType = 1 << (iota + 1)
	Damager
	Damageable
	Perceiver
	Perceivable
)

type Terrain interface {
	Width() int
	Height() int
	// Map returns the terrain map where Map()[x][y] is the value of the cell at (x,y) where (0,0) is the top-left corner.
	Map() [][]uint8
}

type collidingEntity struct {
	health *int
	body   *cp.Body
}

type System struct {
	manager  *ecs.Manager
	space    *cp.Space
	entities map[ecs.Index]collidingEntity
}

func New(manager *ecs.Manager, space *cp.Space) ecs.System {
	system := &System{
		manager:  manager,
		space:    space,
		entities: make(map[ecs.Index]collidingEntity),
	}
	dmg := space.NewCollisionHandler(Damageable, Damager)
	dmg.PreSolveFunc = func(arb *cp.Arbiter, space *cp.Space, userData interface{}) bool {
		a, b := arb.Bodies()
		damageableIndex := a.UserData.(ecs.Index)
		damagerIndex := b.UserData.(ecs.Index)
		damageable := system.entities[damageableIndex]
		damager := system.entities[damagerIndex]
		*damageable.health -= *damager.health
		*damager.health = 0
		return true // bullets should transfer velocity
	}
	return system
}

func (s *System) Add(id ecs.Index, health *int, body *cp.Body) {
	s.space.AddBody(body)
	body.EachShape(func(shape *cp.Shape) {
		if !s.space.ContainsShape(shape) {
			s.space.AddShape(shape)
		}
	})
	s.entities[id] = collidingEntity{health: health, body: body}
}

func (s *System) Update(dt float64) {
	s.space.Step(dt)
	for i, e := range s.entities {
		if *e.health <= 0 {
			s.manager.Remove(i)
		}
	}
}

func (s *System) Remove(id ecs.Index) {
	if e, ok := s.entities[id]; ok {
		e.body.EachShape(func(shape *cp.Shape) {
			s.space.RemoveShape(shape)
		})
		s.space.RemoveBody(e.body)
		delete(s.entities, id)
	}
}
