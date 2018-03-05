package server

import (
	"github.com/jakecoffman/cp"
	"github.com/SMGameDev/visibio/fbs"
	"github.com/google/flatbuffers/go"
	"github.com/SMGameDev/visibio/world"
	"github.com/SMGameDev/visibio/moving"
	"github.com/SMGameDev/visibio/legacy/dying"
)

func (s *Server) NewPlayer(name string) (uint64, *cp.Body, *fbs.Inputs) {
	id := s.NextId()
	body := cp.NewBody(0, 0)
	playerShape := cp.NewCircle(body, 15, cp.Vector{})
	playerShape.SetFriction(1)
	playerShape.SetElasticity(0)
	playerShape.SetFilter(cp.NewShapeFilter(uint(id), world.Perceivable|world.Damageable, uint(cp.WILDCARD_COLLISION_TYPE)))
	body.AddShape(playerShape)
	world.Lock()
	world.Space.AddBody(body)
	world.Unlock()
	var health int = 100
	moving.Add(id, inputs, body, 4)
	dying.Add(id, &health)
	return &Player{
		Id:     id,
		Body:   body,
		Health: &health,
		Name:   name,
	}
}

func (p Player) Alive() bool {
	return *p.Health > 0
}

func (p Player) Snapshot(introduction bool, builder *flatbuffers.Builder) flatbuffers.UOffsetT {
	fbs.PlayerStart(builder)
	fbs.PlayerAddId(builder, p.Id)
	fbs.PlayerAddPosition(builder, fbs.CreatePoint(builder, int32(p.Body.Position().X), int32(p.Body.Position().Y)))
	fbs.PlayerAddVelocity(builder, fbs.CreateVector(builder, float32(p.Body.Velocity().X), float32(p.Body.Velocity().Y)))
	fbs.PlayerAddRotation(builder, uint16(p.Body.Angle()))
	if introduction {
		//fbs.PlayerAddTeam(builder, p.Team)
		fbs.PlayerAddName(builder, builder.CreateString(p.Name))
	}
	return fbs.PlayerEnd(builder)
}
