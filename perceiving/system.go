package perceiving

import (
	"github.com/SMGameDev/visibio/networking"
	"github.com/jakecoffman/cp"
	"github.com/google/flatbuffers/go"
	"github.com/SMGameDev/visibio/fbs"
	"sync"
	"github.com/SMGameDev/visibio/colliding"
)

//
//const (
//	VisibleToNone    uint = 1 << iota
//	VisibleToGhosts
//	VisibleToHunters
//	VisibleToAll     = VisibleToGhosts | VisibleToHunters
//)

type Perceivable interface {
	// visible returns whether an entity is visible to members of another team
	Snapshot(introduce bool, builder *flatbuffers.Builder) flatbuffers.UOffsetT
}

type perceivingEntity struct {
	conn   networking.Connection
	body   *cp.Body
	health *int
	team   *uint8
	known  map[Perceivable]struct{}
}

type System struct {
	perceivers map[uint64]perceivingEntity
	space      *cp.Space
	mu         *sync.RWMutex
}

func New(space *cp.Space) *System {
	return &System{
		perceivers: make(map[uint64]perceivingEntity),
		space:      space,
		mu:         new(sync.RWMutex),
	}
}

func (s *System) Remove(id uint64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.perceivers, id)
}

func (s *System) Update() {
	s.mu.RLock()
	defer s.mu.RUnlock()

	builder := flatbuffers.NewBuilder(0)
	for _, entity := range s.perceivers {
		builder.Reset()
		// find all perceivable entities within viewing range
		perceivables := make(map[Perceivable]struct{}, 0)
		s.space.BBQuery(
			cp.NewBBForExtents(entity.body.Position(), 200, 200),
			cp.NewShapeFilter(cp.NO_GROUP, 0, uint(colliding.Perceivable)),
			func(shape *cp.Shape, _ interface{}) {
				perceivables[shape.Body().UserData.(Perceivable)] = struct{}{}
			},
			nil,
		)
		var perceptions = make([]flatbuffers.UOffsetT, 0, len(perceivables))
		for perceivable, _ := range perceivables {
			_, known := entity.known[perceivable]
			perceptions = append(perceptions, perceivable.Snapshot(known, builder))
		}
		fbs.PerceptionStartSnapshotsVector(builder, len(perceivables))
		for i := len(perceptions) - 1; i >= 0; i-- {
			builder.PrependUOffsetT(perceptions[i])
		}
		snapshots := builder.EndVector(len(perceivables))
		fbs.PerceptionStart(builder)
		fbs.PerceptionAddHealth(builder, uint16(*entity.health))
		fbs.PerceptionAddSnapshots(builder, snapshots)
		perception := fbs.PerceptionEnd(builder)
		builder.Finish(perception)
		go entity.conn.Send(builder.FinishedBytes())
	}
}
