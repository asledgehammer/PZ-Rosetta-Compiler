/* eslint-disable prettier/prettier */

import { JavaType } from './JavaType';

export class JavaReturns {
    readonly type: JavaType;
    notes: string | undefined;

    constructor(type: JavaType, notes: string | undefined = undefined) {
        this.type = type;
        this.notes = notes;
    }

    toJSONObject(): any {
        return {
            type: this.type.toJSONObject(),
            notes: this.notes ? this.notes : undefined,
        };
    }
}
