import { SimpleOffice, CharacterState } from '../../src/engine/simpleOffice.js';
import {
  DEFAULT_COLS,
  DEFAULT_ROWS,
  TILE_SIZE,
  TYPE_FRAME_DURATION_SEC,
  WANDER_PAUSE_MAX_SEC,
} from '../../src/constants.js';

describe('SimpleOffice', () => {
  let office: SimpleOffice;

  beforeEach(() => {
    office = new SimpleOffice();
  });

  it('addCharacter adds a character with correct initial state', () => {
    const ch = office.addCharacter(1);

    expect(ch.id).toBe(1);
    expect(ch.state).toBe(CharacterState.IDLE);
    expect(ch.frame).toBe(0);
    expect(ch.isActive).toBe(false);
    expect(ch.currentTool).toBeNull();
    expect(ch.currentStatus).toBeNull();
    expect(ch.isSubagent).toBe(false);
    expect(ch.parentAgentId).toBeNull();
    expect(office.characters.has(1)).toBe(true);
  });

  it('removeCharacter removes the character', () => {
    office.addCharacter(1);
    expect(office.characters.has(1)).toBe(true);

    office.removeCharacter(1);
    expect(office.characters.has(1)).toBe(false);
  });

  it('characters get different palettes (0, 1, 2...)', () => {
    const ch1 = office.addCharacter(1);
    const ch2 = office.addCharacter(2);
    const ch3 = office.addCharacter(3);

    expect(ch1.palette).toBe(0);
    expect(ch2.palette).toBe(1);
    expect(ch3.palette).toBe(2);
  });

  it('setActive transitions character to TYPE state', () => {
    office.addCharacter(1);
    office.setActive(1, 'Read', 'reading file');

    const ch = office.characters.get(1)!;
    expect(ch.state).toBe(CharacterState.TYPE);
    expect(ch.isActive).toBe(true);
    expect(ch.currentTool).toBe('Read');
    expect(ch.currentStatus).toBe('reading file');
  });

  it('setIdle transitions character to IDLE state', () => {
    office.addCharacter(1);
    office.setActive(1, 'Read', 'reading');

    const ch = office.characters.get(1)!;
    expect(ch.state).toBe(CharacterState.TYPE);

    office.setIdle(1);
    expect(ch.state).toBe(CharacterState.IDLE);
    expect(ch.isActive).toBe(false);
    expect(ch.currentTool).toBeNull();
    expect(ch.currentStatus).toBeNull();
  });

  it('update(dt) in TYPE state cycles animation frames', () => {
    office.addCharacter(1);
    office.setActive(1, 'Bash', 'running');

    const ch = office.characters.get(1)!;
    expect(ch.frame).toBe(0);

    // Advance past one frame duration to trigger frame change
    office.update(TYPE_FRAME_DURATION_SEC + 0.01);
    expect(ch.frame).toBe(1);

    // Advance again to cycle back to frame 0
    office.update(TYPE_FRAME_DURATION_SEC + 0.01);
    expect(ch.frame).toBe(0);
  });

  it('update(dt) in IDLE state eventually triggers WALK', () => {
    office.addCharacter(1);
    const ch = office.characters.get(1)!;
    expect(ch.state).toBe(CharacterState.IDLE);

    // Advance time past the maximum wander pause to guarantee transition
    office.update(WANDER_PAUSE_MAX_SEC + 1);
    expect(ch.state).toBe(CharacterState.WALK);
  });

  it('getPixelSize() returns correct dimensions (cols*16, rows*16)', () => {
    const size = office.getPixelSize();

    expect(size.width).toBe(DEFAULT_COLS * TILE_SIZE);
    expect(size.height).toBe(DEFAULT_ROWS * TILE_SIZE);
  });
});
