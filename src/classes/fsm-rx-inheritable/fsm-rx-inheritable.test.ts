import { Observable, Subject } from "rxjs";
import { RunHelpers, TestScheduler } from 'rxjs/testing';
import { FsmRxInheritable } from "../..";
import { BaseStateData, CanLeaveToStatesMap, CurrentStateInfo, DebugLogEntry, FSMInit, FSMInitStateData, FSMTerminate, FsmConfig, OnEnterStateChanges, OnLeaveStateChanges, OnOverrideStateChanges, OnUpdateStateChanges, StateDiagramDirections, StateMap, StateOverride, StateTransition, TransitionRejection } from '../../types/fsm-rx-types';

type TestStatesA = "state1" | "state2";
type TestStatesB = "state2" | "state3";
type TestStates = TestStatesA | TestStatesB;

interface BaseTestData extends BaseStateData<TestStates> {
  testNumber: number;
}

interface TestData1 extends BaseTestData {
  state: "state1",
  myNumber: 100;
}

interface TestData2 extends BaseTestData {
  state: "state2",
  myString: "myData";
}

interface TestData3 extends BaseTestData {
  state: "state3",
  myBoolean: false;
}

type TestData = TestData1 | TestData2 | TestData3;

interface TestCanLeaveToStatesMap extends CanLeaveToStatesMap<TestStates> {
  FSMInit: "state1",
  state1: "state2",
  state2: "state3",
  state3: "FSMTerminate";
}

describe('FsmRx Initialization', () => {

  class TestFSM extends FsmRxInheritable<
    TestStates,
    BaseStateData<TestStates>,
    TestCanLeaveToStatesMap
  > {
    protected override stateMap: StateMap<TestStates, BaseStateData<TestStates>, TestCanLeaveToStatesMap> = {
      state1: {
        canLeaveToStates: { state2: true },
        canEnterFromStates: { FSMInit: true }
      },
      state2: {
        canLeaveToStates: { state3: true },
        canEnterFromStates: { state1: true }
      },
      state3: {
        canLeaveToStates: { FSMTerminate: true },
        canEnterFromStates: { state2: true }
      }
    };

    public constructor() {
      super({}, true);
    }

    public override get stateData$(): Observable<BaseStateData<TestStates> | FSMInitStateData> {
      return super.stateData$;
    }

    public override get currentState$(): Observable<CurrentStateInfo<TestStates, BaseStateData<TestStates>, TestCanLeaveToStatesMap>> {
      return super.currentState$;
    }

    public override updateState(transitionData: BaseStateData<TestStates>): void {
      super.updateState(transitionData);
    }

    public override changeState(transitionData: BaseStateData<TestStates>): void {
      super.changeState(transitionData);
    }

  }

  let testScheduler: TestScheduler;
  let testFSM: TestFSM;

  beforeEach(() => {
    testFSM = new TestFSM();
    testScheduler = new TestScheduler((actual, expected) => {
      expect(actual).toEqual(expected);
    });
  });

  it('Should create an instance', () => {
    expect(testFSM).toBeTruthy();
  });

  it('Should initially be set to FSMInit', () => {
    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('a', {
        a: { state: 'FSMInit' }
      });
    });
  });

  it("currentState$ Should return FSMInit info and complete when called before changeState", () => {
    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.currentState$).toBe('(a|)', {
        a: {
          state: "FSMInit",
          stateData: { state: "FSMInit" },
          canUpdate: false,
          canLeaveTo: ["state1"]
        }
      });
    });
  });

  it("currentState$ Should return the current state and complete when called after changeState", () => {
    testScheduler.schedule(() => { testFSM.changeState({ state: "state1" }); }, 1);
    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      testScheduler.flush();
      expectObservable(testFSM.currentState$).toBe('-(a|)', {
        a: {
          state: "state1",
          stateData: { state: "state1" },
          canUpdate: true,
          canLeaveTo: ["state2"]
        }
      });
    });
  });

});

describe('FsmRx Update Tests', () => {

  let updateState1Spy: jest.Mock<boolean | void, [changes: OnUpdateStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>]>;

  class TestFSM extends FsmRxInheritable<
    TestStates,
    TestData,
    TestCanLeaveToStatesMap
  > {

    public override stateMap: StateMap<TestStates, TestData, TestCanLeaveToStatesMap> = {
      state1: {
        canEnterFromStates: { FSMInit: true },
        canLeaveToStates: { state2: true },
        onUpdate: updateState1Spy
      },
      state2: {
        canEnterFromStates: { state1: true },
        canLeaveToStates: { state3: true }
      },
      state3: {
        canEnterFromStates: { state2: true },
        canLeaveToStates: { FSMTerminate: true }
      }
    };

    public constructor() {
      super({}, true);
    }
    public override get stateData$(): Observable<TestData | FSMInitStateData> {
      return super.stateData$;
    }

    public override updateState(transitionData: TestData): void {
      super.updateState(transitionData);
    }

    public override changeState(transitionData: TestData): void {
      super.changeState(transitionData);
    }

    public override onTransitionRejected(transitionRejection: TransitionRejection): void { super.onTransitionRejected(transitionRejection); }

    public override onUnknownError(e: Error, rejectData: StateTransition<TestStates, TestData>): void { super.onUnknownError(e, rejectData); }

  }

  let testScheduler: TestScheduler;
  let testFSM: TestFSM;
  let consoleWarnSpy: jest.SpyInstance<void, [message?: any, ...optionalParams: any[]], any>;

  beforeEach(() => {
    testFSM = new TestFSM();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    testScheduler = new TestScheduler((actual, expected) => {
      expect(actual).toEqual(expected);
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('Should not emit, due to errors, when attempting to update the FSMInit State', () => {
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('a', {
        a: { state: 'FSMInit' },
      });
    });
  });

  it('Should log a warning when attempting to update the FSMInit State', () => {
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("-|").subscribe({
        complete: () => {
          expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
          expect(consoleWarnSpy).toHaveBeenCalledWith(`illegal_update_FSMInit: Cannot update when in the "FSMInit" state`);
        }
      });
    });

  });

  it("Should call onTransitionRejected hook when a transition is rejected while attempting to update the FSMInit State", () => {
    jest.spyOn(testFSM, 'onTransitionRejected');
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("-|").subscribe({
        complete: () => {
          expect(testFSM.onTransitionRejected).toHaveBeenCalledTimes(1);
          expect(testFSM.onTransitionRejected).toHaveBeenCalledWith(expect.objectContaining({
            message: `Cannot update when in the "FSMInit" state`,
            errorSeverity: "warn",
            rejectReason: "illegal_update_FSMInit",
          }));
        }
      });
    });
  });

  it("Should execute any valid updateState calls made in the onTransitionRejected hook", () => {
    let isTriggerError: boolean = true;
    updateState1Spy = jest.fn((_changes: OnUpdateStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => {
      if (isTriggerError) {
        isTriggerError = false;
        return false;
      }
      return true;
    });

    testFSM = new TestFSM();

    jest.spyOn(testFSM, 'onTransitionRejected').mockImplementation(() => {
      testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 2 });
    });

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('abc', {
        a: { state: "FSMInit" },
        b: { state: "state1", myNumber: 100, testNumber: 0 },
        c: { state: "state1", myNumber: 100, testNumber: 2 }
      });
    });
  });

  it("Should execute any valid changeState calls made in the onTransitionRejected hook ", () => {

    jest.spyOn(testFSM, 'onTransitionRejected').mockImplementation(() => {
      testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 1 });
    });

    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 1 },
      });
    });
  });

  it("Should recover when a transition that attempts to update the FSMInitState is rejected", () => {

    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('a-b', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 0 },
      });
    });

  });

  it('Should not call the on update function when an error is caused by attempting to update the FSMInitState', () => {

    updateState1Spy = jest.fn((_changes: OnUpdateStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { });

    testFSM = new TestFSM();
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(updateState1Spy).not.toHaveBeenCalled();
        }
      });
    });

  });

  it("Should successfully update and emit an allowed state with data of the same state", () => {

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('abc', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 0 },
        c: { state: "state1", myNumber: 100, testNumber: 1 }
      });
    });
  });

  it("Should call the onUpdate function when a state is successfully updated", () => {

    updateState1Spy = jest.fn((_changes: OnUpdateStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { });
    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {

          expect(updateState1Spy).toHaveBeenCalledTimes(1);
          expect(updateState1Spy).toHaveBeenCalledWith({
            hook: "onUpdate",
            previousInfo: {
              state: 'state1',
              stateData: { state: 'state1', myNumber: 100, testNumber: 0 },
              canUpdate: true, canLeaveTo: ['state2']
            },
            updateInfo: {
              state: 'state1',
              stateData: { state: 'state1', myNumber: 100, testNumber: 1 },
              canUpdate: true,
              canLeaveTo: ['state2']
            }
          });
        }
      });
    });
  });

  it("Should execute updateState calls made in the onUpdate function after the current update pipe has finished ", () => {

    updateState1Spy = jest.fn((_changes: OnUpdateStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => {
      testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 2 });
    });

    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab(cd)', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 0 },
        c: { state: "state1", myNumber: 100, testNumber: 1 },
        d: { state: 'state1', myNumber: 100, testNumber: 2 }
      });
    });

  });

  it("Should execute changeState calls made in the onUpdate function after the current update pipe has finished ", () => {
    updateState1Spy = jest.fn((_changes: OnUpdateStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => {
      testFSM.changeState({ state: "state2", myString: "myData", testNumber: 2 });
    });
    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab(cd)', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 0 },
        c: { state: "state1", myNumber: 100, testNumber: 1 },
        d: { state: 'state2', myString: "myData", testNumber: 2 }
      });
    });

  });

  it("Should not emit when the onUpdate function returns false", () => {
    updateState1Spy = jest.fn((_changes: OnUpdateStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { return false; });
    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 0 },
      });
    });
  });

  it("Should log a warning when the onUpdate returns false", () => {

    updateState1Spy = jest.fn((_changes: OnUpdateStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { return false; });
    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
          expect(consoleWarnSpy).toHaveBeenCalledWith(`terminated_by_update_callback: update function for "state1" returned false`);
        }
      });
    });
  });

  it("Should execute updateState calls made in the onUpdate function after the current update pipe has finished ", () => {

    let isTriggerRejection: boolean = true;

    updateState1Spy = jest.fn((_changes: OnUpdateStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => {
      if (isTriggerRejection) {
        isTriggerRejection = false;
        testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 2 });
        return false;
      }
      return true;
    });
    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('abc', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 0 },
        c: { state: 'state1', myNumber: 100, testNumber: 2 }
      });
    });

  });

  it("Should execute updateState calls made in the onUpdate function after the current update pipe has finished ", () => {

    let isTriggerRejection: boolean = true;

    updateState1Spy = jest.fn((_changes: OnUpdateStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => {
      if (isTriggerRejection) {
        isTriggerRejection = false;
        testFSM.changeState({ state: "state2", myString: "myData", testNumber: 2 });
        return false;
      }
      return true;
    });

    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('abc', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 0 },
        c: { state: 'state2', myString: "myData", testNumber: 2 }
      });
    });

  });

  it("Should call onTransitionRejected hook when a transition is rejected by the onUpdate function returning false", () => {

    updateState1Spy = jest.fn((_changes: OnUpdateStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { return false; });
    testFSM = new TestFSM();
    jest.spyOn(testFSM, 'onTransitionRejected');

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(testFSM.onTransitionRejected).toHaveBeenCalledTimes(1);
          expect(testFSM.onTransitionRejected).toHaveBeenCalledWith(expect.objectContaining({
            message: `update function for "state1" returned false`,
            errorSeverity: "warn",
            rejectReason: "terminated_by_update_callback",
          }));
        }
      });
    });
  });

  it("Should recover from the transition being rejected by the onUpdate function returns false", () => {

    updateState1Spy = jest.fn((_changes: OnUpdateStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => {
      return false;
    });
    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 2);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state2", myString: "myData", testNumber: 2 }); }, 3);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab-c', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 0 },
        c: { state: "state2", myString: "myData", testNumber: 2 }
      });
    });
  });

  it("Should log the error when an unknown error is thrown in the onUpdate function", () => {

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    const testError: Error = new Error("test error");
    updateState1Spy = jest.fn((_changes: OnUpdateStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { throw testError; });
    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
          expect(consoleErrorSpy).toHaveBeenCalledWith(testError);
        }
      });
    });
  });

  it("Should not emit when an unknown error is thrown in the onUpdate function", () => {

    jest.spyOn(console, 'error').mockImplementation();
    const testError: Error = new Error("test error");
    updateState1Spy = jest.fn((_changes: OnUpdateStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { throw testError; });
    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 0 },
      });
    });
  });

  it("Should call onUnknownError hook when an unknown error is thrown in the onUpdate function", () => {

    jest.spyOn(console, 'error').mockImplementation();
    const testError: Error = new Error("test error");
    updateState1Spy = jest.fn((_changes: OnUpdateStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { throw testError; });
    testFSM = new TestFSM();
    jest.spyOn(testFSM, 'onUnknownError');

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(testFSM.onUnknownError).toHaveBeenCalledTimes(1);
          expect(testFSM.onUnknownError).toHaveBeenCalledWith(testError, { stateData: { state: "state1", myNumber: 100, testNumber: 1 }, transitionType: "update" });
        }
      });
    });
  });

  it("Should execute updateState calls made in the onUnknownError function after the current update pipe has finished  ", () => {
    const testError: Error = new Error("test error");
    let isTriggerError: boolean = true;

    updateState1Spy = jest.fn((_changes: OnUpdateStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => {
      if (isTriggerError) {
        isTriggerError = false;
        throw testError;
      }
      return true;
    });

    testFSM = new TestFSM();

    jest.spyOn(testFSM, 'onUnknownError').mockImplementation(() => {
      testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 2 });
    });

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('abc', {
        a: { state: "FSMInit" },
        b: { state: "state1", myNumber: 100, testNumber: 0 },
        c: { state: "state1", myNumber: 100, testNumber: 2 }
      });
    });
  });

  it("Should execute updateState calls made in the onUnknownError function after the current update pipe has finished  ", () => {
    const testError: Error = new Error("test error");

    updateState1Spy = jest.fn((_changes: OnUpdateStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => {
      throw testError;
    });

    testFSM = new TestFSM();

    jest.spyOn(testFSM, 'onUnknownError').mockImplementation(() => {
      testFSM.changeState({ state: "state2", myString: "myData", testNumber: 2 });
    });

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('abc', {
        a: { state: "FSMInit" },
        b: { state: "state1", myNumber: 100, testNumber: 0 },
        c: { state: "state2", myString: "myData", testNumber: 2 }
      });
    });

  });

  it("Should recover from unknown errors thrown in the onUpdate function", () => {
    const testError: Error = new Error("test error");
    updateState1Spy = jest.fn((_changes: OnUpdateStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => {
      throw testError;
    });

    testFSM = new TestFSM();
    jest.spyOn(console, 'error').mockImplementation();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 2);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state2", myString: "myData", testNumber: 2 }); }, 3);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab-c', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 0 },
        c: { state: "state2", myString: "myData", testNumber: 2 }
      });
    });

  });

  it("Should not emit when updating a state with the same data due to filterRepeatUpdates", () => {

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 2);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 3);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab--', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 0 },
      });
    });
  });

  it("Should not emit anything when attempting to update a state with data of a different state", () => {

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state2", myString: "myData", testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 0 }
      });
    });
  });

  it('Should log a warning when attempting to update a state with data of a different state', () => {

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state2", myString: "myData", testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
          expect(consoleWarnSpy).toHaveBeenCalledWith('update_state_mismatch: Mismatch when updating state "state2". Data for "state1" state given');
        }
      });
    });
  });

  it("Should not call the update function when attempting to update a state with data of a different state", () => {

    updateState1Spy = jest.fn((_changes: OnUpdateStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { });
    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state2", myString: "myData", testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(updateState1Spy).not.toHaveBeenCalled();
        }
      });
    });
  });

});

describe('FsmRx Change Tests', () => {

  let onEnterState1Spy: jest.Mock<boolean | void, [changes: OnEnterStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>]>;
  let onEnterState2Spy: jest.Mock<boolean | void, [changes: OnEnterStateChanges<TestStates, "state2", TestData, TestCanLeaveToStatesMap>]>;
  let onEnterState3Spy: jest.Mock<boolean | void, [changes: OnEnterStateChanges<TestStates, "state3", TestData, TestCanLeaveToStatesMap>]>;

  let onLeaveState1Spy: jest.Mock<boolean | void, [changes: OnLeaveStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>]>;
  let onLeaveState3Spy: jest.Mock<boolean | void, [changes: OnLeaveStateChanges<TestStates, "state3", TestData, TestCanLeaveToStatesMap>]>;

  class TestFSM extends FsmRxInheritable<
    TestStates,
    TestData,
    TestCanLeaveToStatesMap
  > {
    protected override stateMap: StateMap<TestStates, TestData, TestCanLeaveToStatesMap> = {
      state1: {
        canEnterFromStates: { FSMInit: true },
        canLeaveToStates: { state2: true },
        onEnter: onEnterState1Spy,
        onLeave: onLeaveState1Spy
      },
      state2: {
        canEnterFromStates: { state1: true },
        canLeaveToStates: { state3: true },
        onEnter: onEnterState2Spy
      },
      state3: {
        canEnterFromStates: { state2: true },
        canLeaveToStates: { FSMTerminate: true },
        onEnter: onEnterState3Spy,
        onLeave: onLeaveState3Spy
      }

    };

    public constructor(userConfig: Partial<FsmConfig<TestStates, TestData, TestCanLeaveToStatesMap>> = {}) {
      super(userConfig, true);
    }

    public override get stateData$(): Observable<TestData | FSMInitStateData> {
      return super.stateData$;
    }

    public override get currentState$(): Observable<CurrentStateInfo<TestStates, TestData, TestCanLeaveToStatesMap>> {
      return super.currentState$;
    }

    public override updateState(transitionData: TestData): void {
      super.updateState(transitionData);
    }

    public override changeState(transitionData: TestData): void {
      super.changeState(transitionData);
    }

    public override onTransitionRejected(transitionRejection: TransitionRejection): void { super.onTransitionRejected(transitionRejection); }

    public override onUnknownError(e: Error, rejectData: StateTransition<TestStates, TestData>): void { super.onUnknownError(e, rejectData); }

    public override nextChangeStateTransition$: Subject<void> = new Subject();
  }

  let testScheduler: TestScheduler;
  let testFSM: TestFSM;
  let consoleWarnSpy: jest.SpyInstance<void, [message?: any, ...optionalParams: any[]], any>;

  beforeEach(() => {
    testFSM = new TestFSM();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    testScheduler = new TestScheduler((actual, expected) => {
      expect(actual).toEqual(expected);
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('Should successfully transition to an allowed state', () => {
    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab', {
        a: { state: 'FSMInit' },
        b: { state: 'state1', myNumber: 100, testNumber: 0 }
      });
    });
  });

  it("should trigger nextStateTransition$ when transitioning to an allowed state", () => {

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.nextChangeStateTransition$).toBe('-a', {
        a: undefined
      });
    });
  });

  it('Should call the supplied onEnterFunction when transitioning to an allowed state', () => {

    onEnterState1Spy = jest.fn((_changes: OnEnterStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { });

    testFSM = new TestFSM();
    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("-|").subscribe({
        complete: () => {

          expect(onEnterState1Spy).toHaveBeenCalledTimes(1);
          expect(onEnterState1Spy).toHaveBeenCalledWith({
            hook: 'onEnter',
            leavingStateInfo: {
              state: 'FSMInit',
              stateData: { state: 'FSMInit' },
              canUpdate: false,
              canLeaveTo: ['state1']
            },
            enteringStateInfo: {
              state: 'state1',
              stateData: { state: 'state1', myNumber: 100, testNumber: 0 },
              canUpdate: true,
              canLeaveTo: ['state2']
            }
          });
        }
      });
    });
  });

  it('Should execute updateState calls made in the onEnter function after the current update pipe has finished', () => {
    onEnterState1Spy = jest.fn((_changes: OnEnterStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => {
      testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 1 });
    });
    testFSM = new TestFSM();
    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('a(bc)', {
        a: { state: 'FSMInit' },
        b: { state: 'state1', myNumber: 100, testNumber: 0 },
        c: { state: "state1", myNumber: 100, testNumber: 1 }
      });
    });
  });

  it('Should execute changeState calls made in the onEnter function after the current update pipe has finished', () => {
    onEnterState1Spy = jest.fn((_changes: OnEnterStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => {
      testFSM.changeState({ state: "state2", myString: "myData", testNumber: 1 });
    });
    testFSM = new TestFSM();
    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('a(bc)', {
        a: { state: 'FSMInit' },
        b: { state: 'state1', myNumber: 100, testNumber: 0 },
        c: { state: "state2", myString: "myData", testNumber: 1 }
      });
    });
  });

  it('Should call the supplied onLeaveFunction when transitioning to an allowed state', () => {

    onLeaveState1Spy = jest.fn((_changes: OnLeaveStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { });
    testFSM = new TestFSM();
    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state2", myString: "myData", testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(onLeaveState1Spy).toHaveBeenCalledTimes(1);
          expect(onLeaveState1Spy).toHaveBeenCalledWith({
            hook: 'onLeave',
            leavingStateInfo: {
              state: 'state1',
              stateData: { state: 'state1', myNumber: 100, testNumber: 0 },
              canUpdate: true,
              canLeaveTo: ['state2']
            },
            enteringStateInfo: {
              state: 'state2',
              stateData: { state: 'state2', myString: 'myData', testNumber: 1 },
              canUpdate: true,
              canLeaveTo: ['state3']
            }
          });
        }
      });
    });
  });

  it('Should execute updateState calls made in the onLeave function after the current update pipe has finished  ', () => {
    onLeaveState1Spy = jest.fn((_changes: OnLeaveStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => {
      testFSM.updateState({ state: "state2", myString: "myData", testNumber: 2 });
    });
    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state2", myString: "myData", testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab(cd)', {
        a: { state: 'FSMInit' },
        b: { state: 'state1', myNumber: 100, testNumber: 0 },
        c: { state: "state2", myString: "myData", testNumber: 1 },
        d: { state: "state2", myString: "myData", testNumber: 2 }
      });
    });
  });

  it('Should execute changeState calls made in the onLeave function after the current update pipe has finished', () => {
    onLeaveState1Spy = jest.fn((_changes: OnLeaveStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => {
      testFSM.changeState({ state: "state3", myBoolean: false, testNumber: 2 });
    });
    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state2", myString: "myData", testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab(cd)', {
        a: { state: 'FSMInit' },
        b: { state: 'state1', myNumber: 100, testNumber: 0 },
        c: { state: "state2", myString: "myData", testNumber: 1 },
        d: { state: "state3", myBoolean: false, testNumber: 2 }
      });
    });
  });

  it("Should not emit when trying to transition to a state not on the canLeaveToStates list", () => {

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state3", myBoolean: false, testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 0 }
      });
    });
  });

  it("Should log warning when trying to transition to a state not on the canLeaveToStates list", () => {

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state3", myBoolean: false, testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
          expect(consoleWarnSpy).toHaveBeenCalledWith(`not_permitted_to_leave: Leaving state "state1" to "state3" is not allowed by the "state1" canLeaveToStates whitelist`);
        }
      });
    });
  });

  it("Should call onTransitionRejected hook when a transition is rejected while trying to transition to a state not on the canLeaveToStates list", () => {

    jest.spyOn(testFSM, 'onTransitionRejected');

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => {
      testFSM.changeState({ state: "state3", myBoolean: false, testNumber: 1 });
    }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(testFSM.onTransitionRejected).toHaveBeenCalledTimes(1);
          expect(testFSM.onTransitionRejected).toHaveBeenCalledWith(expect.objectContaining({
            message: `Leaving state "state1" to "state3" is not allowed by the "state1" canLeaveToStates whitelist`,
            errorSeverity: "warn",
            rejectReason: "not_permitted_to_leave",
          }));
        }
      });
    });
  });

  it("Should recover from the error when attempting to transition to a state not on the canLeaveToStates list", () => {

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state3", myBoolean: false, testNumber: 1 }); }, 2);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state2", myString: "myData", testNumber: 2 }); }, 3);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab-c', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 0 },
        c: { state: "state2", myString: "myData", testNumber: 2 }
      });
    });
  });

  it("should not call onEnterFunction when attempting to transition to a state not on the canLeaveToStates list", () => {

    onEnterState3Spy = jest.fn((_changes: OnEnterStateChanges<TestStates, "state3", TestData, TestCanLeaveToStatesMap>) => { });
    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state3", myBoolean: false, testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(onEnterState3Spy).not.toHaveBeenCalled();
        }
      });
    });
  });

  it("should not call onLeaveFunction when attempting to transition to a state not on the canLeaveToStates list", () => {
    onLeaveState1Spy = jest.fn((_changes: OnLeaveStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { });
    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state3", myBoolean: false, testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(onLeaveState1Spy).not.toHaveBeenCalled();
        }
      });
    });
  });

  it("Should not emit when trying to transition to a state (FSMInit) not on the canEnterFromStates list", () => {
    testScheduler.schedule(() => { testFSM.changeState({ state: "state3", myBoolean: false, testNumber: 0 }); }, 1);
    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('a', {
        a: { state: 'FSMInit' },
      });
    });

  });

  it("Should log warning when trying to transition to a state (FSMInit) not on the canEnterFromStates list", () => {
    testScheduler.schedule(() => { testFSM.changeState({ state: "state3", myBoolean: false, testNumber: 0 }); }, 1);
    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("-|").subscribe({
        complete: () => {
          expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
          expect(consoleWarnSpy).toHaveBeenCalledWith('not_permitted_to_enter: Entering state "state3" from "FSMInit" is not allowed by the "state3" canEnterFromStates whitelist');
        }
      });
    });

  });

  it("Should call onTransitionRejected hook when a transition is rejected while trying to transition to a state (FSMInit) not on the canEnterFromStates list", () => {

    jest.spyOn(testFSM, 'onTransitionRejected');

    testScheduler.schedule(() => { testFSM.changeState({ state: "state3", myBoolean: false, testNumber: 0 }); }, 1);
    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("-|").subscribe({
        complete: () => {
          expect(testFSM.onTransitionRejected).toHaveBeenCalledTimes(1);
          expect(testFSM.onTransitionRejected).toHaveBeenCalledWith(expect.objectContaining({
            message: `Entering state "state3" from "FSMInit" is not allowed by the "state3" canEnterFromStates whitelist`,
            errorSeverity: "warn",
            rejectReason: "not_permitted_to_enter",
          }));
        }
      });
    });

  });

  it("Should recover from the error when trying to transition to a state (FSMInit) not on the canEnterFromStates list", () => {

    testScheduler.schedule(() => { testFSM.changeState({ state: "state3", myBoolean: false, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 2);
    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('a-b', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 0 }
      });
    });
  });

  it("should not call onEnterFunction when attempting to transition to a state (FSMInit) not on the canEnterFromStates list", () => {

    onEnterState3Spy = jest.fn((_changes: OnEnterStateChanges<TestStates, "state3", TestData, TestCanLeaveToStatesMap>) => { });
    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state3", myBoolean: false, testNumber: 0 }); }, 1);
    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("-|").subscribe({
        complete: () => {
          expect(onEnterState3Spy).not.toHaveBeenCalled();
        }
      });
    });
  });

  it("Should log a warning when the onLeave function returns false", () => {
    onLeaveState1Spy = jest.fn((_changes: OnLeaveStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { return false; });
    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state2", myString: "myData", testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
          expect(consoleWarnSpy).toHaveBeenCalledWith(`terminated_by_leave_callback: onLeave function for state1 returned false`);
        }
      });
    });
  });

  it("Should execute updateState calls made in the onLeave function, when it returns false, after the current update pipe has finished", () => {

    onLeaveState1Spy = jest.fn((_changes: OnLeaveStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => {
      testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 2 });
      return false;
    });

    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state2", myString: "myData", testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('abc', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 0 },
        c: { state: "state1", myNumber: 100, testNumber: 2 },
      });
    });

  });

  it("Should execute changeState calls made in the onLeave function, when it returns false, after the current update pipe has finished", () => {

    let isTriggerRejection: boolean = true;

    onLeaveState1Spy = jest.fn((_changes: OnLeaveStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => {

      if (isTriggerRejection) {
        isTriggerRejection = false;
        testFSM.changeState({ state: "state2", myString: "myData", testNumber: 2 });
        return false;
      }
      return true;
    });

    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state2", myString: "myData", testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('abc', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 0 },
        c: { state: "state2", myString: "myData", testNumber: 2 },
      });
    });

  });

  it("should not call onEnter function when the onLeaveFunction returns false", () => {
    onLeaveState1Spy = jest.fn((_changes: OnLeaveStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { return false; });
    onEnterState2Spy = jest.fn((_changes: OnEnterStateChanges<TestStates, "state2", TestData, TestCanLeaveToStatesMap>) => { });
    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state2", myString: "myData", testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(onEnterState2Spy).not.toHaveBeenCalled();
        }
      });
    });
  });

  it("Should call onTransitionRejected hook when a transition is rejected by the onLeave function returning false", () => {

    onLeaveState1Spy = jest.fn((_changes: OnLeaveStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { return false; });
    testFSM = new TestFSM();
    jest.spyOn(testFSM, 'onTransitionRejected');

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state2", myString: "myData", testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(testFSM.onTransitionRejected).toHaveBeenCalledTimes(1);
          expect(testFSM.onTransitionRejected).toHaveBeenCalledWith(expect.objectContaining({
            message: `onLeave function for state1 returned false`,
            errorSeverity: "warn",
            rejectReason: "terminated_by_leave_callback",
          }));
        }
      });
    });
  });

  it("Should recover when a transition is rejected by the onLeaveFunction returning false", () => {

    let errorCount: number = 0;
    onLeaveState1Spy = jest.fn((_changes: OnLeaveStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => {
      if (errorCount === 0) {
        errorCount++;
        return false;
      }
      return true;
    });

    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state2", myString: "myData", testNumber: 1 }); }, 2);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state2", myString: "myData", testNumber: 2 }); }, 3);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab-c', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 0 },
        c: { state: "state2", myString: "myData", testNumber: 2 }
      });
    });

  });

  it("Should log a warning when the onEnter function returns false", () => {
    onEnterState1Spy = jest.fn((_changes: OnEnterStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { return false; });
    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("-|").subscribe({
        complete: () => {
          expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
          expect(consoleWarnSpy).toHaveBeenCalledWith(`terminated_by_enter_callback: onEnter function for "state1" returned false`);
        }
      });
    });
  });

  it("Should execute updateState calls made in the onEnter function, when it returns false, after the current update pipe has finished", () => {

    onEnterState2Spy = jest.fn((_changes: OnEnterStateChanges<TestStates, "state2", TestData, TestCanLeaveToStatesMap>) => {
      testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 2 });
      return false;
    });

    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state2", myString: "myData", testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('abc', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 0 },
        c: { state: "state1", myNumber: 100, testNumber: 2 },
      });
    });

  });

  it("Should execute changeState calls made in the onEnter function, when it returns false, after the current update pipe has finished", () => {
    let isTriggerRejection: boolean = true;
    onEnterState1Spy = jest.fn((_changes: OnEnterStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => {

      if (isTriggerRejection) {
        isTriggerRejection = false;
        testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 1 });
        return false;
      }
      return true;
    });

    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 1 },
      });
    });

  });

  it("Should call onTransitionRejected hook when a transition is rejected by the onEnter function returning false", () => {

    onEnterState1Spy = jest.fn((_changes: OnEnterStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { return false; });
    testFSM = new TestFSM();
    jest.spyOn(testFSM, 'onTransitionRejected');

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("-|").subscribe({
        complete: () => {
          expect(testFSM.onTransitionRejected).toHaveBeenCalledTimes(1);
          expect(testFSM.onTransitionRejected).toHaveBeenCalledWith(expect.objectContaining({
            message: `onEnter function for "state1" returned false`,
            errorSeverity: "warn",
            rejectReason: "terminated_by_enter_callback",
          }));
        }
      });
    });

  });

  it("Should recover when a transition is rejected by the onEnter returning false", () => {

    let isThrowError: boolean = true;
    onEnterState1Spy = jest.fn((_changes: OnEnterStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => {
      if (isThrowError) {
        isThrowError = false;
        return false;
      }
      return true;
    });

    testFSM = new TestFSM();
    jest.spyOn(testFSM, 'onTransitionRejected');

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('a-b', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 1 },
      });
    });

  });

  it("Should log a warning when attempting to transition to the same state", () => {

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
          expect(consoleWarnSpy).toHaveBeenCalledWith(`illegal_change_same_state: Change to State must be different from the current state "state1"`);
        }
      });
    });

  });

  it("Should not emit when when attempting to transition to the same state", () => {

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 0 }
      });
    });

  });

  it("Should not call onEnterFunction when attempting to transition to the same state", () => {

    onEnterState1Spy = jest.fn((_changes: OnEnterStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { });
    testFSM = new TestFSM({ stateOverride: { stateData: { state: "state1", myNumber: 100, testNumber: 0 } } });

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 1);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("-|").subscribe({
        complete: () => {
          expect(onEnterState1Spy).not.toHaveBeenCalled();
        }
      });
    });

  });

  it("Should not call onEnterFunction when attempting to transition to the same state", () => {

    onLeaveState1Spy = jest.fn((_changes: OnLeaveStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { });
    testFSM = new TestFSM();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("-|").subscribe({
        complete: () => {
          expect(onLeaveState1Spy).not.toHaveBeenCalled();
        }
      });
    });

  });

  it("Should call onTransitionRejected hook attempting to transition to the same state", () => {

    jest.spyOn(testFSM, 'onTransitionRejected');

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(testFSM.onTransitionRejected).toHaveBeenCalledTimes(1);
          expect(testFSM.onTransitionRejected).toHaveBeenCalledWith(expect.objectContaining({
            message: `Change to State must be different from the current state "state1"`,
            errorSeverity: "warn",
            rejectReason: "illegal_change_same_state",
          }));
        }
      });
    });

  });

  it("Should recover when a transition is rejected by the onEnter returning false", () => {

    testFSM = new TestFSM();
    jest.spyOn(testFSM, 'onTransitionRejected');

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 2);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state2", myString: "myData", testNumber: 2 }); }, 3);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab-c', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 0 },
        c: { state: "state2", myString: "myData", testNumber: 2 },
      });
    });

  });

  it("Should log the error when an unknown error is thrown in the onLeaveFunction", () => {

    const testError: Error = new Error("test error");
    onLeaveState1Spy = jest.fn((_changes: OnLeaveStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { throw testError; });
    testFSM = new TestFSM();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state2", myString: "myData", testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("---|").subscribe({
        complete: () => {
          expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
          expect(consoleErrorSpy).toHaveBeenCalledWith(testError);
        }
      });
    });

  });

  it("Should not emit when an unknown error is thrown in the onLeaveFunction", () => {

    const testError: Error = new Error("test error");
    onLeaveState1Spy = jest.fn((_changes: OnLeaveStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { throw testError; });
    testFSM = new TestFSM();
    jest.spyOn(console, 'error').mockImplementation();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state2", myString: "myData", testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 0 },
      });
    });

  });

  it("Should call onUnknownError hook when an unknown error is thrown in the onLeaveFunction", () => {

    const testError: Error = new Error("test error");
    onLeaveState1Spy = jest.fn((_changes: OnLeaveStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { throw testError; });
    testFSM = new TestFSM();
    jest.spyOn(testFSM, 'onUnknownError');
    jest.spyOn(console, 'error').mockImplementation();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state2", myString: "myData", testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("---|").subscribe({
        complete: () => {
          expect(testFSM.onUnknownError).toHaveBeenCalledTimes(1);
          expect(testFSM.onUnknownError).toHaveBeenCalledWith(testError, { stateData: { state: "state2", myString: "myData", testNumber: 1 }, transitionType: "change" });
        }
      });
    });

  });

  it("Should not call onEnterFunction when an unknown error is thrown in the onLeaveFunction", () => {

    const testError: Error = new Error("test error");
    onLeaveState1Spy = jest.fn((_changes: OnLeaveStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { throw testError; });
    onEnterState2Spy = jest.fn((_changes: OnEnterStateChanges<TestStates, "state2", TestData, TestCanLeaveToStatesMap>) => { });
    testFSM = new TestFSM();
    jest.spyOn(console, 'error').mockImplementation();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state2", myString: "myData", testNumber: 1 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("---|").subscribe({
        complete: () => {
          expect(onEnterState2Spy).not.toHaveBeenCalled();
        }
      });
    });
  });

  it("Should recover when an unknown error is thrown in the onLeaveFunction", () => {

    const testError: Error = new Error("test error");
    onLeaveState1Spy = jest.fn((_changes: OnLeaveStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { throw testError; });
    testFSM = new TestFSM();
    jest.spyOn(console, 'error').mockImplementation();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state2", myString: "myData", testNumber: 1 }); }, 2);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", myNumber: 100, testNumber: 2 }); }, 3);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab-c', {
        a: { state: "FSMInit" },
        b: { state: "state1", myNumber: 100, testNumber: 0 },
        c: { state: "state1", myNumber: 100, testNumber: 2 }
      });
    });

  });

  it("Should log the error when an unknown error is thrown in the onEnterFunction", () => {

    const testError: Error = new Error("test error");
    onEnterState1Spy = jest.fn((_changes: OnEnterStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { throw testError; });
    testFSM = new TestFSM();
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
          expect(consoleErrorSpy).toHaveBeenCalledWith(testError);
        }
      });
    });

  });

  it("Should not emit when an unknown error is thrown in the onEnterFunction", () => {

    const testError: Error = new Error("test error");
    onEnterState1Spy = jest.fn((_changes: OnEnterStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { throw testError; });
    testFSM = new TestFSM();
    jest.spyOn(console, 'error').mockImplementation();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('a', {
        a: { state: 'FSMInit' },
      });
    });

  });

  it("Should call onUnknownError hook when an unknown error is thrown in the onEnterFunction", () => {

    const testError: Error = new Error("test error");
    onEnterState1Spy = jest.fn((_changes: OnEnterStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { throw testError; });
    testFSM = new TestFSM();
    jest.spyOn(testFSM, 'onUnknownError');
    jest.spyOn(console, 'error').mockImplementation();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(testFSM.onUnknownError).toHaveBeenCalledTimes(1);
          expect(testFSM.onUnknownError).toHaveBeenCalledWith(testError, { stateData: { state: "state1", myNumber: 100, testNumber: 0 }, transitionType: "change" });
        }
      });
    });

  });

  it("Should recover when an unknown error is thrown in the onEnterFunction", () => {

    const testError: Error = new Error("test error");
    let isThrowError: boolean = true;
    onEnterState1Spy = jest.fn((_changes: OnEnterStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => {
      if (isThrowError) {
        isThrowError = false;
        throw testError;
      }
    });
    testFSM = new TestFSM();
    jest.spyOn(console, 'error').mockImplementation();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", myNumber: 100, testNumber: 1 }); }, 1);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab', {
        a: { state: 'FSMInit' },
        b: { state: "state1", myNumber: 100, testNumber: 1 }
      });
    });

  });

});

describe("FsmRx FsmConfig", () => {

  let updateState1Spy: jest.Mock<boolean | void, [changes: OnUpdateStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>]>;
  let onEnterState1Spy: jest.Mock<boolean | void, [changes: OnEnterStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>]>;

  class TestFSM extends FsmRxInheritable<
    TestStates,
    BaseTestData,
    TestCanLeaveToStatesMap
  > {

    public override stateMap: StateMap<TestStates, BaseTestData, TestCanLeaveToStatesMap> = {
      state1: {
        canEnterFromStates: { FSMInit: true },
        canLeaveToStates: { state2: true },
        onUpdate: updateState1Spy,
        onEnter: onEnterState1Spy
      },
      state2: {
        canLeaveToStates: { state3: true },
        canEnterFromStates: { state1: true }
      },
      state3: {
        canLeaveToStates: { FSMTerminate: true },
        canEnterFromStates: { state2: true }
      }
    };

    public constructor(
      userConfig: Partial<FsmConfig<TestStates, BaseTestData, TestCanLeaveToStatesMap>> = {},
      isInDevMode: boolean = true
    ) {
      super(userConfig, isInDevMode);
    }

    public get resolvedFSMDebugConfig(): FsmConfig<TestStates, BaseTestData, TestCanLeaveToStatesMap> {
      return this.resolvedFsmConfig;
    }

    public override get stateData$(): Observable<BaseTestData | FSMInitStateData> {
      return super.stateData$;
    }

    public override get currentState$(): Observable<CurrentStateInfo<TestStates, BaseTestData, TestCanLeaveToStatesMap>> {
      return super.currentState$;
    }

    public override updateState(transitionData: BaseTestData): void {
      super.updateState(transitionData);
    }

    public override changeState(transitionData: BaseTestData): void {
      super.changeState(transitionData);
    }

    public override get debugLog(): DebugLogEntry<TestStates, BaseTestData>[] {
      return super.debugLog;
    }

    protected override extractFsmConfig(
      userFsmDebugConfig: Partial<FsmConfig<TestStates, BaseTestData, TestCanLeaveToStatesMap>>,
      isInDevMode: boolean
    ): FsmConfig<TestStates, BaseTestData, TestCanLeaveToStatesMap> {
      return super.extractFsmConfig(userFsmDebugConfig, isInDevMode);
    }

  }

  let testScheduler: TestScheduler;

  beforeEach(() => {

    jest.useFakeTimers();
    jest.setSystemTime(new Date(Date.UTC(1983, 11, 30, 0, 0, 0, 0)));

    testScheduler = new TestScheduler((actual, expected) => {
      expect(actual).toEqual(expected);
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("Should create the default dev mode config when given no values and isInDevMode is true", () => {
    const testFSM: TestFSM = new TestFSM({}, true);
    expect(testFSM.resolvedFSMDebugConfig).toEqual({
      outputTransitionRejectionToConsole: true,
      filterRepeatUpdates: true,
      stateOverride: false,
      debugLogBufferCount: Infinity,
      stringifyLogTransitionData: false,
      recordFilteredUpdatesToDebugLog: false,
      resetDebugLogOnOverride: true,
      recordResetDataToDebugLog: true,
      stateDiagramDirection: "TB"
    });
  });

  it("Should set config values to supplied values when isInDevMode is true", () => {
    const testFSM: TestFSM = new TestFSM({
      outputTransitionRejectionToConsole: false,
      filterRepeatUpdates: false,
      stateOverride: {
        stateData: { state: "state2", testNumber: 0 }
      },
      debugLogBufferCount: Infinity,
      stringifyLogTransitionData: true,
      recordFilteredUpdatesToDebugLog: true,
      resetDebugLogOnOverride: false,
      recordResetDataToDebugLog: false,
      stateDiagramDirection: "LR"
    }, true);
    expect(testFSM.resolvedFSMDebugConfig).toEqual({
      outputTransitionRejectionToConsole: false,
      filterRepeatUpdates: false,
      stateOverride: {
        stateData: { state: "state2", testNumber: 0 }
      },
      debugLogBufferCount: Infinity,
      stringifyLogTransitionData: true,
      recordFilteredUpdatesToDebugLog: true,
      resetDebugLogOnOverride: false,
      recordResetDataToDebugLog: false,
      stateDiagramDirection: "LR"
    });
  });

  it("Should set the initial state to stateOverride when supplied in the config", () => {
    const testFSM: TestFSM = new TestFSM({ stateOverride: { stateData: { state: "state2", testNumber: 0 } } }, true);
    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('a', {
        a: { state: 'state2', testNumber: 0 }
      });
    });
  });

  it("Should still successfully update after initial state is overridden by the config ", () => {

    const testFSM: TestFSM = new TestFSM({ stateOverride: { stateData: { state: "state2", testNumber: 0 } } }, true);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state2", testNumber: 1 }); }, 1);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab', {
        a: { state: 'state2', testNumber: 0 },
        b: { state: 'state2', testNumber: 1 }
      });
    });
  });


  it("Should still successfully change state after initial state is overridden by the config ", () => {

    const testFSM: TestFSM = new TestFSM({ stateOverride: { stateData: { state: "state2", testNumber: 0 } } }, true);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state3", testNumber: 1 }); }, 1);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab', {
        a: { state: 'state2', testNumber: 0 },
        b: { state: 'state3', testNumber: 1 }
      });
    });
  });


  it("Should call the onOverride function with the supplied stateData when one is defined by the config", async () => {

    let onOverrideSpy = jest.fn((_changes: OnOverrideStateChanges<TestStates, BaseTestData, TestCanLeaveToStatesMap>) => { });
    jest.useFakeTimers();
    const testFSM: TestFSM = new TestFSM({
      stateOverride: {
        stateData: { state: "state2", testNumber: 0 },
        onOverride: onOverrideSpy
      }
    }, true);

    await jest.runOnlyPendingTimers();

    expect(onOverrideSpy).toHaveBeenCalledTimes(1);
    expect(onOverrideSpy).toHaveBeenCalledWith({
      originalStateInfo: {
        state: "FSMInit",
        stateData: { state: "FSMInit" },
        canUpdate: false,
        canLeaveTo: ['state1']
      },
      overridingStateInfo: {
        state: "state2",
        stateData: { state: "state2", testNumber: 0 },
        canUpdate: true,
        canLeaveTo: ['state3']
      }
    });

  });

  it("Should create the default prod mode config when given no values and isInDevMode is false", () => {
    const testFSM: TestFSM = new TestFSM({}, false);
    expect(testFSM.resolvedFSMDebugConfig).toEqual({
      outputTransitionRejectionToConsole: false,
      filterRepeatUpdates: true,
      stateOverride: false,
      debugLogBufferCount: 0,
      stringifyLogTransitionData: true,
      recordFilteredUpdatesToDebugLog: false,
      resetDebugLogOnOverride: false,
      recordResetDataToDebugLog: false,
      stateDiagramDirection: "TB"
    });
  });


  it("Should force set outputTransitionRejectionToConsole, stateOverride and resetDebugLogOnOverride to false when isInDevMode is false", () => {
    const testFSM: TestFSM = new TestFSM({
      outputTransitionRejectionToConsole: true,
      stateOverride: { stateData: { state: "state2", testNumber: 0 } },
      resetDebugLogOnOverride: true,
    }, false);
    expect(testFSM.resolvedFSMDebugConfig).toEqual({
      outputTransitionRejectionToConsole: false,
      filterRepeatUpdates: true,
      stateOverride: false,
      debugLogBufferCount: 0,
      stringifyLogTransitionData: true,
      recordFilteredUpdatesToDebugLog: false,
      resetDebugLogOnOverride: false,
      recordResetDataToDebugLog: false,
      stateDiagramDirection: "TB"
    });
  });


  it("Should not log warning if outputTransitionRejectionToConsole is set to false", () => {

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const testFSM: TestFSM = new TestFSM({ outputTransitionRejectionToConsole: false }, true);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", testNumber: 0 }); }, 1);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("-|").subscribe({
        complete: () => {
          expect(consoleWarnSpy).not.toHaveBeenCalled();
        }
      });
    });
  });


  it("Should not filter repeated updates if filterRepeatUpdates is set false", () => {

    const testFSM: TestFSM = new TestFSM({ filterRepeatUpdates: false, stateOverride: { stateData: { state: "state1", testNumber: 0 } } }, true);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", testNumber: 1 }); }, 1);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", testNumber: 1 }); }, 2);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", testNumber: 1 }); }, 3);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('abcd', {
        a: { state: 'state1', testNumber: 0 },
        b: { state: 'state1', testNumber: 1 },
        c: { state: 'state1', testNumber: 1 },
        d: { state: 'state1', testNumber: 1 }
      });
    });
  });


  it("Should initialize with the default debugLog value when debugLogBufferCount is given", () => {
    const testFSM: TestFSM = new TestFSM({ debugLogBufferCount: 5 });
    expect(testFSM.debugLog).toEqual([
      { message: 'success', result: 'success', timeStamp: 441590400000, stateData: { state: 'FSMInit' }, transitionType: 'init' }
    ]);
  });


  it("Should initialize the debug log with debugLog the override value when both an stateOverride and debugLogBufferCount is given", () => {
    const testFSM: TestFSM = new TestFSM({ debugLogBufferCount: 5, stateOverride: { stateData: { state: "state1", testNumber: 0 } } });
    expect(testFSM.debugLog).toEqual([
      { message: 'override to "state1"', result: "override", timeStamp: 441590400000, stateData: { state: "state1", testNumber: 0 }, transitionType: "override" }
    ]);
  });

  it("Should add successful changes to the debugLog array when debugLogBufferCount is given", () => {
    const testFSM: TestFSM = new TestFSM({ debugLogBufferCount: 5 });
    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.changeState({ state: "state1", testNumber: 1 });
    }, 1);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("-|").subscribe({
        complete: () => {
          expect(testFSM.debugLog).toEqual([
            { message: 'success', result: 'success', timeStamp: 441590400000, stateData: { state: 'FSMInit' }, transitionType: 'init' },
            { message: 'success', result: 'success', timeStamp: 441590400001, stateData: { state: 'state1', testNumber: 1 }, transitionType: 'change', }
          ]);
        }
      });
    });
  });

  it("Should add successful updates to the debugLog array when debugLogBufferCount is given", () => {
    const testFSM: TestFSM = new TestFSM({ debugLogBufferCount: 5 });

    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.changeState({ state: "state1", testNumber: 0 });
    }, 1);
    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.updateState({ state: "state1", testNumber: 1 });
    }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(testFSM.debugLog).toEqual([
            { message: 'success', result: 'success', timeStamp: 441590400000, stateData: { state: 'FSMInit' }, transitionType: 'init' },
            { message: 'success', result: 'success', timeStamp: 441590400001, stateData: { state: 'state1', testNumber: 0 }, transitionType: 'change' },
            { message: 'success', result: 'success', timeStamp: 441590400002, stateData: { state: 'state1', testNumber: 1 }, transitionType: 'update' }
          ]);
        }
      });
    });
  });

  it("Should add unsuccessful changes to the debugLog array when debugLogBufferCount is given", () => {
    onEnterState1Spy = jest.fn((changes: OnEnterStateChanges<TestStates, "state1", BaseTestData, TestCanLeaveToStatesMap>) => { return false; });
    const testFSM: TestFSM = new TestFSM({ debugLogBufferCount: 5 });

    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.changeState({ state: "state1", testNumber: 0 });
    }, 1);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("-|").subscribe({
        complete: () => {
          expect(testFSM.debugLog).toEqual([
            { message: 'success', result: 'success', timeStamp: 441590400000, stateData: { state: 'FSMInit' }, transitionType: 'init' },
            { message: 'onEnter function for "state1" returned false', result: 'terminated_by_enter_callback', timeStamp: 441590400001, stateData: { state: 'state1', testNumber: 0 }, transitionType: 'change' },
            { message: 'reset to "FSMInit"', result: 'reset', timeStamp: 441590400001, stateData: { state: 'FSMInit' }, transitionType: 'reset' }
          ]);
        }
      });
    });
  });

  it("Should add unsuccessful updates to the debugLog array when debugLogBufferCount is given", () => {

    updateState1Spy = jest.fn((_changes: OnUpdateStateChanges<TestStates, "state1", BaseTestData, TestCanLeaveToStatesMap>) => { return false; });
    const testFSM: TestFSM = new TestFSM({ debugLogBufferCount: 5 });

    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.changeState({ state: "state1", testNumber: 0 });
    }, 1);

    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.updateState({ state: "state1", testNumber: 1 });
    }, 2);

    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.changeState({ state: "state2", testNumber: 2 });
    }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("---|").subscribe({
        complete: () => {
          expect(testFSM.debugLog).toEqual([
            { message: 'success', result: 'success', timeStamp: 441590400000, stateData: { state: 'FSMInit' }, transitionType: 'init' },
            { message: 'success', result: 'success', timeStamp: 441590400001, stateData: { state: 'state1', testNumber: 0 }, transitionType: 'change', },
            { message: 'update function for "state1" returned false', result: 'terminated_by_update_callback', timeStamp: 441590400002, stateData: { state: 'state1', testNumber: 1 }, transitionType: 'update', },
            { message: 'reset to "state1"', result: 'reset', timeStamp: 441590400002, stateData: { state: 'state1', testNumber: 0 }, transitionType: 'reset', },
            { message: 'success', result: 'success', timeStamp: 441590400003, stateData: { state: 'state2', testNumber: 2 }, transitionType: 'change', },
          ]);
        }
      });
    });
  });

  it("Should filter an update that sets the data to the same as the change", () => {

    const testFSM: TestFSM = new TestFSM({ debugLogBufferCount: 5, recordFilteredUpdatesToDebugLog: true });

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", testNumber: 0 }); }, 2);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state2", testNumber: 2 }); }, 3);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab-c', {
        a: { state: 'FSMInit' },
        b: { state: "state1", testNumber: 0 },
        c: { state: 'state2', testNumber: 2 },
      });
    });
  });

  it("Should add filtered updates to the debugLog array when recordFilteredUpdatesToDebugLog is true", () => {
    const testFSM: TestFSM = new TestFSM({ debugLogBufferCount: 5, recordFilteredUpdatesToDebugLog: true });

    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.changeState({ state: "state1", testNumber: 0 });
    }, 1);

    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.updateState({ state: "state1", testNumber: 0 });
    }, 2);

    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.changeState({ state: "state2", testNumber: 1 });
    }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("----|").subscribe({
        complete: () => {
          expect(testFSM.debugLog).toEqual([
            { message: 'success', result: 'success', timeStamp: 441590400000, stateData: { state: 'FSMInit' }, transitionType: 'init' },
            { message: 'success', result: 'success', timeStamp: 441590400001, stateData: { state: 'state1', testNumber: 0 }, transitionType: 'change' },
            { message: 'repeat update for "state1" has been filtered out', result: 'repeat_update_filtered', timeStamp: 441590400002, stateData: { state: 'state1', testNumber: 0 }, transitionType: 'update' },
            { message: 'success', result: 'success', timeStamp: 441590400003, stateData: { state: 'state2', testNumber: 1 }, transitionType: 'change', },
          ]);
        }
      });
    });

  });

  it("Should not add filtered updates to the debugLog array when recordFilteredUpdatesToDebugLog is false", () => {
    const testFSM: TestFSM = new TestFSM({ debugLogBufferCount: 5, recordFilteredUpdatesToDebugLog: false });

    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.changeState({ state: "state1", testNumber: 0 });
    }, 1);

    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.updateState({ state: "state1", testNumber: 0 });
    }, 2);

    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.changeState({ state: "state2", testNumber: 1 });
    }, 3);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("----|").subscribe({
        complete: () => {
          expect(testFSM.debugLog).toEqual([
            { message: 'success', result: 'success', timeStamp: 441590400000, stateData: { state: 'FSMInit' }, transitionType: 'init' },
            { message: 'success', result: 'success', timeStamp: 441590400001, stateData: { state: 'state1', testNumber: 0 }, transitionType: 'change' },
            { message: 'success', result: 'success', timeStamp: 441590400003, stateData: { state: 'state2', testNumber: 1 }, transitionType: 'change', }
          ]);
        }
      });
    });

  });

  it("Should cap the debugLog array size to debugLogBufferCount", () => {
    const testFSM: TestFSM = new TestFSM({ debugLogBufferCount: 2 });


    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.changeState({ state: "state1", testNumber: 0 });
    }, 1);

    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.updateState({ state: "state1", testNumber: 1 });
    }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(testFSM.debugLog).toEqual([
            { result: 'success', message: 'success', stateData: { state: 'state1', testNumber: 0 }, transitionType: 'change', timeStamp: 441590400001, },
            { result: 'success', message: 'success', stateData: { state: 'state1', testNumber: 1 }, transitionType: 'update', timeStamp: 441590400002, }
          ]);
        }
      });
    });
  });

  it("Should initialize with the debugLog as an empty array when debugLogBufferCount is set to 0 ", () => {
    const testFSM: TestFSM = new TestFSM({ debugLogBufferCount: 0 });
    expect(testFSM.debugLog).toEqual([]);
  });

  it("Should not add successful changes to the debugLog array when debugLogBufferCount is set tp 0", () => {
    const testFSM: TestFSM = new TestFSM({ debugLogBufferCount: 0 });

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", testNumber: 0 }); }, 1);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("-|").subscribe({
        complete: () => {
          expect(testFSM.debugLog).toEqual([]);
        }
      });
    });
  });

  it("Should not add successful updates to the debugLog array when debugLogBufferCount is set to 0", () => {
    const testFSM: TestFSM = new TestFSM({ debugLogBufferCount: 0 });

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", testNumber: 0 }); }, 1);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1", testNumber: 2 }); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(testFSM.debugLog).toEqual([]);
        }
      });
    });
  });

  it("Should not add unsuccessful changes to the debugLog array when debugLogBufferCount is set to 0", () => {
    jest.spyOn(console, 'warn').mockImplementation();
    onEnterState1Spy = jest.fn((_changes: OnEnterStateChanges<TestStates, "state1", BaseTestData, TestCanLeaveToStatesMap>) => { return false; });
    const testFSM: TestFSM = new TestFSM({ debugLogBufferCount: 0 });
    testScheduler.schedule(() => { testFSM.changeState({ state: "state1", testNumber: 0 }); }, 1);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("-|").subscribe({
        complete: () => {
          expect(testFSM.debugLog).toEqual([]);
        }
      });
    });
  });

  it("Should not add unsuccessful updates to the debugLog array when debugLogBufferCount is set to 0", () => {
    updateState1Spy = jest.fn((_changes: OnUpdateStateChanges<TestStates, "state1", TestData, TestCanLeaveToStatesMap>) => { return false; });
    const testFSM: TestFSM = new TestFSM({ debugLogBufferCount: 0 });

    testScheduler.schedule(() => {
      testFSM.changeState({ state: "state1", testNumber: 0 });
    }, 1);

    testScheduler.schedule(() => {
      testFSM.updateState({ state: "state1", testNumber: 1 });
    }, 2);

    testScheduler.schedule(() => {
      testFSM.changeState({ state: "state2", testNumber: 2 });
    }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("---|").subscribe({
        complete: () => {
          expect(testFSM.debugLog).toEqual([]);
        }
      });
    });
  });

  it("Should log the recover to state when an unknown error occurs ", () => {
    const testError: Error = new Error("test error");
    jest.spyOn(console, 'error').mockImplementation();
    updateState1Spy = jest.fn((_changes: OnUpdateStateChanges<TestStates, "state1", BaseTestData, TestCanLeaveToStatesMap>) => { throw testError; });
    const testFSM: TestFSM = new TestFSM();

    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.changeState({ state: "state1", testNumber: 0 });
    }, 1);

    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.updateState({ state: "state1", testNumber: 1 });
    }, 2);

    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.changeState({ state: "state2", testNumber: 2 });
    }, 3);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("----|").subscribe({
        complete: () => {
          expect(testFSM.debugLog).toEqual([
            { message: 'success', result: 'success', timeStamp: 441590400000, stateData: { state: 'FSMInit' }, transitionType: 'init' },
            { message: 'success', result: 'success', timeStamp: 441590400001, stateData: { state: 'state1', testNumber: 0 }, transitionType: 'change', },
            { message: "test error", result: "unknown_error", timeStamp: 441590400002, stateData: { state: "state1", testNumber: 1 }, "transitionType": "update" },
            { message: 'recover to "state1"', result: 'recover', timeStamp: 441590400002, stateData: { state: 'state1', testNumber: 0 }, transitionType: 'recover' },
            { message: 'success', result: 'success', timeStamp: 441590400003, stateData: { state: 'state2', testNumber: 2 }, transitionType: 'change' }
          ]);
        }
      });
    });
  });

  it("Should stringify logged transition data if stringifyLogTransitionData is set to true", () => {

    const testFSM: TestFSM = new TestFSM({ debugLogBufferCount: 5, stringifyLogTransitionData: true });
    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.changeState({ state: "state1", testNumber: 0 });
    }, 1);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("-|").subscribe({
        complete: () => {
          expect(testFSM.debugLog).toEqual([
            { message: 'success', result: 'success', timeStamp: 441590400000, stateData: JSON.stringify({ state: "FSMInit" }, null, 1), transitionType: 'init' },
            { message: 'success', result: 'success', timeStamp: 441590400001, stateData: JSON.stringify({ state: "state1", "testNumber": 0 }, null, 1), transitionType: 'change', }
          ]);
        }
      });
    });
  });

});

describe("FsmRx OverrideCurrentState", () => {

  class TestFSM extends FsmRxInheritable<
    TestStates,
    BaseStateData<TestStates>,
    TestCanLeaveToStatesMap
  > {
    protected override stateMap: StateMap<TestStates, BaseStateData<TestStates>, TestCanLeaveToStatesMap> = {
      state1: {
        canEnterFromStates: { FSMInit: true },
        canLeaveToStates: { state2: true },
      },
      state2: {
        canEnterFromStates: { state1: true },
        canLeaveToStates: { state3: true },
      },
      state3: {
        canEnterFromStates: { state2: true },
        canLeaveToStates: { FSMTerminate: true },
      }

    };

    public constructor(userConfig: Partial<FsmConfig<TestStates, BaseStateData<TestStates>, TestCanLeaveToStatesMap>> = {}, isInDevMode: boolean = true) {
      super(userConfig, isInDevMode);
    }

    public override changeState(transitionData: BaseStateData<TestStates>): void {
      super.changeState(transitionData);
    }

    public override get stateData$(): Observable<BaseStateData<TestStates> | FSMInitStateData> {
      return super.stateData$;
    }

    public override get currentState$(): Observable<CurrentStateInfo<TestStates, BaseStateData<TestStates>, TestCanLeaveToStatesMap>> {
      return super.currentState$;
    }

    public override get debugLog(): DebugLogEntry<TestStates, BaseStateData<TestStates>>[] {
      return super.debugLog;
    }

    public override override$: Subject<void> = new Subject();

    public override overrideCurrentState(
      stateOverride: StateOverride<TestStates, BaseStateData<TestStates>, TestCanLeaveToStatesMap>,
      isResetDebugLog: boolean = true
    ): void {
      super.overrideCurrentState(stateOverride, isResetDebugLog);
    }

  }

  let testScheduler: TestScheduler;
  let testFSM: TestFSM;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(Date.UTC(1983, 11, 30, 0, 0, 0, 0)));
    testFSM = new TestFSM();
    testScheduler = new TestScheduler((actual, expected) => {
      expect(actual).toEqual(expected);
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("Should override the state when overrideCurrentState is called", () => {

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1" }); }, 1);
    testScheduler.schedule(() => { testFSM.overrideCurrentState({ stateData: { state: "state3" } }, false); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('abc', {
        a: { state: 'FSMInit' },
        b: { state: 'state1' },
        c: { state: 'state3' },
      });
    });

  });

  it("should trigger override$ when overrideCurrentState is called", () => {

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1" }); }, 1);
    testScheduler.schedule(() => { testFSM.overrideCurrentState({ stateData: { state: "state3" } }, false); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.override$).toBe('--a', {
        a: undefined
      });
    });
  });

  it("should clear the debug log when overrideCurrentState is called with isResetDebugLog set to true", () => {

    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.changeState({ state: "state1" });
    }, 1);
    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.overrideCurrentState({ stateData: { state: "state3" } }, true);
    }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(testFSM.debugLog).toStrictEqual([
            { message: 'override to "state3"', result: "override", stateData: { state: "state3" }, timeStamp: 441590400002, transitionType: "override" }
          ]);
        }
      });
    });

  });

  it("should not clear the debug log when overrideCurrentState is called with isResetDebugLog set to false", () => {

    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.changeState({ state: "state1" });
    }, 1);
    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.overrideCurrentState({ stateData: { state: "state3" } }, false);
    }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(testFSM.debugLog).toStrictEqual([
            { message: 'success', result: "success", stateData: { state: "FSMInit" }, timeStamp: 441590400000, transitionType: "init" },
            { message: 'success', result: "success", stateData: { state: "state1" }, timeStamp: 441590400001, transitionType: "change" },
            { message: 'override to "state3"', result: "override", stateData: { state: "state3" }, timeStamp: 441590400002, transitionType: "override" }
          ]);
        }
      });
    });

  });

  it("should not override the state when overrideCurrentState is called in production", () => {
    jest.spyOn(console, 'warn').mockImplementation();
    testFSM = new TestFSM({}, false);

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1" }); }, 1);
    testScheduler.schedule(() => { testFSM.overrideCurrentState({ stateData: { state: "state3" } }, false); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab', {
        a: { state: 'FSMInit' },
        b: { state: 'state1' }
      });
    });
  });

  it("should add transition rejection to the debug log when overrideCurrentState is called in production", () => {

    testFSM = new TestFSM({ debugLogBufferCount: 10, stringifyLogTransitionData: false }, false);

    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.changeState({ state: "state1" });
    }, 1);
    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.overrideCurrentState({ stateData: { state: "state3" } }, false);
    }, 2);


    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          debugger;
          expect(testFSM.debugLog).toStrictEqual([
            { message: 'success', result: "success", stateData: { state: "FSMInit" }, timeStamp: 441590400000, transitionType: "init" },
            { message: 'success', result: "success", stateData: { state: "state1" }, timeStamp: 441590400001, transitionType: "change" },
            { message: 'Override Current State can only be used in dev mode', result: "override_in_production", stateData: { state: "state1" }, timeStamp: 441590400002, transitionType: "change" }
          ]);
        }
      });
    });
  });

  it("should not clear the debug log when overrideCurrentState is called with isResetDebugLog set to false", () => {

    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.changeState({ state: "state1" });
    }, 1);
    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.overrideCurrentState({ stateData: { state: "state3" } }, false);
    }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {
          expect(testFSM.debugLog).toStrictEqual([
            { message: 'success', result: "success", stateData: { state: "FSMInit" }, timeStamp: 441590400000, transitionType: "init" },
            { message: 'success', result: "success", stateData: { state: "state1" }, timeStamp: 441590400001, transitionType: "change" },
            { message: 'override to "state3"', result: "override", stateData: { state: "state3" }, timeStamp: 441590400002, transitionType: "override" }
          ]);
        }
      });
    });

  });

  it("should not trigger override$ when overrideCurrentState is called in production", () => {

    testFSM = new TestFSM({}, false);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state1" }); }, 1);
    testScheduler.schedule(() => { testFSM.overrideCurrentState({ stateData: { state: "state3" } }, false); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.override$).toBe('', {});
    });

  });

  it("should allow changeState calls to be made after a call to overrideCurrentState", () => {

    jest.spyOn(console, 'warn').mockImplementation();

    testScheduler.schedule(() => {
      testFSM.changeState({ state: "state1" });
    }, 1);

    testScheduler.schedule(() => {
      testFSM.overrideCurrentState({ stateData: { state: "state3" } }, false);
    }, 2);

    testScheduler.schedule(() => {
      testFSM.changeState({ state: "state1" });
    }, 3);


    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('abc', {
        a: { state: 'FSMInit' },
        b: { state: 'state1' },
        c: { state: 'state3' },
        d: { state: 'state1' },
      });
    });
  });

  it("should return the correct currentState$ after a call to overrideCurrentState", () => {
    testScheduler.schedule(() => {
      testFSM.changeState({ state: "state1" });
    }, 1);

    testScheduler.schedule(() => {
      testFSM.overrideCurrentState({ stateData: { state: "state3" } }, false);
    }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      testScheduler.flush();
      expectObservable(testFSM.currentState$).toBe('--(a|)', {
        a: {
          state: 'state3',
          stateData: { state: 'state3' },
          canUpdate: true,
          canLeaveTo: ['FSMTerminate']
        },
      });
    });

  });

  it("should call the onOverrideFunction when given to a overrideCurrentState call", () => {

    let onOverrideSpy = jest.fn((_changes: OnOverrideStateChanges<TestStates, BaseStateData<TestStates>, TestCanLeaveToStatesMap>) => { });

    testScheduler.schedule(() => {
      testFSM.changeState({ state: "state1" });
    }, 1);

    testScheduler.schedule(() => {
      testFSM.overrideCurrentState({ stateData: { state: "state3" }, onOverride: onOverrideSpy }, false);
    }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("--|").subscribe({
        complete: () => {

          expect(onOverrideSpy).toHaveBeenCalledTimes(1);
          expect(onOverrideSpy).toHaveBeenCalledWith({
            originalStateInfo: {
              state: "state1",
              stateData: { state: "state1" },
              canUpdate: true,
              canLeaveTo: ['state2']
            },
            overridingStateInfo: {
              state: "state3",
              stateData: { state: "state3" },
              canUpdate: true,
              canLeaveTo: ['FSMTerminate']
            }
          });
        }
      });
    });

  });




});

describe("FsmRx State Diagram", () => {

  class TestFSM extends FsmRxInheritable<
    TestStates,
    BaseStateData<TestStates>,
    TestCanLeaveToStatesMap
  > {

    public constructor(userConfig: Partial<FsmConfig<TestStates, BaseStateData<TestStates>, TestCanLeaveToStatesMap>> = {},) {
      super(userConfig, true);
    }

    protected override stateMap: StateMap<TestStates, BaseStateData<TestStates>, TestCanLeaveToStatesMap> = {
      state1: {
        canEnterFromStates: { FSMInit: true },
        canLeaveToStates: { state2: true },
      },
      state2: {
        canEnterFromStates: { state1: true },
        canLeaveToStates: { state3: true },
      },
      state3: {
        canEnterFromStates: { state2: true },
        canLeaveToStates: { FSMTerminate: true },
      }
    };

    public override generateStateDiagramHead(direction: StateDiagramDirections | undefined = undefined): string {
      return super.generateStateDiagramHead(direction);
    }

    public override generateStateTransition(state: TestStates, canLeaveTo: (TestStates | FSMTerminate)[]): string {
      return super.generateStateTransition(state, canLeaveTo);
    }

    public override generateStateDiagramClassDefs(): string {
      return super.generateStateDiagramClassDefs();
    };

    public override getStateDiagramDefinition(highlightState: TestStates | FSMInit | undefined = undefined): string {
      return super.getStateDiagramDefinition(highlightState);
    }

    public override clearStateDiagramDefinition(): void {
      super.clearStateDiagramDefinition();
    }

    public setStateDiagramDirection(stateDiagramDirections: StateDiagramDirections): void {
      this.resolvedFsmConfig.stateDiagramDirection = stateDiagramDirections;
    }

  }

  let testScheduler: TestScheduler;
  let testFSM: TestFSM;

  beforeEach(() => {
    testFSM = new TestFSM({ stateDiagramDirection: "TB" });
    testScheduler = new TestScheduler((actual, expected) => {
      expect(actual).toEqual(expected);
    });
  });


  it('Should generate the head string with the default direction of TB', () => {
    let expectedString: string = `stateDiagram-v2\ndirection TB\n[*] --> FSMInit`;
    expect(testFSM.generateStateDiagramHead()).toEqual(expectedString);
  });

  it('Should generate the head string with the required direction of TB', () => {
    let expectedString: string = `stateDiagram-v2\ndirection TB\n[*] --> FSMInit`;
    expect(testFSM.generateStateDiagramHead("TB")).toEqual(expectedString);
  });

  it('Should generate the head string with the required direction of LR', () => {
    let expectedString: string = `stateDiagram-v2\ndirection LR\n[*] --> FSMInit`;
    expect(testFSM.generateStateDiagramHead("LR")).toEqual(expectedString);
  });

  it('Should generate the state node and the transitions to the states it can go to', () => {
    let expectedString: string = "state1 --> state2";
    expect(testFSM.generateStateTransition("state1", ['state2'])).toEqual(expectedString);
  });

  it('should generate the special end symbol [*] when going to FSMTerminate', () => {
    let expectedString: string = "state1 --> [*]";
    expect(testFSM.generateStateTransition("state1", ['FSMTerminate'])).toEqual(expectedString);
  });

  it('should generate an instruction for each of the states it can transition to', () => {
    let expectedString: string = "state1 --> state2\nstate1 --> state3\nstate1 --> [*]";
    expect(testFSM.generateStateTransition("state1", ['state2', 'state3', 'FSMTerminate'])).toEqual(expectedString);
  });

  it('should generate the default styling', () => {
    let expectedString: string = "classDef highlight font-weight:bold,stroke-width:3px,fill:#c6c6f9,stroke:#7d4ce1";
    expect(testFSM.generateStateDiagramClassDefs()).toEqual(expectedString);
  });

  it('should generate the state diagram definition', () => {
    let expectedString: string = "stateDiagram-v2\ndirection TB\n[*] --> FSMInit\nFSMInit --> state1\nstate1 --> state2\nstate2 --> state3\nstate3 --> [*]\nclassDef highlight font-weight:bold,stroke-width:3px,fill:#c6c6f9,stroke:#7d4ce1";
    expect(testFSM.getStateDiagramDefinition()).toEqual(expectedString);
  });

  it('should generate the state diagram definition with the given state highlighted', () => {
    let expectedString: string = "stateDiagram-v2\ndirection TB\n[*] --> FSMInit\nFSMInit --> state1\nstate1 --> state2\nstate2:::highlight --> state3\nstate3 --> [*]\nclassDef highlight font-weight:bold,stroke-width:3px,fill:#c6c6f9,stroke:#7d4ce1";
    expect(testFSM.getStateDiagramDefinition("state2")).toEqual(expectedString);
  });

  it('should trigger the diagram to be regenerated after its value has been cleared', () => {
    const def1 = testFSM.getStateDiagramDefinition();
    testFSM.setStateDiagramDirection('LR');
    testFSM.clearStateDiagramDefinition();
    const def2 = testFSM.getStateDiagramDefinition();
    expect(def1).not.toEqual(def2);
  });

});

describe('FsmRx Destroy', () => {

  class TestFSM extends FsmRxInheritable<
    TestStates,
    BaseStateData<TestStates>,
    TestCanLeaveToStatesMap
  > {
    protected override stateMap: StateMap<TestStates, BaseStateData<TestStates>, TestCanLeaveToStatesMap> = {
      state1: {
        canLeaveToStates: { state2: true },
        canEnterFromStates: { FSMInit: true }
      },
      state2: {
        canLeaveToStates: { state3: true },
        canEnterFromStates: { state1: true }
      },
      state3: {
        canLeaveToStates: { FSMTerminate: true },
        canEnterFromStates: { state2: true }
      }
    };

    public constructor() {
      super({}, true);
    }

    public override get stateData$(): Observable<BaseStateData<TestStates> | FSMInitStateData> {
      return super.stateData$;
    }

    public override changeState(transitionData: BaseStateData<TestStates>): void {
      super.changeState(transitionData);
    }

    public override updateState(transitionData: BaseStateData<TestStates>): void {
      super.updateState(transitionData);
    }

    public override destroy(): void {
      super.destroy();
    }

    public override get debugLog(): DebugLogEntry<TestStates, BaseStateData<TestStates>>[] {
      return super.debugLog;
    }

    public override  destroy$: Subject<void> = new Subject();

  }

  let testScheduler: TestScheduler;
  let testFSM: TestFSM;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(Date.UTC(1983, 11, 30, 0, 0, 0, 0)));
    testFSM = new TestFSM();
    testScheduler = new TestScheduler((actual, expected) => {
      expect(actual).toEqual(expected);
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it("should trigger destroy$ when destroy is called", () => {

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1" }); }, 1);
    testScheduler.schedule(() => { testFSM.destroy(); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.destroy$).toBe('--(a|)', {
        a: undefined
      });
    });
  });

  it("should complete stateData$ when destroy is called", () => {
    testScheduler.schedule(() => { testFSM.changeState({ state: "state1" }); }, 1);
    testScheduler.schedule(() => { testFSM.destroy(); }, 2);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { expectObservable } = runHelpers;
      expectObservable(testFSM.stateData$).toBe('ab|', {
        a: { state: 'FSMInit' },
        b: { state: 'state1' },
        c: undefined
      });
    });
  });

  it("should log a warning when changeState is called after destroy", () => {

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1" }); }, 1);
    testScheduler.schedule(() => { testFSM.destroy(); }, 2);
    testScheduler.schedule(() => { testFSM.changeState({ state: "state2" }); }, 3);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("---|").subscribe({
        complete: () => {
          expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
          expect(consoleWarnSpy).toHaveBeenCalledWith(`after_fsm_destroy: Attempted to call changeState after destroy was called`);
        }
      });
    });
  });

  it("should add a transition rejection to the debug log when changeState is called after destroy", () => {

    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.changeState({ state: "state1" });
    }, 1);
    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.destroy();
    }, 2);
    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.changeState({ state: "state2" });
    }, 3);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("---|").subscribe({
        complete: () => {
          expect(testFSM.debugLog).toStrictEqual([
            { message: 'success', result: "success", stateData: { state: "FSMInit" }, timeStamp: 441590400000, transitionType: "init" },
            { message: 'success', result: "success", stateData: { state: "state1" }, timeStamp: 441590400001, transitionType: "change" },
            { message: "Attempted to call changeState after destroy was called", result: "after_fsm_destroy", stateData: "", timeStamp: 441590400003, transitionType: "change" }
          ]);
        }
      });
    });
  });

  it("should log a warning when updateState is called after destroy", () => {

    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

    testScheduler.schedule(() => { testFSM.changeState({ state: "state1" }); }, 1);
    testScheduler.schedule(() => { testFSM.destroy(); }, 2);
    testScheduler.schedule(() => { testFSM.updateState({ state: "state1" }); }, 3);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("---|").subscribe({
        complete: () => {
          expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
          expect(consoleWarnSpy).toHaveBeenCalledWith(`after_fsm_destroy: Attempted to call updateState after destroy was called`);
        }
      });
    });
  });

  it("should add a transition rejection to the debug log when updateState is called after destroy", () => {

    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.changeState({ state: "state1" });
    }, 1);
    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.destroy();
    }, 2);
    testScheduler.schedule(() => {
      jest.advanceTimersByTime(1);
      testFSM.updateState({ state: "state1" });
    }, 3);

    testScheduler.run((runHelpers: RunHelpers) => {
      const { cold } = runHelpers;
      cold("---|").subscribe({
        complete: () => {
          expect(testFSM.debugLog).toStrictEqual([
            { message: 'success', result: "success", stateData: { state: "FSMInit" }, timeStamp: 441590400000, transitionType: "init" },
            { message: 'success', result: "success", stateData: { state: "state1" }, timeStamp: 441590400001, transitionType: "change" },
            { message: "Attempted to call updateState after destroy was called", result: "after_fsm_destroy", stateData: "", timeStamp: 441590400003, transitionType: "update" }
          ]);
        }
      });
    });
  });

});