import QRCode from 'qrcode';
import { useEffect, useState } from 'react';

export function QrCode({ value }: { value: string }) {
  const [svg, setSvg] = useState('');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    QRCode.toString(value, {
      type: 'svg',
      margin: 1,
      width: 240,
      color: { dark: '#1c2b45', light: '#ffffff' },
    })
      .then((markup) => {
        if (!cancelled) {
          setSvg(markup);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  if (failed) {
    return <p className="text-destructive text-sm">The QR code could not be drawn.</p>;
  }

  if (!svg) {
    return <p className="text-muted-foreground text-sm">Preparing the QR code…</p>;
  }

  return (
    <div
      className="rounded-lg bg-white p-3 [&_svg]:h-auto [&_svg]:w-full"
      role="img"
      aria-label="QR code for the participant joining address"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
