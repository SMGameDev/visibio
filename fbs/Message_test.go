package fbs_test

import (
	"testing"
	"github.com/google/flatbuffers/go"
	"github.com/SMGameDev/visibio/fbs"
)

func TestMessage_Packet(t *testing.T) {
	builder := flatbuffers.NewBuilder(0)
	name := builder.CreateString("meyer")
	fbs.RespawnStart(builder)
	fbs.RespawnAddName(builder, name)
	respawn := fbs.RespawnEnd(builder)
	builder.Finish(respawn)
	data := builder.FinishedBytes()
	t.Logf("data: %v\n", data)
}
