import { FlattenObject, NeverHasStringValue } from './utils/utils';

/** The initial state of the finite state machine. */
export type FSMInit = "FSMInit";

/** The final state of the finite state machine. */
export type FSMTerminate = "FSMTerminate";

/** The reserved keywords that cannot be supplied as the states for the finite state machine */
export type FSMReserved = FSMInit | FSMTerminate;

/** 
 * The custom states of the finite state machine after they have been checked for reserved states.  
 * Will be flattened to TState if no reserved states are found or never. 
 * @template TState string union of the custom states of the finite state machine.
 */
export type FSMState<TState extends string> = NeverHasStringValue<TState, FSMReserved>;

/**
 * The transitions that can be applied to the finite state machine. 
 */
export type TransitionTypes = "init" | "update" | "change" | "override" | "recover" | "reset";

/**
 * The lifecycle hooks that custom callbacks can be attached to during a state transition.   
 */
export type StateLifecycleHook = "onEnter" | "onLeave" | "onUpdate";

/** 
 * The base data of custom states in the finite state machine. 
 * This should be extended to provide custom data types for each state 
 * @template TState String union of the custom states of the finite state machine.
 * @example 
 *  type States = "foo" | "bar" | "baz";
 *  interface CommonData extends BaseStateData<States> {
 *      commonProperty: string;
 *  }
 *  interface FooData extends CommonData {
 *      state: "foo";
 *      fooProperty: number;
 *  }
 *  interface BarData extends CommonData {
 *      state: "bar";
 *      barProperty: string;
 *  }
 *  interface BazData extends CommonData {
 *      state: "baz";
 *      bazProperty: boolean;
 *  }
 *  type StateData = FooData | BarData | BazData;
 */
export type BaseStateData<TState extends string> = {
    state: TState;
};

/**
 * The data object for the reserved FSMInit state 
 */
export type FSMInitStateData = { state: FSMInit; };

/**
 * The states that a given state can leave to. 
 * Will be never if TState contains reserved states. 
 * @template TState String union of the custom states of the finite state machine.
 * @example
 *  type CanLeaveToMap = {
 *      FSMInit: "foo",
 *      foo: "bar",
 *      bar: "foo" | "baz";
 *      baz: "FSMTerminate";
 *  };
 */
export type CanLeaveToStatesMap<TState extends string> =
    Partial<{
        [Key in TState | FSMInit]: Exclude<TState | FSMTerminate, Key>
    }>;


/**
 * The states that a given state can enter from derived from the supplied CanLeaveToStatesMap.
 * Will be never if TState contains reserved states. 
 * @template TState String union of the custom states of the finite state machine.
 * @template TStateKey The specific state the type relates to.
 * @template TCanLeaveToStatesMap A map specifying the states a given state can leave to.
 */
export type CanEnterFromStates<
    TState extends string,
    TStateKey extends TState,
    TCanLeaveToStatesMap extends CanLeaveToStatesMap<TState>
> = FSMState<TState> extends never
    ? never
    : (
        {
            [Key in Exclude<TState | FSMInit, TStateKey>]:
            (
                Key extends keyof TCanLeaveToStatesMap
                ? (
                    TStateKey extends TCanLeaveToStatesMap[Key]
                    ? Key
                    : never
                )
                : Key
            )
        }[Exclude<TState | FSMInit, TStateKey>]
    );

/**
 * The states that a given state can leave to derived from the CanLeaveToStatesMap. 
 * Will be never if TState contains reserved states. 
 * @template TState String union of the custom states of the finite state machine.
 * @template TStateKey The specific state the type relates to.
 * @template TCanLeaveToStatesMap A map specifying the states a given state can leave to.
 */
export type CanLeaveToStates<
    TState extends string,
    TStateKey extends TState | FSMInit,
    TCanLeaveToStatesMap extends CanLeaveToStatesMap<TState>
> = FSMState<TState> extends never
    ? never
    : (

        TStateKey extends keyof TCanLeaveToStatesMap
        ? (
            TCanLeaveToStatesMap[TStateKey] extends string
            ? TCanLeaveToStatesMap[TStateKey]
            : Exclude<TState | FSMTerminate, TStateKey>
        )
        : Exclude<TState | FSMTerminate, TStateKey>

    );

/**
 * The supplied TCanLeaveToStatesMap in array form. 
 * @template TState String union of the custom states of the finite state machine.
 * @template TCanLeaveToStatesMap A map specifying the states a given state can leave to.
 */
export type CanLeaveToStatesArrays<
    TState extends string,
    TCanLeaveToStatesMap extends CanLeaveToStatesMap<TState>
> = {
        [Key in TState | FSMInit]: CanLeaveToStates<TState, Key, TCanLeaveToStatesMap>[]
    };

/**
 * The information about the state the FSM is leaving, supplied to the onLeave callback function as leavingStateInfo. 
 * @template TState String union of the custom states of the finite state machine.
 * @template TLeavingState The state the FSM is leaving.
 * @template TStateData The data associated with each state.
 * @template TCanLeaveToStatesMap A map specifying the states a given state can leave to.
 */
export type OnLeaveLeavingStateInfo<
    TState extends string,
    TLeavingState extends TState,
    TStateData extends BaseStateData<TState>,
    TCanLeaveToStatesMap extends CanLeaveToStatesMap<TState>
> = {
    state: TLeavingState,
    stateData: FlattenObject<TStateData & { state: TLeavingState; }>,
    canUpdate: true,
    canLeaveTo: CanLeaveToStates<TState, TLeavingState, TCanLeaveToStatesMap>[];
};

/**
 * The information about the state the FSM is entering, supplied to the onLeave callback function as enteringStateInfo.
 * The states this data represents is inferred through the TLeavingState CanLeaveToStatesMap value.
 * @template TState String union of the custom states of the finite state machine.
 * @template TLeavingState The state the FSM is leaving.
 * @template TStateData The data associated with each state.
 * @template TCanLeaveToStatesMap A map specifying the states a given state can leave to.
 */
export type OnLeaveEnteringStateInfo<
    TState extends string,
    TLeavingState extends TState | FSMInit,
    TStateData extends BaseStateData<TState>,
    TCanLeaveToStatesMap extends CanLeaveToStatesMap<TState>
> = {
    [Key in CanLeaveToStates<TState, TLeavingState, TCanLeaveToStatesMap>]: Key extends TState
    ? {
        state: Key,
        stateData: FlattenObject<TStateData & { state: Key; }>,
        canUpdate: true,
        canLeaveTo: CanLeaveToStates<TState, Key, TCanLeaveToStatesMap>[];
    } : never
}[CanLeaveToStates<TState, TLeavingState, TCanLeaveToStatesMap>];

/**
 * The data passed into the onLeave state lifecycle hook as part of a changeState transition. 
 * @template TState String union of the custom states of the finite state machine.
 * @template TLeavingState The state(s) the FSM is leaving.
 * @template TStateData The data associated with each state.
 * @template TCanLeaveToStatesMap A map specifying the states a given state can leave to.
 */
export type OnLeaveStateChanges<
    TState extends string,
    TLeavingState extends TState,
    TStateData extends BaseStateData<TState>,
    TCanLeaveToStatesMap extends CanLeaveToStatesMap<TState>
> = {
    [Key in TLeavingState]: {
        hook: StateLifecycleHook & "onLeave";
        leavingStateInfo: OnLeaveLeavingStateInfo<TState, Key, TStateData, TCanLeaveToStatesMap>;
        enteringStateInfo: OnLeaveEnteringStateInfo<TState, Key, TStateData, TCanLeaveToStatesMap>;
    }
}[TLeavingState];

/**
 * The information about the state the FSM is leaving, supplied to the onEnter callback function as leavingStateInfo.
 * The states this data represents is inferred through the TEnteringState CanLeaveToStatesMap value.
 * @template TState String union of the custom states of the finite state machine.
 * @template TEnteringState The state the FSM is entering.
 * @template TStateData The data associated with each state.
 * @template TCanLeaveToStatesMap A map specifying the states a given state can leave to.
 */
export type OnEnterLeavingStateInfo<
    TState extends string,
    TEnteringState extends TState,
    TStateData extends BaseStateData<TState>,
    TCanLeaveToStatesMap extends CanLeaveToStatesMap<TState>
> = {
    [Key in CanEnterFromStates<TState, TEnteringState, TCanLeaveToStatesMap>]: Key extends TState
    ? {
        state: Key,
        stateData: FlattenObject<TStateData & { state: Key; }>,
        canUpdate: true,
        canLeaveTo: CanLeaveToStates<TState, Key, TCanLeaveToStatesMap>[];
    } : {
        state: FSMInit;
        stateData: FSMInitStateData,
        canUpdate: false,
        canLeaveTo: CanLeaveToStates<TState, FSMInit, TCanLeaveToStatesMap>[];
    }
}[CanEnterFromStates<TState, TEnteringState, TCanLeaveToStatesMap>];

/**
 * The information about the state the FSM is entering, supplied to the onEnter callback function as enteringStateInfo.
 * @template TState String union of the custom states of the finite state machine.
 * @template TEnteringState The state the FSM is entering.
 * @template TStateData The data associated with each state.
 * @template TCanLeaveToStatesMap A map specifying the states a given state can leave to.
 */
export type OnEnterEnteringStateInfo<
    TState extends string,
    TEnteringState extends TState,
    TStateData extends BaseStateData<TState>,
    TCanLeaveToStatesMap extends CanLeaveToStatesMap<TState>
> = {
    state: TEnteringState,
    stateData: FlattenObject<TStateData & { state: TEnteringState; }>,
    canUpdate: true,
    canLeaveTo: CanLeaveToStates<TState, TEnteringState, TCanLeaveToStatesMap>[];
};

/**
 * The data passed into the onEnter state lifecycle hook as part of a changeState transition. 
 * @template TState String union of the custom states of the finite state machine.
 * @template TEnteringState The state(s) the FSM is entering.
 * @template TStateData The data associated with each state.
 * @template TCanLeaveToStatesMap A map specifying the states a given state can leave to.
 */
export type OnEnterStateChanges<
    TState extends string,
    TEnteringState extends TState,
    TStateData extends BaseStateData<TState>,
    TCanLeaveToStatesMap extends CanLeaveToStatesMap<TState>
> = {
    [Key in TEnteringState]: {
        hook: StateLifecycleHook & "onEnter",
        leavingStateInfo: OnEnterLeavingStateInfo<TState, Key, TStateData, TCanLeaveToStatesMap>,
        enteringStateInfo: OnEnterEnteringStateInfo<TState, Key, TStateData, TCanLeaveToStatesMap>;
    };
}[TEnteringState];

/**
 * The data relating to the state the FSM is updating, which will be passed into the onUpdate state lifecycle hook during a updateState transition.
 * @template TState String union of the custom states of the finite state machine.
 * @template TUpdateState The state the FSM is updating.
 * @template TStateData The data associated with each state.
 */
export type OnUpdateStateTransitionInfo<
    TState extends string,
    TUpdateState extends TState,
    TStateData extends BaseStateData<TState>,
    TCanLeaveToStatesMap extends CanLeaveToStatesMap<TState>
> = {
    state: TUpdateState,
    stateData: FlattenObject<TStateData & { state: TUpdateState; }>,
    canUpdate: true,
    canLeaveTo: CanLeaveToStates<TState, TUpdateState, TCanLeaveToStatesMap>[];
};


/**
 * The data passed into the onUpdate state lifecycle hook as part of a updateState transition. 
 * @template TState String union of the custom states of the finite state machine.
 * @template TUpdateState The state the FSM is updating.
 * @template TStateData The data associated with each state.
 */
export type OnUpdateStateChanges<
    TState extends string,
    TUpdateState extends TState,
    TStateData extends BaseStateData<TState>,
    TCanLeaveToStatesMap extends CanLeaveToStatesMap<TState>
> = {
    [Key in TUpdateState]: {
        hook: StateLifecycleHook & "onUpdate",
        previousInfo: OnUpdateStateTransitionInfo<TState, Key, TStateData, TCanLeaveToStatesMap>;
        updateInfo: OnUpdateStateTransitionInfo<TState, Key, TStateData, TCanLeaveToStatesMap>;
    }
}[TUpdateState];


/** 
 * The signatures of the StateLifecycleHook functions. 
 * @template TState String union of the custom states of the finite state machine.
 * @template TStateKey The specific state the type relates to.
 * @template TStateData The data associated with each state.
 * @template TCanLeaveToStatesMap A map specifying the states a given state can leave to.
 */
type StateLifecycleTransitionSignatures<
    TState extends string,
    TStateKey extends TState,
    TStateData extends BaseStateData<TState>,
    TCanLeaveToStatesMap extends CanLeaveToStatesMap<TState>
> = {
    onEnter: (changes: OnEnterStateChanges<TState, TStateKey, TStateData, TCanLeaveToStatesMap>) => boolean | void,
    onLeave: (changes: OnLeaveStateChanges<TState, TStateKey, TStateData, TCanLeaveToStatesMap>) => boolean | void,
    onUpdate: (changes: OnUpdateStateChanges<TState, TStateKey, TStateData, TCanLeaveToStatesMap>) => boolean | void;
};

/**
 * The metadata of a given state.
 * Contains The states that a given state can leave to as well as any lifecycle hook functions to call during transitions.
 * Will be never if TState contains reserved states or if the state is an orphaned state (no other states leave to it).
 * @template TState String union of the custom states of the finite state machine.
 * @template TStateKey The specific state the type relates to.
 * @template TStateData The data associated with each state.
 * @template TCanLeaveToStatesMap A map specifying the states a given state can leave to.
 */
export type StateMetadata<
    TState extends string,
    TStateKey extends TState,
    TStateData extends BaseStateData<TState>,
    TCanLeaveToStatesMap extends CanLeaveToStatesMap<TState>
> = CanEnterFromStates<TState, TStateKey, TCanLeaveToStatesMap> extends never
    ? never
    : {
        canEnterFromStates: Record<CanEnterFromStates<TState, TStateKey, TCanLeaveToStatesMap>, true>;
        canLeaveToStates: Record<CanLeaveToStates<TState, TStateKey, TCanLeaveToStatesMap>, true>;
    }
    & Partial<StateLifecycleTransitionSignatures<TState, TStateKey, TStateData, TCanLeaveToStatesMap>>;

/**
 * Collection of states and the corresponding metadata that governs allowed transitions and lifecycle callbacks. 
 * @template TState String union of the custom states of the finite state machine.
 * @template TStateData The data associated with each state.
 * @template TCanLeaveToStatesMap A map specifying the states to which a given state can leave.
 * @example
 *  public override stateMap: StateMap<States, StateData, CanLeaveToMap> = {
 *      foo: {
 *          canEnterFromStates: { FSMInit: true, bar: true },
 *          canLeaveToStates: { bar: true },
 *          onEnter: (changes: OnEnterStateChanges<States, "foo", StateData, CanLeaveToMap>) => { },
 *          onLeave: (changes: OnLeaveStateChanges<States, "foo", StateData, CanLeaveToMap>) => { },
 *          onUpdate: (changes: OnUpdateStateChanges<States, "foo", StateData, CanLeaveToMap>) => { },
 *      },
 *      bar: {
 *          canEnterFromStates: { foo: true },
 *          canLeaveToStates: { foo: true, baz: true },
 *          onEnter: this.handleOnEnterBarBaz,
 *          onLeave: this.handleOnLeaveBarBaz,
 *          onUpdate: this.handleOnUpdateBarBaz
 *      },
 *      baz: {
 *          canEnterFromStates: { bar: true },
 *          canLeaveToStates: { FSMTerminate: true },
 *          onEnter: this.handleOnEnterBarBaz,
 *          onLeave: this.handleOnLeaveBarBaz,
 *          onUpdate: this.handleOnUpdateBarBaz
 *      };
 *  }
 *
 *  private handleOnEnterBarBaz(changes: OnEnterStateChanges<States, "bar" | "baz", StateData, CanLeaveToMap>): void { }
 *  private handleOnLeaveBarBaz(changes: OnLeaveStateChanges<States, "bar" | "baz", StateData, CanLeaveToMap>): void { }
 *  private handleOnUpdateBarBaz(changes: OnUpdateStateChanges<States, "bar" | "baz", StateData, CanLeaveToMap>): void { }
 */
export type StateMap<
    TState extends string,
    TStateData extends BaseStateData<TState>,
    TCanLeaveToStatesMap extends CanLeaveToStatesMap<TState>,
> = FSMState<TState> extends never
    ? never
    : (
        {
            [Key in TState]: StateMetadata<TState, Key, TStateData, TCanLeaveToStatesMap>
        }
    );

/**
 * The information about the currentState the FSM is in. 
 * @template TState String union of the custom states of the finite state machine.
 * @template TStateData The data associated with each state.
 * @template TCanLeaveToStatesMap An option map specifying the states to which a given state can leave.
 */
export type CurrentStateInfo<
    TState extends string,
    TStateData extends BaseStateData<TState>,
    TCanLeaveToStatesMap extends CanLeaveToStatesMap<TState>
> = {
    [Key in TState | FSMInit]: Key extends FSMInit
    ? {
        state: FSMInit,
        stateData: FSMInitStateData,
        canUpdate: false,
        canLeaveTo: CanLeaveToStates<TState, FSMInit, TCanLeaveToStatesMap>[];
    } :
    {
        state: Key,
        stateData: FlattenObject<TStateData & { state: Key; }>,
        canUpdate: true,
        canLeaveTo: CanLeaveToStates<TState, Key, TCanLeaveToStatesMap>[];
    }

}[TState | FSMInit];

/**
 * The information about the state the FSM is overriding to, supplied to the onOverride callback function as overridingStateInfo. 
 * @template TState String union of the custom states of the finite state machine.
 * @template TStateData The data associated with each state.
 * @template TCanLeaveToStatesMap A map specifying the states a given state can leave to.
 */
export type OverridingStateInfo<
    TState extends string,
    TStateData extends BaseStateData<TState>,
    TCanLeaveToStatesMap extends CanLeaveToStatesMap<TState>
> = {
    [Key in TState]: {
        state: Key,
        stateData: FlattenObject<TStateData & { state: Key; }>,
        canUpdate: true,
        canLeaveTo: CanLeaveToStates<TState, Key, TCanLeaveToStatesMap>[];
    }
}[TState];

/**
 * The data passed into the onOverride function as part of a state override. 
 * @template TState String union of the custom states of the finite state machine.
 * @template TStateData The data associated with each state.
 * @template TCanLeaveToStatesMap A map specifying the states a given state can leave to.
 */
export type OnOverrideStateChanges<
    TState extends string,
    TStateData extends BaseStateData<TState>,
    TCanLeaveToStatesMap extends CanLeaveToStatesMap<TState>
> = {
    originalStateInfo: CurrentStateInfo<TState, TStateData, TCanLeaveToStatesMap>;
    overridingStateInfo: OverridingStateInfo<TState, TStateData, TCanLeaveToStatesMap>;
};

/**
 * The data used to force the FSM to transition to a state whether it is allowed to or not.
 * This is useful for debugging and demonstration purposes. 
 * @template TState String union of the custom states of the finite state machine.
 * @template TStateData The data associated with each state including an optional onSetup hook.
 */
export type StateOverride<
    TState extends string,
    TStateData extends BaseStateData<TState>,
    TCanLeaveToStatesMap extends CanLeaveToStatesMap<TState>,
> = {
    stateData: TStateData;
    onOverride?: (changes: OnOverrideStateChanges<TState, TStateData, TCanLeaveToStatesMap>) => void;
};

/**
 * The direction in which the state diagram is to be drawn.
 * TB = Top to Bottom, LR = Left to Right
 */
export type StateDiagramDirections = "TB" | "LR";

export type BaseFsmConfig = {
    outputTransitionRejectionToConsole: boolean,
    filterRepeatUpdates: boolean,
    debugLogBufferCount: number,
    stringifyLogTransitionData: boolean;
    recordFilteredUpdatesToDebugLog: boolean;
    resetDebugLogOnOverride: boolean;
    recordResetDataToDebugLog: boolean;
    stateDiagramDirection: StateDiagramDirections;
};

/**
 * A configuration object that controls the availability of certain debugging features.
 * @template TState String union of the custom states of the finite state machine.
 * @template TStateData The data associated with each state.
 */
export type FsmConfig<
    TState extends string,
    TStateData extends BaseStateData<TState>,
    TCanLeaveToStatesMap extends CanLeaveToStatesMap<TState>,
> = BaseFsmConfig & {
    stateOverride: StateOverride<TState, TStateData, TCanLeaveToStatesMap> | false,
};

/**
 * The data supplied to a state transition.
 * @template TState String union of the custom states of the finite state machine.
 * @template TStateData The data associated with each state.
 */
export type StateTransition<
    TState extends string,
    TStateData extends BaseStateData<TState>
> = {
    transitionType: TransitionTypes,
    stateData: TStateData | FSMInitStateData;
};

/**
 * A string representing the reason a state transition was rejected.
 */
export type TransitionRejectionReasons =
    "illegal_change_same_state"
    | "unknown_error"
    | "illegal_update_FSMInit"
    | "repeat_update_filtered"
    | "update_state_mismatch"
    | "terminated_by_update_callback"
    | "internal_error"
    | "not_permitted_to_enter"
    | "terminated_by_leave_callback"
    | "not_permitted_to_leave"
    | "terminated_by_enter_callback"
    | "after_fsm_destroy"
    | "override_in_production";

/**
 *  A string representing the result of applying a transition. Either a TransitionRejectionReasons or "success"  | "reset" | "override" | "recover";.
 */
export type TransitionResult = TransitionRejectionReasons | "success" | "reset" | "override" | "recover";

/**
 * The data that is added to the debug log after each successful and unsuccessful state transition. 
 * @template TState String union of the custom states of the finite state machine.
 * @template TStateData The data associated with each state.
 */
export type DebugLogEntry<
    TState extends string,
    TStateData extends BaseStateData<TState>
> = {
    stateData: (TStateData | FSMInitStateData) | string;
    transitionType: TransitionTypes,
    result: TransitionResult,
    timeStamp: number;
    message: string;
};

/**
 * If and how the error is logged to the console 
 * "filtered-updates" doesn't log the error while "warn" | "error" will call their respective console functions. 
 */
export type TransitionRejectionSeverity = "warn" | "error" | "filtered-update";

/**
 * Data representing why a transition was rejected. 
 */
export type TransitionRejection = {
    message: string,
    errorSeverity: TransitionRejectionSeverity,
    rejectReason: TransitionRejectionReasons,
    transitionType: TransitionTypes,
};

/**
 * The Data of the state being changed to found by reverse lookup of the states the current state can leave to. 
 * @template TState String union of the custom states of the finite state machine.
 * @template TCurrentState The state the FSM is currently in.  
 * @template TStateData The data associated with each state.
 * @template TCanLeaveToStatesMap A map specifying the states a given state can leave to.
 */
export type ChangeStateData<
    TState extends string,
    TCurrentState extends TState | FSMInit,
    TStateData extends BaseStateData<TState>,
    TCanLeaveToStatesMap extends CanLeaveToStatesMap<TState>,
> = {
    [Key in TCurrentState]: FlattenObject<TStateData & {
        state: CanLeaveToStates<TState, Key, TCanLeaveToStatesMap>;
    }>
}[TCurrentState];