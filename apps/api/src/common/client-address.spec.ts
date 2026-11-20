import type { Request } from 'express';
import { clientAddress } from './client-address';

function request(remote: string, forwarded?: string): Request {
  return {
    socket: { remoteAddress: remote },
    header: (name: string) => (name === 'x-forwarded-for' ? forwarded : undefined),
  } as Request;
}

describe('clientAddress', () => {
  it('uses the proxy client when the connection is local', () => {
    expect(clientAddress(request('127.0.0.1', '203.0.113.9'))).toBe('203.0.113.9');
    expect(clientAddress(request('::ffff:127.0.0.1', '203.0.113.9, 10.0.0.8'))).toBe(
      '10.0.0.8',
    );
  });

  it('ignores a forwarded address from a public connection', () => {
    expect(clientAddress(request('198.51.100.4', '203.0.113.9'))).toBe('198.51.100.4');
  });
});
