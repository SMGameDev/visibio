package moving

import (
	"github.com/jakecoffman/cp"
	"github.com/SMGameDev/visibio/fbs"
	"github.com/SMGameDev/visibio/ecs"
)

type movingEntity struct {
	inputs       *fbs.Inputs
	body         *cp.Body
	acceleration float64
}

type System struct {
	entities map[ecs.Index]movingEntity
	world    *cp.Space
}

func New() ecs.System {
	return &System{
		entities: make(map[ecs.Index]movingEntity),
	}
}

func (s *System) Add(id ecs.Index, inputs *fbs.Inputs, body *cp.Body, acceleration float64) {
	s.entities[id] = movingEntity{
		inputs:       inputs,
		body:         body,
		acceleration: acceleration,
	}
}

func (s *System) Update(dt float64) {
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

func (s *System) Remove(id ecs.Index) {
	delete(s.entities, id)
}
