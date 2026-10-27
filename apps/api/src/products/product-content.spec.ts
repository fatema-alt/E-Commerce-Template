import {
  productDescriptionText,
  safeProductLink,
  toProductHtml,
} from '@commerce/product-content';
describe('Product content safety and legacy compatibility', () => {
  it('renders Bengali, English, emoji, paragraphs and line breaks', () => {
    const html = toProductHtml(
      'বাংলা পণ্য 🛍️\nEnglish details\n\nSecond paragraph',
    );
    expect(html).toContain('বাংলা পণ্য 🛍️');
    expect(html).toContain('<br');
    expect(html.match(/<p>/g)).toHaveLength(2);
  });
  it('renders legacy Markdown headings, marks and both list types', () => {
    const html = toProductHtml(
      '## Features\n\n**Bold** and *italic*\n\n- বাংলা\n- English\n\n1. First\n2. Second',
    );
    for (const tag of ['h2', 'strong', 'em', 'ul', 'ol', 'li'])
      expect(html).toContain('<' + tag + '>');
    expect(html).not.toContain('## Features');
  });
  it('preserves supported HTML formatting on repeated saves', () => {
    const html =
      '<h2>পণ্য 😀</h2><p><strong>Bold</strong> <em>Italic</em> <u>Underline</u></p><ol start="3"><li>Third</li></ol><blockquote><p>Quote</p></blockquote>';
    expect(toProductHtml(toProductHtml(html))).toBe(toProductHtml(html));
    expect(toProductHtml(html)).toContain('<u>Underline</u>');
    expect(toProductHtml(html)).toContain('start="3"');
  });
  it.each([
    '<p onclick="alert(1)">Safe</p><script>alert(1)</script>',
    '<p>Safe</p><img src=x onerror=alert(1)>',
    '<svg><script>alert(1)</script></svg><p>Safe</p>',
    '<p style="background:url(javascript:alert(1))">Safe</p>',
    '<a href="javascript:alert(1)">Safe</a>',
    '<a href="data:text/html,evil">Safe</a>',
    '<a href="//evil.example.com">Safe</a>',
    '<iframe src="https://evil.example.com">bad</iframe><p>Safe</p>',
  ])('sanitizes stored or pasted unsafe content %s', (input) => {
    const html = toProductHtml(input);
    expect(html).not.toMatch(
      /script|onclick|onerror|style=|<img|<svg|<iframe|javascript:|data:|href="\/\//i,
    );
    expect(html).toContain('Safe');
  });
  it('keeps safe relative/external links and secures new windows', () => {
    expect(
      toProductHtml(
        '<a href="https://example.com" target="_blank">Read more</a>',
      ),
    ).toContain('rel="noopener noreferrer"');
    expect(safeProductLink('/help')).toBe(true);
    expect(safeProductLink('https://example.com')).toBe(true);
    expect(safeProductLink('/%2fevil.example.com')).toBe(false);
    expect(safeProductLink('java\nscript:evil')).toBe(false);
  });
  it('returns plain text for SEO without HTML or collapsed paragraphs', () => {
    expect(
      productDescriptionText('<p>বাংলা &amp; English</p><p>Second 😀</p>'),
    ).toBe('বাংলা & English Second 😀');
  });
});
