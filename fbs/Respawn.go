// automatically generated by the FlatBuffers compiler, do not modify

package fbs

import (
	flatbuffers "github.com/google/flatbuffers/go"
)

type Respawn struct {
	_tab flatbuffers.Table
}

func GetRootAsRespawn(buf []byte, offset flatbuffers.UOffsetT) *Respawn {
	n := flatbuffers.GetUOffsetT(buf[offset:])
	x := &Respawn{}
	x.Init(buf, n+offset)
	return x
}

func (rcv *Respawn) Init(buf []byte, i flatbuffers.UOffsetT) {
	rcv._tab.Bytes = buf
	rcv._tab.Pos = i
}

func (rcv *Respawn) Table() flatbuffers.Table {
	return rcv._tab
}

func (rcv *Respawn) Name() []byte {
	o := flatbuffers.UOffsetT(rcv._tab.Offset(4))
	if o != 0 {
		return rcv._tab.ByteVector(o + rcv._tab.Pos)
	}
	return nil
}

func RespawnStart(builder *flatbuffers.Builder) {
	builder.StartObject(1)
}
func RespawnAddName(builder *flatbuffers.Builder, name flatbuffers.UOffsetT) {
	builder.PrependUOffsetTSlot(0, flatbuffers.UOffsetT(name), 0)
}
func RespawnEnd(builder *flatbuffers.Builder) flatbuffers.UOffsetT {
	return builder.EndObject()
}
