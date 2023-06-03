/* eslint-disable prettier/prettier */

import { HTMLElement } from 'node-html-parser';
import { JavaElement } from './JavaElement';
import { JavaParameter } from './JavaParameter';
import { removeHtmlEncoding, splitParameters } from './Utils';
import { JavaReturns } from './JavaReturns';
import { JavaType } from './JavaType';

export class JavaMethod extends JavaElement {
    readonly name: string;
    readonly modifiers: string[] = [];
    readonly parameters: JavaParameter[] = [];
    readonly returns: JavaReturns;

    readonly notes: string | undefined;

    constructor(element: HTMLElement) {
        super(element);

        const name = this.getText('.member-signature > .element-name');
        if (name != undefined) this.name = name;
        else throw new Error('Name is not defined for JavaConstructor.');

        const modifiers = this.getText('.member-signature > .modifiers');
        if (modifiers != undefined) this.modifiers = modifiers.split(' ');

        const eReturnType = this.getElement('.member-signature > .return-type');
        if (eReturnType == undefined) throw new Error("ReturnType not defined.");
        let returnType = eReturnType.text;
        const returnTypeFull = returnType;
        if(returnType.indexOf('<') !== -1) {
            returnType = returnType.split('<')[0];
        }
        let returnNotes: string | undefined = undefined;
        
        const eParameters = this.getElement(
            '.member-signature > .parameters',
        )?.parentNode;

        if (eParameters != null) {
            const sParameters = splitParameters(eParameters.textContent);
            for (const sParameter of sParameters) {
                // const eNotes = this.getElement('.detail > .notes > dd > code');
                // if (eNotes != undefined) {
                //     for (const eNote of eNotes.childNodes) {
                //     }
                // }

                const {name, type, typeFull} = sParameter;
                const param = new JavaParameter(name, type, typeFull);
                this.parameters.push(param);
            }
        }

        const notes =
            this.element.querySelector('.block')?.firstChild.text;
        if (notes != undefined) {
            this.notes = removeHtmlEncoding(notes.trim());
        }

        // @return documentation
        const ddNotes = this.element.getElementsByTagName('dt');
        if (ddNotes.length !== 0) {
            let index = 0;
            for (; index < ddNotes.length; index++) {
                const next = ddNotes[index];

                if (next == undefined) break;

                // console.log(next.innerText);
                if (next.innerText === 'Returns:') {
                    const payload = next.nextElementSibling;
                    if (payload != undefined) {
                        returnNotes = removeHtmlEncoding(payload.innerText.trim());
                    }
                } else if (next.innerText === 'Parameters:') {
                    const payload = next.nextElementSibling;
                    const [name, notes] = payload.innerText
                        .trim()
                        .split(' -')
                        .map((s) => {
                            return s.trim();
                        });

                    if (notes !== '') {
                        for (const p of this.parameters) {
                            if (p.name === name) {
                                p.notes = notes.trim();
                                break;
                            }
                        }
                    }
                }
            }
        }

        this.returns = new JavaReturns(new JavaType(returnType, returnTypeFull), returnNotes);
    }

    toJSONObject(): any {
        return {
            name: this.name,
            modifiers: this.modifiers.length !== 0 ? this.modifiers : undefined,
            deprecated: this.deprecated ? true : undefined,
            parameters: this.parameters.length
                ? this.parameters.map((a) => a.toJSONObject())
                : undefined,
            returns: this.returns.toJSONObject(),
            notes: this.notes,
        };
    }
}
