/**
 * Renders an emoji as a Twemoji image so it looks identical on all platforms.
 * Uses the jsDelivr CDN for Twitter's open-source emoji SVGs.
 */
export default function Emoji({ char, size = '1.1rem' }: { char: string; size?: string | number }) {
  const codePoint = [...char]
    .map(c => c.codePointAt(0)!.toString(16).padStart(4, '0'))
    .filter(cp => cp !== 'fe0f') // strip variation selector-16
    .join('-');

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg/${codePoint}.svg`}
      alt={char}
      draggable={false}
      style={{ width: size, height: size, display: 'inline-block', verticalAlign: 'middle' }}
    />
  );
}
