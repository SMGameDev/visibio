package net

// Connection represents a connection to the server.
type Connection interface {
	Send([]byte) error
	Read() ([]byte, error)
	Close() error
}
