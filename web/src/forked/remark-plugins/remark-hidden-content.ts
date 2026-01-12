/**
 * Remark plugin to handle custom hidden content syntax
 * Supports:
 * - :::hide{...} content ::: (inline)
 * - :::hide{...}\n...\n::: (block)
 * - [hide-inline{...}] (processed inline placeholder)
 * - [hide-block{...}] (processed block placeholder)
 */

import type { Node, Paragraph, Parent, PhrasingContent, Root, Text } from "mdast";
import { SKIP, visit } from "unist-util-visit";

interface HiddenInlineNode {
  type: "hiddenInline";
  data: {
    hName: "span";
    hProperties: {
      "data-hidden-inline": string;
      "data-content"?: string;
      "data-placeholder"?: string;
      [key: string]: any;
    };
  };
}

interface HiddenBlockNode {
  type: "hiddenBlock";
  data: {
    hName: "div";
    hProperties: {
      "data-hidden-block": string;
      "data-placeholder"?: string;
      [key: string]: any;
    };
  };
  children: any[];
}

/**
 * Extract attributes from string like "{foo:foo,bar:bar}" or "{foo=foo;bar=bar}"
 * @example
 * "{foo:foo,bar:bar}" => { foo: "foo", bar: "bar" }
 */
function extractAttributes(attrString: string, separator: string = ",", keyValueSeparator: string = ":"): Record<string, string> {
  if (!attrString) return {};

  try {
    const text = attrString.trim().replace(/^\{|\}$/g, "");
    if (!text) return {};

    const pairs = text
      .split(separator)
      .map((pair) => pair.split(keyValueSeparator).map((s) => s.trim()))
      .filter((pair) => pair.length === 2);

    return Object.fromEntries(pairs);
  } catch (error) {
    console.error("Error extracting attributes:", error);
    return {};
  }
}

const reg = {
  // :::hide{foo=foo;bar=bar} hidden content :::
  inlineOriginal: /:::(?<action>\w+)(?<attributes>\{[^}]*\})?\s+(?<content>.*?)\s*:::/g,
  // :::hide{...} or :::hide
  blockBegin: /^:::(?<action>\w+)(?<attributes>\{[^}]*\})?$/,
  // :::
  blockEnd: /^:::$/,
  // [hide-inline{...}] or [hide-block{...}] or [hide-block{foo:foo,bar:bar}]
  processed: /\[(?<action>\w+)-(?<mode>inline|block)(?<attributes>\{[^}]*\})?\]/g,
};

export const remarkHiddenContent = () => {
  return (tree: Root) => {
    const nodesToReplace: Array<{
      parent: any;
      index: number;
      newNodes: any[];
    }> = [];

    visit(tree, (node, index, parent) => {
      // Handle text nodes for inline patterns
      if (node.type === "text" && parent && typeof index === "number") {
        const textNode = node as Text;
        const content = textNode.value;
        let hasMatch = false;
        const newNodes: any[] = [];

        // Check for :::hide{...} content ::: pattern
        const inlineMatches = [...content.matchAll(reg.inlineOriginal)];
        if (inlineMatches.length > 0) {
          hasMatch = true;
          let lastIndex = 0;

          inlineMatches.forEach((match) => {
            const { action, attributes, content: hiddenContent } = match.groups || {};

            // Add text before match
            if (match.index! > lastIndex) {
              newNodes.push({
                type: "text",
                value: content.slice(lastIndex, match.index),
              });
            }

            if (action === "hide") {
              const attrs = extractAttributes(attributes || "", ";", "=");
              const { text, placeholder, ...restAttrs } = attrs;

              const hiddenNode: HiddenInlineNode = {
                type: "hiddenInline" as any,
                data: {
                  hName: "span",
                  hProperties: {
                    "data-hidden-inline": "true",
                    "data-content": hiddenContent || "",
                    "data-placeholder": placeholder || text || "",
                    ...restAttrs,
                  },
                },
              };
              newNodes.push(hiddenNode);
            } else {
              newNodes.push({
                type: "text",
                value: match[0],
              });
            }

            lastIndex = match.index! + match[0].length;
          });

          // Add remaining text
          if (lastIndex < content.length) {
            newNodes.push({
              type: "text",
              value: content.slice(lastIndex),
            });
          }
        }

        // Check for [hide-inline{...}] or [hide-block{...}] pattern
        const processedMatches = [...content.matchAll(reg.processed)];
        if (processedMatches.length > 0 && !hasMatch) {
          hasMatch = true;
          let lastIndex = 0;

          processedMatches.forEach((match) => {
            const { action, mode, attributes } = match.groups || {};

            // Add text before match
            if (match.index! > lastIndex) {
              newNodes.push({
                type: "text",
                value: content.slice(lastIndex, match.index),
              });
            }

            if (action === "hide") {
              const attrs = extractAttributes(attributes || "");
              const { text, placeholder, ...restAttrs } = attrs;

              if (mode === "inline") {
                const hiddenNode: HiddenInlineNode = {
                  type: "hiddenInline" as any,
                  data: {
                    hName: "span",
                    hProperties: {
                      "data-hidden-inline": "true",
                      "data-content": "",
                      "data-placeholder": placeholder || text || "",
                      ...restAttrs,
                    },
                  },
                };
                newNodes.push(hiddenNode);
              } else if (mode === "block") {
                const hiddenNode: HiddenBlockNode = {
                  type: "hiddenBlock" as any,
                  data: {
                    hName: "div",
                    hProperties: {
                      "data-hidden-block": "true",
                      "data-placeholder": placeholder || text || "",
                      ...restAttrs,
                    },
                  },
                  children: [],
                };
                newNodes.push(hiddenNode);
              }
            } else {
              newNodes.push({
                type: "text",
                value: match[0],
              });
            }

            lastIndex = match.index! + match[0].length;
          });

          // Add remaining text
          if (lastIndex < content.length) {
            newNodes.push({
              type: "text",
              value: content.slice(lastIndex),
            });
          }
        }

        if (hasMatch && newNodes.length > 0) {
          nodesToReplace.push({ parent, index, newNodes });
        }
      }
    });

    // Apply replacements
    nodesToReplace.reverse().forEach(({ parent, index, newNodes }) => {
      parent.children.splice(index, 1, ...newNodes);
    });

    // Handle block-level patterns
    // Strategy: Look for paragraph nodes ending with ":::hide" or ":::hide{...}"
    // Then collect all following nodes until we find one containing ":::" at the end
    const blockNodesToReplace: Array<{
      parent: any;
      startIndex: number;
      endIndex: number;
      newNode: any;
    }> = [];

    visit(tree, (node, index, parent) => {
      if (!parent || typeof index !== "number") return;

      // Look for paragraph nodes that might contain :::hide marker
      if (node.type === "paragraph") {
        const paragraph = node as Paragraph;

        const lastChild = paragraph.children[paragraph.children.length - 1];
        if (!lastChild || lastChild.type !== "text") {
          return;
        }

        // Check all text nodes in this paragraph
        for (let childIdx = 0; childIdx < paragraph.children.length; childIdx++) {
          const child = paragraph.children[childIdx];

          if (child.type === "text") {
            const textValue = child.value.trim();
            const match = textValue.match(reg.blockBegin);

            if (match && match[0] === textValue) {
              const { action, attributes } = match.groups || {};

              if (action === "hide") {
                // Found :::hide marker
                // Look for the ending ::: in subsequent nodes
                let endIndex = -1;
                const hiddenChildren: any[] = [];

                // Check if there are other children before the :::hide marker
                const beforeChildren = paragraph.children.slice(0, childIdx);

                // Start searching from the next node after this paragraph
                for (let i = index + 1; i < parent.children.length; i++) {
                  const currentNode = parent.children[i];

                  // Check if current node contains the ending :::
                  if ("children" in currentNode && Array.isArray(currentNode.children)) {
                    const result = findAndRemoveEndMarker(currentNode);
                    if (result.found) {
                      endIndex = i;
                      if (result.modifiedNode) {
                        hiddenChildren.push(result.modifiedNode);
                      }
                      break;
                    }
                  }

                  // Add this node to hidden content
                  hiddenChildren.push(currentNode);
                }

                if (endIndex > index) {
                  const attrs = extractAttributes(attributes || "", ";", "=");
                  const { text, placeholder, description, ...restAttrs } = attrs;

                  const hiddenNode: HiddenBlockNode = {
                    type: "hiddenBlock" as any,
                    data: {
                      hName: "div",
                      hProperties: {
                        "data-hidden-block": "true",
                        "data-placeholder": placeholder || text || "Hidden Content",
                        "data-description": description || "",
                        ...restAttrs,
                      },
                    },
                    children: hiddenChildren,
                  };

                  // Build replacement nodes
                  const replacementNodes: any[] = [];

                  // If there are children before :::hide, keep them in a paragraph
                  if (beforeChildren.length > 0) {
                    replacementNodes.push({
                      type: "paragraph",
                      children: beforeChildren,
                    });
                  }

                  replacementNodes.push(hiddenNode);

                  replacementNodes.push({
                    type: "break",
                  });

                  blockNodesToReplace.push({
                    parent,
                    startIndex: index,
                    endIndex,
                    newNode: replacementNodes,
                  });

                  // Found a match, no need to check other children
                  return;
                }
              }
            }
          }
        }
      }
    });

    // Apply block replacements (reverse order to maintain indices)
    blockNodesToReplace.reverse().forEach(({ parent, startIndex, endIndex, newNode }) => {
      const nodesToInsert = Array.isArray(newNode) ? newNode : [newNode];
      parent.children.splice(startIndex, endIndex - startIndex + 1, ...nodesToInsert);
    });
  };
};

/**
 * Find and remove the end marker (:::) from a node tree
 * Returns the modified node without the ::: marker, or null if the entire content was just :::
 */
function findAndRemoveEndMarker(node: any): { found: boolean; modifiedNode: any | null } {
  if (!node || !("children" in node) || !Array.isArray(node.children)) {
    return { found: false, modifiedNode: null };
  }

  // Check the last child recursively
  const lastChild = node.children[node.children.length - 1];

  if (lastChild.type === "paragraph") {
    const result = findEndMarkerInParagraph(lastChild);
    if (result.found) {
      const modifiedNode = JSON.parse(JSON.stringify(node));
      if (result.modifiedNode) {
        modifiedNode.children[modifiedNode.children.length - 1] = result.modifiedNode;
      } else {
        // Remove the last child if it only contained :::
        modifiedNode.children.pop();
      }

      // If no children left, return null
      if (modifiedNode.children.length === 0) {
        return { found: true, modifiedNode: null };
      }

      return { found: true, modifiedNode };
    }
  }

  return { found: false, modifiedNode: null };
}

/**
 * Find and remove the end marker (:::) from a paragraph node
 */
function findEndMarkerInParagraph(paragraph: any): { found: boolean; modifiedNode: any | null } {
  if (!paragraph.children || !Array.isArray(paragraph.children)) {
    return { found: false, modifiedNode: null };
  }

  // Check the last text node
  const lastChild = paragraph.children[paragraph.children.length - 1];

  if (lastChild?.type === "text") {
    const textValue = lastChild.value.trim();

    if (textValue.match(reg.blockEnd)) {
      // Found the end marker
      const modifiedParagraph = JSON.parse(JSON.stringify(paragraph));
      modifiedParagraph.children.pop();

      // If there are more children, return the modified paragraph
      if (modifiedParagraph.children.length > 0) {
        return { found: true, modifiedNode: modifiedParagraph };
      }

      // Otherwise, return null (empty paragraph)
      return { found: true, modifiedNode: null };
    }
  }

  return { found: false, modifiedNode: null };
}
