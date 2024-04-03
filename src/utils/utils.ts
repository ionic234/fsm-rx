/**
 * Utility type that creates a partial object where a value for at least one property must be given<br/>
 * @template T - The object to convert into a RequireOne partial. 
 */
export type RequireOne<T extends object> =
    Partial<T> & {
        [Prop in keyof T]: Required<Pick<T, Prop>>
    }[keyof T];

/**
 * Utility type that ensures no value in the string union U can be included in the string union T
 * @template T Haystack to look for prohibited values in
 * @template U Needle of prohibited values. 
 */

// Creates a mapped type by iterating over the union U 
// If Key is in the union T its value is stored in the mapped type.
// This is done by checking: 
//      1. T isn't equal to U or a subtype of U
//      2. U isn't equal to T or a subtype of T
// The indexed access type [U] is used to get a union of all the keys that are not set to never
// If this union is a never then T is returned as no U values exist in T else never is returned 

export type NeverHasStringValue<
    T extends string,
    U extends string
> =
    {
        [Key in U]: (
            [T] extends [Key]
            ? never
            : (
                Key extends T
                ? never
                : T
            )
        ) extends never
        ? Key
        : never
    }[U] extends never
    ? Flat<T>
    : never;


/**
 * Utility that flattens objects / unions into a single value
 *  @template T - The target object / union to be flattened 
 */
export type Flat<T> = { [K in keyof T]: T[K] };


// FlattenObject is useful for when flat fails to adequately collect all the properties of an intersection object (ObjC = ObjA & ObjB)
// T extends O collects all properties of intersection object T in to one object O and returns them using a mapped type. 
export type FlattenObject<T extends object> = T extends infer O
    ? { [K in keyof O]: O[K] }
    : never;
