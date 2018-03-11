package world

import (
	"github.com/jakecoffman/cp"
	"sync/atomic"
)

type Terrain interface {
	Width() int
	Height() int
	// Map returns the terrain map where Map()[x][y] is the value of the cell at (x,y) where (0,0) is the top-left corner.
	Map() [][]uint8
}

type World struct {
	Space    *cp.Space
	entities map[uint64]*cp.Body
	maxId    uint64
}

func (w *World) NextId() uint64 {
	return atomic.AddUint64(&w.maxId, 1) - 1
}

func NewWorld(width, height float64) *World {
	space := cp.NewSpace()
	space.SetGravity(cp.Vector{0, 0})
	hw, hh := width/2, height/2
	sides := []cp.Vector{
		// outer walls
		{-hw, -hh}, {-hw, hh}, // left
		{hw, -hh}, {hw, hh},   // right
		{-hw, -hh}, {hw, -hh}, // bottom
		{-hw, hh}, {hw, hh},   // top
	}
	for i := 0; i < len(sides); i += 2 {
		seg := space.AddShape(cp.NewSegment(space.StaticBody, sides[i], sides[i+1], 1))
		seg.SetElasticity(1)
		seg.SetFriction(0)
		// filter indicates it is not perceivable, i.e. is not communicated on connection
		seg.SetFilter(cp.NewShapeFilter(0, uint(Static), uint(cp.WILDCARD_COLLISION_TYPE)))
	}

	return &World{
		Space:    space,
		entities: make(map[uint64]*cp.Body),
		maxId:    0,
	}
}

func (w *World) Add(id uint64, body *cp.Body) {
	w.Space.AddBody(body)
	w.entities[id] = body
}

func (w *World) Update(dt float64) {
	w.Space.Step(dt)
}

func (w *World) Remove(id uint64) {
	if b, ok := w.entities[id]; ok {
		w.Space.RemoveBody(b)
		delete(w.entities, id)
	}
}
