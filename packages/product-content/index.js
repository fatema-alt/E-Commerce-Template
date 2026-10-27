import sanitizeHtml from 'sanitize-html';
import MarkdownIt from 'markdown-it';

const markdown = new MarkdownIt({ html: false, breaks: true, linkify: false });
const htmlPattern = /<\/?(?:p|div|h[1-6]|ul|ol|li|strong|b|em|i|u|a|br|blockquote|pre|code|hr|script|style|img|iframe|table)\b[^>]*>/i;
export function safeProductLink(value) {
  if (typeof value !== 'string' || !value || /[\u0000-\u0020\u007f\\]/.test(value) || value.startsWith('//')) return false;
  try {
    const decoded = decodeURIComponent(value);
    if (/[\u0000-\u0020\u007f\\]/.test(decoded) || decoded.startsWith('//')) return false;
    if (value.startsWith('/') || value.startsWith('#')) return true;
    const url = new URL(value);
    return ['https:', 'http:', 'mailto:'].includes(url.protocol) && !url.username && !url.password;
  } catch { return false; }
}
export function toProductHtml(source) {
  if (typeof source !== 'string' || !source.trim()) return '';
  const html = htmlPattern.test(source) ? source : markdown.render(source);
  return sanitizeHtml(html, {
    allowedTags: ['p','br','h2','h3','strong','em','u','s','ul','ol','li','blockquote','a','hr','pre','code'],
    allowedAttributes: { a: ['href','title','target','rel'], ol: ['start'] },
    allowedSchemes: ['https','http','mailto'], allowProtocolRelative: false,
    disallowedTagsMode: 'discard', parseStyleAttributes: false,
    nonTextTags: ['script','style','textarea','option','iframe','svg','math','noscript'],
    transformTags: {
      b: 'strong', i: 'em', div: 'p', h1: 'h2', h4: 'h3', h5: 'h3', h6: 'h3',
      a: (_tag, attributes) => ({ tagName: 'a', attribs: {
        ...(safeProductLink(attributes.href) ? { href: attributes.href } : {}),
        ...(attributes.title ? { title: attributes.title } : {}),
        ...(attributes.target === '_blank' ? { target: '_blank', rel: 'noopener noreferrer' } : {}),
      } }),
      ol: (_tag, attributes) => ({ tagName: 'ol', attribs: /^\d{1,5}$/.test(attributes.start || '') ? { start: attributes.start } : {} }),
    },
  }).trim();
}
export function productDescriptionText(source) {
  const html = toProductHtml(source).replace(/<\/(?:p|h2|h3|li|blockquote|pre)>|<br\s*\/?>/g, ' ');
  return markdown.utils.unescapeAll(sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })).replace(/\s+/g, ' ').trim();
}
