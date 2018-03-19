package network

import (
	"github.com/gorilla/websocket"
	"sync"
	"errors"
)

var (
	ErrClosed = errors.New("network: connection closed")
)

type websocketConn struct {
	conn   *websocket.Conn
	out    chan []byte
	in     chan []byte
	done   chan struct{}
	closer *sync.Once
}

func Websocket(conn *websocket.Conn) Connection {
	c := &websocketConn{conn: conn, out: make(chan []byte), in: make(chan []byte), done: make(chan struct{}), closer: &sync.Once{}}
	go c.reader()
	go c.writer()
	return c
}

func (c *websocketConn) Send(data []byte) error {
	go func() {
		for {
			select {
			case <-c.done:
				return
			case c.out <- data:
				return
			}
		}
	}()
	return nil
}

func (c *websocketConn) writer() {
	for {
		select {
		case <-c.done:
			return
		case message := <-c.out:
			err := c.conn.WriteMessage(websocket.BinaryMessage, message)
			if err != nil {
				c.Close()
			}
		}
	}
}

func (c *websocketConn) Read() ([]byte, error) {
	for {
		select {
		case <-c.done:
			return nil, ErrClosed
		case message := <-c.in:
			return message, nil
		}
	}
}

func (c *websocketConn) reader() {
	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			return
		}
		go func() {
			for {
				select {
				case <-c.done:
					return
				case c.in <- message:
					return
				}
			}
		}()
	}
}

func (c *websocketConn) Close() error {
	c.closer.Do(func() {
		close(c.done)
	})
	return c.conn.Close()
}
