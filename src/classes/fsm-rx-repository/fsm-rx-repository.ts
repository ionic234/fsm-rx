import { BaseStateData, FSMInitStateData, StateData } from "../../fsm-rx-types";
import { BehaviorSubject, Observable, Subject, catchError, debounceTime, filter, of, switchMap, take, takeUntil, timeout } from "rxjs";

/**
 * meee
 */
type FsmRxRepositoryStore = {
    [key: string]: Observable<BaseStateData<string> | FSMInitStateData>;
};

/**
 * fdfdf
 */
export class FsmRxRepository {
    private _fsmRxRepositoryStore$: BehaviorSubject<FsmRxRepositoryStore> = new BehaviorSubject({});

    /**
     * fdfd
     * @param fsmName dfdf
     * @param stateData$ fdfd
     * @param destroy$ fdf
     * @returns fdf
     */
    public addFsmData<
        TState extends string,
        TStateData extends BaseStateData<TState>
    >(
        fsmName: string,
        stateData$: Observable<StateData<TState, TStateData>>,
        destroy$: Subject<void>
    ): boolean {
        const currentStore: FsmRxRepositoryStore = { ...this._fsmRxRepositoryStore$.value };

        if (Object.prototype.hasOwnProperty.call(currentStore, "fsmName")) {
            console.error(`A FSM called ${fsmName} already exists in the FsmRxRepository and therefore cannot be added.`);
            return false;
        }

        stateData$.pipe(takeUntil(destroy$)).subscribe({
            complete: () => { this.removeFsmData(fsmName); }
        });
        currentStore[fsmName] = stateData$;
        this._fsmRxRepositoryStore$.next(currentStore);
        return true;
    }

    /**
     * fdfdfd
     * @param fsmName fdfdf
     */
    private removeFsmData(fsmName: string): void {
        const currentStore: FsmRxRepositoryStore = { ...this._fsmRxRepositoryStore$.value };
        if (Object.prototype.hasOwnProperty.call(currentStore, "fsmName")) {
            delete currentStore[fsmName];
            this._fsmRxRepositoryStore$.next(currentStore);
        }
    }

    /**
     * dsdsd
     * @param fsmName dsdsd
     * @param destroy$ dsds
     * @param timeoutDuration dsdsd
     * @returns dsds
     */
    public getFsmStateData$<
        TState extends string,
        TStateData extends BaseStateData<TState>
    >(fsmName: string, destroy$: Subject<void>, timeoutDuration: number = 0): Observable<StateData<TState, TStateData> | undefined> {

        let stateData$: Observable<FsmRxRepositoryStore | undefined> = this._fsmRxRepositoryStore$.pipe(
            debounceTime(0),
            takeUntil(destroy$),
            filter((fsmRxRepositoryStore: FsmRxRepositoryStore) => { return Object.prototype.hasOwnProperty.call(fsmRxRepositoryStore, "fsmName"); }),
            take(1),
        );

        if (timeoutDuration >= 0) {
            stateData$ = stateData$.pipe(
                timeout(timeoutDuration),
                catchError(() => {
                    return of(undefined);
                })
            );
        }

        return stateData$.pipe(
            switchMap((fsmRxRepositoryStore: FsmRxRepositoryStore | undefined) => {
                if (!fsmRxRepositoryStore) { return of(undefined); }
                return fsmRxRepositoryStore[fsmName] as Observable<StateData<TState, TStateData>>;
            }));
    }
}
