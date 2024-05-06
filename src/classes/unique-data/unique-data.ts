/**
 * An object containing a  UUID and optional data of type T.
 * @template T The type of the optional data property. Default is void
 */
export interface UniqueCustomData<T = void> {
    /** The UUID assigned to the UniqueCustomData object */
    uuid: string;
    /** Optional data property of the UniqueCustomData object */
    data?: T;
}

/**
 * Class to create UUIDs and Unique Custom Data objects. 
 * UUIDs are useful when generating diagrams as they require unique ids. 
 * Unique Custom data objects can be used to trigger change detection when data is not required or has the potential to remain the same.  
 */
export class UniqueDataService {

    /**
     * A wrapper around crypto.randomUUID. Override to implement a custom UUID in insecure contexts. 
     * @returns A Universally Unique Identifier
     */
    public generateUUID(): string {
        return crypto.randomUUID();
    }

    /**
     * Returns a UniqueCustomData object that can be used to trigger change detection when data is not required or has the potential to remain the same.
     * @param data Optional data to include in the UniqueCustomData object. 
     * @returns An object containing a UUID and optional data of type T.
     */
    public generateUniqueCustomData<T>(data?: T): UniqueCustomData<T> {
        return {
            uuid: this.generateUUID(),
            data
        };
    }
}