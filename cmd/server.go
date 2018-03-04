package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"sync"
	"github.com/SMGameDev/visibio/dying"
	"github.com/SMGameDev/visibio/perceiving"
	"github.com/SMGameDev/visibio/moving"
	"github.com/SMGameDev/visibio/colliding"
	"github.com/SMGameDev/visibio/networking"
	"sync/atomic"
	"github.com/jakecoffman/cp"
	"time"
	"github.com/gorilla/websocket"
	"net/http"
	"log"
)

var (
	width    float64       = 4608
	height   float64       = 4608
	addr     string        = ":8080"
	tick     time.Duration = time.Millisecond * 20
	upgrader               = websocket.Upgrader{
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

		var g = new(game) // ready player1?
		g.mu = new(sync.RWMutex)

		space := cp.NewSpace()
		g.colliding = colliding.New(space, width, height)
		g.networking = networking.New(g.remover, g.cursor, space)
		g.dying = dying.New(g.remover)
		g.perceiving = perceiving.New(space)
		g.moving = moving.New()

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
					g.tick(delta)
				}
			}
		}()
		http.HandleFunc("/", g.connect)
		log.Fatal(http.ListenAndServe(addr, nil))
	},
}

func init() {
	rootCmd.AddCommand(serverCmd)

	// Here you will define your flags and configuration settings.

	// Cobra supports Persistent Flags which will work for this command
	// and all subcommands, e.g.:
	// serverCmd.PersistentFlags().String("foo", "", "A help for foo")

	// Cobra supports local flags which will only run when this command
	// is called directly, e.g.:
	// serverCmd.Flags().BoolP("toggle", "t", false, "Help message for toggle")
	serverCmd.Flags().Float64Var(&width, "width", 4608, "Set the width of the map. Must be a multiple of 24.")
	serverCmd.Flags().Float64Var(&height, "height", 4608, "Set the height of the map. Must be a multiple of 24.")
	serverCmd.Flags().StringVar(&addr, "addr", ":8080", "Accept incoming requests at this address.")
	serverCmd.Flags().DurationVarP(&tick, "tick", "t", 20*time.Millisecond, "Duration of a game tick.")
}
//
//type websocketConn struct {
//	conn   *websocket.Conn
//	closer func(conn networking.Connection)
//	err    *atomic.Value
//	out    chan []byte
//	done   chan struct{}
//}
//
//func (w *websocketConn) writer() {
//	for {
//		select {
//		case <-w.done:
//			return
//		case message := <-w.out:
//			err := w.conn.WriteMessage(websocket.BinaryMessage, message)
//			if err != nil {
//				w.err.Store(err)
//				go w.closer(w)
//				return
//			}
//		}
//	}
//}
//
//func (c *websocketConn) Send(message []byte) {
//	select {
//	case <-c.done:
//		return
//	case c.out <- message:
//		return
//	}
//}
//
//func (c *websocketConn) Read() ([]byte) {
//	_, message, err := c.conn.ReadMessage()
//	if err != nil {
//		c.err.Store(err)
//		go c.closer(c)
//	}
//	return message
//}
//
//func (c *websocketConn) Close() {
//	close(c.done)
//	err := c.conn.Close()
//	if err != nil {
//		c.err.Store(err)
//		// todo handle?
//	}
//}

type game struct {
	colliding  *colliding.System
	networking *networking.System
	dying      *dying.System
	perceiving *perceiving.System
	moving     *moving.System
	mu         *sync.RWMutex
	maxId      uint64
}

func (g *game) tick(dt float64) {
	g.mu.RLock() // no entities can be added/deleted during a tick
	defer g.mu.RUnlock()

	g.moving.Update()
	g.colliding.Update(dt)
	g.dying.Update()
	g.perceiving.Update()
}

func (g *game) remover(id uint64) {
	g.mu.Lock()
	defer g.mu.Unlock()

	g.colliding.Remove(id)
	g.networking.Remove(id)
	g.dying.Remove(id)
	g.perceiving.Remove(id)
	g.moving.Remove(id)
}

func (g *game) cursor() uint64 {
	return atomic.AddUint64(&g.maxId, 1) - 1
}

func (g *game) connect(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		fmt.Printf("could not upgrade connection: %v\n", err)
		return
	}
	fmt.Printf("handling incoming connection\n")
	g.networking.Add(networking.HandleWebsocket(conn))
}
