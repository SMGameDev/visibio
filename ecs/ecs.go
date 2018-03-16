package ecs

import (
	"sync/atomic"
)

type Index = uint64

type System interface {
	Update(dt float64)
	Remove(Index)
}

type Manager struct {
	systems  []System
	toRemove []Index
	maxId    uint64
}

func NewManager() *Manager {
	return &Manager{
		systems: make([]System, 0),
		maxId:   0,
	}
}

func (m *Manager) Update(dt float64) {
	// first, remove dead entities
	for _, id := range m.toRemove {
		for _, sys := range m.systems {
			sys.Remove(id)
		}
	}
	for i := 0; i < len(m.systems); i++ {
		m.systems[i].Update(dt)
	}
}

func (m *Manager) NextIndex() Index {
	return Index(atomic.AddUint64(&m.maxId, 1))
}

func (m *Manager) AddSystem(system System) {
	m.systems = append([]System{system}, m.systems...) // prepend
}

// Systems returns the list of Systems managed by the World.
func (m *Manager) Systems() []System {
	return m.systems
}

func (m *Manager) Remove(i Index) {
	m.toRemove = append(m.toRemove, i)
}
