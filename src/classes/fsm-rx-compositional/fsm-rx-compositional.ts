import { Observable } from "rxjs";
import { FsmRxInheritable } from "../..";
import { BaseStateData, CanLeaveToStatesMap, FsmConfig, StateMap, ChangeStateData, FSMInit, TransitionStates } from "../../types/fsm-rx-types";

/**
 * FsmRx Concrete version 
 */
export class FsmRxCompositional<
    TState extends string,
    TStateData extends BaseStateData<TState>,
    TCanLeaveToStatesMap extends CanLeaveToStatesMap<TState>> extends FsmRxInheritable<TState, TStateData, TCanLeaveToStatesMap> {

    /**
     * stuff
     */
    protected override readonly stateMap: StateMap<TState, TStateData, TCanLeaveToStatesMap>;

    /**
     * fdfd
     * @returns gdkljg
     */
    public override get destroy$(): Observable<void> {
        return super.destroy$;
    }

    /**
     * jkhfd
     * @returns gdjkgd
     */
    public override get override$(): Observable<void> {
        return super.override$;
    }

    /**
     * Getter for _nextChangeStateTransition$
     * @returns _nextChangeStateTransition$ as an Observable<TransitionStates<TState>>
     */
    public override get nextChangeStateTransition(): Observable<TransitionStates<TState>> {
        return super.nextChangeStateTransition;
    }

    /**
     * gkj
     * @returns gffdgd
     */
    public override get isInDevMode(): boolean {
        return super.isInDevMode;
    }

    declare public resolvedFsmConfig: FsmConfig<TState, TStateData, TCanLeaveToStatesMap>;

    /**
     * fefefe
     * @param stateMap fdf
     * @param fsmConfig  fd
     * @param isInDevMode fdfd
     */
    public constructor(
        stateMap: StateMap<TState, TStateData, TCanLeaveToStatesMap>,
        fsmConfig: Partial<FsmConfig<TState, TStateData, TCanLeaveToStatesMap>> = {},
        isInDevMode: boolean = process?.env?.['NODE_ENV'] === "development"
    ) {
        super(fsmConfig, isInDevMode);
        this.stateMap = stateMap;
    }

    /**
     * dude 
     * @param stateData ddgdg
     */
    public override changeState<TCurrentState extends (TState | FSMInit) = TState | FSMInit>(
        stateData: TCurrentState extends (TState | FSMInit) ? ChangeStateData<TState, TCurrentState, TStateData, TCanLeaveToStatesMap> : TStateData
    ): void {
        super.changeState(stateData);
    }

    /**
     * fdfd
     * @param stateData fdfd
     */
    public override updateState(stateData: TStateData): void {
        super.updateState(stateData);
    }

    /**
     * fdfd
     * @param maxLength vdfgd
     * @returns fdfd 
     */
    public override capDebugLogLength(maxLength: number): void {
        return super.capDebugLogLength(maxLength);
    }

    /**
     * fdf
     */
    public override clearStateDiagramDefinition(): void {
        super.clearStateDiagramDefinition();
    }


    /**
     * ffd
     */
    public override destroy(): void {
        super.destroy();
    }


}
