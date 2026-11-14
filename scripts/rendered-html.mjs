// Parse response markup for HTTP assertions; this is not a product HTML sanitizer.
import { parse, serialize } from 'parse5';

export function renderedHtml(html) {
  const document = parse(html);
  const visit = node => {
    if (node.childNodes) {
      node.childNodes = node.childNodes.filter(child => child.tagName !== 'script');
      node.childNodes.forEach(visit);
    }
    if (node.content) visit(node.content);
  };
  visit(document);
  return serialize(document);
}
