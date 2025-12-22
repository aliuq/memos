/**
 * Handles the resolution of custom nodes within the memo content.
 */
import { Node, NodeType } from "@/types/proto/api/v1/markdown_service";

/**
 * Extracts attributes from a given attribute string or options.
 * Simpler, more maintainable implementation: split by separator and
 * split each pair on the first keyValueSeparator occurrence.
 *
 * @example
 * "{foo:foo,bar:bar}" => { foo: "foo", bar: "bar" }
 */
export function extractAttributes(attributeString?: string | ExtractAttributeOptions) {
  if (!attributeString) return {};

  try {
    const {
      text: rawText,
      separator = ",",
      keyValueSeparator = ":",
    } = typeof attributeString === "string" ? { text: attributeString } : attributeString || {};

    if (!rawText) return {};

    // Remove surrounding braces if present and trim
    const text = rawText.trim().replace(/^\{|\}$/g, "");
    // Split into key-value pairs
    const pairs = text.split(separator).map((pair) => pair.split(keyValueSeparator).map((s) => s.trim()));

    return Object.fromEntries(pairs);
  } catch (error) {
    console.error("Error extracting attributes:", error);
    return {};
  }
}

const reg = {
  // :::action{...} content ::: == `:::hide{foo=foo;bar=bar} hidden content:::`
  inlineOringal: /:::(?<action>\w+)(?<attributes>\{[^}]*\})?\s(?<content>.*?)\s?:::/,
  inlineOringalSplit: /(:::(?:\w+)(?:\{[^}]*\})?\s.*?\s?:::)/g,
  // :::action{...} | :::action
  blockOringalBegin: /^:::(?<action>\w+)(?<attributes>\{[^}]*\})?$/,
  // :::
  blockOringalEnd: /^:::$/,

  // `[hide-block{foo:foo,bar:bar}]`
  raw: /\[(?<action>\w+)-(?<mode>(?:inline|block))(?<attributes>\{[^}]*\})?\]/,
  rawSplit: /(\[(?:\w+)-(?:inline|block)(?:\{[^}]*\})?\])/g,
};

const blockAction = {
  flag: false,
  action: "",
  attrs: {} as Record<string, string>,
  nodes: new Set<Node>(),
};

/**
 * Resolves a node, transforming it if it matches custom patterns.
 * @param node
 */
export function resolveNode(node: Node) {
  if (node.type === NodeType.TEXT) {
    const content = node.textNode?.content;
    if (!content) return node;

    // 1-普通用户用户输入内容/编辑内容，2-普通用户用户查看自己的内容，3-管理员查看内容
    if (content.match(reg.inlineOringal)) {
      const parts = content.split(reg.inlineOringalSplit).filter(Boolean);
      const nodes = parts
        .map((part) => {
          let finalContent = part;
          const match = part.match(reg.inlineOringal);
          if (match) {
            const { action, attributes, content } = match.groups || {};
            const attrs = extractAttributes({ text: attributes, separator: ";", keyValueSeparator: "=" });
            finalContent = content;

            if (action === "hide") {
              // text(向后兼容)
              const { text, placeholder, ...restAttr } = attrs;
              return {
                type: NodeType.CUSTOM_HIDDEN_INLINE,
                customHiddenInlineNode: Object.assign({}, restAttr, { content: finalContent, placeholder: placeholder || text }),
              } as Node;
            }
          }
          return { type: NodeType.TEXT, textNode: { content: finalContent } } as Node;
        })
        .filter(Boolean);

      return nodes;
    }
    // 1-游客用户查看他人内容，2-普通用户用户查看他人内容
    else if (content.match(reg.raw)) {
      const parts = content.split(reg.rawSplit).filter(Boolean);
      const nodes = parts
        .map((part) => {
          let finalContent = part;
          const match = part.match(reg.raw);
          if (match) {
            const { action, mode, attributes } = match.groups || {};
            const attrs = extractAttributes(attributes);
            finalContent = "";

            if (action === "hide") {
              const { text, placeholder, ...restAttr } = attrs;

              if (mode === "inline") {
                return {
                  type: NodeType.CUSTOM_HIDDEN_INLINE,
                  customHiddenInlineNode: Object.assign({}, restAttr, { content: "", placeholder: placeholder || text }),
                } as Node;
              } else {
                return {
                  type: NodeType.CUSTOM_HIDDEN_BLOCK,
                  customHiddenBlockNode: Object.assign({}, restAttr, { placeholder: placeholder || text }),
                } as Node;
              }
            }
          }
          return { type: NodeType.TEXT, textNode: { content: finalContent } } as Node;
        })
        .filter(Boolean);

      return nodes;
    }
  }
  // Block
  // 在 p 节点判断子内容是否存在隐藏内容
  else if (node.type === NodeType.PARAGRAPH) {
    const childText = node.paragraphNode?.children?.[0]?.textNode?.content;
    if (!childText) return node;

    if (!blockAction.flag && childText.match(reg.blockOringalBegin)) {
      if (!blockAction.nodes.size) {
        blockAction.flag = true;
        const match = childText.match(reg.blockOringalBegin);
        if (match) {
          blockAction.attrs = extractAttributes({ text: match.groups?.attributes, separator: ";", keyValueSeparator: "=" });
          blockAction.action = match.groups?.action || "";
        }

        return null;
      }
    } else if (blockAction.flag && childText.match(reg.blockOringalEnd)) {
      blockAction.flag = false;
      const children = Array.from(blockAction.nodes);
      blockAction.nodes.clear();

      const { text, placeholder, ...restAttr } = blockAction.attrs;

      if (blockAction.action === "hide") {
        return {
          type: NodeType.CUSTOM_HIDDEN_BLOCK,
          customHiddenBlockNode: Object.assign({}, restAttr, { children, placeholder: placeholder || text }) as any,
        } as Node;
      }
    }
  }

  if (blockAction.flag) {
    blockAction.nodes.add(node);
    return null;
  }

  // Fallback: return the original node if no special handling is needed
  return node;
}

interface ExtractAttributeOptions {
  /** Content */
  text?: string;
  /** @default "," */
  separator?: string;
  /** @default ":" */
  keyValueSeparator?: string;
}
