/* eslint-disable prettier/prettier */

import * as YAML from 'yaml';
import * as fs from 'fs';
import { HTMLElement, parse } from 'node-html-parser';
import { removeHtmlEncoding } from './Utils';
import { JavaElement } from './JavaElement';
import { JavaField } from './JavaField';
import { JavaMethod } from './JavaMethod';
import { JavaConstructor } from './JavaConstructor';

export class JavaClass extends JavaElement {
    readonly fields: { [name: string]: JavaField } = {};
    readonly methods: { [name: string]: JavaMethod[] } = {};
    readonly constructors: JavaConstructor[] = [];

    readonly namespace: string;
    readonly name: string;
    readonly modifiers: string[] = [];
    readonly notes: string | undefined;
    readonly 'extends': string | undefined;
    readonly javaType: string;

    constructor(path: string) {
        super(parse(fs.readFileSync(path).toString()));

        const { element } = this;

        // Java Package
        this.namespace = this.getText('.header > .sub-title > a')!;

        // Java Type & Modifiers
        const split = this.getText('.type-signature > .modifiers')!.split(' ');

        // Deprecation check.
        this.deprecated =
            this.getElement('.class-description .deprecation-block') != null;

        const extendsText = this.getText(
            '.class-description .extends-implements > a',
        );
        if (extendsText != null) {
            this['extends'] = extendsText.trim();
        }

        let javaType = 'unknown';
        const eName = this.getElement('.type-signature > .element-name');
        if (eName == undefined) throw new Error('Name is undefined.');
        let name = eName.text;
        if (name.indexOf('<') !== -1) {
            name = name.split('<')[0];
        }
        this.name = name;

        const notes = this.getText('.class-description .block');
        if (notes != undefined) {
            this.notes = removeHtmlEncoding(notes.trim());
        }

        for (const modifier of split) {
            if (modifier === '') continue;
            else if (modifier === 'class') {
                javaType = 'class';
                continue;
            } else if (modifier === 'enum') {
                javaType = 'enum';
                continue;
            } else if (modifier === 'interface') {
                javaType = 'interface';
                continue;
            }
            this.modifiers.push(modifier);
        }

        this.javaType = javaType;

        // console.log(`Parsing Class: ${this.package}.${name}..`);

        // FIELDS

        if (this.javaType === 'enum') {
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
                const { name: methodName } = javaMethod;

                try {
                    if (!this.methods[methodName])
                        this.methods[methodName] = [];
                    this.methods[methodName].push(javaMethod);
                } catch (ex) {
                    // This works but causes an error.. and I have no idea why. -Jab, 6/6/2023
                }
            }
        }
    }

    toJSONObject(): any {
        const obj: {
            fields: { [name: string]: any } | undefined;
            constructors: any[] | undefined;
            methods: any[] | undefined;
            deprecated: boolean | undefined;
            modifiers: string[] | undefined;
            javaType: string;
            extends: string | undefined;
            notes: string | undefined;
        } = {
            fields: undefined,
            constructors: undefined,
            methods: undefined,
            modifiers: this.modifiers.length !== 0 ? this.modifiers : undefined,
            deprecated: this.deprecated ? true : undefined,
            javaType: this.javaType,
            extends: this['extends'],
            notes: this.notes,
        };

        const fieldKeys = Object.keys(this.fields);
        if (fieldKeys.length !== 0) {
            obj.fields = {};
            fieldKeys.sort((a, b) => a.localeCompare(b));
            for (const key of fieldKeys) {
                obj.fields[key] = this.fields[key].toJSONObject();
            }
            
        }

        const methodKeys = Object.keys(this.methods);
        if (methodKeys.length !== 0) {
            obj.methods = [];
            methodKeys.sort((a, b) => a.localeCompare(b));
            for (const key of methodKeys) {
                const cluster = this.methods[key];
                for (const method of cluster) {
                    obj.methods.push(method.toJSONObject());
                }
            }
        }

        if (this.constructors.length !== 0) {
            obj.constructors = this.constructors.map((c) => c.toJSONObject());
        }

        return obj;
    }

    save(format: 'yml' | 'json'): void {
        let path = '';
        let text = '';
        if (format === 'yml') {
            path = `dist/yml/${this.namespace.replace(/\./g, '/')}/`;
            text =
                `# ${this.namespace}.${this.name}\n` +
                YAML.stringify(this.toJSONObject());
        } else {
            path = `dist/json/${this.namespace.replace(/\./g, '/')}/`;
            text = JSON.stringify(this.toJSONObject());
        }

        let append = './';
        path.split('/').forEach((f) => {
            append += f + '/';
            if (!fs.existsSync(append)) fs.mkdirSync(append);
        });

        fs.writeFileSync(`${path}/${this.name}.${format}`, text);
    }
}
