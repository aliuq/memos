package forked

import (
	"fmt"
	"regexp"
	"strings"
)

// ProcessHiddenContent processes hidden content in the memo content and replaces
// it with placeholder markers.
//
// The function handles two types of hidden content:
//  1. Block-level hidden content: Multi-line content wrapped in :::hide::: markers
//  2. Inline hidden content: Single-line content wrapped in :::hide::: markers
//
// Both types support optional attributes in the format {key=value;key2=value2}.
//
// Rules:
//  1. Inline format: :::hide hidden content::: => [hide-inline]
//  2. Inline with attributes: :::hide{foo=foo;bar=bar} hidden content::: => [hide-inline{foo:foo,bar:bar}]
//  3. Block format:
//     :::hide{foo=foo;bar=bar}
//     hidden content
//     hidden content
//     :::
//     => [hide-block{foo:foo,bar:bar}]
//
// Examples:
//
//	input := "This is :::hide secret::: content"
//	output := ProcessHiddenContent(input)
//	// output: "This is [hide-inline] content"
//
//	input := ":::hide{level=high}\nSecret data\nMore secrets\n:::"
//	output := ProcessHiddenContent(input)
//	// output: "[hide-block{level:high}]"
func ProcessHiddenContent(content string) string {
	// Match block hidden content with optional attributes
	// Pattern: :::hide{attrs}\n...content...\n:::
	blockRe := regexp.MustCompile(`(?s):::hide(?:\{([^}]*)\})?\n(.*?)\n:::`)
	processedContent := blockRe.ReplaceAllStringFunc(content, func(match string) string {
		parts := blockRe.FindStringSubmatch(match)
		if len(parts) > 1 && parts[1] != "" {
			// Convert attributes from foo=bar;baz=qux format to {foo:bar,baz:qux}
			attrs := strings.Split(parts[1], ";")
			attrMap := make([]string, 0)
			for _, attr := range attrs {
				kv := strings.Split(attr, "=")
				if len(kv) == 2 {
					attrMap = append(attrMap, fmt.Sprintf("%s:%s", kv[0], kv[1]))
				}
			}
			if len(attrMap) > 0 {
				return fmt.Sprintf("[hide-block{%s}]", strings.Join(attrMap, ","))
			}
		}
		return "[hide-block]"
	})

	// Match inline hidden content with optional attributes
	// Pattern: :::hide{attrs} content:::
	inlineRe := regexp.MustCompile(`:::hide(?:\{([^}]*)\})?\s+(.*?):::`)
	processedContent = inlineRe.ReplaceAllStringFunc(processedContent, func(match string) string {
		parts := inlineRe.FindStringSubmatch(match)
		if len(parts) > 1 && parts[1] != "" {
			// Convert attributes from foo=bar;baz=qux format to {foo:bar,baz:qux}
			attrs := strings.Split(parts[1], ";")
			attrMap := make([]string, 0)
			for _, attr := range attrs {
				kv := strings.Split(attr, "=")
				if len(kv) == 2 {
					attrMap = append(attrMap, fmt.Sprintf("%s:%s", kv[0], kv[1]))
				}
			}
			if len(attrMap) > 0 {
				return fmt.Sprintf("[hide-inline{%s}]", strings.Join(attrMap, ","))
			}
		}
		return "[hide-inline]"
	})

	return processedContent
}

// ProcessContentSearchFilter processes content search filter and checks if the memo content
// contains any of the search keywords, excluding matches within hidden content placeholders.
//
// This function:
//  1. Iterates through each filter string in the filters array
//  2. Extracts search keywords from filters in the format: content.contains("keyword")
//  3. Removes hidden content placeholders from the memo content before searching
//  4. Checks if ALL keywords appear in the filtered content (AND logic within each filter)
//
// Hidden content placeholders that are excluded from search:
//   - [hide-inline]
//   - [hide-inline{foo:foo,bar:bar}]
//   - [hide-block]
//   - [hide-block{foo:foo,bar:bar}]
//
// Parameters:
//   - content: The memo content to search in (may contain hidden content placeholders)
//   - filters: Array of filter strings that may contain content.contains() conditions
//     Each filter is an independent condition, e.g.:
//     ["creator_id == 1 && content.contains(\"hello\") && content.contains(\"world\")",
//     "creator_id == 1 || visibility in [\"PUBLIC\", \"PROTECTED\"]"]
//
// Returns:
//   - true if ALL keywords from ALL filters with content.contains() are found in visible content
//   - false if any keyword is not found or if filters contain content.contains() but content doesn't match
//   - true if no content.contains() filters exist (no content filtering needed)
//
// Examples:
//
//	// Example 1: Basic keyword search
//	content := "This is a public message"
//	filters := []string{`creator_id == 1 && content.contains("public")`}
//	result := ProcessContentSearchFilter(content, filters)
//	// result: true
//
//	// Example 2: Keyword hidden in placeholder
//	content := "This is [hide-inline] message"
//	filters := []string{`content.contains("hide-inline")`}
//	result := ProcessContentSearchFilter(content, filters)
//	// result: false (hidden placeholder is excluded)
//
//	// Example 3: Multiple keywords in multiple filters
//	content := "Hello world"
//	filters := []string{
//	    `creator_id == 1 && content.contains("Hello")`,
//	    `content.contains("world")`,
//	}
//	result := ProcessContentSearchFilter(content, filters)
//	// result: true
//
//	// Example 4: Multiple filters, one without content.contains
//	content := "Public info"
//	filters := []string{
//	    `creator_id == 1 && content.contains("Public")`,
//	    `creator_id == 1 || visibility in ["PUBLIC", "PROTECTED"]`,
//	}
//	result := ProcessContentSearchFilter(content, filters)
//	// result: true
func ProcessContentSearchFilter(content string, filters []string) bool {
	// Collect all keywords from all filters
	allKeywords := make([]string, 0)
	contentSearchRegex := regexp.MustCompile(`content\.contains\("([^"]+)"\)`)

	for _, filter := range filters {
		// Extract keywords from content.contains("keyword") patterns in this filter
		matches := contentSearchRegex.FindAllStringSubmatch(filter, -1)
		for _, match := range matches {
			if len(match) > 1 {
				allKeywords = append(allKeywords, match[1])
			}
		}
	}

	// If no content search filters, return true (no filtering needed)
	if len(allKeywords) == 0 {
		return true
	}

	// Remove hidden content placeholders from the content before searching
	// This ensures we only search in visible content
	visibleContent := removeHiddenPlaceholders(content)

	// Check if ALL keywords appear in the visible content (AND logic)
	for _, keyword := range allKeywords {
		if !strings.Contains(visibleContent, keyword) {
			return false
		}
	}

	return true
}

// removeHiddenPlaceholders removes all hidden content placeholders from the content.
// This includes both inline and block placeholders, with or without attributes.
//
// Patterns removed:
//   - [hide-inline]
//   - [hide-inline{...}]
//   - [hide-block]
//   - [hide-block{...}]
//
// Examples:
//
//	input := "Public [hide-inline] content [hide-block{level:high}]"
//	output := removeHiddenPlaceholders(input)
//	// output: "Public  content "
func removeHiddenPlaceholders(content string) string {
	// Remove all [hide-inline] and [hide-inline{...}] patterns
	inlinePlaceholderRe := regexp.MustCompile(`\[hide-inline(?:\{[^}]*\})?\]`)
	content = inlinePlaceholderRe.ReplaceAllString(content, "")

	// Remove all [hide-block] and [hide-block{...}] patterns
	blockPlaceholderRe := regexp.MustCompile(`\[hide-block(?:\{[^}]*\})?\]`)
	content = blockPlaceholderRe.ReplaceAllString(content, "")

	return content
}
