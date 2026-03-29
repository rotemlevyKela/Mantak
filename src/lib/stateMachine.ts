import type { StreamId } from '../domain/types'

export type WorkflowStateType =
  | 'idle'
  | 'selectingAlert'
  | 'switchingStream'
  | 'focusingObject'
  | 'focused'

export interface WorkflowState {
  type: WorkflowStateType
  focusAlertId?: string
  focusTrackId?: string
  focusStreamId?: StreamId
  token: number
}

export type WorkflowEvent =
  | { type: 'SELECT_ALERT'; alertId: string; trackId: string; streamId: StreamId }
  | { type: 'STREAM_SWITCHED'; token: number; streamId: StreamId }
  | { type: 'OBJECT_FOCUSED'; token: number; trackId: string }
  | { type: 'CLEAR_FOCUS' }

export function createWorkflowState(): WorkflowState {
  return { type: 'idle', token: 0 }
}

export function advanceWorkflow(
  state: WorkflowState,
  event: WorkflowEvent,
): WorkflowState {
  if (event.type === 'CLEAR_FOCUS') {
    return { type: 'idle', token: state.token + 1 }
  }

  if (event.type === 'SELECT_ALERT') {
    const token = state.token + 1
    return {
      type: 'switchingStream',
      focusAlertId: event.alertId,
      focusTrackId: event.trackId,
      focusStreamId: event.streamId,
      token,
    }
  }

  if (event.type === 'STREAM_SWITCHED') {
    if (event.token !== state.token || state.type !== 'switchingStream') {
      return state
    }
    return { ...state, type: 'focusingObject' }
  }

  if (event.type === 'OBJECT_FOCUSED') {
    if (event.token !== state.token || state.type !== 'focusingObject') {
      return state
    }
    return { ...state, type: 'focused', focusTrackId: event.trackId }
  }

  return state
}
