package moving

import (
	"github.com/SMGameDev/visibio/fbs"
	"github.com/jakecoffman/cp"
	"github.com/SMGameDev/visibio/world"
)

type movingEntity struct {
	inputs       *fbs.Inputs
	body         *cp.Body
	acceleration float64
}

type System struct {
	entities map[uint64]movingEntity
	world    *world.World
}

func New(world *world.World) *System {
	return &System{
		entities: make(map[uint64]movingEntity),
		world:    world,
	}
}

func (s *System) Add(id uint64, inputs *fbs.Inputs, body *cp.Body, acceleration float64) {
	s.entities[id] = movingEntity{
		inputs:       inputs,
		body:         body,
		acceleration: acceleration,
	}
}

func (s *System) Update() {
	for _, entity := range s.entities {
		if len(entity.inputs.Table().Bytes) > 0 {
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
}

func (s *System) Remove(id uint64) {
	delete(s.entities, id)
}
