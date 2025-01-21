import {
  AutoLinkNode,
  BlockquoteNode,
  BoldItalicNode,
  BoldNode,
  CodeBlockNode,
  CodeNode,
  EmbeddedContentNode,
  EscapingCharacterNode,
  HeadingNode,
  HighlightNode,
  HorizontalRuleNode,
  HTMLElementNode,
  ImageNode,
  ItalicNode,
  LinkNode,
  ListNode,
  MathBlockNode,
  MathNode,
  Node,
  NodeType,
  OrderedListItemNode,
  ParagraphNode,
  ReferencedContentNode,
  SpoilerNode,
  StrikethroughNode,
  SubscriptNode,
  SuperscriptNode,
  TableNode,
  TagNode,
  TaskListItemNode,
  TextNode,
  UnorderedListItemNode,
} from "@/types/proto/api/v1/markdown_service";
import Blockquote from "./Blockquote";
import Bold from "./Bold";
import BoldItalic from "./BoldItalic";
import Code from "./Code";
import CodeBlock from "./CodeBlock";
import EmbeddedContent from "./EmbeddedContent";
import EscapingCharacter from "./EscapingCharacter";
import HTMLElement from "./HTMLElement";
import Heading from "./Heading";
import HiddenContent from "./HiddenContent";
import Highlight from "./Highlight";
import HorizontalRule from "./HorizontalRule";
import Image from "./Image";
import Italic from "./Italic";
import LineBreak from "./LineBreak";
import Link from "./Link";
import List from "./List";
import Math from "./Math";
import OrderedListItem from "./OrderedListItem";
import Paragraph from "./Paragraph";
import ReferencedContent from "./ReferencedContent";
import Spoiler from "./Spoiler";
import Strikethrough from "./Strikethrough";
import Subscript from "./Subscript";
import Superscript from "./Superscript";
import Table from "./Table";
import Tag from "./Tag";
import TaskListItem from "./TaskListItem";
import Text from "./Text";
import UnorderedListItem from "./UnorderedListItem";

interface Props {
  index: string;
  node: Node;
}

const parseAttributes = (attrStr?: string) => {
  if (!attrStr) return {};
  try {
    // 移除首尾的花括号
    const cleanStr = attrStr.trim().replace(/^\{|\}$/g, "");
    // 解析键值对
    const pairs = cleanStr.split(",").map((pair) => pair.split(":").map((s) => s.trim()));
    return Object.fromEntries(pairs);
  } catch (e) {
    console.warn("Failed to parse attributes:", attrStr);
    return {};
  }
};

let HIDDEN_FLAG = false;
const resolveNode = (node: Node) => {
  if (node.type === NodeType.TEXT) {
    const reg = {
      hidden_show: /:::hide(?:\{[^}]*\})? (.*?):::/g,
      hidden_inline: /\[hide-inline(?:\{[^}]*\})?\]/g,
      hidden_block: /\[hide-block(?:\{[^}]*\})?\]/g,
      // 修改属性提取正则，移除可选空格
      attributes: /\[hide-(?:inline|block)(\{[^}]*\})\]/,
    };
    const content = node.textNode?.content;

    if (content?.startsWith(":::hide")) {
      HIDDEN_FLAG = true;
      return null;
    }
    if (HIDDEN_FLAG && content === ":::") {
      HIDDEN_FLAG = false;
      return null;
    }

    if (content?.match(reg.hidden_show)) {
      const newContent = content.replace(reg.hidden_show, "$1");
      return { ...node, textNode: { ...node.textNode, content: newContent } } as Node;
    } else if (content?.match(reg.hidden_inline) || content?.match(reg.hidden_block)) {
      const isInline = content?.match(reg.hidden_inline);
      const attrMatch = content?.match(reg.attributes);
      const attrs = parseAttributes(attrMatch?.[1]);
      const parts = isInline ? content.split(reg.hidden_inline) : content.split(reg.hidden_block);

      // 直接返回节点数组
      return parts.reduce((acc: Node[], text, index) => {
        if (text) {
          acc.push({ type: NodeType.TEXT, textNode: { content: text } } as Node);
        }
        if (index < parts.length - 1) {
          const attrString = Object.keys(attrs).length ? ` attrs='${JSON.stringify(attrs)}'` : "";
          acc.push(`<hidden-content mode='${isInline ? "inline" : "block"}'${attrString} />` as unknown as Node);
        }
        return acc;
      }, []);
    }
  }

  // 如果是数组，返回数组中的节点
  if (Array.isArray(node)) {
    return node;
  }

  return node;
};

const Renderer: React.FC<Props> = ({ index, node }: Props) => {
  const resolvedNode = resolveNode(node);

  // 处理节点数组的情况
  if (Array.isArray(resolvedNode)) {
    return (
      <>
        {resolvedNode.map((n, i) => (
          <Renderer key={`${index}-${i}`} index={`${index}-${i}`} node={n} />
        ))}
      </>
    );
  }

  if (!resolvedNode) return null;

  if (typeof resolvedNode === "string" && (resolvedNode as string)?.startsWith("<hidden-content")) {
    const mode = (resolvedNode as string).includes("mode='block'") ? "block" : "inline";
    const attrsMatch = (resolvedNode as string).match(/attrs='([^']+)'/);
    const attrs = attrsMatch ? JSON.parse(attrsMatch[1]) : {};
    return <HiddenContent mode={mode} {...attrs} />;
  }

  switch (resolvedNode.type) {
    case NodeType.LINE_BREAK:
      return <LineBreak index={index} />;
    case NodeType.PARAGRAPH:
      return <Paragraph index={index} {...(resolvedNode.paragraphNode as ParagraphNode)} />;
    case NodeType.CODE_BLOCK:
      return <CodeBlock index={index} {...(resolvedNode.codeBlockNode as CodeBlockNode)} />;
    case NodeType.HEADING:
      return <Heading index={index} {...(resolvedNode.headingNode as HeadingNode)} />;
    case NodeType.HORIZONTAL_RULE:
      return <HorizontalRule index={index} {...(resolvedNode.horizontalRuleNode as HorizontalRuleNode)} />;
    case NodeType.BLOCKQUOTE:
      return <Blockquote index={index} {...(resolvedNode.blockquoteNode as BlockquoteNode)} />;
    case NodeType.LIST:
      return <List index={index} {...(resolvedNode.listNode as ListNode)} />;
    case NodeType.ORDERED_LIST_ITEM:
      return <OrderedListItem index={index} {...(resolvedNode.orderedListItemNode as OrderedListItemNode)} />;
    case NodeType.UNORDERED_LIST_ITEM:
      return <UnorderedListItem {...(resolvedNode.unorderedListItemNode as UnorderedListItemNode)} />;
    case NodeType.TASK_LIST_ITEM:
      return <TaskListItem index={index} node={resolvedNode} {...(resolvedNode.taskListItemNode as TaskListItemNode)} />;
    case NodeType.MATH_BLOCK:
      return <Math {...(resolvedNode.mathBlockNode as MathBlockNode)} block={true} />;
    case NodeType.TABLE:
      return <Table index={index} {...(resolvedNode.tableNode as TableNode)} />;
    case NodeType.EMBEDDED_CONTENT:
      return <EmbeddedContent {...(resolvedNode.embeddedContentNode as EmbeddedContentNode)} />;
    case NodeType.TEXT:
      return <Text {...(resolvedNode.textNode as TextNode)} />;
    case NodeType.BOLD:
      return <Bold {...(resolvedNode.boldNode as BoldNode)} />;
    case NodeType.ITALIC:
      return <Italic {...(resolvedNode.italicNode as ItalicNode)} />;
    case NodeType.BOLD_ITALIC:
      return <BoldItalic {...(resolvedNode.boldItalicNode as BoldItalicNode)} />;
    case NodeType.CODE:
      return <Code {...(resolvedNode.codeNode as CodeNode)} />;
    case NodeType.IMAGE:
      return <Image {...(resolvedNode.imageNode as ImageNode)} />;
    case NodeType.LINK:
      return <Link {...(resolvedNode.linkNode as LinkNode)} />;
    case NodeType.AUTO_LINK:
      return <Link {...(resolvedNode.autoLinkNode as AutoLinkNode)} />;
    case NodeType.TAG:
      return <Tag {...(resolvedNode.tagNode as TagNode)} />;
    case NodeType.STRIKETHROUGH:
      return <Strikethrough {...(resolvedNode.strikethroughNode as StrikethroughNode)} />;
    case NodeType.MATH:
      return <Math {...(resolvedNode.mathNode as MathNode)} />;
    case NodeType.HIGHLIGHT:
      return <Highlight {...(resolvedNode.highlightNode as HighlightNode)} />;
    case NodeType.ESCAPING_CHARACTER:
      return <EscapingCharacter {...(resolvedNode.escapingCharacterNode as EscapingCharacterNode)} />;
    case NodeType.SUBSCRIPT:
      return <Subscript {...(resolvedNode.subscriptNode as SubscriptNode)} />;
    case NodeType.SUPERSCRIPT:
      return <Superscript {...(resolvedNode.superscriptNode as SuperscriptNode)} />;
    case NodeType.REFERENCED_CONTENT:
      return <ReferencedContent {...(resolvedNode.referencedContentNode as ReferencedContentNode)} />;
    case NodeType.SPOILER:
      return <Spoiler {...(resolvedNode.spoilerNode as SpoilerNode)} />;
    case NodeType.HTML_ELEMENT:
      return <HTMLElement {...(resolvedNode.htmlElementNode as HTMLElementNode)} />;
    default:
      return null;
  }
};

export default Renderer;
