package terrain

import "strconv"

type point [2]int

func (p point) key() string {
	return strconv.Itoa(p.X()) + "." + strconv.Itoa(p.Y())
}

func (p point) X() int {
	return p[0]
}

func (p point) Y() int {
	return p[1]
}
