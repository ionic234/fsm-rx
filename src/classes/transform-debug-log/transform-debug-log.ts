//import { BaseStateData, DebugLogEntry, TransitionResult, TransitionTypes } from "fsm-rx";

import { BaseStateData, DebugLogEntry, TransitionResult, TransitionTypes } from "../../fsm-rx-types";

/**
 * The type of the debug entry. 
 * Each string in the union represents a style class to apply to the table row.  
 */
export type DebugEntryResult = "success" | "error" | "warning" | "filtered" | 'override' | 'reset';

/**
 * A simplified representation of a data entry in an FsmRxComponents debugLog.
 * Used to populate a table row. 
 */
export type SimpleDebugEntry = {
    time: string,
    type: TransitionTypes,
    data: string,
    message: string,
    result: DebugEntryResult;
};

/**
 * Class which contains functions for transforming the debuglog into a format ready for display. 
 */
export class TransformDebugLog {

    /**
     * 
     * @param debugLog fdfd
     * @param debugLogKeys fdf
     * @returns fddfd
     */
    public processDebugLog(debugLog: DebugLogEntry<string, BaseStateData<string>>[], debugLogKeys: string[]): SimpleDebugEntry[] {
        return debugLog.reduce((rData: SimpleDebugEntry[], entry: DebugLogEntry<string, BaseStateData<string>>) => {
            rData.push({
                time: this.formatTimestamp(entry.timeStamp),
                type: entry.transitionType,
                data: typeof (entry.stateData) === "string" ? entry.stateData : this.formatEntryStateData(entry.stateData, debugLogKeys),
                message: entry.message,
                result: this.getDebugEntryResult(entry.result)
            });
            return rData;
        }, []).reverse();
    }

    /**
     * Formats the supplied timestamp as HH:MM:SS:MMM AM/PM 
     * @param timeStamp The timestamp to format.
     * @returns A string representation off the timestamp in HH:MM:SS:MMM AM/PM format. 
     */
    private formatTimestamp(timeStamp: number): string {
        const date = new Date(timeStamp);
        const formatter: Intl.DateTimeFormat = new Intl.DateTimeFormat('en-AU', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            fractionalSecondDigits: 3,
        });
        return formatter.format(date);
    }

    /**
     * Transforms the stateData into a string containing only the items specified in debugLogKeys. 
     * @param stateData The data to be processed.
     * @param debugLogKeys An array of keys to include in the returned string. 
     * @returns A string representation of the StateData containing only the keys specified in debugLogKeys. 
     */
    private formatEntryStateData(
        stateData: Record<string, unknown>,
        debugLogKeys: string[]): string {

        const pulledData = debugLogKeys.reduce((rData: Record<string, unknown>, key: string) => {
            if (key in stateData) {
                rData[key] = stateData[key];
            }
            return rData;
        }, {});
        return JSON.stringify(pulledData, null, 1);
    }

    /**
     * Transforms the supplied TransitionResult into the simplified DebugEntryResult.
     * @param transitionResult The transitionResult of a DebugLogEntry
     * @returns A DebugEntryResult
     */
    private getDebugEntryResult(transitionResult: TransitionResult): DebugEntryResult {
        switch (transitionResult) {
            case "success":
                return "success";
            case "override":
                return "override";
            case "reset":
                return 'reset';
            case "internal_error":
                return 'error';
            case "unknown_error":
                return "error";
            default:
                return 'warning';
        }
    }

}
