import { createParticipantToken, hashParticipantToken } from './participant-token';

describe('participant tokens', () => {
  it('stores a SHA-256 hash that is distinct from the reconnect token', () => {
    const token = createParticipantToken();
    const hash = hashParticipantToken(token);

    expect(token.length).toBeGreaterThan(20);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe(token);
    expect(hashParticipantToken(token)).toBe(hash);
  });
});
