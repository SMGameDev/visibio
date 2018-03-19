package collision

import (
	"github.com/jakecoffman/cp"
	"github.com/SMGameDev/visibio/ecs"
)

const (
	Wall   uint = 1 << (iota + 1)
	Bullet
	Player
)

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
	bullets := space.NewCollisionHandler(cp.CollisionType(Player), cp.CollisionType(Bullet))
	bullets.PreSolveFunc = func(arb *cp.Arbiter, space *cp.Space, userData interface{}) bool {
		a, b := arb.Bodies()
		playerIndex := a.UserData.(ecs.Index)
		bulletIndex := b.UserData.(ecs.Index)
		player := system.entities[playerIndex]
		bullet := system.entities[bulletIndex]
		*player.health -= *bullet.health
		*bullet.health = 0
		system.manager.Remove(bulletIndex)
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
