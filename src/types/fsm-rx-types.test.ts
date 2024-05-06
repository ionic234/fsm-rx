
import { expectTypeOf } from 'expect-type';
import { CanEnterFromStates, CanLeaveToStates, FSMInit, FSMInitStateData, FSMReserved, FSMState, FSMTerminate, OnEnterEnteringStateInfo, OnEnterLeavingStateInfo, OnEnterStateChanges, OnLeaveEnteringStateInfo, OnLeaveLeavingStateInfo, OnLeaveStateChanges, OnUpdateStateChanges, OnUpdateStateTransitionInfo, StateMetadata } from "./fsm-rx-types";

type TestStatesA = "state1" | "state2";
type TestStatesB = "state2" | "state3";
type TestStates = TestStatesA | TestStatesB;

type TestStateData = { state: "state1", test: string; } | { state: "state2", test: boolean; } | { state: "state3", test: number; };

type FSMInitInfo = {
  state: "FSMInit";
  stateData: FSMInitStateData;
  canUpdate: false;
  canLeaveTo: "state1"[];
};

type State1Info = {
  state: "state1";
  stateData: {
    state: "state1";
    test: string;
  };
  canUpdate: true;
  canLeaveTo: "state2"[];
};

type State2Info = {
  state: "state2";
  stateData: {
    state: "state2";
    test: boolean;
  };
  canUpdate: true;
  canLeaveTo: "state3"[];
};

type State3Info = {
  state: "state3";
  stateData: {
    state: "state3";
    test: number;
  };
  canUpdate: true;
  canLeaveTo: ("state1" | "FSMTerminate")[];
};

type TestStateCanLeaveToStatesMap = {
  "FSMInit": "state1",
  "state1": "state2",
  "state2": "state3",
  "state3": "state1" | "FSMTerminate";
};

describe('Type FSMState', () => {

  it("Should be typed as TStates when it doesn't include FSMInit", () => {
    expect(expectTypeOf<FSMState<TestStates>>().toEqualTypeOf<TestStates>()).toBe(true);
  });

  it("Should be typed as an Never when TStates includes FSMInit", () => {
    expect(expectTypeOf<FSMState<TestStates | FSMInit>>().toBeNever()).toBe(true);
  });

  it("Should be typed as an Never when TStates includes FSMTerminate", () => {
    expect(expectTypeOf<FSMState<TestStates | FSMTerminate>>().toBeNever()).toBe(true);
  });

  it("Should be typed as an Never when TStates includes both FSMInit | FSMTerminate ", () => {
    expect(expectTypeOf<FSMState<TestStates | FSMReserved>>().toBeNever()).toBe(true);
  });

});

describe('Type CanEnterFromStates', () => {

  it("should be typed as never when TStates includes FSMReserved", () => {
    expect(expectTypeOf<CanEnterFromStates<TestStates | FSMReserved, "state1", object>>().toBeNever()).toBe(true);
  });

  it("Should be typed as never when no states in the TCanLeaveToStatesMap leave to TStateKey", () => {
    expect(expectTypeOf<CanEnterFromStates<TestStates, "state1", { FSMInit: "state2"; state1: "state2", state2: "state3", state3: "state2"; }>>().toBeNever()).toBe(true);
  });

  it("Should be typed as Exclude<TestStates | FSMInit, TEnteringState> when TCanLeaveToStatesMap has no value for TStateKey", () => {
    expect(expectTypeOf<CanEnterFromStates<TestStates, "state1", object>>()
      .toEqualTypeOf<Exclude<TestStates | FSMInit, "state1">>()).toBe(true);
  });

  it("should be typed as all of the states in the TCanLeaveToStatesMap that leave to TStateKey", () => {
    expect(expectTypeOf<CanEnterFromStates<TestStates, "state1", TestStateCanLeaveToStatesMap>>()
      .toEqualTypeOf<"state3" | "FSMInit">()).toBe(true);
  });

});

describe('Type CanLeaveToStates', () => {

  it("should be typed as never when TStates includes FSMReserved", () => {
    expect(expectTypeOf<CanLeaveToStates<TestStates | FSMReserved, "state1", object>>().toBeNever()).toBe(true);
  });

  it("Should be typed as Exclude<TestStates | FSMTerminate, TStateKey> when TCanLeaveToStatesMap has no value for TStateKey", () => {
    expect(expectTypeOf<CanLeaveToStates<TestStates, "state1", object>>()
      .toEqualTypeOf<Exclude<TestStates | FSMTerminate, "state1">>()).toBe(true);
  });

  it("Should be typed as the states TStateKey can leave to in the TCanLeaveToStatesMap when given", () => {
    expect(expectTypeOf<CanLeaveToStates<TestStates, "state1", TestStateCanLeaveToStatesMap>>()
      .toEqualTypeOf<"state2">()).toBe(true);
  });

  it("should accept FSMInit as a value for TStateKey", () => {
    expect(expectTypeOf<CanLeaveToStates<TestStates, "FSMInit", object>>()
      .toEqualTypeOf<TestStates | "FSMTerminate">()).toBe(true);
  });

  //@ts-expect-error it should not accept FSMTerminate as a value for TStateKey
  type expectErrorTest = CanLeaveToStates<TestStates, "FSMTerminate", object>;

});

describe('Type OnLeaveEnteringStateInfo', () => {

  it("should be typed as never when TStates includes FSMReserved", () => {
    expect(expectTypeOf<OnLeaveEnteringStateInfo<TestStates | FSMReserved, "state1", TestStateData, object>>().toBeNever()).toBe(true);
  });

  it("should be typed to a union of info about the states Exclude<TStates, TLeavingState> when TCanLeaveToStatesMap has no value for TLeavingState", () => {

    type TestStateCanLeaveToStatesMap = {
      "FSMInit": "state1",
      "state2": "state3",
      "state3": "state1" | "FSMTerminate";
    };

    expect(expectTypeOf<OnLeaveEnteringStateInfo<TestStates, "state1", TestStateData, TestStateCanLeaveToStatesMap>>()
      .toEqualTypeOf<State2Info | State3Info>()).toBe(true);

  });

  it("Should be typed to a union of info about the states TLeavingState can leave to when TCanLeaveToStatesMap has a value for TLeavingState", () => {
    expect(expectTypeOf<OnLeaveEnteringStateInfo<TestStates, "state1", TestStateData, TestStateCanLeaveToStatesMap>>()
      .toEqualTypeOf<State2Info>()).toBe(true);
  });

});

describe('Type OnEnterLeavingStateInfo', () => {

  it("should be typed as never when TStates includes FSMReserved", () => {
    expect(expectTypeOf<OnEnterLeavingStateInfo<TestStates | FSMReserved, "state1", TestStateData, object>>().toBeNever()).toBe(true);
  });

  it("Should be typed as FSMInit data when the state TEnteringState can enter from the FSMInit state", () => {

    type TestStateCanLeaveToStatesMap = {
      "FSMInit": "state1",
      "state1": "state2",
      "state2": "state3",
      "state3": "FSMTerminate";
    };

    expect(expectTypeOf<OnEnterLeavingStateInfo<TestStates, "state1", TestStateData, TestStateCanLeaveToStatesMap>>()
      .toEqualTypeOf<FSMInitInfo>()).toBe(true);
  });

  it("Should be typed as info about the state TEnteringState can enter from when it is a TState", () => {
    expect(expectTypeOf<OnEnterLeavingStateInfo<TestStates, "state2", TestStateData, TestStateCanLeaveToStatesMap>>()
      .toEqualTypeOf<State1Info>()).toBe(true);
  });

  it("Should be typed to a union of info about the states TEnteringState can enter from", () => {
    expect(expectTypeOf<OnEnterLeavingStateInfo<TestStates, "state1", TestStateData, TestStateCanLeaveToStatesMap>>()
      .toEqualTypeOf<FSMInitInfo | State3Info>()).toBe(true);
  });

});

describe('Type OnLeaveStateChanges', () => {

  it("Should be typed as a union of leave hook info that matches TLeavingState", () => {
    type stateUnionChanges = {
      hook: "onLeave";
      leavingStateInfo: OnLeaveLeavingStateInfo<TestStates, "state1", TestStateData, TestStateCanLeaveToStatesMap>;
      enteringStateInfo: OnLeaveEnteringStateInfo<TestStates, "state1", TestStateData, TestStateCanLeaveToStatesMap>;
    } | {
      hook: "onLeave";
      leavingStateInfo: OnLeaveLeavingStateInfo<TestStates, "state2", TestStateData, TestStateCanLeaveToStatesMap>;
      enteringStateInfo: OnLeaveEnteringStateInfo<TestStates, "state2", TestStateData, TestStateCanLeaveToStatesMap>;
    };

    expect(expectTypeOf<OnLeaveStateChanges<TestStates, "state1" | "state2", TestStateData, TestStateCanLeaveToStatesMap>>()
      .toEqualTypeOf<stateUnionChanges>()).toBe(true);
  });

});

describe('Type OnEnterStateChanges', () => {

  it("Should be typed as a union of enter hook info that matches TEnteringState", () => {
    type stateUnionChanges = {
      hook: "onEnter";
      leavingStateInfo: OnEnterLeavingStateInfo<TestStates, "state1", TestStateData, TestStateCanLeaveToStatesMap>;
      enteringStateInfo: OnEnterEnteringStateInfo<TestStates, "state1", TestStateData, TestStateCanLeaveToStatesMap>;
    } | {
      hook: "onEnter";
      leavingStateInfo: OnEnterLeavingStateInfo<TestStates, "state2", TestStateData, TestStateCanLeaveToStatesMap>;
      enteringStateInfo: OnEnterEnteringStateInfo<TestStates, "state2", TestStateData, TestStateCanLeaveToStatesMap>;
    };

    expect(expectTypeOf<OnEnterStateChanges<TestStates, "state1" | "state2", TestStateData, TestStateCanLeaveToStatesMap>>()
      .toEqualTypeOf<stateUnionChanges>()).toBe(true);
  });

});

describe('Type OnUpdateStateChanges', () => {

  it("Should be typed as a union of update hook info that matches TUpdateState", () => {
    type stateUnionChanges = {
      hook: "onUpdate";
      previousInfo: OnUpdateStateTransitionInfo<TestStates, "state1", TestStateData, TestStateCanLeaveToStatesMap>;
      updateInfo: OnUpdateStateTransitionInfo<TestStates, "state1", TestStateData, TestStateCanLeaveToStatesMap>;
    } | {
      hook: "onUpdate";
      previousInfo: OnUpdateStateTransitionInfo<TestStates, "state2", TestStateData, TestStateCanLeaveToStatesMap>;
      updateInfo: OnUpdateStateTransitionInfo<TestStates, "state2", TestStateData, TestStateCanLeaveToStatesMap>;
    };

    expect(expectTypeOf<OnUpdateStateChanges<TestStates, "state1" | "state2", TestStateData, TestStateCanLeaveToStatesMap>>()
      .toEqualTypeOf<stateUnionChanges>()).toBe(true);
  });

});

describe('Type StateMetadata', () => {

  it("should be typed as never when TStates includes FSMReserved", () => {
    expect(expectTypeOf<StateMetadata<TestStates | FSMReserved, "state1", TestStateData, object>>().toBeNever()).toBe(true);
  });

  it("should be typed as never when no states in the TCanLeaveToStatesMap can leave to TStateKey", () => {

    type TestStateCanLeaveToStatesMap = {
      "FSMInit": "state1",
      "state1": "state3",
      "state2": "state3",
      "state3": "state1" | "FSMTerminate";
    };

    expect(expectTypeOf<StateMetadata<TestStates, "state2", TestStateData, TestStateCanLeaveToStatesMap>>().toBeNever()).toBe(true);
  });

});
