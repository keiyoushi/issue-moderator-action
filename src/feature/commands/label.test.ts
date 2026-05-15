import { afterEach, describe, expect, it } from 'vitest';

import { parseLabelArgs } from './label';

describe('parseLabelArgs', () => {
  afterEach(() => {
    delete process.env['INPUT_LABEL-COMMAND'];
    delete process.env['INPUT_UNLABEL-COMMAND'];
  });

  it('parses bot-style token with comma separated labels', () => {
    expect(parseLabelArgs('/label bug, help wanted', 'label')).toStrictEqual([
      'bug',
      'help wanted',
    ]);
  });

  it('supports ? and ! bot characters', () => {
    expect(parseLabelArgs('?label bug', 'label')).toStrictEqual(['bug']);
    expect(parseLabelArgs('!unlabel bug', 'unlabel')).toStrictEqual(['bug']);
  });

  it('parses the configured prefix', () => {
    process.env['INPUT_LABEL-COMMAND'] = 'Label';
    expect(parseLabelArgs('Label bug, wontfix', 'label')).toStrictEqual([
      'bug',
      'wontfix',
    ]);
  });

  it('trims whitespace and drops empty entries', () => {
    expect(
      parseLabelArgs('/label   bug ,, , help wanted ,', 'label'),
    ).toStrictEqual(['bug', 'help wanted']);
  });

  it('returns empty array when no labels given', () => {
    expect(parseLabelArgs('/label', 'label')).toStrictEqual([]);
  });

  it('does not strip the label token from an unlabel command', () => {
    expect(parseLabelArgs('/unlabel bug', 'unlabel')).toStrictEqual(['bug']);
  });
});
