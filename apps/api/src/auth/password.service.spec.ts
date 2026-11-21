import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();

  it('hashes with argon2id (PHC string)', async () => {
    const hash = await service.hash('clave-segura-1');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(hash).not.toContain('clave-segura-1');
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const hash = await service.hash('clave-segura-1');
    await expect(service.verify(hash, 'clave-segura-1')).resolves.toBe(true);
    await expect(service.verify(hash, 'otra-clave')).resolves.toBe(false);
  });

  it('returns false for a malformed hash instead of throwing', async () => {
    await expect(service.verify('not-a-hash', 'x')).resolves.toBe(false);
  });

  it('verifyAgainstDummy always returns false (equalizes timing for unknown emails)', async () => {
    await expect(service.verifyAgainstDummy('cualquier-cosa')).resolves.toBe(false);
    await expect(service.verifyAgainstDummy('')).resolves.toBe(false);
  });
});
