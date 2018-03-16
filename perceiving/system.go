package perceiving

import (
	"github.com/google/flatbuffers/go"
	"github.com/jakecoffman/cp"
	"github.com/SMGameDev/visibio/colliding"
	"github.com/SMGameDev/visibio/fbs"
	"github.com/SMGameDev/visibio/network"
	"github.com/SMGameDev/visibio/ecs"
	"math"
	"sync"
)

type perceiver struct {
	conn   network.Connection
	body   *cp.Body
	health *int
	known  map[ecs.Index]struct{}
}

type System struct {
	perceivers    map[ecs.Index]perceiver
	perceivables  map[ecs.Index]network.Perceivable
	space         *cp.Space
	pool          *sync.Pool
	width, height uint32
}

func New(space *cp.Space, width, height uint32, pool *sync.Pool) ecs.System {
	return &System{
		perceivers:   make(map[ecs.Index]perceiver),
		perceivables: make(map[ecs.Index]network.Perceivable),
		space:        space,
		pool:         pool,
		width:        width,
		height:       height,
	}
}

func (s *System) AddPerceivable(id ecs.Index, perceivable network.Perceivable) {
	s.perceivables[id] = perceivable
}

func (s *System) AddPerceiver(id ecs.Index, conn network.Connection, body *cp.Body, health *int) {
	s.perceivers[id] = perceiver{conn: conn, body: body, health: health, known: make(map[ecs.Index]struct{})}
	go func() {
		builder := s.pool.Get().(*flatbuffers.Builder)
		builder.Reset()

		fbs.WorldStartMapVector(builder, 0) // todo encode and transmit map
		m := builder.EndVector(0)
		fbs.WorldStart(builder)
		fbs.WorldAddId(builder, id)
		fbs.WorldAddWidth(builder, s.width)
		fbs.WorldAddHeight(builder, s.height)
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
	for _, p := range s.perceivers {
		builder := s.pool.Get().(*flatbuffers.Builder)
		builder.Reset()
		// find all perceivable entities within viewing range
		targets := map[ecs.Index]struct{}{p.body.UserData.(ecs.Index): {}} // include self
		s.space.BBQuery(
			cp.NewBBForExtents(p.body.Position(), 200, 200),
			cp.NewShapeFilter(cp.NO_GROUP, 0, uint(colliding.Perceivable)),
			func(shape *cp.Shape, _ interface{}) {
				targets[shape.Body().UserData.(ecs.Index)] = struct{}{}
			},
			nil,
		)
		var perceptions = make([]flatbuffers.UOffsetT, 0, len(targets))
		for target := range targets {
			_, known := p.known[target]
			perceptions = append(perceptions, s.perceivables[target].Snapshot(known, builder))
			if !known { // reduce writes
				p.known[target] = struct{}{}
			}
		}
		fbs.PerceptionStartSnapshotsVector(builder, len(perceptions))
		for i := len(perceptions) - 1; i >= 0; i-- {
			builder.PrependUOffsetT(perceptions[i])
		}
		snapshots := builder.EndVector(len(perceptions))
		fbs.PerceptionStart(builder)
		fbs.PerceptionAddHealth(builder, uint16(math.Max(float64(*p.health), 0)))
		fbs.PerceptionAddSnapshots(builder, snapshots)
		perception := fbs.PerceptionEnd(builder)
		fbs.MessageStart(builder)
		fbs.MessageAddPacketType(builder, fbs.PacketPerception)
		fbs.MessageAddPacket(builder, perception)
		message := fbs.MessageEnd(builder)
		builder.Finish(message)
		p.conn.Send(builder.FinishedBytes())
		builder.Reset()
		s.pool.Put(builder)
	}
}
