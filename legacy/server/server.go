package server

import (
	"github.com/SMGameDev/visibio/world"
	"github.com/SMGameDev/visibio/moving"
	"github.com/SMGameDev/visibio/legacy/dying"
	"sync"
	"github.com/SMGameDev/visibio/net"
)

type Server struct {
	world   *world.World
	clients map[net.Connection]*Client
	remover func(uint64)
	moving  *moving.System
	dying   *dying.System
	*sync.RWMutex
}
