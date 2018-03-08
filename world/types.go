package world

const (
	StaticBody      uint = 1 << iota
	PerceivableBody
	DamageableBody
	DamagerBody
)


type Damageable interface {
	Damage(int)
}

type Damager interface {
	DamageAmount() int
}