/* eslint-disable prettier/prettier */

import { HTMLElement } from 'node-html-parser';

export abstract class JavaElement {
    readonly element: HTMLElement;
    public deprecated: boolean;

    constructor(element: HTMLElement) {
        this.element = element;
        this.deprecated =
            this.element.querySelector('.deprecated-block') != undefined;
    }

    getElement(selector: string): HTMLElement | undefined {
        const element = this.element.querySelector(selector);
        if (element == undefined) return undefined;
        return element.firstChild as HTMLElement;
    }

    getText(selector: string): string | undefined {
        const element = this.getElement(selector);
        if (element == undefined) return undefined;
        return element.innerText;
    }
}
