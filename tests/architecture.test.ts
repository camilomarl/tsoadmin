import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint();

async function rulesFor(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath });
  return result.messages
    .filter((message) => message.severity === 2)
    .map((message) => message.ruleId);
}

describe('feature architecture lint rules', () => {
  it('requires application logging through the shared logger', async () => {
    expect(await rulesFor("console.log('event');", 'src/server.ts')).toContain('no-console');
  });

  it.each(['controller', 'service', 'validation'])(
    'keeps declared types out of %s.ts',
    async (file) => {
      expect(
        await rulesFor('export interface Example { id: number }', `src/example/${file}.ts`),
      ).toContain('no-restricted-syntax');
    },
  );

  it.each(['express', 'tsoa', '@prisma/client', '../db.js', '../errors.js'])(
    'rejects validator dependency %s',
    async (dependency) => {
      expect(
        await rulesFor(
          `import * as dependency from '${dependency}'; export { dependency };`,
          'src/example/validation.ts',
        ),
      ).toContain('no-restricted-imports');
    },
  );

  it('keeps database access out of controllers', async () => {
    expect(
      await rulesFor(
        "import { prisma } from '../db.js'; export { prisma };",
        'src/example/controller.ts',
      ),
    ).toContain('no-restricted-imports');
  });

  it('rejects runtime values in types.ts', async () => {
    expect(await rulesFor('export const value = 1;', 'src/example/types.ts')).toContain(
      'no-restricted-syntax',
    );
  });

  it('requires feature errors to extend ValidationError', async () => {
    expect(
      await rulesFor('export class ExampleError extends Error {}', 'src/example/errors.ts'),
    ).toContain('no-restricted-syntax');
  });

  it('allows the documented type and error patterns', async () => {
    expect(
      await rulesFor('export interface Example { id: number }', 'src/example/types.ts'),
    ).toEqual([]);
    expect(
      await rulesFor(
        "import { ValidationError } from '../validation-error.js'; export class ExampleError extends ValidationError {}",
        'src/example/errors.ts',
      ),
    ).toEqual([]);
    expect(
      await rulesFor(
        "import { ExampleError } from './errors.js'; export function validate() { throw new ExampleError('Invalid'); }",
        'src/example/validation.ts',
      ),
    ).toEqual([]);
  });
});
