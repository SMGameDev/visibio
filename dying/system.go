package dying

import "sync"

type Damager interface {
	DamageAmount() int
}

type Damageable interface {
	Damage(amount int)
}

type System struct {
	tracked map[uint64]*int
	remover func(id uint64)
	mu      *sync.RWMutex
}

func New(remover func(id uint64)) *System {
	return &System{
		tracked: make(map[uint64]*int),
		remover: remover,
		mu:      new(sync.RWMutex),
	}
}

func (s *System) Update() {
	s.mu.RLock()
	defer s.mu.RUnlock()

	for id, h := range s.tracked {
		if *h <= 0 {
			go s.remover(id)
		}
	}
}

func (s *System) Add(id uint64, health *int) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.tracked[id] = health
}

func (s *System) Remove(id uint64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.tracked, id)
}
