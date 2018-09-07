'use strict';

// https://stackoverflow.com/questions/29775830/how-to-implement-a-typescript-decorator
// https://stackoverflow.com/questions/52175508/conditional-types-with-typescript

import * as assert from 'assert';
import chalk from 'chalk';
import {getTable} from './table';
import * as util from 'util';


export const r2gSmokeTest = function () {
  // r2g command line app uses this exported function
  return true;
};

type TypeMapping<T = any> = {
  Boolean: boolean,
  String: string,
  Number: number,
  Integer: number,
  ArrayOfString: Array<string>,
  ArrayOfBoolean: Array<boolean>,
  ArrayOfNumber: Array<number>,
  ArrayOfInteger: Array<number>,
  JSON: T,
  SeparatedStrings: Array<string>,
  SeparatedNumbers: Array<string>,
  SeparatedIntegers: Array<string>,
  SeparatedBooleans: Array<string>
}

export enum Type {
  Boolean = 'Boolean',
  String = 'String',
  Number = 'Number',
  Integer = 'Integer',
  ArrayOfString = 'ArrayOfString',
  ArrayOfBoolean = 'ArrayOfBoolean',
  ArrayOfNumber = 'ArrayOfNumber',
  ArrayOfInteger = 'ArrayOfInteger',
  JSON = 'JSON',
  SeparatedStrings = 'SeparatedStrings',
  SeparatedNumbers = 'SeparatedNumbers',
  SeparatedIntegers = 'SeparatedIntegers',
  SeparatedBooleans = 'SeparatedIntegers'
}

// const asOptions = <K extends keyof any, T extends Array<{ name: K, type: keyof TypeMapping }>>(t: T) => t;
//
//
// type OptionsToType<T extends Array<{ name: keyof any, type: keyof TypeMapping }>>
//   = { [K in T[number]['name']]: TypeMapping[Extract<T[number], { name: K }>['type']] }

export interface ElemType<T = any> {
  name: string,
  alt?: string | Array<string>
  short?: string,
  type: keyof TypeMapping,
  default?: any,
  separator?: string,
  env?: string | Array<string>,
  help?: string
}

export const asOptions = <K extends keyof any, T extends Array<{ name: K, type: keyof TypeMapping }>>(t: T) => t;

export type OptionsToType<T extends Array<ElemType>>
  = { [K in T[number]['name']]: TypeMapping[Extract<T[number], { name: K }>['type']] }

export interface ParsedValue extends ElemType {
  cleanName: string
}

export interface Parsed {
  [key: string]: ParsedValue
}

export interface CliParserHelpOpts {
  includeEnv: boolean
}

export interface CliParserOptions {
  commandName: string,
  commandExample: string
  allowUnknown: boolean
}

export class CliParser<T extends Array<ElemType>> {

  private readonly options: T;
  private readonly opts: OptionsToType<T>;
  private readonly parserOpts: CliParserOptions;

  static separators = [Type.SeparatedBooleans, Type.SeparatedIntegers, Type.SeparatedStrings, Type.SeparatedNumbers];
  static arrays = [Type.ArrayOfBoolean, Type.ArrayOfString, Type.ArrayOfInteger];

  allowUnknown = false;

  constructor(o: T, opts?: Partial<CliParserOptions>) {

    this.parserOpts = <CliParserOptions>(opts || {});
    this.options = o;

    try {

      if ('allowUnknown' in this.parserOpts) {
        assert([undefined, true, false].includes(this.parserOpts.allowUnknown),
          '"allowUnknown" option must be a boolean.');
      }

      this.allowUnknown = this.parserOpts.allowUnknown || false;

      const set = {} as { [key: string]: true };

      for (let i = 0; i < o.length; i++) {
        const v = o[i];

        assert(v.name && typeof v.name === 'string',
          `${JSON.stringify(v)} is missing a name field, or the field is not a string.`);

        assert(!/-{2}/.test(v.name), `A "name" field cannot have more than one consecutive hyphen. See: ${chalk.bold(v.name)}.`);
        assert(!/_{2}/.test(v.name), `A "name" field cannot have more than one consecutive underscore. See: ${chalk.bold(v.name)}.`);

        assert(!v.name.startsWith('-'), 'A "name" field cannot start with a - hyphen character.');

        assert(/^[A-Za-z0-9-_:@]+$/.test(v.name),
          `"name" letter must be alphanumeric, or have a colon, underscore, ampersand, or hyphen/dash. See: ${chalk.bold(v.name)}.`);

        if (v.short) {
          assert.strictEqual(typeof v.short, 'string', `"short" property must be a string. See: '${util.inspect(v.short)}'.`);
          assert(v.short.length === 1, `"short" string property must be one character in length. See: '${v.short}'.`);
          assert(/[A-Za-z]/.test(v.short), `"short" letter must be alphabetic (uppercase or lowercase. See: '${v.short}'.`);
        }

        const clean = this.getCleanOpt(v.name);
        if (set[clean]) {
          throw `Duplication of option for "name" => '${v.name}'.`;
        }
        else if(set[v.short]){
          throw `Duplication of option for "short" => '${v.short}'.`;
        }
        else {
          set[clean] = set[v.short] = true;
        }
      }
    }
    catch (e) {
      throw chalk.magenta(e);
    }
  }

  getCleanOpt(v: string) {

    // return String(v).replace(/[-_]/g, '').toLowerCase();

    while (v.startsWith('-')) {
      v = v.slice(1);
    }

    return v.toLowerCase()
  }

  getSpreadedArray(v: Array<string>): Array<string> {

    const ret: Array<string> = [];

    for (let i = 0; i < v.length; i++) {

      const elem = v[i];

      if (elem.startsWith('–')) {
        throw 'Your program has an "en-dash" instead of a hyphen - .';
      }

      if (elem.startsWith('—')) {
        throw 'Your program has an "em-dash" instead of a hyphen - .';
      }

      if (elem.startsWith('-')) {
        const index = elem.indexOf('=');
        if (index > -1) {
          const first = elem.slice(0, index).trim();
          const second = elem.slice(index + 1).trim();

          if (first.length < 1 || second.length < 1) {
            throw chalk.magenta('Malformed expression involving equals (=) sign, see: ' + elem);
          }
          ret.push(first, second);
          continue;
        }
      }

      ret.push(elem);
    }

    return ret;
  }

  getHelpString(v?: CliParserHelpOpts) {
    v = <CliParserHelpOpts>(v || {});
    return getTable(this.options, this.parserOpts, v);
  }


  parse(argv?: Array<string>) {

    if (!argv) {
      argv = process.argv;
    }

    if (argv === process.argv) {
      argv = argv.slice(2);
    }

    assert(Array.isArray(argv), 'argv is not an array.');
    argv.forEach(v => {
      assert.strictEqual(typeof v, 'string', `Element in the argv array is not a string type => ${util.inspect(v)}`);
    });

    const ret = {} as { [key: string]: any };
    const values: Array<string> = [];

    this.options.forEach(v => {
      if (CliParser.arrays.includes(<Type>v.type)) {
        ret[v.name] = [];
      }
    });

    console.log('ret prepped:', ret);

    const nameHash = <Parsed>{};
    const shortNameHash = <Parsed>{};

    for (let i = 0; i < this.options.length; i++) {
      const o = this.options[i];
      const cleanName = this.getCleanOpt(o.name);
      nameHash[cleanName] = Object.assign({}, o, {cleanName});
      if (o.short) {
        shortNameHash[o.short] = Object.assign({}, o, {cleanName});
      }
    }

    const args = this.getSpreadedArray(argv);
    console.log('these args:', args);

    let prev: ParsedValue = null;

    for (let i = 0; i < args.length; i++) {

      const a = args[i];

      if (prev) {

        let v: string | number | Array<string> | Array<number>;

        if (prev.type === Type.String || prev.type === Type.ArrayOfString) {
          v = a.slice(0);
        }
        else if (prev.type === Type.Integer || prev.type === Type.ArrayOfInteger) {
          v = Number.parseInt(a);
        }
        else if (prev.type === Type.Number || prev.type === Type.ArrayOfNumber) {
          v = Number.parseFloat(a);
        }
        else if (CliParser.separators.includes(<Type>prev.type)) {
          v = a.split(prev.separator || ',').map(v => String(v || '').trim()).filter(Boolean).map(v => {
            switch (<Type>prev.type) {
              case Type.SeparatedNumbers:
                return JSON.parse(v);
              case Type.SeparatedIntegers:
                return Number.parseInt(v);
              case Type.SeparatedBooleans:
                return Boolean(JSON.parse(v));
            }

            return v;
          });
        }
        else {
          throw new Error('No type matched. Fallthrough.');
        }

        const name = prev.name;
        if (CliParser.arrays.includes(<Type>prev.type)) {
          ret[name].push(v);
          continue;
        }

        if (name in ret) {
          throw chalk.magenta(`Non-array and non-boolean option was used more than once, the option name is: '${name}'.`);
        }
        ret[name] = v;
        prev = null;
        continue;
      }


      if (!a.startsWith('-')) {
        values.push(a);
        prev = null;
        continue;
      }


      const clean = this.getCleanOpt(a);
      let longOpt = null;

      if (a.startsWith('--')) {
        longOpt = nameHash[clean];

        if (!longOpt) {
          if (this.allowUnknown) {
            values.push(a);
            continue;
          }

          throw chalk.magenta('Could not find option with name: ' + a);
        }

        if (longOpt.type === Type.Boolean) {
          ret[longOpt.name] = true;
        }
        else if (longOpt.type === Type.ArrayOfBoolean) {
          ret[longOpt.name].push(true);
        }
        else {
          prev = longOpt;
          if (!args[i + 1]) {
            throw chalk.magenta('Not enough arguments to satisfy: ') + chalk.magenta.bold(JSON.stringify(longOpt));
          }
        }
        continue;
      }

      let c = null;
      const shorties = a.slice(1).split('');
      const shortOpts: Parsed = shorties.reduce((a, b) => (a[b] = shortNameHash[b], a), <Parsed>{});
      const keys = Object.keys(shortOpts);

      for (let j = 0; j < keys.length; j++) {

        const k = keys[j];
        const t = shortOpts[k];

        if (!t) {

          if (this.allowUnknown) {
            values.push(a);
            break;
          }

          throw chalk.magenta('No short name for letter: ' + k);
        }

        if (t.type !== Type.Boolean && t.type !== Type.ArrayOfBoolean) {
          if (j < keys.length - 1) {
            throw chalk.magenta(`When you group options, only the last option can be non-boolean. The letter that is the problem is: '${k}', in the following group: ${a}`);
          }

          if (!args[i + 1]) {
            throw chalk.magenta('Not enough arguments to satisfy non-boolean option: ') + chalk.magenta.bold(JSON.stringify(t));
          }
          c = t;
        }

        const shortHashVal = shortNameHash[k];
        if (!shortHashVal) {
          throw chalk.magenta('Could not find option for shortname: ' + k);
        }

        const longNameHashVal = nameHash[shortHashVal.cleanName];
        if (!longNameHashVal) {
          throw chalk.magenta('Could not find hash val for name: ') + longNameHashVal;
        }

        const originalName = longNameHashVal.name;
        if (shortHashVal.type === Type.Boolean) {
          ret[originalName] = true;
        }
        else if (shortHashVal.type === Type.ArrayOfBoolean) {
          ret[originalName].push(true);
        }
      }

      prev = c;
    }

    return {
      opts: <OptionsToType<T>>ret,
      values
    };
  }
}












