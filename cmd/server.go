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
	"github.com/SMGameDev/visibio/collision"
	"github.com/SMGameDev/visibio/ecs"
	"github.com/SMGameDev/visibio/perception"
	"github.com/SMGameDev/visibio/movement"
	"sync"
	"github.com/google/flatbuffers/go"
	"github.com/SMGameDev/visibio/network"
	"github.com/SMGameDev/visibio/terrain"
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

		// generate the terrain
		logger.Info("generating terrain")
		w := terrain.NewCellular(int(width), int(height))
		w.Randomize(.45)
		for i := 0; i < 5; i++ {
			w.Create()
		}
		w.Connect(0)

		// set up physics
		space := cp.NewSpace()
		// > rules
		space.SetDamping(0.3)
		space.SetGravity(cp.Vector{0, 0})
		// > outer boundaries
		wallFilter := cp.NewShapeFilter(0, uint(collision.Wall), uint(cp.WILDCARD_COLLISION_TYPE))
		pwidth := float64(width) * 64
		pheight := float64(height) * 64
		sides := []cp.Vector{
			// outer walls
			{0, 0}, {0, pheight},
			{pwidth, 0}, {pwidth, pheight},
			{0, 0}, {pwidth, 0},
			{0, pheight}, {pwidth, pheight},
		}
		for i := 0; i < len(sides); i += 2 {
			seg := space.AddShape(cp.NewSegment(space.StaticBody, sides[i], sides[i+1], 1))
			seg.SetElasticity(1.0)
			seg.SetFilter(wallFilter)
		}
		// > walls
		for x := 0; x < int(w.Width()); x++ {
			for y := 0; y < int(w.Height()); y++ {
				if w.Cells()[x][y] > 0 {
					wall := space.AddShape(cp.NewBox2(space.StaticBody, cp.NewBBForExtents(cp.Vector{float64(1+x)*64 - 32, float64(1+y)*64 - 32}, 32, 32), 0))
					wall.SetFilter(wallFilter)
				}
			}
		}

		// entity-component-system
		manager := ecs.NewManager()
		manager.AddSystem(collision.New(manager, space))
		manager.AddSystem(perception.New(space, w, builderPool))
		manager.AddSystem(movement.New(manager))
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
