// automatically generated by the FlatBuffers compiler, do not modify

package fbs

import (
	flatbuffers "github.com/google/flatbuffers/go"
)

type World struct {
	_tab flatbuffers.Table
}

func GetRootAsWorld(buf []byte, offset flatbuffers.UOffsetT) *World {
	n := flatbuffers.GetUOffsetT(buf[offset:])
	x := &World{}
	x.Init(buf, n+offset)
	return x
}

func (rcv *World) Init(buf []byte, i flatbuffers.UOffsetT) {
	rcv._tab.Bytes = buf
	rcv._tab.Pos = i
}

func (rcv *World) Table() flatbuffers.Table {
	return rcv._tab
}

func (rcv *World) Id() uint64 {
	o := flatbuffers.UOffsetT(rcv._tab.Offset(4))
	if o != 0 {
		return rcv._tab.GetUint64(o + rcv._tab.Pos)
	}
	return 0
}

func (rcv *World) MutateId(n uint64) bool {
	return rcv._tab.MutateUint64Slot(4, n)
}

func (rcv *World) Width() uint32 {
	o := flatbuffers.UOffsetT(rcv._tab.Offset(6))
	if o != 0 {
		return rcv._tab.GetUint32(o + rcv._tab.Pos)
	}
	return 0
}

func (rcv *World) MutateWidth(n uint32) bool {
	return rcv._tab.MutateUint32Slot(6, n)
}

func (rcv *World) Height() uint32 {
	o := flatbuffers.UOffsetT(rcv._tab.Offset(8))
	if o != 0 {
		return rcv._tab.GetUint32(o + rcv._tab.Pos)
	}
	return 0
}

func (rcv *World) MutateHeight(n uint32) bool {
	return rcv._tab.MutateUint32Slot(8, n)
}

func (rcv *World) Map(j int) byte {
	o := flatbuffers.UOffsetT(rcv._tab.Offset(10))
	if o != 0 {
		a := rcv._tab.Vector(o)
		return rcv._tab.GetByte(a + flatbuffers.UOffsetT(j*1))
	}
	return 0
}

func (rcv *World) MapLength() int {
	o := flatbuffers.UOffsetT(rcv._tab.Offset(10))
	if o != 0 {
		return rcv._tab.VectorLen(o)
	}
	return 0
}

func (rcv *World) MapBytes() []byte {
	o := flatbuffers.UOffsetT(rcv._tab.Offset(10))
	if o != 0 {
		return rcv._tab.ByteVector(o + rcv._tab.Pos)
	}
	return nil
}

func WorldStart(builder *flatbuffers.Builder) {
	builder.StartObject(4)
}
func WorldAddId(builder *flatbuffers.Builder, id uint64) {
	builder.PrependUint64Slot(0, id, 0)
}
func WorldAddWidth(builder *flatbuffers.Builder, width uint32) {
	builder.PrependUint32Slot(1, width, 0)
}
func WorldAddHeight(builder *flatbuffers.Builder, height uint32) {
	builder.PrependUint32Slot(2, height, 0)
}
func WorldAddMap(builder *flatbuffers.Builder, map_ flatbuffers.UOffsetT) {
	builder.PrependUOffsetTSlot(3, flatbuffers.UOffsetT(map_), 0)
}
func WorldStartMapVector(builder *flatbuffers.Builder, numElems int) flatbuffers.UOffsetT {
	return builder.StartVector(1, numElems, 1)
}
func WorldEnd(builder *flatbuffers.Builder) flatbuffers.UOffsetT {
	return builder.EndObject()
}
