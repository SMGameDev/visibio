package health

import (
	"github.com/jakecoffman/cp"
	"github.com/SMGameDev/visibio/world"
)

type entity struct {
	id     uint64
	health *uint16
}

type System struct {
	entities []entity
	remover  func(uint64)
}

func New(w *world.World, remover func(id uint64)) *System {
	damageHandler := w.Space.NewCollisionHandler(cp.CollisionType(world.Damageable), cp.CollisionType(world.Damager))
	damageHandler.PreSolveFunc = func(arb *cp.Arbiter, space *cp.Space, userData interface{}) bool {
		damageableBody, damagerBody := arb.Bodies()
		damageable := damageableBody.UserData.(Damageable)
		damager := damagerBody.UserData.(Damager)
		damageable.Damage(damager.DamageAmount())
		return arb.Ignore() // bullets go through
	}
	return &System{
		entities: make([]entity, 0),
		remover:  remover,
	}
}

func (s *System) Add(id uint64, health *uint16) {
	s.entities = append(s.entities, entity{id: id, health: health})
}

func (s *System) Remove(id uint64) {
	for i := len(s.entities) - 1; i >= 0; i-- {
		if s.entities[i].id == id {
			s.entities[i] = s.entities[len(s.entities)-1]
			s.entities = s.entities[:len(s.entities)-1]
			return
		}
	}
}

func (s *System) Update() {
	for _, entity := range s.entities {
		if *entity.health <= 0 {
			go s.remover(entity.id)
		}
	}
}
