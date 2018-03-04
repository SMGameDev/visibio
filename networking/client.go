package networking

import (
	"github.com/SMGameDev/visibio/entity"
	"github.com/SMGameDev/visibio/fbs"
	"time"
)

type Client struct {
	player       *entity.Player
	inputs       *fbs.Inputs
	lastReceived time.Time
	spawned      time.Time
}
