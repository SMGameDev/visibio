package moving

import (
	"github.com/jakecoffman/cp"
	"github.com/SMGameDev/visibio/fbs"
	"github.com/SMGameDev/visibio/ecs"
)

type movingEntity struct {
	inputs *fbs.Inputs
	body   *cp.Body
	force  float64
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

func (s *System) Add(id ecs.Index, inputs *fbs.Inputs, body *cp.Body, force float64) {
	s.entities[id] = movingEntity{
		inputs: inputs,
		body:   body,
		force:  force,
	}
}

func (s *System) Update(dt float64) {
	for _, entity := range s.entities {
		if len(entity.inputs.Table().Bytes) > 0 {
			var force cp.Vector
			left := entity.inputs.Left()
			right := entity.inputs.Right()
			if left != right {
				if entity.inputs.Left() > 0 {
					force.X = -(entity.force)
				} else {
					force.X = entity.force
				}
			}
			if entity.inputs.Down() != entity.inputs.Up() { // inverted b/c canvas
				if entity.inputs.Down() > 0 {
					force.Y = entity.force
				} else {
					force.Y = -(entity.force)
				}
			}
			entity.body.SetForce(force)
			//delta := force.Sub(entity.body.Velocity())
			//entity.body.SetVelocityVector(entity.body.Velocity().Add(delta.Clamp(entity.acceleration / dt)))
			entity.body.SetAngle(float64(entity.inputs.Rotation()))
		}
	}
}

func (s *System) Remove(id ecs.Index) {
	delete(s.entities, id)
}
