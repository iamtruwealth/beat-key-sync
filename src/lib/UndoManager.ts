/**
 * UndoManager - A TypeScript singleton for managing undo/redo operations in a DAW-like application
 * 
 * Usage Examples:
 * 
 * // Adding a clip
 * UndoManager.getInstance().push({
 *   type: 'ADD_CLIP',
 *   payload: { trackId: 'track-1', clip: newClip },
 *   undo: () => removeClipFromTrack('track-1', newClip.id)
 * });
 * 
 * // Removing a clip
 * UndoManager.getInstance().push({
 *   type: 'REMOVE_CLIP',
 *   payload: { trackId: 'track-1', clip: removedClip },
 *   undo: () => addClipToTrack('track-1', removedClip)
 * });
 * 
 * // Recording a MIDI note
 * UndoManager.getInstance().push({
 *   type: 'RECORD_MIDI_NOTE',
 *   payload: { trackId: 'midi-track-1', note: midiNote },
 *   undo: () => removeMidiNote('midi-track-1', midiNote.id)
 * });
 */

// Base interface for all undo actions
export interface UndoAction<T = any> {
  type: string;
  payload: T;
  undo: () => void | Promise<void>;
  timestamp?: number;
  description?: string;
}

// Specific action payload types
export interface ClipActionPayload {
  trackId: string;
  clip: {
    id: string;
    startTime: number;
    endTime: number;
    url?: string;
    name?: string;
    [key: string]: any;
  };
}

export interface MidiNoteActionPayload {
  trackId: string;
  note: {
    id: string;
    pitch: number;
    velocity: number;
    startTime: number;
    duration: number;
    [key: string]: any;
  };
}

export interface TrackActionPayload {
  track: {
    id: string;
    name: string;
    volume?: number;
    muted?: boolean;
    solo?: boolean;
    [key: string]: any;
  };
}

export interface ClipMoveActionPayload {
  trackId: string;
  clipId: string;
  fromPosition: { startTime: number; endTime: number };
  toPosition: { startTime: number; endTime: number };
}

export interface VolumeChangeActionPayload {
  trackId: string;
  fromVolume: number;
  toVolume: number;
}

export interface AudioInsertActionPayload {
  trackId: string;
  audioData: {
    id: string;
    url: string;
    startTime: number;
    duration: number;
    [key: string]: any;
  };
}

// Union type for all possible action payloads
export type ActionPayload = 
  | ClipActionPayload
  | MidiNoteActionPayload
  | TrackActionPayload
  | ClipMoveActionPayload
  | VolumeChangeActionPayload
  | AudioInsertActionPayload;

// Predefined action types
export enum ActionType {
  ADD_CLIP = 'ADD_CLIP',
  REMOVE_CLIP = 'REMOVE_CLIP',
  MOVE_CLIP = 'MOVE_CLIP',
  RECORD_MIDI_NOTE = 'RECORD_MIDI_NOTE',
  REMOVE_MIDI_NOTE = 'REMOVE_MIDI_NOTE',
  ADD_TRACK = 'ADD_TRACK',
  REMOVE_TRACK = 'REMOVE_TRACK',
  CHANGE_VOLUME = 'CHANGE_VOLUME',
  TOGGLE_MUTE = 'TOGGLE_MUTE',
  TOGGLE_SOLO = 'TOGGLE_SOLO',
  INSERT_AUDIO = 'INSERT_AUDIO',
  TRIM_CLIP = 'TRIM_CLIP',
  SPLIT_CLIP = 'SPLIT_CLIP',
  DUPLICATE_CLIP = 'DUPLICATE_CLIP'
}

/**
 * UndoManager class - Singleton pattern for managing undo operations
 */
export class UndoManager {
  private static instance: UndoManager | null = null;
  private actionStack: UndoAction[] = [];
  private maxStackSize: number = 50; // Limit stack size to prevent memory issues
  private isUndoing: boolean = false; // Prevent recursive undo operations

  private constructor() {
    console.log('🔄 UndoManager initialized');
  }

  /**
   * Get the singleton instance of UndoManager
   */
  public static getInstance(): UndoManager {
    if (!UndoManager.instance) {
      UndoManager.instance = new UndoManager();
    }
    return UndoManager.instance;
  }

  /**
   * Push a new action onto the undo stack
   */
  public push(action: UndoAction): void {
    // Don't push actions while undoing to prevent infinite loops
    if (this.isUndoing) {
      console.log('⚠️ UndoManager: Skipping action push during undo operation');
      return;
    }

    // Add timestamp if not provided
    const actionWithTimestamp: UndoAction = {
      ...action,
      timestamp: action.timestamp || Date.now()
    };

    this.actionStack.push(actionWithTimestamp);

    // Limit stack size
    if (this.actionStack.length > this.maxStackSize) {
      const removedAction = this.actionStack.shift();
      console.log('📚 UndoManager: Removed oldest action from stack:', removedAction?.type);
    }

    console.log(`✅ UndoManager: Action pushed - ${action.type}`, {
      stackSize: this.actionStack.length,
      payload: action.payload,
      description: action.description
    });
  }

  /**
   * Undo the last action in the stack
   */
  public async undo(): Promise<boolean> {
    if (this.actionStack.length === 0) {
      console.log('⚠️ UndoManager: No actions to undo');
      return false;
    }

    if (this.isUndoing) {
      console.log('⚠️ UndoManager: Undo operation already in progress');
      return false;
    }

    const action = this.actionStack.pop();
    if (!action) {
      console.log('⚠️ UndoManager: Failed to retrieve action from stack');
      return false;
    }

    this.isUndoing = true;

    try {
      console.log(`🔄 UndoManager: Undoing action - ${action.type}`, {
        payload: action.payload,
        description: action.description,
        timestamp: action.timestamp
      });

      // Execute the undo function
      await action.undo();

      console.log(`✅ UndoManager: Successfully undid action - ${action.type}`, {
        remainingActions: this.actionStack.length
      });

      return true;
    } catch (error) {
      console.error(`❌ UndoManager: Failed to undo action - ${action.type}`, error);
      
      // Re-add the action to the stack if undo failed
      this.actionStack.push(action);
      return false;
    } finally {
      this.isUndoing = false;
    }
  }

  /**
   * Clear all actions from the undo stack
   */
  public clear(): void {
    const previousStackSize = this.actionStack.length;
    this.actionStack = [];
    console.log(`🗑️ UndoManager: Cleared ${previousStackSize} actions from stack`);
  }

  /**
   * Get the current number of actions in the stack
   */
  public getStackSize(): number {
    return this.actionStack.length;
  }

  /**
   * Check if there are any actions to undo
   */
  public canUndo(): boolean {
    return this.actionStack.length > 0 && !this.isUndoing;
  }

  /**
   * Get the last action without removing it from the stack
   */
  public peekLastAction(): UndoAction | null {
    return this.actionStack.length > 0 ? this.actionStack[this.actionStack.length - 1] : null;
  }

  /**
   * Get all actions in the stack (for debugging purposes)
   */
  public getActionHistory(): ReadonlyArray<UndoAction> {
    return [...this.actionStack];
  }

  /**
   * Set the maximum stack size
   */
  public setMaxStackSize(size: number): void {
    this.maxStackSize = Math.max(1, size);
    
    // Trim current stack if needed
    while (this.actionStack.length > this.maxStackSize) {
      this.actionStack.shift();
    }
    
    console.log(`📏 UndoManager: Max stack size set to ${this.maxStackSize}`);
  }

  /**
   * Check if an undo operation is currently in progress
   */
  public isUndoInProgress(): boolean {
    return this.isUndoing;
  }
}

// Export the singleton instance for convenience
export const undoManager = UndoManager.getInstance();

// Export action creators for common operations
export const createClipAction = (
  type: ActionType.ADD_CLIP | ActionType.REMOVE_CLIP,
  trackId: string,
  clip: ClipActionPayload['clip'],
  undoFn: () => void,
  description?: string
): UndoAction<ClipActionPayload> => ({
  type,
  payload: { trackId, clip },
  undo: undoFn,
  description: description || `${type === ActionType.ADD_CLIP ? 'Add' : 'Remove'} clip "${clip.name || clip.id}" ${type === ActionType.ADD_CLIP ? 'to' : 'from'} track ${trackId}`
});

export const createMidiAction = (
  type: ActionType.RECORD_MIDI_NOTE | ActionType.REMOVE_MIDI_NOTE,
  trackId: string,
  note: MidiNoteActionPayload['note'],
  undoFn: () => void,
  description?: string
): UndoAction<MidiNoteActionPayload> => ({
  type,
  payload: { trackId, note },
  undo: undoFn,
  description: description || `${type === ActionType.RECORD_MIDI_NOTE ? 'Record' : 'Remove'} MIDI note (pitch: ${note.pitch}) ${type === ActionType.RECORD_MIDI_NOTE ? 'to' : 'from'} track ${trackId}`
});

export const createMoveAction = (
  trackId: string,
  clipId: string,
  fromPosition: ClipMoveActionPayload['fromPosition'],
  toPosition: ClipMoveActionPayload['toPosition'],
  undoFn: () => void,
  description?: string
): UndoAction<ClipMoveActionPayload> => ({
  type: ActionType.MOVE_CLIP,
  payload: { trackId, clipId, fromPosition, toPosition },
  undo: undoFn,
  description: description || `Move clip ${clipId} from ${fromPosition.startTime}s to ${toPosition.startTime}s on track ${trackId}`
});

export default UndoManager;