import { render, screen } from '@testing-library/react';
import { Linkify } from './Linkify';

describe('Linkify', () => {
  it('turns http(s) URLs into links that open in a new tab, keeping the text around them', () => {
    const { container } = render(<Linkify text={'Manual: https://example.com/a?b=1 and http://x.fi'} />);
    const links = screen.getAllByRole('link');
    expect(links.map(a => a.getAttribute('href'))).toEqual(['https://example.com/a?b=1', 'http://x.fi']);
    expect(links[0]).toHaveAttribute('target', '_blank');
    expect(container).toHaveTextContent('Manual: https://example.com/a?b=1 and http://x.fi');
  });

  it('leaves sentence punctuation after a URL out of the link', () => {
    const { container } = render(<Linkify text="See (https://example.com/x)." />);
    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://example.com/x');
    expect(container).toHaveTextContent('See (https://example.com/x).');
  });

  it('does not link text without a scheme', () => {
    render(<Linkify text="example.com, javascript:alert(1)" />);
    expect(screen.queryByRole('link')).toBeNull();
  });
});
