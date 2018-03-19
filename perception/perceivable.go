package perception

import (
	"github.com/google/flatbuffers/go"
	"github.com/SMGameDev/visibio/collision"
)

// some helper values
const (
	perceivable = collision.Player | collision.Bullet
)

type Perceivable interface {
	// visible returns whether an entity is visible to members of another team
	Snapshot(builder *flatbuffers.Builder, introduce bool) flatbuffers.UOffsetT
}

type PerceivableFunc func(builder *flatbuffers.Builder, introduce bool) flatbuffers.UOffsetT

func (fn PerceivableFunc) Snapshot(builder *flatbuffers.Builder, introduce bool) flatbuffers.UOffsetT {
	return fn(builder, introduce)
}
