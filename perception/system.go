package perception

import (
	"github.com/google/flatbuffers/go"
	"github.com/jakecoffman/cp"
	"github.com/SMGameDev/visibio/fbs"
	"github.com/SMGameDev/visibio/ecs"
	"math"
	"sync"
	"github.com/SMGameDev/visibio/network"
	"github.com/SMGameDev/visibio/terrain"
)

type perceivingEntity struct {
	conn   network.Connection
	health *int
	known  map[ecs.Index]struct{}
}

type System struct {
	perceivers   map[ecs.Index]perceivingEntity
	perceivables map[ecs.Index]Perceivable
	space        *cp.Space
	pool         *sync.Pool
	t            terrain.Map
}

func New(space *cp.Space, t terrain.Map, pool *sync.Pool) ecs.System {
	return &System{
		perceivers:   make(map[ecs.Index]perceivingEntity),
		perceivables: make(map[ecs.Index]Perceivable),
		space:        space,
		pool:         pool,
		t:            t,
	}
}

func (s *System) AddPerceivable(id ecs.Index, perceivable Perceivable) {
	s.perceivables[id] = perceivable
}

func (s *System) AddPerceiver(id ecs.Index, conn network.Connection, health *int) {
	s.perceivers[id] = perceivingEntity{conn: conn, health: health, known: make(map[ecs.Index]struct{})}
	go func() {
		builder := s.pool.Get().(*flatbuffers.Builder)
		builder.Reset()
		fbs.WorldStartMapVector(builder, int(s.t.Width()*s.t.Height()))
		//fmt.Println("dims: ", s.t.Width(), " ", s.t.Height())
		for x := int(s.t.Width()) - 1; x >= 0; x-- {
			//fmt.Println("row ", x, " ", s.t.Cells()[x])
			for y := int(s.t.Height()) - 1; y >= 0; y-- {
				//fmt.Println(x, " ", y)
				builder.PrependByte(s.t.Cells()[x][y])
			}
		}
		m := builder.EndVector(int(s.t.Width() * s.t.Height()))
		fbs.WorldStart(builder)
		fbs.WorldAddId(builder, id)
		fbs.WorldAddWidth(builder, uint32(s.t.Width()))
		fbs.WorldAddHeight(builder, uint32(s.t.Height()))
		fbs.WorldAddMap(builder, m)
		world := fbs.WorldEnd(builder)
		fbs.MessageStart(builder)
		fbs.MessageAddPacketType(builder, fbs.PacketWorld)
		fbs.MessageAddPacket(builder, world)
		message := fbs.MessageEnd(builder)
		builder.Finish(message)
		conn.Send(builder.FinishedBytes())

		builder.Reset()
		s.pool.Put(builder)
	}()
}

func (s *System) Remove(id ecs.Index) {
	delete(s.perceivers, id)
	delete(s.perceivables, id)
}

func (s *System) Update(dt float64) {
	s.space.EachBody(func(b *cp.Body) {
		id, ok := b.UserData.(ecs.Index)
		if !ok {
			return
		}
		perceiver, ok := s.perceivers[id]
		if !ok {
			return
		}
		builder := s.pool.Get().(*flatbuffers.Builder)
		builder.Reset()
		// find all perceivable entities within viewing range
		targets := map[ecs.Index]struct{}{b.UserData.(ecs.Index): {}} // include self
		s.space.BBQuery(
			cp.NewBBForExtents(b.Position(), 32*64, 32*64),
			cp.NewShapeFilter(cp.NO_GROUP, cp.ALL_CATEGORIES, perceivable), //  all categories so that no perceivable can reject collision
			func(shape *cp.Shape, _ interface{}) {
				targets[shape.Body().UserData.(ecs.Index)] = struct{}{}
			},
			nil,
		)
		var perceptions = make([]flatbuffers.UOffsetT, 0, len(targets))
		for target := range targets {
			_, known := perceiver.known[target]
			perceptions = append(perceptions, s.perceivables[target].Snapshot(builder, known))
			if !known {
				perceiver.known[target] = struct{}{}
			}
		}
		// clean known index
		for k := range perceiver.known {
			if _, ok := targets[k]; !ok {
				delete(perceiver.known, k)
			}
		}
		fbs.PerceptionStartSnapshotsVector(builder, len(perceptions))
		for i := len(perceptions) - 1; i >= 0; i-- {
			builder.PrependUOffsetT(perceptions[i])
		}
		snapshots := builder.EndVector(len(perceptions))
		fbs.PerceptionStart(builder)
		fbs.PerceptionAddHealth(builder, uint16(math.Max(float64(*perceiver.health), 0)))
		fbs.PerceptionAddSnapshots(builder, snapshots)
		perception := fbs.PerceptionEnd(builder)
		fbs.MessageStart(builder)
		fbs.MessageAddPacketType(builder, fbs.PacketPerception)
		fbs.MessageAddPacket(builder, perception)
		message := fbs.MessageEnd(builder)
		builder.Finish(message)
		perceiver.conn.Send(builder.FinishedBytes())
		builder.Reset()
		s.pool.Put(builder)
	})
}
