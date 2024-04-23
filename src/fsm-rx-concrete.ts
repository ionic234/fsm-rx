import { FsmRx } from ".";
import { BaseStateData, CanLeaveToStatesMap, FsmConfig, StateMap } from "./fsm-rx-types";

/**
 * FsmRx Concrete version 
 */
export class FsmRxConcrete<
    TState extends string,
    TStateData extends BaseStateData<TState>,
    TCanLeaveToStatesMap extends CanLeaveToStatesMap<TState>> extends FsmRx<TState, TStateData, TCanLeaveToStatesMap> {

    protected stateMap: StateMap<TState, TStateData, TCanLeaveToStatesMap>;

    /**
     * 
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

}
