package moving

import (
	"sync"
	"github.com/SMGameDev/visibio/fbs"
	"github.com/jakecoffman/cp"
	"github.com/SMGameDev/visibio/game"
)

type movingEntity struct {
	inputs       *fbs.Inputs
	body         *cp.Body
	acceleration float64
}

type System struct {
	entities map[uint64]movingEntity
	world    *game.World
	mu       *sync.RWMutex
}

func New(world *game.World) *System {
	return &System{
		entities: make(map[uint64]movingEntity),
		world:    world,
		mu:       &sync.RWMutex{},
	}
}

func (s *System) Update() {
	s.mu.RLock()
	defer s.mu.RUnlock()

	s.world.Lock()
	defer s.world.Unlock()

	for _, entity := range s.entities {
		force := cp.Vector{0, 0}
		if entity.inputs.Left() != entity.inputs.Right() {
			if entity.inputs.Left() > 0 {
				force.X = -float64(entity.acceleration)
			} else {
				force.X = float64(entity.acceleration)
			}
		}
		if entity.inputs.Down() != entity.inputs.Up() {
			if entity.inputs.Down() > 0 {
				force.Y = -float64(entity.acceleration)
			} else {
				force.Y = float64(entity.acceleration)
			}
		}
		entity.body.SetForce(force)
		entity.body.SetAngle(float64(entity.inputs.Rotation()))
	}
}

func (s *System) Remove(id uint64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.entities, id)
}
