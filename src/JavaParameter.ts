/* eslint-disable prettier/prettier */

import { removeHtmlEncoding } from "./Utils";
import { JavaType } from "./JavaType";

export class JavaParameter {
    readonly name: string;
    readonly type: JavaType;
    notes: string | undefined;

    constructor(
        name: string,
        type: string,
        typeFull: string | undefined,
        notes: string | undefined = undefined,
    ) {
        this.name = name;
        this.type = new JavaType(type, typeFull);
        this.notes = notes != undefined ? removeHtmlEncoding(notes.trim()) : undefined; 
    }

    toJSONObject(): any {
        return {
            name: this.name,
            type: this.type.toJSONObject(),
            notes: this.notes != undefined ? removeHtmlEncoding(this.notes) : undefined,
        };
    }
}
