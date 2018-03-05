package perceiving

import (
	"github.com/SMGameDev/visibio/net"
	"github.com/jakecoffman/cp"
	"github.com/SMGameDev/visibio/world"
	"github.com/google/flatbuffers/go"
	"github.com/SMGameDev/visibio/fbs"
)

type perceiver struct {
	conn   net.Connection
	body   *cp.Body
	health *uint16
	known  map[net.Perceivable]struct{}
}

type System struct {
	perceivers map[uint64]perceiver
	world      *world.World
}

func New(world *world.World) *System {
	return &System{
		perceivers: make(map[uint64]perceiver),
		world:      world,
	}
}

func (s *System) Add(id uint64, conn net.Connection, body *cp.Body) {
	s.perceivers[id] = perceiver{conn: conn, body: body, known: make(map[net.Perceivable]struct{})}
}

func (s *System) Remove(id uint64) {
	delete(s.perceivers, id)
}

func (s *System) Update() {
	builder := flatbuffers.NewBuilder(100)
	for _, p := range s.perceivers {
		builder.Reset()
		// find all perceivable entities within viewing range
		perceivables := make(map[net.Perceivable]struct{}, 0)
		s.world.Space.BBQuery(
			cp.NewBBForExtents(p.body.Position(), 200, 200),
			cp.NewShapeFilter(cp.NO_GROUP, 0, uint(world.Perceivable)),
			func(shape *cp.Shape, _ interface{}) {
				perceivables[shape.Body().UserData.(net.Perceivable)] = struct{}{}
			},
			nil,
		)
		var perceptions = make([]flatbuffers.UOffsetT, 0, len(perceivables)+1)
		for perceivable := range perceivables {
			_, known := p.known[perceivable]
			perceptions = append(perceptions, perceivable.Snapshot(known, builder))
			p.known[perceivable] = struct{}{}
		}
		perceptions = append(perceptions, p.body.UserData.(net.Perceivable).Snapshot(false, builder))
		fbs.PerceptionStartSnapshotsVector(builder, len(perceptions))
		for i := len(perceptions) - 1; i >= 0; i-- {
			builder.PrependUOffsetT(perceptions[i])
		}
		snapshots := builder.EndVector(len(perceptions))
		fbs.PerceptionStart(builder)
		fbs.PerceptionAddHealth(builder, *p.health)
		fbs.PerceptionAddSnapshots(builder, snapshots)
		perception := fbs.PerceptionEnd(builder)
		fbs.MessageStart(builder)
		fbs.MessageAddPacketType(builder, fbs.PacketPerception)
		fbs.MessageAddPacket(builder, perception)
		message := fbs.MessageEnd(builder)
		builder.Finish(message)
		data := make([]byte, 0, len(builder.FinishedBytes()))
		copy(data, builder.FinishedBytes()[:])
		go p.conn.Send(data)
	}
}
