package cmd

import (
	"github.com/spf13/cobra"
	"time"
	"github.com/gorilla/websocket"
	"net/http"
	"log"
	"github.com/SMGameDev/visibio/networking"
	"math/big"
	"go.uber.org/zap"
	"github.com/jakecoffman/cp"
	"github.com/SMGameDev/visibio/colliding"
	"github.com/SMGameDev/visibio/ecs"
	"github.com/SMGameDev/visibio/perceiving"
	"github.com/SMGameDev/visibio/moving"
	"sync"
	"github.com/google/flatbuffers/go"
	"github.com/SMGameDev/visibio/network"
)

var (
	width    uint32 = 192
	height   uint32 = 192
	addr            = ":8080"
	tick            = time.Millisecond * 20
	upgrader        = &websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	} // use default options
	logger *zap.Logger
)

var builderPool = &sync.Pool{
	New: func() interface{} {
		return flatbuffers.NewBuilder(128)
	},
}

// serverCmd represents the server command
var serverCmd = &cobra.Command{
	Use:   "server",
	Short: "Hosts a visibio server.",
	Long:  `Use this command to host a visibio server for players to connect to.`,
	Run: func(cmd *cobra.Command, args []string) {
		// initialize logger
		var err error
		if debug {
			logger, err = zap.NewDevelopment()
		} else {
			logger, err = zap.NewProduction()
		}
		if err != nil {
			log.Fatalf("can't initialize zap logger: %v", err)
		}
		defer logger.Sync()

		manager := ecs.NewManager()
		space := cp.NewSpace()
		space.SetGravity(cp.Vector{0, 0})
		hw, hh := (float64(width)/2)*64, (float64(height)/2)*64
		sides := []cp.Vector{
			// outer walls
			{-hw, -hh}, {-hw, hh}, // left
			{hw, -hh}, {hw, hh},   // right
			{-hw, -hh}, {hw, -hh}, // bottom
			{-hw, hh}, {hw, hh},   // top
		}
		for i := 0; i < len(sides); i += 2 {
			seg := space.AddShape(cp.NewSegment(space.StaticBody, sides[i], sides[i+1], 1))
			seg.SetElasticity(1.0)
			seg.SetFilter(cp.NewShapeFilter(0, uint(colliding.Static), uint(cp.WILDCARD_COLLISION_TYPE)))
		}
		space.SetDamping(0.3)
		manager.AddSystem(colliding.New(manager, space))
		manager.AddSystem(perceiving.New(space, width, height, builderPool))
		manager.AddSystem(moving.New())
		manager.AddSystem(networking.New(manager, builderPool, logger))

		go func() {
			ticks := big.NewInt(0)
			one := big.NewInt(1)
			ticker := time.NewTicker(tick)
			var skipped = 0
			start := time.Now()
			for t := range ticker.C {
				select {
				case <-ticker.C: // if the next tick is immediately available (means we're lagging)
					skipped++
					break
				default:
					if skipped > 0 {
						logger.Info("lagging", zap.Int("skipped", skipped))
						ticks.Add(ticks, big.NewInt(int64(skipped)))
						skipped = 0
					}
					delta := t.Sub(start).Seconds()
					start = t
					manager.Update(delta)
					ticks.Add(ticks, one)
					logger.Debug("game tick", zap.Int64("tick", ticks.Int64()), zap.Float64("delta", delta))
				}
			}
		}()
		logger.Info("game started")
		http.Handle("/", connect(manager))
		log.Fatal(http.ListenAndServe(addr, nil))
	},
}

func init() {
	rootCmd.AddCommand(serverCmd)
	serverCmd.Flags().Uint32Var(&width, "width", 192, "Set the width of the map (tiles). Each tile is 64 physics units.")
	serverCmd.Flags().Uint32Var(&height, "height", 192, "Set the width of the map (tiles). Each tile is 64 physics units.")
	serverCmd.Flags().StringVar(&addr, "addr", ":8080", "Accept incoming requests at this address.")
	serverCmd.Flags().DurationVarP(&tick, "tick", "t", 20*time.Millisecond, "Duration of a game tick.")
}

func connect(m *ecs.Manager) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			logger.Info("could not upgrade connection: %v\n", zap.Error(err))
			return
		}
		for _, system := range m.Systems() {
			switch sys := system.(type) {
			case *networking.System:
				sys.Add(network.Websocket(conn))
			}
		}
		logger.Info("client connected")
	})
}
