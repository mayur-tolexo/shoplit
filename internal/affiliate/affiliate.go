// Package affiliate provides a registry of per-retailer affiliate rules. v1 ships with NO rules — all
// outbound URLs pass through unchanged. Each retailer-specific rule lands
// in its own follow-up plan, gated by the respective affiliate program's
// approval.
package affiliate

// Rule rewrites the outbound URL to include affiliate / tracking parameters.
type Rule func(rawURL, creatorHandle string) (string, error)

var rules = map[string]Rule{
	// nykaa.com: applyNykaa  ← will be wired up in a Nykaa-affiliate plan
}

// Apply dispatches to the right rule for retailer; pass-through if none.
func Apply(rawURL, retailer, creatorHandle string) (string, error) {
	rule, ok := rules[retailer]
	if !ok {
		return rawURL, nil
	}
	return rule(rawURL, creatorHandle)
}
