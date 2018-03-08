package health

type Damageable interface {
	Damage(int)
}

type Damager interface {
	DamageAmount() int
}
