/* eslint-disable prettier/prettier */

import * as YAML from 'yaml';
import { HTMLElement, parse } from 'node-html-parser';
import * as fs from 'fs';

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

class JavaParameter {
    readonly name: string;
    readonly type: string;
    notes: string | undefined;

    constructor(
        name: string,
        type: string,
        notes: string | undefined = undefined,
    ) {
        this.name = name;
        this.type = type;
        this.notes = notes?.trim().replaceAll('&nbsp;', ' ');
    }

    toObject(): any {
        return {
            name: this.name,
            type: this.type,
            notes: this.notes,
        };
    }
}

class JavaField extends JavaElement {
    readonly name: string;
    readonly modifiers: string[] = [];
    readonly returnType: string | undefined;
    readonly parameters: JavaParameter[] = [];

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

        const returnType = this.getText('.member-signature > .return-type');
        if (returnType != undefined) this.returnType = returnType;

        const notes =
            this.element.querySelector('.block')?.firstChild.innerText;
        if (notes != undefined) {
            this.notes = notes.trim().replaceAll('&nbsp;', ' ');
        }
    }

    toObject(): any {
        return {
            name: this.name,
            deprecated: this.deprecated ? true : undefined,
            modifiers: this.modifiers.length !== 0 ? this.modifiers : undefined,
            returnType: this.returnType,
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
            let raw = '';
            let indent = 0;
            for (const char of eParameters.textContent) {
                if (indent !== 0) {
                    if (char === '<') {
                        indent++;
                    } else if (char === '>') {
                        indent--;
                    }
                    continue;
                } else {
                    if (char === '<') {
                        indent++;
                        continue;
                    } else if (char === '>') {
                        indent--;
                        continue;
                    }
                    raw += char;
                }
            }

            const sParameters = raw.split(',').map((s) => {
                return s
                    .replace('(', '')
                    .replace(')', '')
                    .replaceAll('\n', '')
                    .trim()
                    .split(String.fromCharCode(160));
            });

            for (const sParameter of sParameters) {
                const [type, name] = sParameter;
                this.parameters.push(new JavaParameter(name, type));
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
        this.name = name;
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
    readonly returnType: string;

    readonly notes: string | undefined;
    readonly returnNotes: string | undefined;

    constructor(element: HTMLElement) {
        super(element);

        let name = this.getText('.member-signature > .element-name');
        if (name != undefined) {
            if (name === 'toString') name = '__toString';
            else if (name === 'valueOf') name = '__valueOf';
            this.name = name;
        } else throw new Error('Name is not defined for JavaConstructor.');

        const modifiers = this.getText('.member-signature > .modifiers');
        if (modifiers != undefined) this.modifiers = modifiers.split(' ');

        const returnType = this.getText('.member-signature > .return-type');
        if (returnType != undefined) this.returnType = returnType;
        else throw new Error('returnType not defined.');
        const eParameters = this.getElement(
            '.member-signature > .parameters',
        )?.parentNode;

        if (eParameters != null) {
            let raw = '';
            let indent = 0;
            for (const char of eParameters.textContent) {
                if (indent !== 0) {
                    if (char === '<') {
                        indent++;
                    } else if (char === '>') {
                        indent--;
                    }
                    continue;
                } else {
                    if (char === '<') {
                        indent++;
                        continue;
                    } else if (char === '>') {
                        indent--;
                        continue;
                    }
                    raw += char;
                }
            }

            const sParameters = raw.split(',').map((s) => {
                return s
                    .replace('(', '')
                    .replace(')', '')
                    .replaceAll('\n', '')
                    .trim()
                    .split(String.fromCharCode(160));
            });

            for (const sParameter of sParameters) {
                const [type, name] = sParameter;
                this.parameters.push(new JavaParameter(name, type));
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
            returnType: this.returnType,
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
        const name = this.getText('.type-signature > .element-name');
        if (name == undefined) throw new Error('Name is undefined.');
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
