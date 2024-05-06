import deepEqual from "deep-equal";
import { BehaviorSubject, Observable, Subject, filter, map, observeOn, queueScheduler, take, takeUntil, withLatestFrom } from "rxjs";
import { BaseStateData, CanLeaveToStates, CanLeaveToStatesArrays, CanLeaveToStatesMap, ChangeStateData, CurrentStateInfo, DebugLogEntry, FSMInit, FSMInitStateData, FSMTerminate, FsmConfig, OnEnterEnteringStateInfo, OnEnterLeavingStateInfo, OnLeaveEnteringStateInfo, OnLeaveLeavingStateInfo, OnUpdateStateTransitionInfo, OverridingStateInfo, StateData, StateDiagramDirections, StateMap, StateMetadata, StateOverride, StateTransition, TransitionRejection, TransitionRejectionSeverity, TransitionStates, TransitionTypes } from "../../types/fsm-rx-types";

/**
 * An RXJS implementation of a Finite state machine.
 * @template TState String union of the custom states of a finite state machine 
 * @template TStateData The data associated with each state.
 * @template TCanLeaveToStatesMap An option map specifying the states a given state can leave to.
 */
export abstract class FsmRxInheritable<
    TState extends string,
    TStateData extends BaseStateData<TState>,
    TCanLeaveToStatesMap extends CanLeaveToStatesMap<TState>
> {
    /** 
     * Collection of states and the corresponding metadata that governs allowed transitions and lifecycle callbacks.
     * Must be overridden in extending class.
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
     *  private handleOnEnterBarBaz(changes: OnEnterStateChanges<States, "bar" | "baz", StateData, CanLeaveToMap>): void { }
     *  private handleOnLeaveBarBaz(changes: OnLeaveStateChanges<States, "bar" | "baz", StateData, CanLeaveToMap>): void { }
     *  private handleOnUpdateBarBaz(changes: OnUpdateStateChanges<States, "bar" | "baz", StateData, CanLeaveToMap>): void { }
     */
    protected abstract readonly stateMap: StateMap<TState, TStateData, TCanLeaveToStatesMap>;

    /** A configuration object that controls the availability of certain debugging features. */
    protected readonly resolvedFsmConfig: FsmConfig<TState, TStateData, TCanLeaveToStatesMap>;

    /** If the application is running in dev mode or not. */
    private readonly _isInDevMode: boolean;

    /**
     * Getter for _isInDevMode
     * @returns _isInDevMode 
     */
    public get isInDevMode(): boolean {
        return this._isInDevMode;
    }


    /** A subject used to trigger the completion of observables when the class is destroyed.*/
    private _destroy$: Subject<void> = new Subject();

    /** 
     * Getter for _destroy$
     * @returns _destroy$ as an Observable<void>
     */
    protected get destroy$(): Observable<void> {
        return this._destroy$.asObservable();
    }


    /** 
     * A subject used to trigger the completion of observables when the FSM transitions to a new state.
     * Emits TransitionStates on next; 
     */
    private _nextChangeStateTransition$: Subject<TransitionStates<TState>> = new Subject();

    /**
     * Getter for _nextChangeStateTransition$
     * @returns _nextChangeStateTransition$ as an Observable<TransitionStates<TState>>
     */
    protected get nextChangeStateTransition(): Observable<TransitionStates<TState>> {
        return this._nextChangeStateTransition$.asObservable();
    }

    /** A subject used to trigger the completion of observables when an override occurs.*/
    private _override$: Subject<void> = new Subject();

    /**
     * Getter for _override$
     * @returns _override$ as an Observable<void>
     */
    protected get override$(): Observable<void> {
        return this._override$.asObservable();
    }

    /**
     * A Behavior Subject to which successful transitions of the finite state machine are applied for emission.
     * This subject is exposed externally via the stateData$ and currentState$ getters.
     * It is also used to supply the data for the resetInternalObservables functions during error handling.
     */
    private _stateData$: BehaviorSubject<StateTransition<TState, TStateData>>;

    /**
     * Getter for _stateData$.transition observable steam
     * @returns An observable which emits all successful state transition data as it occurs.
     */
    public get stateData$(): Observable<StateData<TState, TStateData>> {
        return this._stateData$.asObservable().pipe(
            takeUntil(this.destroy$),
            map((stateTransition: StateTransition<TState, TStateData>) => { return stateTransition.stateData; })
        );
    }

    /** 
     * A Behavior Subject to which all transitions of the finite state machine are applied for emission. 
     * This subject is used internally and feeds into the stateTransitionObservable$ pipeline which processes transitions and executes lifecycle hook callbacks. 
     * This subject is used to supply error data for logging and error handling functions. 
     * During error handling this subject will complete and is reinitialized during the resetInternalObservables function. 
     */
    private stateTransition$: BehaviorSubject<StateTransition<TState, TStateData>>;

    /** 
     * An observable derived from piping the stateTransition$ behavior subject. 
     * The pipeline processes transitions and executes lifecycle hook callbacks.
     * During error handling this observable will complete and be reinitialized during the resetInternalObservables function. 
     */
    private stateTransitionObservable$: Observable<StateTransition<TState, TStateData>>;

    /** 
     * An array of DebugLogEntry data that represents the outcome of applying a state transition. 
     * The behavior of this log can be altered via the FsmConfig supplied to the constructor. 
     */
    private _debugLog: DebugLogEntry<TState, TStateData>[] | undefined;

    /**
     * Getter for _debugLog
     * @returns An array of DebugLogEntry data that represents the outcome of applying a state transition.
     */
    protected get debugLog(): DebugLogEntry<TState, TStateData>[] {
        return this._debugLog ? this._debugLog : [];
    }

    /** A collection of states and the arrays of states they can leave to */
    private _canLeaveToStatesArrays: CanLeaveToStatesArrays<TState, TCanLeaveToStatesMap> | undefined;

    /**
     * Getter for canLeaveToStatesArrays. 
     * This object derives its data from the abstract stateMap property. 
     * As abstract properties cannot be accessed in the constructor the data is processed the first time the value is accessed. 
     * @returns A collection of states and the arrays of states they can leave to
     */
    private get canLeaveToStatesArrays(): CanLeaveToStatesArrays<TState, TCanLeaveToStatesMap> {
        if (!this._canLeaveToStatesArrays) {
            const entries = Object.entries(this.stateMap) as Array<[TState, StateMetadata<TState, TState, TStateData, TCanLeaveToStatesMap>]>;
            this._canLeaveToStatesArrays = entries.reduce((rData, [state, metadata]: [TState, StateMetadata<TState, TState, TStateData, TCanLeaveToStatesMap>]) => {
                if (state !== "FSMInit" && Object.keys(metadata.canEnterFromStates).includes("FSMInit")) {
                    rData.FSMInit.push(state as CanLeaveToStates<TState, FSMInit, TCanLeaveToStatesMap>);
                }
                rData[state] = Object.keys(metadata.canLeaveToStates) as CanLeaveToStates<TState, typeof state, TCanLeaveToStatesMap>[];
                return rData;
            }, { FSMInit: [] } as CanLeaveToStatesArrays<TState, TCanLeaveToStatesMap>);

        }
        return this._canLeaveToStatesArrays;
    }

    /**
     * Getter for _stateData$.transitionData observable steam that will emit the current state data and immediately complete.
     * @example 
     *  this.currentState$.subscribe((currentStateInfo: CurrentStateInfo<States, StateData, CanLeaveToMap>) => {
     *     if (currentStateInfo.state === "FSMInit") { return; }
     *     const currentState: States = currentStateInfo.state;
     *     switch (currentState) {
     *          case "foo":
     *              ...
     *              break;
     *          case "bar":
     *              ...
     *              break;
     *          case "baz":
     *              ...
     *              break;
     *          default:
     *              FsmRx.assertCannotReach(currentState);
     *     }
     *  });
     * @returns An observable which emits the current state data and completes. 
     */
    protected get currentState$(): Observable<CurrentStateInfo<TState, TStateData, TCanLeaveToStatesMap>> {
        return this._stateData$.asObservable().pipe(
            take(1),
            map((stateTransition: StateTransition<TState, TStateData>) => {
                const stateData: StateData<TState, TStateData> = stateTransition.stateData;
                if (!this.isTStateData(stateData)) {
                    return {
                        state: "FSMInit",
                        stateData: stateData,
                        canUpdate: false,
                        canLeaveTo: this.canLeaveToStatesArrays["FSMInit"]
                    } as CurrentStateInfo<TState, TStateData, TCanLeaveToStatesMap>;
                } else {
                    const state: TState = stateData.state;
                    return {
                        state,
                        stateData,
                        canUpdate: true,
                        canLeaveTo: this.canLeaveToStatesArrays[state]
                    } as CurrentStateInfo<TState, TStateData, TCanLeaveToStatesMap>;

                }
            })
        );
    }


    /**
     * @returns An observable which emits the current state data and completes filtering out the state "FSMInit". 
     */
    protected get currentStatePostInit(): Observable<CurrentStateInfo<TState, TStateData, TCanLeaveToStatesMap>> {
        return this.currentState$.pipe(
            filter((currentState: CurrentStateInfo<TState, TStateData, TCanLeaveToStatesMap>) => {
                return currentState.state !== "FSMInit";
            })
        );
    }


    /** 
     * String instructions to draw a state diagram of the finite state machine transitions. 
     * In mermaidJS format
     */
    private _stateDiagramDefinition: string | undefined;

    /**
     * Getter for _stateDiagramDefinitionTemplate
     * @returns String instructions, to draw a diagram of the finite state machines state transitions. 
     * In mermaidJS format
     */
    private get stateDiagramDefinition(): string {
        if (!this._stateDiagramDefinition) {
            this._stateDiagramDefinition = this.generateStateDiagramDefinition(this.resolvedFsmConfig.stateDiagramDirection);
        }
        return this._stateDiagramDefinition;
    }

    /**
     * Setter for _stateDiagramDefinitionTemplate. 
     * As the definition is created during the get it is only possible to set it to undefined. 
     */
    private set stateDiagramDefinition(value: undefined) {
        this._stateDiagramDefinition = value;
    }

    /* istanbul ignore next */
    /**
     * Constructor for FsmRx. 
     * Calls functions to create the fsmDebugConfig and constructs the observables required for the FSM to function. 
     * @param [fsmConfig] An optional partial FsmConfig configuration object that controls the availability of certain debugging features. By default it is set to {}.
     * @param [isInDevMode] An Optional boolean that sets whether the application in running in debug mode or not. By default it is set to the result of checking if process.env.NODE_ENV exists and is set to "development". It is not recommended to set this value outside of testing. 
     */
    public constructor(
        fsmConfig: Partial<FsmConfig<TState, TStateData, TCanLeaveToStatesMap>> = {},
        isInDevMode: boolean = process?.env?.['NODE_ENV'] === "development"
    ) {
        this.resolvedFsmConfig = this.extractFsmConfig(fsmConfig, isInDevMode);
        this._isInDevMode = isInDevMode;
        const stateOverride: StateOverride<TState, TStateData, TCanLeaveToStatesMap> | false = this.resolvedFsmConfig.stateOverride;

        if (stateOverride) {
            this._stateData$ = new BehaviorSubject<StateTransition<TState, TStateData>>({ transitionType: "override", stateData: stateOverride.stateData });
        } else {
            this._stateData$ = new BehaviorSubject<StateTransition<TState, TStateData>>({ transitionType: "init", stateData: { state: "FSMInit" } });
        }

        this.stateTransition$ = new BehaviorSubject<StateTransition<TState, TStateData>>(this._stateData$.value);

        if (this.resolvedFsmConfig.debugLogBufferCount > 0) {
            this._debugLog = [];

            this.writeToDebugLog({
                message: stateOverride ? `override to "${stateOverride.stateData.state}"` : "success",
                result: stateOverride ? "override" : "success",
                timeStamp: Date.now(),
                stateData: this._stateData$.value.stateData,
                transitionType: this._stateData$.value.transitionType
            });
        }

        this.stateTransitionObservable$ = this.createStateTransitionObservable$(this.stateTransition$);
        this.subscribeToStateTransitionObservable$(this.stateTransitionObservable$);

        if (stateOverride !== false && stateOverride.onOverride) {
            // CanLeaveToStatesArrays requires access to the stateMap property but abstract properties cannot be accessed in the constructor.
            // SetTimeout 0 executes the function outside of the constructor. 
            setTimeout(() => {
                this.executeStateOverrideFunction(stateOverride,
                    {
                        state: "FSMInit",
                        stateData: { state: "FSMInit" },
                        canUpdate: false,
                        canLeaveTo: this.canLeaveToStatesArrays["FSMInit"]
                    } as CurrentStateInfo<TState, TStateData, TCanLeaveToStatesMap>
                );
            }, 0);
        }
    }

    /**
     * 
     * Constructs the FsmConfig object by combining the supplied fsmConfig partial with default values.  
     * @param fsmConfig The partial configuration object supplied by the user.
     * @param isInDevMode A boolean which determines whether the application in running in debug mode or not.
     * @returns A whole FSMConfig object constructed by combining the supplied fsmConfig partial with default values.
     */
    protected extractFsmConfig(
        fsmConfig: Partial<FsmConfig<TState, TStateData, TCanLeaveToStatesMap>>,
        isInDevMode: boolean
    ): FsmConfig<TState, TStateData, TCanLeaveToStatesMap> {
        return {
            outputTransitionRejectionToConsole: !isInDevMode ? false : (fsmConfig.outputTransitionRejectionToConsole ?? true),
            filterRepeatUpdates: fsmConfig.filterRepeatUpdates ?? true,
            stateOverride: isInDevMode ? (fsmConfig.stateOverride ?? false) : false,
            debugLogBufferCount: fsmConfig.debugLogBufferCount ?? (isInDevMode ? Infinity : 0),
            stringifyLogTransitionData: fsmConfig.stringifyLogTransitionData ?? (isInDevMode ? false : true),
            recordFilteredUpdatesToDebugLog: fsmConfig.recordFilteredUpdatesToDebugLog ?? false,
            resetDebugLogOnOverride: !isInDevMode ? false : (fsmConfig.resetDebugLogOnOverride ?? true),
            recordResetDataToDebugLog: fsmConfig.recordResetDataToDebugLog ?? (isInDevMode ? true : false),
            stateDiagramDirection: fsmConfig.stateDiagramDirection ?? "TB",
            name: fsmConfig.name ?? false
        };
    }

    /**
     * Process the debug log entry and stores it in the _debugLog.
     * Also makes sure the _debugLog doesn't exceed the debugLogBufferCount specified in the fsmDebugConfig
     * @param entry The debug log entry to store. 
     */
    protected writeToDebugLog(entry: DebugLogEntry<TState, TStateData>): void {
        if (!this._debugLog) { return; }
        if (this.resolvedFsmConfig.stringifyLogTransitionData) { entry.stateData = JSON.stringify(entry.stateData, null, 1); }
        this._debugLog.push(entry);
        this.capDebugLogLength(this.resolvedFsmConfig.debugLogBufferCount);
    }

    /**
     * Caps the maximum value of the _debugLog length to the supplied maxLength
     * @param maxLength The maximum length of the _debugLog
     */
    protected capDebugLogLength(maxLength: number): void {
        /* istanbul ignore next */
        if (!this._debugLog) { return; }
        const itemsToRemove: number = Math.max(this.debugLog.length - maxLength, 0);
        this._debugLog = this._debugLog.slice(itemsToRemove);
    }

    /**
     * Creates an observable pipe from the stateTransition$ behavior subject. 
     * This pipe processes and filters the transitions so only allowed transitions emit white prohibited transitions throw an error. 
     * Transitions are processed by calling either the updateFilter or changeFilter functions. 
     * @param stateTransition$ A Behavior Subject to which all transitions of the finite state machine are applied to for emission. 
     * @returns An observable which emits allowed transitions while throwing error on prohibited transitions. 
     */
    private createStateTransitionObservable$(
        stateTransition$: BehaviorSubject<StateTransition<TState, TStateData>>
    ): Observable<StateTransition<TState, TStateData>> {

        return stateTransition$.asObservable().pipe(
            // Run the pipe as a que. This allows any next calls that result from callback function to be executed after the current pipe has finished. 
            observeOn(queueScheduler),
            // Destroy the observable when next is called on this._destroy$ 
            takeUntil(this.destroy$),
            // Get previous as well as next data  
            withLatestFrom(this._stateData$),
            // Filter prohibited transitions 
            filter(([nextTransitionStateData, previousTransitionStateData]: [StateTransition<TState, TStateData>, StateTransition<TState, TStateData>]) => {
                // This pipe is called when when the behavior subjects are initialized giving a erroneous update where both are FSMInit. Return false when this is the case.
                if (nextTransitionStateData.stateData.state === "FSMInit") { return false; }
                const transitionType: TransitionTypes = nextTransitionStateData.transitionType;
                switch (transitionType) {
                    case "update":
                        return this.updateFilter(previousTransitionStateData, nextTransitionStateData);
                    case "change":
                        return this.changeFilter(previousTransitionStateData, nextTransitionStateData);
                    case "override":
                        return false;
                    // These are here for the assert cannot reach default to function. 
                    // They do not relate to the filter function as they do not operate on live observables but rather create and repair them. 
                    /* istanbul ignore next */
                    case "init":
                        return false;
                    /* istanbul ignore next */
                    case "recover":
                        return false;
                    /* istanbul ignore next */
                    case "reset":
                        return false;
                    /* istanbul ignore next */
                    default:
                        FsmRxInheritable.assertCannotReach(transitionType);
                }
                /* istanbul ignore next */
                return false;
            }),
            // return the next data that passed filtering. 
            map(([nextTransitionStateData, _previousTransitionStateData]: [StateTransition<TState, TStateData>, StateTransition<TState, TStateData>]) => {
                return nextTransitionStateData;
            })
        );
    }

    /**
     * Filter function that stops prohibited update transitions from being emitted via the stateTransition$ behavior subject.
     * Data that fails to meet the update criteria will be filtered while permitted transition data will return true.
     * Any callbacks supplied to the states onLeave lifecycle hook are executed as part of the filter process. 
     * @param previousStateTransition The previous successful transition.
     * @param nextStateTransition The update transition being processed.
     * @returns Whether the data is permitted or prohibited from emitting.
     */
    private updateFilter(
        previousStateTransition: StateTransition<TState, TStateData>,
        nextStateTransition: StateTransition<TState, TStateData>,
    ): boolean {

        if (!this.filterUpdateFSMInit(previousStateTransition)) { return false; }

        if (this.isTStateData(nextStateTransition.stateData)) {

            const previousState: FSMInit | TState = previousStateTransition.stateData.state;
            const nextState: TState = nextStateTransition.stateData.state;
            const nextStateData: TStateData = nextStateTransition.stateData;

            if (!this.filterRepeatedStateUpdates(previousStateTransition, nextStateTransition)) { return false; }
            if (!this.filterUpdateStateMismatch(previousState, nextState)) { return false; }
            const nextStateMetadata: StateMetadata<TState, typeof nextState, TStateData, TCanLeaveToStatesMap> | undefined = this.getStateMetadata(nextState);
            if (!this.executeOnUpdateHookCallback(nextState, nextStateData, nextStateMetadata, previousStateTransition)) { return false; }

            return true;
        }
        /* istanbul ignore next */
        return false;
    }

    /**
     * Checks that update has not been called when in FSMInit state.
     * @param previousStateTransition The previous successful transition.
     * @returns a boolean specifying whether the FSM is currently in its FSMInit state.
     */
    private filterUpdateFSMInit(previousStateTransition: StateTransition<TState, TStateData>): boolean {
        if (!this.isTStateData(previousStateTransition.stateData)) {
            this.handleTransitionRejection(
                {
                    message: `Cannot update when in the "FSMInit" state`,
                    errorSeverity: "warn",
                    rejectReason: "illegal_update_FSMInit",
                    transitionType: "update"
                }
            );
            return false;
        }
        return true;
    }


    /**
     * Tests that the data supplied is of type TStateData not FSMInitStateData.
     * @param data The date being tested. 
     * @returns a boolean indicating whether data is of type TStateData.
     */
    private isTStateData(data: StateData<TState, TStateData>): data is TStateData {
        return data.state !== "FSMInit";
    }

    /**
     * Function called when a transition is rejected. Optionally logs the rejection and calls the onTransitionRejected function.
     * @param transitionRejection data describing the rejected transition.
     */
    private handleTransitionRejection(transitionRejection: TransitionRejection): void {

        if (this.resolvedFsmConfig.outputTransitionRejectionToConsole) {
            this.logTransitionRejectionToConsole(`${transitionRejection.rejectReason}: ${transitionRejection.message}`, transitionRejection.errorSeverity);
        }

        if (transitionRejection.rejectReason === "after_fsm_destroy") {
            this.writeToDebugLog({ result: transitionRejection.rejectReason, stateData: "", transitionType: transitionRejection.transitionType, timeStamp: Date.now(), message: transitionRejection.message });
        } else {
            if (transitionRejection.errorSeverity !== "filtered-update" || this.resolvedFsmConfig.recordFilteredUpdatesToDebugLog === true) {
                const errorTransitionStateData: StateTransition<TState, TStateData> = this.stateTransition$.value;
                this.writeToDebugLog({ result: transitionRejection.rejectReason, stateData: errorTransitionStateData.stateData, transitionType: errorTransitionStateData.transitionType, timeStamp: Date.now(), message: transitionRejection.message });
            }

            if (transitionRejection.errorSeverity !== "filtered-update" && this.resolvedFsmConfig.recordResetDataToDebugLog) {
                const resetData: StateTransition<TState, TStateData> = this._stateData$.value;
                this.writeToDebugLog({ result: "reset", stateData: resetData.stateData, transitionType: "reset", timeStamp: Date.now(), message: `reset to "${resetData.stateData.state}"` });
            }
        }

        this.onTransitionRejected(transitionRejection);

    }

    /**
     * Logs the error to the console based on its severity.  
     * @param error the error to log 
     * @param transitionRejectionSeverity The severity of the rejection. This Determines if and how the error is logged to the console.
     */
    private logTransitionRejectionToConsole(
        error: Error | string,
        transitionRejectionSeverity: TransitionRejectionSeverity
    ): void {

        switch (transitionRejectionSeverity) {
            case "error":
                console.error(error);
                break;
            case "warn":
                console.warn(error);
                break;
            case "filtered-update":
                break;
            /* istanbul ignore next */
            default:
                FsmRxInheritable.assertCannotReach(transitionRejectionSeverity);
        }
    }

    /**
     * Function called when a transition is rejected.
     * This function can be overridden to create custom transition rejection logic for debugging purposes. 
     * It is recommended to include error states in your FSM rather than relying on this function in production.  
     * @param _transitionRejection data describing the rejected transition 
     */
    protected onTransitionRejected(_transitionRejection: TransitionRejection): void { return; }

    /** 
     * Deep compares the previous transition data with the next transition data to determine if they contain the same data.
     * Calls handleTransitionRejection if their data is the same and filterRepeatUpdates in the fsmConfig is set to true.
     * @param previousStateTransition The previous successful transition.
     * @param nextStateTransition The update transition being processed.
     * @returns boolean whether the previousStateTransition and nextStateTransition contain the same data 
     */
    private filterRepeatedStateUpdates(
        previousStateTransition: StateTransition<TState, TStateData>,
        nextStateTransition: StateTransition<TState, TStateData>
    ): boolean {

        if (this.resolvedFsmConfig.filterRepeatUpdates && deepEqual(previousStateTransition.stateData, nextStateTransition.stateData, { strict: true })) {
            this.handleTransitionRejection(
                {
                    message: `repeat update for "${nextStateTransition.stateData.state}" has been filtered out`,
                    errorSeverity: "filtered-update",
                    rejectReason: "repeat_update_filtered",
                    transitionType: "update"
                }
            );
            return false;
        }
        return true;
    }

    /**
     * Compare the previous successful transition state with the state of the next transition to ensure they match. 
     * Calls handleTransitionRejection if they do not match.
     * @param previousState The state of the previous successful transition. 
     * @param nextState The update transition data being processed. 
     * @returns boolean whether the previousState and next nextState values match. 
     */
    private filterUpdateStateMismatch(
        previousState: FSMInit | TState,
        nextState: TState
    ): boolean {
        if (previousState !== nextState) {
            this.handleTransitionRejection(
                {
                    message: `Mismatch when updating state "${nextState}". Data for "${previousState}" state given`,
                    errorSeverity: "warn",
                    rejectReason: "update_state_mismatch",
                    transitionType: "update"
                }
            );
            return false;
        }
        return true;
    }

    /**
     * Gets the metadata of a given state.
     * @param state The state of the metadata to retrieve. 
     * @returns The meta data of the given state. 
     */
    private getStateMetadata(state: TState): StateMetadata<TState, typeof state, TStateData, TCanLeaveToStatesMap> {
        return <unknown>this.stateMap[state] as StateMetadata<TState, typeof state, TStateData, TCanLeaveToStatesMap>;
    }

    /**
     * Executes the onUpdate hook callback and returns the result.
     * Calls handleTransitionRejection if the callback returns false
     * @param updateState The state that is being updated
     * @param updateStateData The data being processed.
     * @param updateStateMetadata The metadata of the state that is being updated. 
     * @param previousStateTransition The previous successful transition.
     * @returns boolean whether the callback returned true/void or false.
     */
    private executeOnUpdateHookCallback(
        updateState: TState,
        updateStateData: TStateData,
        updateStateMetadata: StateMetadata<TState, TState, TStateData, TCanLeaveToStatesMap> | undefined,
        previousStateTransition: StateTransition<TState, TStateData>,
    ): boolean {
        if (this.isTStateData(previousStateTransition.stateData)) {
            if (updateStateMetadata?.onUpdate) {
                const updateResult: boolean | void = updateStateMetadata?.onUpdate.call(
                    this,
                    {
                        hook: "onUpdate",
                        previousInfo: {
                            state: updateState,
                            stateData: previousStateTransition.stateData,
                            canUpdate: true,
                            canLeaveTo: this.canLeaveToStatesArrays[updateState]
                        } as OnUpdateStateTransitionInfo<TState, typeof updateState, TStateData, TCanLeaveToStatesMap>,
                        updateInfo: {
                            state: updateState,
                            stateData: updateStateData,
                            canUpdate: true,
                            canLeaveTo: this.canLeaveToStatesArrays[updateState]
                        } as OnUpdateStateTransitionInfo<TState, typeof updateState, TStateData, TCanLeaveToStatesMap>,
                    }
                );

                if (updateResult === false) {
                    this.handleTransitionRejection(
                        {
                            message: `update function for "${updateState}" returned false`,
                            errorSeverity: "warn",
                            rejectReason: "terminated_by_update_callback",
                            transitionType: "update"
                        }
                    );
                    return false;
                }
            }
        }
        return true;
    }

    /**
     * Filter function that stops prohibited change transitions from being emitted via the stateTransition$ behavior subject.
     * Data that fails to meet the change criteria will be filtered while permitted transition data will return true
     * Any callbacks supplied to the states onLeave or onEnter lifecycle hooks are executed as part of the filter process. 
     * @param previousStateTransition The previous successful transition.
     * @param nextStateTransition The update transition being processed.
     * @returns Weather the data is permitted or prohibited from emitting. 
     */
    private changeFilter(
        previousStateTransition: StateTransition<TState, TStateData>,
        nextStateTransition: StateTransition<TState, TStateData>): boolean {

        const previousState: FSMInit | TState = previousStateTransition.stateData.state;
        const previousStateData: FSMInitStateData | TStateData = previousStateTransition.stateData;

        /* istanbul ignore next */
        if (!this.isTStateData(nextStateTransition.stateData)) {
            this.handleTransitionRejection(
                {
                    message: `Data supplied when changing from "${previousState}" to "${nextStateTransition.stateData.state}" does not conform to TStateData`,
                    errorSeverity: "error",
                    rejectReason: "internal_error",
                    transitionType: "change"
                }
            );
            return false;
        }


        const nextStateData: TStateData = nextStateTransition.stateData;
        const nextState: TState = nextStateData.state;

        if (!this.filterChangeToSameState(previousState, nextState)) { return false; }

        const nextStateMetadata: StateMetadata<TState, typeof nextState, TStateData, TCanLeaveToStatesMap> = this.getStateMetadata(nextState);

        if (this.isTState(previousState) && this.isTStateData(previousStateData)) {
            const previousStateMetadata: StateMetadata<TState, typeof previousState, TStateData, TCanLeaveToStatesMap> = this.getStateMetadata(previousState);
            if (!this.filterChangeToProhibitedState(previousState, nextState, previousStateMetadata)) { return false; }
            this._nextChangeStateTransition$.next({ leavingState: previousState, enteringState: nextState });
            if (!this.executeOnLeaveHookCallback(previousState, nextState, previousStateData, nextStateData, previousStateMetadata)) { return false; }
        } else {
            // This test will return the same result as filterChangeToProhibitedState so is only required if not running that test. 
            if (!this.filterChangeFromProhibitedState(previousState, nextState, nextStateMetadata)) { return false; }
            this._nextChangeStateTransition$.next({ leavingState: previousState, enteringState: nextState });
        }

        if (!this.executeOnEnterHookCallback(previousState, nextState, previousStateData, nextStateData, nextStateMetadata)) { return false; }
        return true;
    }

    /**
     * Filters illegal attempts to change to the current state.
     * Calls handleTransitionRejection if it attempts to change to the current state.
     * @param previousState the name of the previous state.
     * @param nextState the name of the state the FSM is attempting to transition to. 
     * @returns boolean whether the previous and next states are different. 
     */
    private filterChangeToSameState(
        previousState: FSMInit | TState,
        nextState: TState
    ): boolean {
        if (nextState === previousState) {
            this.handleTransitionRejection(
                {
                    message: `Change to State must be different from the current state "${nextState}"`,
                    errorSeverity: "warn",
                    rejectReason: "illegal_change_same_state",
                    transitionType: "change"
                }
            );
            return false;
        }
        return true;
    }

    /**
     * Filters illegal attempts to change from a state that is not on the nextStateMetadata canEnterFromStates whitelist
     * Calls handleTransitionRejection if it is not on the whitelist.
     * @param previousState the name of the previous state.
     * @param nextState the name of the state the FSM is attempting to transition to. 
     * @param nextStateMetadata the metadata of the next state
     * @returns boolean whether or not the previous state can be found in the nextStateMetadata canEnterFromStates whitelist. 
     */
    private filterChangeFromProhibitedState(
        previousState: FSMInit | TState,
        nextState: TState,
        nextStateMetadata: StateMetadata<TState, TState, TStateData, TCanLeaveToStatesMap>

    ): boolean {
        if (!(previousState in nextStateMetadata.canEnterFromStates)) {
            this.handleTransitionRejection(
                {
                    message: `Entering state "${nextState}" from "${previousState}" is not allowed by the "${nextState}" canEnterFromStates whitelist`,
                    errorSeverity: "warn",
                    rejectReason: "not_permitted_to_enter",
                    transitionType: "change"
                }
            );
            return false;
        }
        return true;
    }

    /**
     * Tests the supplied state is of type TState not FSMInit
     * @param state The state being tested
     * @returns a boolean indicating whether the state is of type TState
     */
    private isTState(state: TState | FSMInit): state is TState {
        return state !== "FSMInit" && state !== "FSMTerminating";
    }

    /**
     * Filters illegal attempts to change to from a state that is not on the previousStateMetadata canLeaveToStates whitelist
     * Calls handleTransitionRejection if it is not on the whitelist.
     * @param previousState the name of the previous state.
     * @param nextState the name of the state attempting to transition to. 
     * @param previousStateMetadata the metadata of the previous state
     * @returns boolean whether the previous state can be found in the previousStateMetadata canLeaveToStates whitelist. 
     */
    private filterChangeToProhibitedState(
        previousState: FSMInit | TState,
        nextState: TState,
        previousStateMetadata: StateMetadata<TState, TState, TStateData, TCanLeaveToStatesMap>
    ): boolean {
        if (!(nextState in previousStateMetadata.canLeaveToStates)) {
            this.handleTransitionRejection(
                {
                    message: `Leaving state "${previousState}" to "${nextState}" is not allowed by the "${previousState}" canLeaveToStates whitelist`,
                    errorSeverity: "warn",
                    rejectReason: "not_permitted_to_leave",
                    transitionType: "change"
                }
            );
            return false;
        }
        return true;
    }

    /**
     * Executes the onLeave hook callback and returns the result.
     * Calls handleTransitionRejection if the callback returns false
     * @param previousState the name of the previous state.
     * @param nextState the name of the state the FSM is attempting to transition to. 
     * @param previousStateData the data of the previous state.
     * @param nextStateData the data of the next state.
     * @param previousStateMetadata the metadata of the previous state 
     * @returns boolean whether the callback returned true | void or false.
     */
    private executeOnLeaveHookCallback(
        previousState: TState,
        nextState: TState,
        previousStateData: TStateData,
        nextStateData: TStateData,
        previousStateMetadata: StateMetadata<TState, typeof previousState, TStateData, TCanLeaveToStatesMap>
    ): boolean {

        if (previousStateMetadata.onLeave) {
            const leaveResult: boolean | void = previousStateMetadata.onLeave.call(
                this,
                {
                    hook: "onLeave",
                    leavingStateInfo: {
                        state: previousState,
                        stateData: previousStateData,
                        canUpdate: true,
                        canLeaveTo: this.canLeaveToStatesArrays[previousState]
                    } as OnLeaveLeavingStateInfo<TState, typeof previousState, TStateData, TCanLeaveToStatesMap>,
                    enteringStateInfo: {
                        state: nextState,
                        stateData: nextStateData,
                        canUpdate: true,
                        canLeaveTo: this.canLeaveToStatesArrays[nextState]
                    } as OnLeaveEnteringStateInfo<TState, typeof previousState, TStateData, TCanLeaveToStatesMap>

                }
            );
            if (leaveResult === false) {
                this.handleTransitionRejection(
                    {
                        message: `onLeave function for ${previousState} returned false`,
                        errorSeverity: "warn",
                        rejectReason: "terminated_by_leave_callback",
                        transitionType: "change"
                    }
                );
                return false;
            }
        }
        return true;
    }

    /**
     * Executes the onLeave hook callback and returns the result.
     * Calls handleTransitionRejection if the callback returns false
     * @param previousState the name of the previous state.
     * @param nextState the name of the state the FSM is attempting to transition to. 
     * @param previousStateData the data of the previous state.
     * @param nextStateData the data of the next state.
     * @param nextStateMetadata the metadata of the next state 
     * @returns  boolean whether the callback returned true | void or false.
     */
    private executeOnEnterHookCallback(
        previousState: TState | FSMInit,
        nextState: TState,
        previousStateData: StateData<TState, TStateData>,
        nextStateData: TStateData,
        nextStateMetadata: StateMetadata<TState, typeof nextState, TStateData, TCanLeaveToStatesMap>
    ): boolean {
        if (nextStateMetadata.onEnter) {
            const enterResult: boolean | void = nextStateMetadata.onEnter.call(
                this,
                {
                    hook: "onEnter",
                    leavingStateInfo: {
                        state: previousState,
                        stateData: previousStateData,
                        canUpdate: previousState !== "FSMInit",
                        canLeaveTo: this.canLeaveToStatesArrays[previousState]
                    } as OnEnterLeavingStateInfo<TState, typeof nextState, TStateData, TCanLeaveToStatesMap>,
                    enteringStateInfo: {
                        state: nextState,
                        stateData: nextStateData,
                        canUpdate: true,
                        canLeaveTo: this.canLeaveToStatesArrays[nextState]
                    } as OnEnterEnteringStateInfo<TState, typeof nextState, TStateData, TCanLeaveToStatesMap>

                }

            );
            if (enterResult === false) {
                this.handleTransitionRejection(
                    {
                        message: `onEnter function for "${nextState}" returned false`,
                        errorSeverity: "warn",
                        rejectReason: "terminated_by_enter_callback",
                        transitionType: "change"
                    }
                );
                return false;
            }
        }
        return true;
    }

    /* istanbul ignore next */
    /**
     * A defensive programming technique used to throw errors in the IDE when the application changes, highlighting areas that require updating.
     * @param x a value which should never exist. 
     */
    public static assertCannotReach(x: never): void {
        throw new Error(`Unreachable code detected. ${x}`);
    }

    /**
     * Subscribes to next or error emissions from the stateTransitionObservable$.
     * Next will log the emission and supply it to the _stateData$ behavior subject by calling its next function.
     * Errors will trigger error handling by calling either the handleFSMError or handleUnknownError functions
     * @param stateTransitionObservable$ The observable to subscribe to. 
     */
    private subscribeToStateTransitionObservable$(stateTransitionObservable$: Observable<StateTransition<TState, TStateData>>): void {

        stateTransitionObservable$.subscribe({
            next: ((nextTransitionStateData: StateTransition<TState, TStateData>) => {
                this.writeToDebugLog({ result: "success", stateData: nextTransitionStateData.stateData, transitionType: nextTransitionStateData.transitionType, timeStamp: Date.now(), message: "success" });
                this._stateData$.next(nextTransitionStateData);
            }),
            error: ((error) => {
                this.handleUnknownError(error);
            })
        });
    }

    /**
     * Handles unknown errors caused by an unhandled exception in an onUpdate, onLeave or onEnter hook callback.
     * Will handle logging the error, FSM termination / resetting internal observables and calling the onFSMError hook function.
     * @param e The unknown error.
     */
    private handleUnknownError(e: Error): void {

        const errorStateTransition: StateTransition<TState, TStateData> = this.stateTransition$.value;

        this.logTransitionRejectionToConsole(e, "error");

        this.writeToDebugLog({ result: "unknown_error", stateData: errorStateTransition.stateData, transitionType: errorStateTransition.transitionType, timeStamp: Date.now(), message: e.message });

        this.resetInternalObservables(this._stateData$.value);
        this.onUnknownError(e, errorStateTransition);
    }

    /**
     * Destroy function which completes and unsubscribes from the FSMs observables and behavior subjects.
     */
    protected destroy(): void {

        this._destroy$.next();
        this._destroy$.complete();

        this._stateData$.complete();
        this._stateData$.unsubscribe();

        this.stateTransition$.complete();
        this.stateTransition$.unsubscribe();

        this._override$.complete();
        this._override$.unsubscribe();

        this._nextChangeStateTransition$.complete();
        this._nextChangeStateTransition$.unsubscribe();

    }

    /**
     * Resets the internal observables to the supplied state and resubscribes. 
     * @param resetData The data to start the new observables with. 
     * @param logReset whether to log the reset data or not. 
     */
    private resetInternalObservables(
        resetData: StateTransition<TState, TStateData>,
        logReset: boolean = this.resolvedFsmConfig.recordResetDataToDebugLog
    ): void {

        this.stateTransition$.complete();
        this.stateTransition$.unsubscribe();
        this.stateTransition$ = new BehaviorSubject<StateTransition<TState, TStateData>>({ ...resetData, transitionType: "recover" });

        this.stateTransitionObservable$ = this.createStateTransitionObservable$(this.stateTransition$);
        this.subscribeToStateTransitionObservable$(this.stateTransitionObservable$);
        if (logReset) {
            this.writeToDebugLog({ result: "recover", stateData: resetData.stateData, transitionType: "recover", timeStamp: Date.now(), message: `recover to "${resetData.stateData.state}"` });
        }
    }

    /**
     * Function called when an unknown error is thrown due to an unhandled exception in an onUpdate, onLeave or onEnter hook callback.
     * This function can be overridden to create custom unknown error handling for debugging purposes. 
     * It is recommended to include error states in your FSM rather than relying on this function in production.  
     * @param _e The unknown error.
     * @param _rejectData the data of the transition which caused the error
     */
    protected onUnknownError(_e: Error, _rejectData: StateTransition<TState, TStateData>): void { return; }

    /**
     * 
     * @param stateOverride The state information that is being used to override the current state. 
     * @param originalStateInfo The state information of the current state.
     */
    private executeStateOverrideFunction(
        stateOverride: StateOverride<TState, TStateData, TCanLeaveToStatesMap>,
        originalStateInfo: CurrentStateInfo<TState, TStateData, TCanLeaveToStatesMap>
    ): void {

        const { stateData } = stateOverride;
        const { state } = stateData;

        stateOverride.onOverride?.call(this,
            {
                originalStateInfo,
                overridingStateInfo: {
                    state,
                    stateData,
                    canUpdate: true,
                    canLeaveTo: this.canLeaveToStatesArrays[state]
                } as OverridingStateInfo<TState, TStateData, TCanLeaveToStatesMap>
            }
        );
    }

    /**
     * Generates the string instructions to draw a state diagram of the state transitions.
     * Does this by concatenating the outputs of the generateStateDiagramHead, generateStateDiagramBody and generateStateDiagramClassDefs functions
     * The definition is in mermaidJS format. 
     * @param direction the direction the diagram should be drawn in: top-bottom or Left-right
     * @returns String instructions to draw a state diagram of the finite state machine transitions.
     */
    private generateStateDiagramDefinition(direction: StateDiagramDirections): string {
        return `${this.generateStateDiagramHead(direction)}\n${this.generateStateDiagramBody()}\n${this.generateStateDiagramClassDefs()}`;
    }

    /**
     * Generates the instructions to draw the head section of a state diagram.
     * The definition is in mermaidJS format. Override this function to change the format or add additional features to the whole diagram.  
     * @param direction the direction the diagram should be drawn in: top-bottom or Left-right
     * @returns The instructions to draw the head section of a state diagram.
     */
    protected generateStateDiagramHead(direction: StateDiagramDirections = "TB"): string {
        return `stateDiagram-v2\ndirection ${direction}\n[*] --> FSMInit`;
    }

    /**
     * Generates the instructions to draw the body section of a state diagram.
     * The definition is in mermaidJS format. Override this function to change the order states are processed in. 
     * @returns the instructions to draw the body section of a state diagram.
     */
    private generateStateDiagramBody(): string {
        const states: (TState | FSMInit)[] = Object.keys(this.canLeaveToStatesArrays) as (TState | FSMInit)[];
        return states.reduce((rData: string, state: TState | FSMInit, i: number) => {
            const canLeaveTo = this.canLeaveToStatesArrays[state] as (TState | FSMTerminate)[];
            rData = rData.concat(this.generateStateDiagramTransition(state, canLeaveTo));
            if (i < states.length - 1) {
                rData = rData.concat('\n');
            }
            return rData;
        }, "");
    }

    /**
     * Generates the instructions to draw each node of the state diagram 
     * The definition is in mermaidJS format. Override this function to change how nodes are rendered. 
     * @param state Which state the node being drawn represents. 
     * @param canLeaveTo an array of states the node can leave to. 
     * @returns the instructions to draw a node on the state diagram.
     */
    protected generateStateDiagramTransition(state: TState | FSMInit, canLeaveTo: (TState | FSMTerminate)[]): string {
        return canLeaveTo.reduce((rData: string, transitionToState: string, i: number) => {
            const lineEnd: string = i < canLeaveTo.length - 1 ? `\n` : ``;
            const transitionToString: string = transitionToState !== "FSMTerminate" ? transitionToState : "[*]";
            return rData.concat(`${state} --> ${transitionToString}${lineEnd}`);
        }, "");
    }

    /**
     * Generates the style information for highlighted nodes. 
     * The definition is in mermaidJS format. Override this function to change the look of the highlighted state.
     * @returns the style information for highlighted nodes. 
     */
    protected generateStateDiagramClassDefs(): string {
        return `classDef highlight font-weight:bold,stroke-width:3px,fill:#c6c6f9,stroke:#7d4ce1`;
    }

    /**
     * Gets the string instructions to draw a state diagram of the finite state machine transitions and optionally apply the :::highlight class to the supplied state. 
     * The definition is in mermaidJS format. Override this function to change the format or add additional features.  
     * @param highlightState the state to highlight.
     * @returns the string instructions to draw a state diagram of the finite state machine transitions.
     */
    protected getStateDiagramDefinition(highlightState: TState | FSMInit | undefined = undefined): string {
        let diagramDefinition = this.stateDiagramDefinition;
        if (highlightState) {
            const regex = new RegExp(`^\\s*${highlightState}\\b`, 'gm');
            diagramDefinition = diagramDefinition.replace(regex, `${highlightState}:::highlight`);
        }
        return diagramDefinition;
    }

    /**
     * Clears the state diagram definition. 
     */
    protected clearStateDiagramDefinition(): void {
        this.stateDiagramDefinition = undefined;
    }

    /* istanbul ignore next */
    /**
     * Overrides the current state. For use in devMode debugging only. 
     * @param stateOverride The data to start the new observables with. 
     * @param isResetDebugLog If overriding should reset the debug log. 
     */
    protected overrideCurrentState(
        stateOverride: StateOverride<TState, TStateData, TCanLeaveToStatesMap>,
        isResetDebugLog: boolean = true
    ): void {
        if (!this.isInDevMode) {
            this.handleTransitionRejection({
                errorSeverity: "warn",
                message: "Override Current State can only be used in dev mode",
                rejectReason: "override_in_production",
                transitionType: "override"
            });
            return;
        }

        this._override$.next();

        this.currentState$.subscribe((currentStateInfo: CurrentStateInfo<TState, TStateData, TCanLeaveToStatesMap>) => {
            const overrideTransitionData: StateTransition<TState, TStateData> = { transitionType: "override", stateData: stateOverride.stateData };
            this.resetInternalObservables(overrideTransitionData, false);
            if (isResetDebugLog) {
                this.capDebugLogLength(0);
            }
            this.writeToDebugLog({ result: "override", stateData: overrideTransitionData.stateData, transitionType: overrideTransitionData.transitionType, timeStamp: Date.now(), message: `override to "${overrideTransitionData.stateData.state}"` });
            this._stateData$.next(overrideTransitionData);

            if (stateOverride.onOverride) {
                this.executeStateOverrideFunction(stateOverride, currentStateInfo);
            }

        });

    }

    /**
     * Updates the values of the current state.
     * If successful the stateData$ will emit the updated data
     * Otherwise the transition will be rejected and the reason may be logged depending on the supplied FsmDebugConfig.
     * The reasons for rejection are:
     * - Attempting to update the FSMInit state. 
     * - Attempting to update a state with data that does not match the current state.
     * - OnUpdate callback returned false 
     * - An unhandled unknown error thrown in the OnUpdate callback. 
     * @param stateData the data being updating to. 
     * @example
     *  this.currentState$.subscribe((currentStateInfo: CurrentStateInfo<States, StateData, CanLeaveToMap>) => {
     *      const { state, stateData } = currentStateInfo;
     *      if (state === "foo") {
     *          const { fooProperty } = stateData;
     *          this.updateState({
     *              ...stateData,
     *              fooProperty: fooProperty + 1
     *          });
     *      }
     *  });
     */
    protected updateState(stateData: TStateData): void {
        if (this.stateTransition$.closed) {
            this.handleTransitionRejection({
                errorSeverity: "warn",
                rejectReason: "after_fsm_destroy",
                transitionType: "update",
                message: "Attempted to call updateState after destroy was called"
            });
            return;
        }
        this.stateTransition$.next({
            transitionType: "update",
            stateData
        });
    }

    /**
     * Changes the state from one state to another.
     * If successful the stateData$ will emit the new state
     * Otherwise the transition will be rejected and the reason may be logged depending on the fsmDebugConfig.
     * The reasons for rejection are: 
     * - Not being permitted to leave to the next state by the previous states canLeaveToStates property.
     * - Not being permitted to enter from the previous state by the next states canEnterFromStates property.
     * - The previous states onLeave callback returned false.
     * - The next states onEnter callback returned false.
     * - An unhandled unknown error thrown in either the OnLeave or OnEnter callbacks. 
     * @template TCurrentState the state the FSM is currently in. Provides intellisense on which states the FSM can leave to.
     * @param stateData the data of the state the FSM is attempting to change to.
     * @example 
     *  this.currentState$.subscribe((currentStateInfo: CurrentStateInfo<States, StateData, CanLeaveToMap>) => {
     *      const { state, canLeaveTo } = currentStateInfo;
     *      if (state === "foo" && canLeaveTo.includes("bar")) {
     *          this.changeState<"foo">({
     *              state: "bar",
     *              commonProperty: "some-string",
     *              barProperty: "some-other-string"
     *          });
     *      }
     *  });
     */
    protected changeState<TCurrentState extends (TState | FSMInit) = TState | FSMInit>(
        stateData: TCurrentState extends (TState | FSMInit) ? ChangeStateData<TState, TCurrentState, TStateData, TCanLeaveToStatesMap> : TStateData
    ): void {
        if (this.stateTransition$.closed) {
            this.handleTransitionRejection({
                errorSeverity: "warn",
                rejectReason: "after_fsm_destroy",
                transitionType: "change",
                message: "Attempted to call changeState after destroy was called"
            });
            return;
        }
        this.stateTransition$.next({
            transitionType: "change",
            stateData: stateData as TStateData
        });
    }

}
