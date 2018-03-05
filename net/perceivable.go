package net

import "github.com/google/flatbuffers/go"

type Perceivable interface {
	// visible returns whether an entity is visible to members of another team
	Snapshot(introduce bool, builder *flatbuffers.Builder) flatbuffers.UOffsetT
}
