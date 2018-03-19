package terrain

import (
	"math/rand"
)

type Map interface {
	Width() uint
	Height() uint
	Cells() [][]uint8
}

var dirs = map[int][][2]int{
	4: {
		{0, -1},
		{1, 0},
		{0, 1},
		{-1, 0},
	},
	8: {
		{0, -1},
		{1, -1},
		{1, 0},
		{1, 1},
		{0, 1},
		{-1, 1},
		{-1, 0},
		{-1, -1},
	},
	6: {
		{-1, -1},
		{1, -1},
		{2, 0},
		{1, 1},
		{-1, 1},
		{-2, 0},
	},
}

type CellularOption func(c *Cellular)

func CellularTopolgy(t int) CellularOption {
	if t != 4 && t != 6 && t != 8 {
		panic("invalid topology: must be one of 4, 6, and 8")
	}
	return func(c *Cellular) {
		c.topology = t
	}
}

func CellularSetInitially(x, y, value uint8) CellularOption {
	return func(c *Cellular) {
		c.terrain[x][y] = value
	}
}

func CellularBorn(born []int) CellularOption {
	return func(c *Cellular) {
		for _, val := range born {
			c.born[val] = struct{}{}
		}
	}
}

func CellularSurvive(survive []int) CellularOption {
	return func(c *Cellular) {
		for _, val := range survive {
			c.survive[val] = struct{}{}
		}
	}
}

type Cellular struct {
	width, height int
	born, survive map[int]struct{}
	topology      int // 4, 6, or 8
	terrain       [][]uint8
}

func NewCellular(width, height int, options ...CellularOption) *Cellular {
	c := &Cellular{width, height, map[int]struct{}{5: {}, 6: {}, 7: {}, 8: {}}, map[int]struct{}{4: {}, 5: {}, 6: {}, 7: {}, 8: {}}, 8, make([][]uint8, width)}
	c.terrain = c.fillMap(0)
	for _, o := range options {
		o(c)
	}
	return c
}

func (c *Cellular) Width() uint {
	return uint(c.width)
}

func (c *Cellular) Height() uint {
	return uint(c.height)
}

func (c *Cellular) Cells() [][]uint8 {
	return c.terrain
}

// Randomize fills the terrain with random values, with probability being the chance that a cell will be alive; 0 = all empty, 1 = all full.
func (c *Cellular) Randomize(probability float64) {
	for i := 0; i < c.width; i++ {
		for j := 0; j < c.height; j++ {
			if rand.Float64() < probability {
				c.terrain[i][j] = 1
			} else {
				c.terrain[i][j] = 0
			}
		}
	}
}

func (c *Cellular) countNeighbors(cx, cy int) int {
	result := 0
	for i := 0; i < len(dirs[c.topology]); i++ {
		dir := dirs[c.topology][i]
		x := cx + dir[0]
		y := cy + dir[1]
		if x < 0 || x >= c.width || y < 0 || y >= c.height {
			continue
		}
		result += int(c.terrain[x][y])
	}
	return result
}

func (c *Cellular) getClosest(pt point, space map[string]point) point {
	var minPoint point
	var minDist int = -1
	for _, p := range space {
		d := (p[0] - pt[0]) ^ 2 + (p[1] - pt[1]) ^ 2
		if minDist == -1 || d < minDist {
			minDist = d
			minPoint = p
		}
	}
	return minPoint
}

// getFromTo finds random points to connect and searches for the closest point in the larger space.
// This is to minimize the length of the passage while maintaining good performance.
func (c *Cellular) getFromTo(connected, notConnected map[string]point) (from, to point) {
	//var connectedKeys = make([]string, len(connected))
	//for k, _ := range connected {
	//	connectedKeys = append(connectedKeys, k)
	//}
	//var notConnectedKeys = make([]string, len(notConnected))
	//for k, _ := range notConnected {
	//notConnectedKeys = append(notConnectedKeys, k)
	//}

	var d int = 0
	for i := 0; i < 5; i++ {
		if len(connected) < len(notConnected) {

			for _, to = range connected {
				break
			}
			from = c.getClosest(to, notConnected)
		} else {
			for _, from = range notConnected {
				break
			}
			to = c.getClosest(from, connected)
		}
		d = (from[0]-to[0])*(from[0]-to[0]) + (from[1]-to[1])*(from[1]-to[1])
		if d < 64 {
			break
		}
	}
	return
}

func (c *Cellular) findConnected(connected, notConnected map[string]point, start point, keepNotConnected bool, value uint8) {
	var p point
	var stack = []point{start}
	for len(stack) > 0 {
		p, stack = stack[0], stack[1:]
		var tests []point
		if c.topology == 6 {
			tests = []point{
				{p[0] + 2, p[1]},
				{p[0] + 1, p[1] - 1},
				{p[0] - 1, p[1] - 1},
				{p[0] - 2, p[1]},
				{p[0] - 1, p[1] + 1},
				{p[0] + 1, p[1] + 1},
			}
		} else {
			tests = []point{
				{p[0] + 1, p[1]},
				{p[0] - 1, p[1]},
				{p[0], p[1] + 1},
				{p[0], p[1] - 1},
			}
		}
		for i := 0; i < len(tests); i++ {
			key := tests[i].key()
			if _, ok := connected[key]; !ok && c.isCellValue(tests[i], value) {
				connected[key] = tests[i]
				if !keepNotConnected {
					delete(notConnected, key)
				}
				stack = append(stack, tests[i])
			}
		}
	}
}

func (c *Cellular) Connect(value uint8) {
	var allFreeSpace []point
	var notConnected = map[string]point{}

	var widthStep = 1
	var widthStarts = point{0, 0}
	if c.topology == 6 {
		widthStep = 2
		widthStarts = point{0, 1}
	}
	for y := 0; y < c.height; y++ {
		for x := widthStarts[y%2]; x < c.width; x += widthStep {
			p := point{x, y}
			if c.isCellValue(p, value) {
				notConnected[p.key()] = p
				allFreeSpace = append(allFreeSpace, p)
			}
		}
	}
	start := allFreeSpace[rand.Intn(len(allFreeSpace))]
	key := start.key()
	connected := map[string]point{}
	connected[key] = start
	delete(notConnected, key)

	c.findConnected(connected, notConnected, start, false, value)

	for len(notConnected) > 0 {
		from, to := c.getFromTo(connected, notConnected)

		local := map[string]point{}
		local[from.key()] = from
		c.findConnected(local, notConnected, from, true, value)
		var tunnelFn func(to, from point, connected, notConnected map[string]point, value uint8)
		if c.topology == 6 {
			tunnelFn = c.tunnelToConnected6
		} else {
			tunnelFn = c.tunnelToConnected
		}
		tunnelFn(to, from, connected, notConnected, value)
		for key, val := range local {
			c.terrain[val[0]][val[1]] = value
			connected[key] = val
			delete(notConnected, key)
		}
	}
}

func (c *Cellular) isCellValue(p point, value uint8) bool {
	return p[0] >= 0 && p[0] < c.width && p[1] >= 0 && p[1] < c.height && c.terrain[p[0]][p[1]] == value
}

func (c *Cellular) tunnelToConnected(to, from point, connected, notConnected map[string]point, value uint8) {
	var a, b point
	if from[0] < to[0] {
		a = from
		b = to
	} else {
		a = to
		b = from
	}
	for xx := a[0]; xx <= b[0]; xx++ {
		c.terrain[xx][a[1]] = value
		p := point{xx, a[1]}
		connected[p.key()] = p
		delete(notConnected, p.key())
	}
	x := b[0]
	if from[1] < to[1] {
		a = from
		b = to
	} else {
		a = to
		b = from
	}
	for yy := a[1]; yy < b[1]; yy++ {
		c.terrain[x][yy] = value
		p := point{x, yy}
		connected[p.key()] = p
		delete(notConnected, p.key())
	}
	//fmt.Println("tunelled")
}

func (c *Cellular) tunnelToConnected6(to, from point, connected, notConnected map[string]point, value uint8) {
	var a, b point
	if from[0] < to[0] {
		a = from
		b = to
	} else {
		a = to
		b = from
	}
	xx := a[0]
	yy := a[1]
	for !(xx == b[0] && yy == b[1]) {
		stepWidth := 2
		if yy < b[1] {
			yy++
			stepWidth = 1
		} else if yy > b[1] {
			yy--
			stepWidth = 1
		}
		if xx < b[0] {
			xx += stepWidth
		} else if xx > b[0] {
			xx -= stepWidth
		} else if b[1]%2 == 1 {
			// Won't step outside map if destination on is map's right edge
			xx -= stepWidth
		} else {
			xx += stepWidth
		}
		c.terrain[xx][yy] = value
		p := point{xx, yy}
		connected[p.key()] = p
		delete(notConnected, p.key())
	}
}

func (c *Cellular) fillMap(value uint8) [][]uint8 {
	m := make([][]uint8, c.width)
	for i := 0; i < c.width; i++ {
		m[i] = make([]uint8, c.height)
		for j := 0; j < c.height; j++ {
			m[i][j] = value
		}
	}
	return m
}

func (c *Cellular) Create() {
	newMap := c.fillMap(0)
	for j := 0; j < c.height; j++ {
		widthStep := 1
		widthStart := 0
		if c.topology == 6 {
			widthStep = 2
			widthStart = j % 2
		}
		for i := widthStart; i < c.width; i += widthStep {
			cur := c.terrain[i][j]
			ncount := c.countNeighbors(i, j)
			if cur == 1 {
				if _, ok := c.survive[ncount]; ok {
					newMap[i][j] = 1
				}
			}
			if cur == 0 {
				if _, ok := c.born[ncount]; ok {
					newMap[i][j] = 1
				}
			}
		}
	}
	c.terrain = newMap
}
