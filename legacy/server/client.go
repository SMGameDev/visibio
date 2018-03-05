package server

import (
	"github.com/SMGameDev/visibio/legacy/entity"
	"github.com/SMGameDev/visibio/fbs"
	"time"
	"sync"
)

type Client struct {
	player       *entity.Player
	inputs       *fbs.Inputs
	lastReceived time.Time
	spawned      time.Time
	known        map[Perceivable]struct{}
	//closer       *sync.Once
	mu *sync.Mutex
}
