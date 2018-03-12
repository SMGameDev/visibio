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
	toRemove chan Index
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
	// kill entities
remover:
	for {
		select {
		case id := <-m.toRemove:
			m.Remove(id)
		default:
			break remover
		}
	}

	for i := 0; i < len(m.systems); i++ {
		m.systems[i].Update(dt)
	}
}

func (m *Manager) NextIndex() Index {
	return Index(atomic.AddUint64(&m.maxId, 1) - 1)
}

func (m *Manager) AddSystem(system System) {
	m.systems = append([]System{system}, m.systems...) // prepend
}

// Systems returns the list of Systems managed by the World.
func (m *Manager) Systems() []System {
	return m.systems
}

func (m *Manager) Remove(i Index) {
	go func() { m.toRemove <- i }()
}
