import {
  handleOnlineVariableCommandEnvelopeV2,
  validateOnlineVariableProtocolStateV2,
  type OnlineCommandEnvelopeV1,
  type OnlineVariableProtocolStateV2,
} from '../protocol/index';
import { projectOnlineVariableProtocolV3 } from '../projection/index';
import {
  type CreateLocalGameApplicationAdapterV1Input,
  type GameApplicationAdapterV1,
  type GameApplicationExecutionV1,
  registerGameApplicationAdapterV1,
} from './types';
import { validateGameApplicationAuthorityV1 } from './applicationV1';

export function createLocalGameApplicationAdapterV1(
  input: CreateLocalGameApplicationAdapterV1Input,
): GameApplicationAdapterV1 {
  const authorityResult = validateGameApplicationAuthorityV1(input.authority);
  if (!authorityResult.ok) throw new Error('Invalid application authority');
  const stateResult = validateOnlineVariableProtocolStateV2(input.initialState);
  if (!stateResult.ok) throw new Error('Invalid variable protocol state');
  const state = stateResult.value;
  const seat = state.room.participants.find((entry) => entry.participantId === authorityResult.value.participantId);
  if (
    seat === undefined
    || seat.role !== 'player'
    || seat.seatIndex === null
    || state.room.seats[seat.seatIndex]?.seatCapability !== authorityResult.value.participantCapability
    || state.room.roomId !== authorityResult.value.roomId
    || state.protocolVersion !== authorityResult.value.protocolVersion
  ) throw new Error('Invalid application authority');
  let currentState: OnlineVariableProtocolStateV2 = state;
  const applyEnvelope = (envelope: OnlineCommandEnvelopeV1): Promise<GameApplicationExecutionV1> => {
      try {
        const transition = handleOnlineVariableCommandEnvelopeV2(currentState, envelope);
        currentState = transition.state;
        const projection = projectOnlineVariableProtocolV3(
          currentState,
          authorityResult.value.participantId,
        );
        return Promise.resolve(Object.freeze({
          ok: true as const,
          value: Object.freeze({
            kind: 'game-application-exchange-v1' as const,
            receipt: transition.response,
            projection,
          }),
        }));
      } catch {
        return Promise.resolve(Object.freeze({
          ok: false as const,
          issues: Object.freeze([Object.freeze({
            code: 'APPLICATION_FAILURE' as const,
            path: '',
            message: 'Local application failed',
          })]),
        }));
      }
  };
  return registerGameApplicationAdapterV1('local', authorityResult.value, applyEnvelope);
}
