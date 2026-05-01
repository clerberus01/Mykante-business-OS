import { describe, expect, it } from 'vitest';
import { escapeHtml } from '../html.js';

describe('escapeHtml', () => {
  it('escapes characters with special meaning in HTML', () => {
    expect(escapeHtml('User <script>alert("x")</script> & \'test\'')).toBe(
      'User &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &#39;test&#39;',
    );
  });

  it('coerces non-string values before escaping', () => {
    expect(escapeHtml(123)).toBe('123');
  });
});
