package networking

// Connection represents a connection to the server. It handles errors internally, coordinating with the networking system to close out.
type Connection interface {
	Send([]byte)
	Read() []byte
	Close()
}
