/* eslint-disable prettier/prettier */

import * as YAML from 'yaml';
import { HTMLElement, parse } from 'node-html-parser';
import * as fs from 'fs';

const RESERVED_FUNCTION_NAMES = ['toString', 'valueOf'];
const RESERVED_WORDS = [
    'and',
    'break',
    'do',
    'else',
    'elseif',
    'end',
    'false',
    'for',
    'function',
    'if',
    'in',
    'local',
    'nil',
    'not',
    'or',
    'repeat',
    'return',
    'then',
    'true',
    'until',
    'while',

    // NOTE: This is a technical issue involving 'snakeyaml' interpreting
    //       this as a BOOLEAN not a STRING value.
    'on',
    'off',
    'yes',
    'no',
];

function splitParameters(
    paramString: string,
): Array<{ param: string; full: string }> {
    
    if(paramString === "") return [];
    
    paramString = paramString
        .replace('(', '')
        .replace(')', '')
        .replaceAll('\n', '')
        .trim();

    const params: Array<{ param: string; full: string }> = [];



    let genericIndent = 0;
    let current = { param: '', full: '' };

    for (const char of paramString) {
        // (Generics counter block)
        if (char === '<') {
            genericIndent++;
            current.full += char;
            continue;
        } else if (char === '>') {
            genericIndent--;
            current.full += char;
            continue;
        }

        // (Only split params if not inside of a Generics block)
        if (char === ',' && genericIndent === 0) {
            params.push(current);
            current = { param: '', full: '' };
            continue;
        }

        // (Add to basic param if not in Generics block)
        if (genericIndent === 0) current.param += char;

        current.full += char;
    }

    params.push(current);

    return params;
}

function isReservedWord(word: string): boolean {
    return RESERVED_WORDS.indexOf(word.toLowerCase()) !== -1;
}

function isReservedFunctionName(word: string): boolean {
    return RESERVED_FUNCTION_NAMES.indexOf(word) !== -1;
}

abstract class JavaElement {
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

class JavaReturn {
    readonly type: string;
    readonly generic: string;
    notes: string | undefined;

    constructor(type: string, generic: string) {
        this.type = type.trim();
        this.generic = generic.trim();
    }

    toObject(): any {
        return {
            type: this.type,
            generic: this.type !== this.generic ? this.generic : undefined,
            notes: this.notes,
        };
    }
}

class JavaParameter {
    readonly name: string;
    readonly type: string;
    readonly generic: string;
    notes: string | undefined;

    constructor(name: string, type: string, generic: string) {
        this.name = isReservedWord(name) ? `__${name}` : name;
        this.type = type;
        this.generic = generic;
    }

    toObject(): any {
        return {
            name: this.name,
            type: this.type,
            generic: this.generic !== this.type ? this.generic : undefined,
            notes: this.notes,
        };
    }
}

class JavaField extends JavaElement {
    readonly name: string;
    readonly modifiers: string[] = [];
    readonly type: string | undefined;
    readonly genericType: string | undefined;
    readonly parameters: JavaParameter[] = [];

    readonly notes: string | undefined;

    readonly return: JavaReturn;

    constructor(element: HTMLElement) {
        super(element);

        const name = this.getText('.element-name');
        if (name != undefined) this.name = name;
        else {
            throw new Error('Name is not defined for JavaField.');
        }

        const modifiers = this.getText('.member-signature > .modifiers');
        if (modifiers != undefined) this.modifiers = modifiers.split(' ');

        // RETURN DATA
        const returnType = this.getText('.member-signature > .return-type');
        const genericType = this.getElement('.member-signature > .return-type')
            ?.parentNode.text;
        if (returnType == undefined || genericType == undefined) {
            throw new Error(
                'The return type for field ' + name + ' is missing.',
            );
        }
        this.return = new JavaReturn(returnType, genericType);

        const notes =
            this.element.querySelector('.block')?.innerText;
        if (notes != undefined) {
            this.notes = notes.trim().replaceAll('&nbsp;', ' ');
        }
    }

    toObject(): any {
        return {
            name: this.name,
            deprecated: this.deprecated ? true : undefined,
            modifiers: this.modifiers.length !== 0 ? this.modifiers : undefined,
            return: this.return.toObject(),
            notes: this.notes,
        };
    }
}

class JavaConstructor extends JavaElement {
    readonly name: string;
    readonly modifiers: string[] = [];
    readonly parameters: JavaParameter[] = [];

    readonly notes: string | undefined;
    readonly returnNotes: string | undefined;

    constructor(element: HTMLElement) {
        super(element);

        const name = this.getText('.member-signature > .element-name');
        if (name != undefined) this.name = name;
        else throw new Error('Name is not defined for JavaConstructor.');

        const modifiers = this.getText('.member-signature > .modifiers');
        if (modifiers != undefined) this.modifiers = modifiers.split(' ');

        const eParameters = this.getElement(
            '.member-signature > .parameters',
        )?.parentNode;

        if (eParameters != null) {
            const paramsSplit = splitParameters(eParameters.textContent);
            const funSpace = String.fromCharCode(160);
            const sParameters = paramsSplit.map((a) => {
                const split = a.param.split(funSpace);
                return {
                    name: split[1].trim(),
                    type: split[0].trim(),
                    full: a.full.split(funSpace)[0].trim(),
                };
            });

            for (const sParameter of sParameters) {
                this.parameters.push(
                    new JavaParameter(
                        sParameter.name,
                        sParameter.type,
                        sParameter.full,
                    ),
                );
            }
        }

        const notes =
            this.element.querySelector('.block')?.firstChild.innerText;
        if (notes != undefined) {
            this.notes = notes.trim().replaceAll('&nbsp;', ' ');
        }

        // @return documentation
        const ddNotes = this.element.getElementsByTagName('dt');
        if (ddNotes.length !== 0) {
            let index = 0;
            for (; index < ddNotes.length; index++) {
                const next = ddNotes[index];

                if (next == undefined) break;

                if (next.innerText === 'Returns:') {
                    const payload = next.nextElementSibling;
                    if (payload != undefined) {
                        this.returnNotes = payload.innerText.trim();
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
    }

    toObject(): any {
        return {
            name: this.name,
            deprecated: this.deprecated ? true : undefined,
            modifiers: this.modifiers.length !== 0 ? this.modifiers : undefined,
            parameters:
                this.parameters.length !== 0
                    ? this.parameters.map((p) => {
                          return p.toObject();
                      })
                    : undefined,
            notes: this.notes,
        };
    }
}

class JavaMethodCluster {
    readonly methods: JavaMethod[] = [];
    readonly name: string;

    constructor(name: string) {
        this.name = isReservedFunctionName(name) ? `__${name}` : name;
    }

    sort(): JavaMethod[] {
        this.methods.sort((a, b) => {
            return a.parameters.length - b.parameters.length;
        });
        return this.methods;
    }

    add(method: JavaMethod) {
        if (this.methods.indexOf(method) !== -1) return;
        this.methods.push(method);
    }
}

class JavaMethod extends JavaElement {
    readonly name: string;
    readonly modifiers: string[] = [];
    readonly parameters: JavaParameter[] = [];

    readonly notes: string | undefined;

    readonly return: JavaReturn;

    constructor(element: HTMLElement) {
        super(element);

        let name = this.getText('.member-signature > .element-name');
        if (name != undefined) {
            name = isReservedFunctionName(name) ? `__${name}` : name;
            this.name = name;
        } else throw new Error('Name is not defined for JavaConstructor.');

        const modifiers = this.getText('.member-signature > .modifiers');
        if (modifiers != undefined) this.modifiers = modifiers.split(' ');

        // RETURN DATA
        const returnType = this.getText('.member-signature > .return-type');
        const genericType = this.getElement('.member-signature > .return-type')
            ?.parentNode.text;
        if (returnType == undefined || genericType == undefined) {
            throw new Error(
                'The return type for field ' + name + ' is missing.',
            );
        }
        this.return = new JavaReturn(returnType, genericType);

        const eParameters = this.getElement(
            '.member-signature > .parameters',
        )?.parentNode;

        if (eParameters != null) {
            const paramsSplit = splitParameters(eParameters.textContent);
            const funSpace = String.fromCharCode(160);
            const sParameters = paramsSplit.map((a) => {
                const split = a.param.split(funSpace);
                return {
                    name: split[1].trim(),
                    type: split[0].trim(),
                    full: a.full.split(funSpace)[0].trim(),
                };
            });

            for (const sParameter of sParameters) {
                this.parameters.push(
                    new JavaParameter(
                        sParameter.name,
                        sParameter.type,
                        sParameter.full,
                    ),
                );
            }
        }

        const notes =
            this.element.querySelector('.block')?.firstChild.innerText;
        if (notes != undefined) {
            this.notes = notes.trim().replaceAll('&nbsp;', ' ');
        }

        // @return documentation
        const ddNotes = this.element.getElementsByTagName('dt');
        if (ddNotes.length !== 0) {
            let index = 0;
            for (; index < ddNotes.length; index++) {
                const next = ddNotes[index];

                if (next == undefined) break;
                if (next.innerText === 'Returns:') {
                    const payload = next.nextElementSibling;
                    if (payload != undefined) {
                        this.return.notes = payload.innerText.trim();
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
    }

    toObject(): any {
        return {
            name: this.name,
            deprecated: this.deprecated ? true : undefined,
            modifiers: this.modifiers.length !== 0 ? this.modifiers : undefined,
            return: this.return.toObject(),
            parameters:
                this.parameters.length !== 0
                    ? this.parameters.map((p) => {
                          return p.toObject();
                      })
                    : undefined,
            notes: this.notes,
        };
    }
}

class JavaClass extends JavaElement {
    readonly fields: { [name: string]: JavaField } = {};
    readonly methods: { [name: string]: JavaMethodCluster } = {};
    readonly constructors: JavaConstructor[] = [];
    readonly generic: string | undefined;

    readonly package: string;
    readonly name: string;
    readonly modifiers: string[] = [];
    readonly notes: string | undefined;
    readonly _extends: string | undefined;
    type: string;

    constructor(path: string) {
        super(parse(fs.readFileSync(path).toString()));

        const { element } = this;

        // Java Package
        this.package = this.getText('.header > .sub-title > a')!;

        // Java Type & Modifiers
        const split = this.getText('.type-signature > .modifiers')!.split(' ');

        // Deprecation check.
        this.deprecated =
            this.getElement('.class-description .deprecation-block') != null;

        const extendsText = this.getText(
            '.class-description .extends-implements > a',
        );
        if (extendsText != null) {
            this._extends = extendsText.trim();
        }

        this.type = 'unknown';
        
        const eName = this.getElement('.type-signature > .element-name')?.parentNode;
        if (eName == undefined) throw new Error('Name is undefined.');
        
        const eTemp = eName.textContent;
        let name = this.getText('.type-signature > .element-name')!;
        
        if(name.indexOf('&lt;') !== -1) {
            name = name.replaceAll('&lt;', '<').replaceAll('&gt;', '>');
            this.generic = name;
            name = name.split('<')[0];
        }

        this.name = name;

        this.notes = this.getText('.class-description .block')?.trim();

        for (const modifier of split) {
            if (modifier === '') continue;
            else if (modifier === 'class') {
                this.type = 'class';
                continue;
            } else if (modifier === 'enum') {
                this.type = 'enum';
                continue;
            } else if (modifier === 'interface') {
                this.type = 'interface';
                continue;
            }
            this.modifiers.push(modifier);
        }

        // ENUM CONSTANTS
        if (this.type === 'enum') {
            const listFields = element.querySelector(
                '.constant-details > .member-list',
            );
            if (listFields != undefined) {
                for (const field of listFields.getElementsByTagName('li')) {
                    // (<li> <section>..</section></li> pattern check)
                    const sectionCheck = field.getElementsByTagName('section');
                    if (
                        sectionCheck == undefined ||
                        sectionCheck.length === 0
                    ) {
                        continue;
                    }

                    const javaField = new JavaField(field as HTMLElement);
                    this.fields[javaField.name] = javaField;
                }
            }
        }

        // FIELDS
        const listFields = element.querySelector(
            '.field-details > .member-list',
        );
        if (listFields != undefined) {
            for (const field of listFields.getElementsByTagName('li')) {
                // (<li> <section>..</section></li> pattern check)
                const sectionCheck = field.getElementsByTagName('section');
                if (sectionCheck == undefined || sectionCheck.length === 0) {
                    continue;
                }

                const javaField = new JavaField(field as HTMLElement);
                this.fields[javaField.name] = javaField;
            }
        }

        // CONSTRUCTORS
        const listConstructors = element.querySelector(
            '.constructor-details > .member-list',
        );
        if (listConstructors != undefined) {
            for (const conztructor of listConstructors.getElementsByTagName(
                'li',
            )) {
                // (<li> <section>..</section></li> pattern check)
                const sectionCheck =
                    conztructor.getElementsByTagName('section');
                if (sectionCheck == undefined || sectionCheck.length === 0) {
                    continue;
                }

                const javaConstructor = new JavaConstructor(
                    conztructor as HTMLElement,
                );
                this.constructors.push(javaConstructor);
            }
        }

        // METHODS
        const listMethods = element.querySelector('#method-detail');
        if (listMethods != undefined) {
            for (const method of listMethods.getElementsByTagName('li')) {
                // (<li> <section>..</section></li> pattern check)
                const sectionCheck = method.getElementsByTagName('section');
                if (sectionCheck == undefined || sectionCheck.length === 0) {
                    continue;
                }

                const javaMethod = new JavaMethod(method);

                let cluster = this.methods[javaMethod.name];
                if (cluster == undefined) {
                    cluster = new JavaMethodCluster(javaMethod.name);
                    this.methods[cluster.name] = cluster;
                }
                cluster.add(javaMethod);
            }
        }
    }

    toObject(): any {
        const fieldKeys = Object.keys(this.fields);
        fieldKeys.sort((a, b) => {
            return a.localeCompare(b);
        });

        const fieldsSorted = [];
        for (const key of fieldKeys) {
            fieldsSorted.push(this.fields[key].toObject());
        }

        const methodClusterKeys = Object.keys(this.methods);
        methodClusterKeys.sort((a, b) => {
            return a.localeCompare(b);
        });

        const methodsSorted = [];
        for (const key of methodClusterKeys) {
            const cluster = this.methods[key];
            const methods = cluster.sort();
            for (const method of methods) {
                methodsSorted.push(method.toObject());
            }
        }

        const constructors = this.constructors.map((c) => {
            return c.toObject();
        });

        return {
            package: this.package,
            type: this.type,
            name: this.name,
            generic: this.generic,
            extends: this._extends != undefined ? this._extends : undefined,
            modifiers: this.modifiers.length !== 0 ? this.modifiers : undefined,
            deprecated: this.deprecated ? true : undefined,
            notes: this.notes,
            fields: fieldsSorted.length !== 0 ? fieldsSorted : undefined,
            constructors: constructors.length !== 0 ? constructors : undefined,
            methods: methodsSorted.length !== 0 ? methodsSorted : undefined,
        };
    }

    save(): void {
        const yaml = YAML.stringify(this.toObject());
        const folder = `dist/${this.package.replace(/\./g, '/')}/`;

        let append = './';
        folder.split('/').forEach((f) => {
            append += f + '/';
            if (!fs.existsSync(append)) fs.mkdirSync(append);
        });

        const header = `# ${this.package}.${this.name}\n`;

        fs.writeFileSync(`${folder}/${this.name}.yml`, header + yaml);
    }
}

class JavaClassCatalog {
    constructor() {
        const path = './docs/allclasses-index.html';
        const html = fs.readFileSync(path).toString();
        const root = parse(html);

        const classList = [];
        const list = root.getElementsByTagName('a');
        for (const item of list) {
            const href = item.attributes['href'];
            if (!href.startsWith('zombie/')) {
                continue;
            }
            classList.push(href);
        }

        const failedFiles = [];
        for (const classURI of classList) {
            const uri = `./docs/${classURI}`;
            try {
                new JavaClass(uri).save();
            } catch (ex: any) {
                console.error(`### Failed to scrape HTML file: ${uri}`);
                console.error(ex.message);
                failedFiles.push(uri);
            }
        }
        if (failedFiles.length !== 0) {
            console.error('Failed classes: ');
            for (const entry of failedFiles) {
                console.error(` -  ${entry}`);
            }
        }
    }
}

new JavaClassCatalog();
