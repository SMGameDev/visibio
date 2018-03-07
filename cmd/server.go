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
)

// serverCmd represents the server command
var serverCmd = &cobra.Command{
	Use:   "server",
	Short: "Hosts a visibio server.",
	Long:  `Use this command to host a visibio server for players to connect to.`,
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Println("Starting server...")

		g := game.New(width, height)
		go func() {
			ticker := time.NewTicker(tick)
			var skipped = 0
			start := time.Now()
			for t := range ticker.C {
				select {
				case <-ticker.C: // if the next tick is immediately available (means last tick took > 20ms to complete)
					skipped++
					break
				default:
					if skipped > 0 {
						fmt.Printf("skipped %d ticks; is the server lagging?", skipped)
						skipped = 0
					}
					delta := float64(t.Sub(start).Nanoseconds() / 1000000)
					start = t
					g.Tick(delta)
				}
			}
		}()
		fmt.Println("Server started...")

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

//
//type server struct {
//	world      *world.World
//	moving     *moving.System
//	dying      *dying.System
//	networking *networking.System
//	upgrader   *websocket.Upgrader
//	*sync.RWMutex
//}
//
//func (s *server) tick(dt float64) {
//	s.RLock()
//	defer s.RUnlock()
//
//	s.world.Update(dt)
//	s.moving.Update()
//	s.networking.Update()
//	s.dying.Update()
//}
//
func connect(g *game.Game) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			fmt.Printf("could not upgrade connection: %v\n", err)
			return
		}
		g.Handle(net.Websocket(conn))
		fmt.Printf("handling incoming connection\n")
	})
}

//
//func (s *server) remover(id uint64) {
//	s.Lock()
//	defer s.Unlock()
//
//	s.moving.Remove(id)
//	s.dying.Remove(id)
//	s.networking.Remove(id)
//	s.world.Remove(id)
//}
