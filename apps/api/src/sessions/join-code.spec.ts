import { createJoinCode } from './join-code';

describe('createJoinCode', () => {
  it('creates an 8-character code from an unambiguous alphabet', () => {
    for (let index = 0; index < 30; index += 1) {
      expect(createJoinCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    }
  });
});
