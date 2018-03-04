package networking

import (
	"github.com/gorilla/websocket"
)

type websocketConn struct {
	conn *websocket.Conn
	out  chan []byte
	in   chan []byte
	done chan struct{}
}

func HandleWebsocket(conn *websocket.Conn) Connection {
	c := &websocketConn{conn: conn, out: make(chan []byte), in: make(chan []byte), done: make(chan struct{})}
	go c.reader()
	go c.writer()
	return c
}

func (c *websocketConn) Send(data []byte) error {
	for {
		select {
		case <-c.done:
			return nil
		case c.out <- data:
			return nil
		}
	}
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
			return nil, websocket.ErrCloseSent
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
		for {
			select {
			case <-c.done:
				return
			case c.in <- message:
				break
			}
		}
	}
}

func (c *websocketConn) Close() error {
	close(c.done)
	return c.conn.Close()
}
