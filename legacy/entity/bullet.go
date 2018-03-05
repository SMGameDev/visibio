package entity

import (
	"github.com/jakecoffman/cp"
	"github.com/SMGameDev/visibio/world"
)

type Bullet struct {
	Id     uint64
	Health *int
	Body   *cp.Body
}

func NewBullet(world *world.World, owner uint64) *Bullet {
	body := cp.NewBody(0, 0)
	bulletShape := cp.NewCircle(body, 3, cp.Vector{})
	bulletShape.SetFilter(cp.NewShapeFilter(uint(owner), world.Perceivable|world.Damager|world.Damageable, uint(cp.WILDCARD_COLLISION_TYPE)))
	bulletShape.SetFriction(1)
	bulletShape.SetElasticity(0)
	world.Lock()
	world.Space.AddBody(body)
	world.Unlock()
}

func (b Bullet) Alive() bool {
	return *b.Health > 0
}
