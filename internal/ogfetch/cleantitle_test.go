package ogfetch

import "testing"

func TestCleanTitle(t *testing.T) {
	cases := []struct{ in, want string }{
		// Myntra: "Buy" prefix + " - - Apparel for Men" suffix noise.
		{"Buy The Roadster Life Co. Men Straight Fit Chinos Trousers - - Apparel for Men", "The Roadster Life Co. Men Straight Fit Chinos Trousers"},
		// Nykaa: "- Buy X Online at Best Price | Nykaa".
		{"Lakme Eyeconic Kajal - Buy Lakme Eyeconic Kajal Online at Best Price | Nykaa", "Lakme Eyeconic Kajal"},
		// Amazon: " : Amazon.in: ...".
		{"Levi's Men's Slim Jeans : Amazon.in: Clothing & Accessories", "Levi's Men's Slim Jeans"},
		// Generic " | brand" suffix.
		{"Cool Sneakers | Flipkart", "Cool Sneakers"},
		// Already clean — left untouched.
		{"Plain Product Name", "Plain Product Name"},
		// Whitespace collapse + dangling dash trim.
		{"  Spaced   Out  Name - ", "Spaced Out Name"},
		{"", ""},
	}
	for _, c := range cases {
		if got := cleanTitle(c.in); got != c.want {
			t.Errorf("cleanTitle(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}
