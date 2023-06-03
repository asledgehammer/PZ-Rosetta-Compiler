/* eslint-disable prettier/prettier */

import * as fs from 'fs';
import { parse } from 'node-html-parser';
import { JavaClass } from './JavaClass';
import { JavaNamespace } from './JavaNamespace';

export class JavaCatalog {
    readonly namespaces: { [name: string]: JavaNamespace } = {};

    parse(path: string) {
        const html = fs.readFileSync(path).toString();
        const root = parse(html);

        const classList = [];
        const list = root.getElementsByTagName('a');
        for (const item of list) {
            const href = item.attributes['href'];
            if (!href.startsWith('zombie/')) continue;
            classList.push(href);
        }

        const failedFiles = [];
        for (const classURI of classList) {
            const uri = `./docs/${classURI}`;
            try {
                const clazz = new JavaClass(uri);
                const name = clazz.namespace;
                if (!this.namespaces[name]) {
                    this.namespaces[name] = new JavaNamespace(name);
                }
                this.namespaces[name].addClass(clazz);
            } catch (ex) {
                console.error(`### Failed to scrape file: ${uri}`);
                failedFiles.push(uri);
            }
        }
        if (failedFiles.length !== 0) {
            console.error('Failed classes: ');
            for (const entry of failedFiles) {
                console.error(entry);
            }
        }
    }

    save(format: 'yml' | 'json') {
        const keys = Object.keys(this.namespaces);
        keys.sort((a, b) => a.localeCompare(b));
        for (const key of keys) {
            this.namespaces[key].save(format);
        }
    }
}
