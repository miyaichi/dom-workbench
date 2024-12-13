/**
 * @jest-environment jsdom
 */
import { isValidHtmlString } from '../htmlValidator';

describe('isValidHtmlString', () => {
  describe('valid HTML strings', () => {
    const validCases = [
      // 基本的なタグ
      '<div>test1</div>',
      '<div>test1</div><div>test2</div>',
      '<div><p>nested content</p></div>',

      // 属性を持つタグ
      '<div class="test-class">content</div>',
      '<div id="test" class="class1 class2">content</div>',
      '<div data-test="value">content</div>',
      '<div onclick="alert(\'Hello\')">button</div>',

      // 自己閉じタグの様々な形式
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

      // script タグ
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
      // 不正な構文
      '',
      '   ',
      'just some text',
      '<>',
      '<div>',
      '</div>',
      '< div>test</div>',
      //'<div >test</div >',
      '<div><span></div></span>',

      // 不正な属性
      '<div class=>test</div>',
      '<div class="test>content</div>',
      '<div class=test>content</div>',
      '<div class=>content</div>',

      // 不正なタグ名
      '<divv>test</divv>',
      '<unknown>test</unknown>',
      '<INVALID>test</INVALID>',
      '<div1>test</div1>',

      // 不正なスクリプトタグ
      '<script>alert("Hello");</skript>',
      '<script>alert("Hello")</script',

      // 不正な自己閉じタグ
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

      // 複合ケース
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

      // AMP 広告
      '<amp-ad width="100vw" height="320" type="adsense" data-ad-client="ca-pub-123456789" data-ad-slot="987654321"></amp-ad>',
    ];

    test.each(adCases)('should validate ad tag: %s', (html) => {
      expect(isValidHtmlString(html)).toBe(true);
    });

    // 無効なケース
    const invalidAdCases = [
      '<ins data-ad-client>invalid</ins>',
      '<ins class="adsbygoogle" data-ad-client></ins>',
      '<script>(adsbygoogle = window.adsbygoogle || []).push({);</script>', // 構文エラー
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
