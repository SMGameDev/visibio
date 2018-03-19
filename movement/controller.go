package movement

type Controller interface {
	Up() bool
	Down() bool
	Left() bool
	Right() bool
	Rotation() float64
}

type ControllerFunc func() (up, down, left, right bool, rotation float64)

func (c ControllerFunc) Up() bool {
	up, _, _, _, _ := c()
	return up
}

func (c ControllerFunc) Down() bool {
	_, down, _, _, _ := c()
	return down
}

func (c ControllerFunc) Left() bool {
	_, _, left, _, _ := c()
	return left
}

func (c ControllerFunc) Right() bool {
	_, _, _, right, _ := c()
	return right
}

func (c ControllerFunc) Rotation() float64 {
	_, _, _, _, rotation := c()
	return rotation
}
