/* eslint-disable prettier/prettier */

import * as YAML from 'yaml';
import * as fs from 'fs';
import { JavaClass } from './JavaClass';

export class JavaNamespace {
    readonly name: string;
    readonly classes: { [name: string]: JavaClass } = {};

    constructor(name: string) {
        this.name = name;
    }

    save(format: 'yml' | 'json') {
        let path = '';
        let text = '';
        if (format === 'yml') {
            path = `dist/yml/`;
            const namespaces: { [name: string]: any } = {};
            namespaces[this.name] = this.toJSONObject();
            text = YAML.stringify({namespaces}, null, 2);
        } else {
            path = `dist/json/`;
            const namespaces: { [name: string]: any } = {};
            namespaces[this.name] = this.toJSONObject();
            text = JSON.stringify({namespaces}, null, 2);
        }

        let append = './';
        path.split('/').forEach((f) => {
            append += f + '/';
            if (!fs.existsSync(append)) fs.mkdirSync(append);
        });

        fs.writeFileSync(
            `${path}/${this.name.replace(/\./g, '-')}.${format}`,
            text,
        );
    }

    addClass(clazz: JavaClass) {
        this.classes[clazz.name] = clazz;
    }

    toJSONObject(): any {
        const obj: { [name: string]: any } = {};
        const keys = Object.keys(this.classes);
        keys.sort((a, b) => a.localeCompare(b));

        for (const key of keys) {
            const clazz = this.classes[key];
            obj[key] = clazz.toJSONObject();
        }

        return obj;
    }
}
