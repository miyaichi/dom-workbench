/**
 * @jest-environment jsdom
 */
import { isValidHtmlString } from '../htmlValidator';

describe('isValidHtmlString', () => {
  describe('valid HTML strings', () => {
    const validCases = [
      // Basic tags
      '<div>test1</div>',
      '<div>test1</div><div>test2</div>',
      '<div><p>nested content</p></div>',

      // Tag with attributes
      '<div class="test-class">content</div>',
      '<div id="test" class="class1 class2">content</div>',
      '<div data-test="value">content</div>',
      '<div onclick="alert(\'Hello\')">button</div>',

      // Self-closing tags in various formats
      '<br>',
      '<br/>',
      '<br />',
      '<img src="test.jpg">',
      '<img src="test.jpg"/>',
      '<img src="test.jpg" />',
      '<input type="text">',
      '<input type="text"/>',
      '<input type="text" />',
      '<input type="text" required>',
      '<input type="text" value="test">',
      '<input type="text" value="test"/>',

      // Script tags
      '<script>alert("Hello");</script>',
      '<script> a=0; alert(a);</script>',
      '<script type="text/javascript">console.log("test");</script>',
    ];

    test.each(validCases)('should validate %s', (html) => {
      expect(isValidHtmlString(html)).toBe(true);
    });
  });

  describe('invalid HTML strings', () => {
    const invalidCases = [
      // Invalid syntax
      '',
      '   ',
      'just some text',
      '<>',
      '<div>',
      '</div>',
      '< div>test</div>',
      '<div><span></div></span>',

      // Invalid attributes
      '<div class=>test</div>',
      '<div class="test>content</div>',
      '<div class=test>content</div>',
      '<div class=>content</div>',

      // Invalid tag names
      '<divv>test</divv>',
      '<unknown>test</unknown>',
      '<INVALID>test</INVALID>',
      '<div1>test</div1>',

      // Invalid script tags
      '<script>alert("Hello");</skript>',
      '<script>alert("Hello")</script',

      // Invalid self-closing tags
      '<br / >',
      '<br/ >',
      '<br/ />',
      '<br / />',
    ];

    test.each(invalidCases)('should invalidate %s', (html) => {
      expect(isValidHtmlString(html)).toBe(false);
    });
  });

  describe('edge cases', () => {
    const edgeCases = [
      ['whitespace around tags', '  <div>  test  </div>  ', true],
      [
        'multiline content',
        `
        <div>
          test
        </div>
      `,
        true,
      ],
      ['comments', '<!-- comment --><div>test</div>', true],
      ['special characters', '<div>&nbsp;&lt;&gt;</div>', true],
      ['empty content', '<div></div>', true],
      ['multiple comments', '<!-- comment --><!-- comment --><div>test</div>', true],
    ] as const;

    test.each(edgeCases)('%s', (_, html, expected) => {
      expect(isValidHtmlString(html)).toBe(expected);
    });
  });

  describe('ad-related HTML', () => {
    const adCases = [
      // Google Ads
      '<ins class="adsbygoogle" style="display:block" data-ad-client="ca-pub-123456789" data-ad-slot="987654321" data-ad-format="auto"></ins>',
      '<script>(adsbygoogle = window.adsbygoogle || []).push({});</script>',

      // Multiple ad tags
      `
      <ins class="adsbygoogle"
           style="display:block"
           data-ad-client="ca-pub-123456789"
           data-ad-slot="987654321"
           data-ad-format="auto"
           data-full-width-responsive="true">
      </ins>
      <script>
           (adsbygoogle = window.adsbygoogle || []).push({});
      </script>
      `,

      // AMP ad tag
      '<amp-ad width="100vw" height="320" type="adsense" data-ad-client="ca-pub-123456789" data-ad-slot="987654321"></amp-ad>',
    ];

    test.each(adCases)('should validate ad tag: %s', (html) => {
      expect(isValidHtmlString(html)).toBe(true);
    });

    // Invalid ad tags
    const invalidAdCases = [
      '<ins data-ad-client>invalid</ins>',
      '<ins class="adsbygoogle" data-ad-client></ins>',
      '<script>(adsbygoogle = window.adsbygoogle || []).push({);</script>',
    ];

    test.each(invalidAdCases)('should invalidate malformed ad tag: %s', (html) => {
      expect(isValidHtmlString(html)).toBe(false);
    });
  });

  describe('input validation', () => {
    test('should handle invalid input types without throwing', () => {
      expect(isValidHtmlString(undefined as any)).toBe(false);
      expect(isValidHtmlString(null as any)).toBe(false);
      expect(isValidHtmlString({} as any)).toBe(false);
      expect(isValidHtmlString([] as any)).toBe(false);
      expect(isValidHtmlString(42 as any)).toBe(false);
    });
  });
});
