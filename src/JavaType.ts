/* eslint-disable prettier/prettier */

export class JavaType {
    readonly basic: string;
    full: string | undefined;

    constructor(basic: string, full: string | undefined = undefined) {
        this.basic = basic;
        this.full = full;
    }

    toJSONObject(): any {
        return {
            basic: this.basic,
            full: this.full && this.full !== this.basic ? this.full : undefined,
        };
    }
}
