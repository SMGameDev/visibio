// automatically generated by the FlatBuffers compiler, do not modify

package fbs

import (
	flatbuffers "github.com/google/flatbuffers/go"
)

type Inputs struct {
	_tab flatbuffers.Table
}

func GetRootAsInputs(buf []byte, offset flatbuffers.UOffsetT) *Inputs {
	n := flatbuffers.GetUOffsetT(buf[offset:])
	x := &Inputs{}
	x.Init(buf, n+offset)
	return x
}

func (rcv *Inputs) Init(buf []byte, i flatbuffers.UOffsetT) {
	rcv._tab.Bytes = buf
	rcv._tab.Pos = i
}

func (rcv *Inputs) Table() flatbuffers.Table {
	return rcv._tab
}

func (rcv *Inputs) Left() byte {
	o := flatbuffers.UOffsetT(rcv._tab.Offset(4))
	if o != 0 {
		return rcv._tab.GetByte(o + rcv._tab.Pos)
	}
	return 0
}

func (rcv *Inputs) MutateLeft(n byte) bool {
	return rcv._tab.MutateByteSlot(4, n)
}

func (rcv *Inputs) Right() byte {
	o := flatbuffers.UOffsetT(rcv._tab.Offset(6))
	if o != 0 {
		return rcv._tab.GetByte(o + rcv._tab.Pos)
	}
	return 0
}

func (rcv *Inputs) MutateRight(n byte) bool {
	return rcv._tab.MutateByteSlot(6, n)
}

func (rcv *Inputs) Up() byte {
	o := flatbuffers.UOffsetT(rcv._tab.Offset(8))
	if o != 0 {
		return rcv._tab.GetByte(o + rcv._tab.Pos)
	}
	return 0
}

func (rcv *Inputs) MutateUp(n byte) bool {
	return rcv._tab.MutateByteSlot(8, n)
}

func (rcv *Inputs) Down() byte {
	o := flatbuffers.UOffsetT(rcv._tab.Offset(10))
	if o != 0 {
		return rcv._tab.GetByte(o + rcv._tab.Pos)
	}
	return 0
}

func (rcv *Inputs) MutateDown(n byte) bool {
	return rcv._tab.MutateByteSlot(10, n)
}

func (rcv *Inputs) Shooting() byte {
	o := flatbuffers.UOffsetT(rcv._tab.Offset(12))
	if o != 0 {
		return rcv._tab.GetByte(o + rcv._tab.Pos)
	}
	return 0
}

func (rcv *Inputs) MutateShooting(n byte) bool {
	return rcv._tab.MutateByteSlot(12, n)
}

func (rcv *Inputs) Rotation() uint16 {
	o := flatbuffers.UOffsetT(rcv._tab.Offset(14))
	if o != 0 {
		return rcv._tab.GetUint16(o + rcv._tab.Pos)
	}
	return 0
}

func (rcv *Inputs) MutateRotation(n uint16) bool {
	return rcv._tab.MutateUint16Slot(14, n)
}

func InputsStart(builder *flatbuffers.Builder) {
	builder.StartObject(6)
}
func InputsAddLeft(builder *flatbuffers.Builder, left byte) {
	builder.PrependByteSlot(0, left, 0)
}
func InputsAddRight(builder *flatbuffers.Builder, right byte) {
	builder.PrependByteSlot(1, right, 0)
}
func InputsAddUp(builder *flatbuffers.Builder, up byte) {
	builder.PrependByteSlot(2, up, 0)
}
func InputsAddDown(builder *flatbuffers.Builder, down byte) {
	builder.PrependByteSlot(3, down, 0)
}
func InputsAddShooting(builder *flatbuffers.Builder, shooting byte) {
	builder.PrependByteSlot(4, shooting, 0)
}
func InputsAddRotation(builder *flatbuffers.Builder, rotation uint16) {
	builder.PrependUint16Slot(5, rotation, 0)
}
func InputsEnd(builder *flatbuffers.Builder) flatbuffers.UOffsetT {
	return builder.EndObject()
}
