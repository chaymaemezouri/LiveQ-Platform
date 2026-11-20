import type { Request } from 'express';

export function clientAddress(request: Request): string | null {
  const remote = strip(request.socket?.remoteAddress ?? '');
  const forwarded = request.header('x-forwarded-for');
  if (forwarded && isPrivate(remote)) {
    const hops = forwarded
      .split(',')
      .map((part) => strip(part))
      .filter((part) => part.length > 0);
    const client = hops.at(-1);
    if (client) {
      return client.slice(0, 45);
    }
  }
  return remote.length > 0 ? remote.slice(0, 45) : null;
}

function strip(value: string): string {
  return value.trim().replace(/^::ffff:/, '');
}

function isPrivate(address: string): boolean {
  return (
    address === '127.0.0.1' ||
    address === '::1' ||
    address.startsWith('10.') ||
    address.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(address)
  );
}
