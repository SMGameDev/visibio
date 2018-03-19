package movement

import (
	"github.com/jakecoffman/cp"
	"github.com/SMGameDev/visibio/ecs"
)

type movingEntity struct {
	controller Controller
	body       *cp.Body
	force      float64
}

type System struct {
	manager  *ecs.Manager
	entities map[ecs.Index]movingEntity
}

func New(manager *ecs.Manager) ecs.System {
	return &System{
		manager:  manager,
		entities: make(map[ecs.Index]movingEntity),
	}
}

func (s *System) Add(id ecs.Index, controller Controller, body *cp.Body, force float64) {
	s.entities[id] = movingEntity{
		controller: controller,
		body:       body,
		force:      force,
	}
}

func (s *System) Update(dt float64) {
	for _, entity := range s.entities {
		var force cp.Vector
		if entity.controller.Left() != entity.controller.Right() {
			if entity.controller.Left() {
				force.X = -(entity.force)
			} else {
				force.X = entity.force
			}
		}
		if entity.controller.Down() != entity.controller.Up() { // inverted b/c canvas
			if entity.controller.Down() {
				force.Y = entity.force
			} else {
				force.Y = -(entity.force)
			}
		}
		entity.body.SetForce(force)
		entity.body.SetAngle(float64(entity.controller.Rotation()))
	}
}

//func (s *System) newBullet(ownerId ecs.Index, owner movingEntity) {
//	id := s.manager.NextIndex()
//	body := cp.NewBody(1, cp.MomentForCircle(1, 0, 3, cp.Vector{}))
//	body.UserData = id
//	body.SetPosition(owner.body.Position())
//	body.SetForce(owner.body.LocalToWorld(cp.Vector{0, 500}.Rotate(owner.body.Rotation())))
//
//	bulletShape := body.AddShape(cp.NewCircle(body, 3, cp.Vector{0, 19}.Rotate(body.Rotation())))
//	bulletShape.SetFilter(cp.NewShapeFilter(uint(ownerId), uint(collision.Bullet), uint(collision.Player|collision.Wall)))
//}

func (s *System) Remove(id ecs.Index) {
	delete(s.entities, id)
}
