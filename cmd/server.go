package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"time"
	"github.com/gorilla/websocket"
	"net/http"
	"log"
	"github.com/SMGameDev/visibio/net"
	"github.com/SMGameDev/visibio/game"
	"math/big"
	"go.uber.org/zap"
)

var (
	width    float64 = 4608
	height   float64 = 4608
	addr             = ":8080"
	tick             = time.Millisecond * 20
	upgrader         = &websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
	} // use default options
	logger *zap.Logger
)

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

		g := game.New(width, height, logger)
		go func() {
			ticks := big.NewInt(0)
			one := big.NewInt(1)
			ticker := time.NewTicker(tick)
			var skipped = 0
			start := time.Now()
			for t := range ticker.C {
				select {
				case <-ticker.C: // if the next tick is immediately available (which means we're lagging)
					skipped++
					break
				default:
					if skipped > 0 {
						fmt.Printf("skipped %d ticks; is the server lagging?", skipped)
						ticks.Add(ticks, big.NewInt(int64(skipped)))
						skipped = 0
					}
					delta := float64(t.Sub(start).Nanoseconds() / 1000) // microseconds
					start = t
					g.Tick(delta)
					ticks.Add(ticks, one)
					logger.Debug("game tick", zap.Int64("tick", ticks.Int64()), zap.Float64("delta", delta))
				}
			}
		}()
		logger.Info("game started")
		http.Handle("/", connect(g))
		log.Fatal(http.ListenAndServe(addr, nil))
	},
}

func init() {
	rootCmd.AddCommand(serverCmd)
	serverCmd.Flags().Float64Var(&width, "width", 4608, "Set the width of the map. Must be a multiple of 24.")
	serverCmd.Flags().Float64Var(&height, "height", 4608, "Set the height of the map. Must be a multiple of 24.")
	serverCmd.Flags().StringVar(&addr, "addr", ":8080", "Accept incoming requests at this address.")
	serverCmd.Flags().DurationVarP(&tick, "tick", "t", 20*time.Millisecond, "Duration of a game tick.")
}

func connect(g *game.Game) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			logger.Info("could not upgrade connection: %v\n", zap.Error(err))
			return
		}
		g.Add(net.Websocket(conn))
		logger.Info("client connected")
	})
}

