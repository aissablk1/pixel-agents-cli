import { detectBestRenderer } from '../../src/renderer/detect.js';

describe('detectBestRenderer', () => {
  let savedEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    savedEnv = { ...process.env };
    // Clear relevant env vars to avoid interference
    delete process.env.TERM_PROGRAM;
    delete process.env.TERM;
    delete process.env.COLORTERM;
  });

  afterEach(() => {
    process.env = savedEnv;
  });

  it('with TERM_PROGRAM=kitty returns "kitty"', () => {
    process.env.TERM_PROGRAM = 'kitty';
    expect(detectBestRenderer()).toBe('kitty');
  });

  it('with TERM_PROGRAM=Ghostty returns "kitty"', () => {
    process.env.TERM_PROGRAM = 'Ghostty';
    expect(detectBestRenderer()).toBe('kitty');
  });

  it('with TERM_PROGRAM=WezTerm returns "kitty"', () => {
    process.env.TERM_PROGRAM = 'WezTerm';
    expect(detectBestRenderer()).toBe('kitty');
  });

  it('with TERM_PROGRAM=iTerm.app returns "sixel"', () => {
    process.env.TERM_PROGRAM = 'iTerm.app';
    expect(detectBestRenderer()).toBe('sixel');
  });

  it('with COLORTERM=truecolor returns "halfblock"', () => {
    process.env.COLORTERM = 'truecolor';
    expect(detectBestRenderer()).toBe('halfblock');
  });

  it('with default env returns "halfblock"', () => {
    expect(detectBestRenderer()).toBe('halfblock');
  });
});
