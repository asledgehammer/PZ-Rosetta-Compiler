/* eslint-disable prettier/prettier */
import { JavaMethod } from "./JavaMethod";

export class JavaMethodCluster {
    readonly methods: JavaMethod[] = [];
    readonly name: string;

    constructor(name: string) {
        this.name = name;
    }

    add(method: JavaMethod) {
        this.methods.push(method);
    }
}