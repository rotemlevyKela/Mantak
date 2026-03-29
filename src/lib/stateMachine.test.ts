import { describe, expect, it } from 'vitest'
import { advanceWorkflow, createWorkflowState } from './stateMachine'

describe('workflow state machine', () => {
  it('ignores stale stream switched token', () => {
    const selected = advanceWorkflow(createWorkflowState(), {
      type: 'SELECT_ALERT',
      alertId: 'a-1',
      streamId: 'front',
      trackId: 't-1',
    })
    const stale = advanceWorkflow(selected, {
      type: 'STREAM_SWITCHED',
      token: selected.token - 1,
      streamId: 'front',
    })
    expect(stale.type).toBe('switchingStream')
  })

  it('flows to focused state in order', () => {
    const selected = advanceWorkflow(createWorkflowState(), {
      type: 'SELECT_ALERT',
      alertId: 'a-2',
      streamId: 'left',
      trackId: 't-3',
    })
    const switched = advanceWorkflow(selected, {
      type: 'STREAM_SWITCHED',
      token: selected.token,
      streamId: 'left',
    })
    const focused = advanceWorkflow(switched, {
      type: 'OBJECT_FOCUSED',
      token: switched.token,
      trackId: 't-3',
    })
    expect(focused.type).toBe('focused')
    expect(focused.focusTrackId).toBe('t-3')
  })
})
