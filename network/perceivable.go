package network

import "github.com/google/flatbuffers/go"

type Perceivable interface {
	// visible returns whether an entity is visible to members of another team
	Snapshot(introduce bool, builder *flatbuffers.Builder) flatbuffers.UOffsetT
}

type PerceivableFunc func(introduce bool, builder *flatbuffers.Builder) flatbuffers.UOffsetT

func (fn PerceivableFunc) Snapshot(introduce bool, builder *flatbuffers.Builder) flatbuffers.UOffsetT {
	return fn(introduce, builder)
}
