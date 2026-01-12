package forked

import (
	"testing"
)

func TestProcessHiddenContent(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "inline hidden content without attributes",
			input:    "This is :::hide secret::: content",
			expected: "This is [hide-inline] content",
		},
		{
			name:     "inline hidden content with attributes",
			input:    "This is :::hide{level=high;type=sensitive} secret::: content",
			expected: "This is [hide-inline{level:high,type:sensitive}] content",
		},
		{
			name:     "block hidden content without attributes",
			input:    ":::hide\nSecret line 1\nSecret line 2\n:::",
			expected: "[hide-block]",
		},
		{
			name:     "block hidden content with attributes",
			input:    ":::hide{level=high;type=sensitive}\nSecret line 1\nSecret line 2\n:::",
			expected: "[hide-block{level:high,type:sensitive}]",
		},
		{
			name:     "mixed inline and block",
			input:    "Start :::hide inline::: middle\n:::hide{foo=bar}\nblock content\n:::\nend",
			expected: "Start [hide-inline] middle\n[hide-block{foo:bar}]\nend",
		},
		{
			name:     "no hidden content",
			input:    "This is just normal content",
			expected: "This is just normal content",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ProcessHiddenContent(tt.input)
			if result != tt.expected {
				t.Errorf("ProcessHiddenContent() = %q, want %q", result, tt.expected)
			}
		})
	}
}

func TestProcessContentSearchFilter(t *testing.T) {
	tests := []struct {
		name     string
		content  string
		filters  []string
		expected bool
	}{
		{
			name:     "keyword found in visible content",
			content:  "This is a public message",
			filters:  []string{`creator_id == 1 && content.contains("public")`},
			expected: true,
		},
		{
			name:     "keyword not found",
			content:  "This is a private message",
			filters:  []string{`creator_id == 1 && content.contains("public")`},
			expected: false,
		},
		{
			name:     "keyword in hidden placeholder should not match",
			content:  "This is [hide-inline] message",
			filters:  []string{`content.contains("hide-inline")`},
			expected: false,
		},
		{
			name:     "keyword in hidden placeholder with attributes should not match",
			content:  "This is [hide-inline{level:high}] message",
			filters:  []string{`content.contains("hide-inline")`},
			expected: false,
		},
		{
			name:     "keyword in visible part with hidden content present",
			content:  "Public info [hide-inline{level:high}] more public info",
			filters:  []string{`content.contains("Public")`},
			expected: true,
		},
		{
			name:     "multiple keywords all found in single filter",
			content:  "Hello world",
			filters:  []string{`content.contains("Hello") && content.contains("world")`},
			expected: true,
		},
		{
			name:     "multiple keywords, one not found in single filter",
			content:  "Hello world",
			filters:  []string{`content.contains("Hello") && content.contains("universe")`},
			expected: false,
		},
		{
			name:     "multiple filters with keywords",
			content:  "Hello world example",
			filters:  []string{`creator_id == 1 && content.contains("Hello")`, `content.contains("world")`},
			expected: true,
		},
		{
			name:     "multiple filters, one filter without content.contains",
			content:  "Public info",
			filters:  []string{`creator_id == 1 && content.contains("Public")`, `creator_id == 1 || visibility in ["PUBLIC", "PROTECTED"]`},
			expected: true,
		},
		{
			name:     "no content.contains filter",
			content:  "Any content",
			filters:  []string{`creator_id == 1`},
			expected: true,
		},
		{
			name:     "empty filters",
			content:  "Any content",
			filters:  []string{},
			expected: true,
		},
		{
			name:     "keyword in block placeholder should not match",
			content:  "This is [hide-block{foo:bar}] content",
			filters:  []string{`content.contains("hide-block")`},
			expected: false,
		},
		{
			name:     "multiple filters with keywords from different filters",
			content:  "Hello world example test",
			filters:  []string{`content.contains("Hello") && content.contains("world")`, `content.contains("example")`},
			expected: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := ProcessContentSearchFilter(tt.content, tt.filters)
			if result != tt.expected {
				t.Errorf("ProcessContentSearchFilter() = %v, want %v", result, tt.expected)
			}
		})
	}
}

func TestRemoveHiddenPlaceholders(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "remove inline placeholder",
			input:    "Public [hide-inline] content",
			expected: "Public  content",
		},
		{
			name:     "remove inline placeholder with attributes",
			input:    "Public [hide-inline{level:high}] content",
			expected: "Public  content",
		},
		{
			name:     "remove block placeholder",
			input:    "Public [hide-block] content",
			expected: "Public  content",
		},
		{
			name:     "remove block placeholder with attributes",
			input:    "Public [hide-block{level:high,type:sensitive}] content",
			expected: "Public  content",
		},
		{
			name:     "remove multiple placeholders",
			input:    "Start [hide-inline] middle [hide-block{foo:bar}] end",
			expected: "Start  middle  end",
		},
		{
			name:     "no placeholders",
			input:    "Just normal content",
			expected: "Just normal content",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := removeHiddenPlaceholders(tt.input)
			if result != tt.expected {
				t.Errorf("removeHiddenPlaceholders() = %q, want %q", result, tt.expected)
			}
		})
	}
}
