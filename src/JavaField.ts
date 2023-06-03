/* eslint-disable prettier/prettier */

import { HTMLElement } from 'node-html-parser';
import { JavaElement } from './JavaElement';
import { JavaType } from './JavaType';
import { removeHtmlEncoding } from './Utils';

export class JavaField extends JavaElement {
    readonly name: string;
    readonly modifiers: string[] = [];
    readonly type: JavaType;

    readonly notes: string | undefined;

    constructor(element: HTMLElement) {
        super(element);

        const name = this.getText('.element-name');
        if (name != undefined) this.name = name;
        else {
            throw new Error('Name is not defined for JavaField.');
        }

        const modifiers = this.getText('.member-signature > .modifiers');
        if (modifiers != undefined) this.modifiers = modifiers.split(' ');

        const eReturnType = this.getElement('.member-signature > .return-type');
        if (eReturnType == undefined) throw new Error("Return Type not defined.");

        let basic = eReturnType.text;
        let full: string | undefined = undefined;
        if(basic.indexOf('<') !== -1) {
            full = basic;
            basic = basic.split('<')[0];
        }
        this.type = new JavaType(basic, full);

        const notes =
            this.element.querySelector('.block')?.firstChild.innerText;
        if (notes != undefined) {
            this.notes = removeHtmlEncoding(notes.trim());
        }
    }

    toJSONObject(): any {
        return {
            name: this.name,
            modifiers: this.modifiers.length !== 0 ? this.modifiers : undefined,
            deprecated: this.deprecated ? true : undefined,
            type: this.type.toJSONObject(),
            notes: this.notes ? this.notes : undefined,
        };
    }
}
