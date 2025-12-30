import { MatchResult, Semantics } from 'ohm-js';
import grammar, { FunnierActionDict } from './funnier.ohm-bundle';
import { AnnotatedModule, Formula, AnnotatedFunctionDef } from './funnier';
import { checkUniqueNames, collectNamesInNode, getFunnyAst, intervalToLoc } from '@tvm/lab08';
import { ParameterDef, Statement, Predicate } from '../../lab08/src/funny';

function checkFunctionCalls(module: AnnotatedModule) {
    const functionTable = new Map<string, { params: number, returns: number }>();
    for (const func of module.functions) {
        functionTable.set(func.name, { 
            params: func.parameters.length, 
            returns: func.returns.length 
        });
    }

    const builtins = new Map<string, { params: number, returns: number }>([
        ['length', { params: 1, returns: 1 }],
    ]);

    function visitNode(node: any, context: { expectedReturns?: number } = {}) {
        if (!node) return;

        if (node.type === "funccallstmt") {
            const funcCall = node.call;
            const funcName = funcCall.name;
            const argCount = Array.isArray(funcCall.args) ? funcCall.args.length : 0;
            
            const funcInfo = functionTable.get(funcName) ?? builtins.get(funcName);
            if (!funcInfo) {
                throw new Error(`function ${funcName} is not declared`);
            }
    
            const expectedArgCount = funcInfo.params;
            if (argCount !== expectedArgCount) {
                throw new Error();
            }
    
            const returnsCount = funcInfo.returns;
            if (returnsCount !== 0) {
                throw new Error(`function ${funcName} used as statement must return void but returns ${returnsCount} values`);
            }
    
            if (Array.isArray(funcCall.args)) {
                for (const arg of funcCall.args) {
                    visitNode(arg, { expectedReturns: 1 });
                }
            }
            return;
        }

        if (node.type === "funccall") {
            const funcName = node.name;
            const argCount = Array.isArray(node.args) ? node.args.length : 0;
            
            const funcInfo = functionTable.get(funcName) ?? builtins.get(funcName);
            if (!funcInfo) {
                throw new Error(`function ${funcName} is not declared`);
            }

            const expectedArgCount = funcInfo.params;
            if (argCount !== expectedArgCount) {
                throw new Error();
            }

            const returnsCount = funcInfo.returns;
            const expectedReturns = (typeof context.expectedReturns === "number") ? context.expectedReturns : 0;
            if (returnsCount !== expectedReturns) {
                throw new Error();
            }

            if (Array.isArray(node.args)) {
                for (const arg of node.args) {
                    visitNode(arg, { expectedReturns: 1 });
                }
            }
            return;
        } 
        
        if (node.type === "block") {
            if (Array.isArray(node.stmts)) {
                node.stmts.forEach((stmt: any) => visitNode(stmt));
            }
            return;
        } 
        
        if (node.type === "assign") {
            if (Array.isArray(node.exprs)) {
                const targetsReturns = node.targets.length;
                if (Array.isArray(node.exprs)) {
                    node.exprs.forEach((expr: any) => visitNode(expr, { expectedReturns: targetsReturns }));
                }
            }
            return;
        }

        if (node.type === "if") {
            visitNode(node.condition);
            visitNode(node.then);
            visitNode(node.else);
            return;
        }

        if (node.type === "while") {
            visitNode(node.condition);
            visitNode(node.body);
            if (node.invariant) {
                visitNode(node.invariant);
            }
            return;
        }

        if (node.type === "arraccess") {
            visitNode(node.index, { expectedReturns: 1 });
            return;
        }

        if (node.type === "bin") {
            visitNode(node.left, { expectedReturns: 1 });
            visitNode(node.right, { expectedReturns: 1 });
            return;
        }
        
        if (node.type === "unary") {
            visitNode(node.operand, { expectedReturns: 1 });
            return;
        }

        if (node.kind) {
            switch (node.kind) {
                case "comparison":
                    visitNode(node.left, { expectedReturns: 1 });
                    visitNode(node.right, { expectedReturns: 1 });
                    break;
                case "and":
                case "or":
                    visitNode(node.left);
                    visitNode(node.right);
                    break;
                case "not":
                    visitNode(node.condition || node.predicate);
                    break;
                case "paren":
                    visitNode(node.inner);
                    break;
                case "quantifier":
                    visitNode(node.body);
                    break;
                case "formula":
                    if (Array.isArray(node.parameters)) {
                        node.parameters.forEach((param: any) => visitNode(param, { expectedReturns: 1 }));
                    }
                    break;
                case "true":
                case "false":
                    break;
            }
            return;
        }

        if (Array.isArray(node)) {
            node.forEach(item => visitNode(item, context));
            return;
        }
    }

    for (const func of module.functions) {        
        visitNode(func.body);
        
        if (func.precondition) {
            visitNode(func.precondition);
        }
        
        if (func.postcondition) {
            visitNode(func.postcondition);
        }
    }
}

function resolvePredicate(node: any): Predicate | null {
    if (!node) return null;

    if (typeof node === "object" && node !== null && typeof (node as any).kind !== "undefined") {
        return node as Predicate;
    }

    if (typeof node.parse === "function") {
        try {
            const p = node.parse();
            if (p && typeof (p as any).kind !== "undefined") {
                return p as Predicate;
            }
            const rec = resolvePredicate(p);
            if (rec) return rec;
        } catch {
        }
    }

    if (Array.isArray(node.children) && node.children.length > 0) {
        for (const c of node.children) {
            const r = resolvePredicate(c);
            if (r) return r;
        }
    }

    if (Array.isArray(node)) {
        for (const el of node) {
            const r = resolvePredicate(el);
            if (r) return r;
        }
    }

    return null;
}

function mergeLocs(a?: any, b?: any): any | undefined {
    if (!a) return b;
    if (!b) return a;

    const file = a.file ?? b.file;

    function isBefore(x: any, y: any) {
        if (!x) return true;
        if (!y) return false;
        if (x.startLine < y.startLine) return true;
        if (x.startLine > y.startLine) return false;
        return (x.startCol ?? 0) <= (y.startCol ?? 0);
    }
    const start = isBefore(a, b) ? 
        { startLine: a.startLine, startCol: a.startCol } : 
        { startLine: b.startLine, startCol: b.startCol };

    function isAfter(x: any, y: any) {
        if (!x) return true;
        if (!y) return false;
        if ((x.endLine ?? x.startLine) > (y.endLine ?? y.startLine)) return true;
        if ((x.endLine ?? x.startLine) < (y.endLine ?? y.startLine)) return false;
        return (x.endCol ?? x.startCol ?? 0) >= (y.endCol ?? y.startCol ?? 0);
    }
    const end = isAfter(a, b) ? 
        { endLine: (a.endLine ?? a.startLine), endCol: (a.endCol ?? a.startCol) } : 
        { endLine: (b.endLine ?? b.startLine), endCol: (b.endCol ?? b.startCol) };

    return { file, startLine: start.startLine, startCol: start.startCol, endLine: end.endLine, endCol: end.endCol } as any;
}


const getFunnierAst = {
    ...getFunnyAst,

    _iter: (...children) => children,
    EmptyListOf: () => [],
    _terminal: () => null,

    Module(formulas: any, functions: any){
        const formulasAst = formulas.children.map((x: any) => x.parse());
        const functionsAst = functions.children.map((x: any) => x.parse());
        
        return { 
            type: "module", 
            formulas: formulasAst, 
            functions: functionsAst 
        } as AnnotatedModule;
    },

    Formula(name, _lp, paramsNode, _rp, _arrow, body, _semi) {
        const paramsAst = paramsNode.children.map((c: any) => c.parse());
        
        return {
            type: "formula",
            name: name.sourceString,
            parameters: paramsAst,
            body: body.parse()
        } as Formula;
    },

    Preopt(_requires, firstPred, _ands, otherPreds) {
        let conditions = [firstPred.parse()];
        
        if (otherPreds && otherPreds.children && otherPreds.children.length > 0) {
            otherPreds.children.forEach((child: any) => {
                conditions.push(child.parse());
            });
        }

        if (conditions.length === 1) {
            return conditions[0];
        }

        let result = conditions[0];
        for (let i = 1; i < conditions.length; ++i) {
            const right = conditions[i];
            const loc = mergeLocs((result as any).loc, (right as any).loc);
            result = {
                kind: "and",
                left: result,
                right: right,
                loc
            } as Predicate;
        }

        return result;
    },

    Postopt(_ensures, firstPred, _ands, otherPreds) {
        let conditions = [firstPred.parse()];
        
        if (otherPreds && otherPreds.children && otherPreds.children.length > 0) {
            otherPreds.children.forEach((child: any) => {
                conditions.push(child.parse());
            });
        }

        if (conditions.length === 1) {
            return conditions[0];
        }

        let result = conditions[0];
        for (let i = 1; i < conditions.length; ++i) {
            const right = conditions[i];
            const loc = mergeLocs((result as any).loc, (right as any).loc);
            result = {
                kind: "and",
                left: result,
                right: right,
                loc
            } as Predicate;
        }

        return result;
    },

    InvariantOpt(_invariant, firstPred) {
        return firstPred.parse();
    },

    Function(var_name, left_paren, params_opt, right_paren, preopt, returns_str, returns_list, postopt, usesopt, statement: any) {
        const func_name = var_name.sourceString;
        const arr_func_parameters = params_opt.asIteration().children.map(x => x.parse()) as ParameterDef[];

        let preopt_ast: Predicate[] | null = null;
        if (preopt) {
            const resolved = resolvePredicate(preopt);
            if (resolved) preopt_ast = [resolved];
        }

        let arr_return_array: ParameterDef[] = [];
        if (returns_list && returns_list.sourceString && returns_list.sourceString.trim() !== "void") {
            arr_return_array = returns_list.asIteration().children.map(x => x.parse()) as ParameterDef[];
        }

        let postopt_ast: Predicate[] | null = null;
        if (postopt) {
            const resolved = resolvePredicate(postopt);
            if (resolved) postopt_ast = [resolved];
        }

        const arr_locals_array = usesopt.children.length > 0
        ? usesopt.children[0].children[1].asIteration().children.map((x: any) => x.parse()) as ParameterDef[]
        : [];

        if (arr_func_parameters.length !== 0) {
            checkUniqueNames(arr_func_parameters, "parameter");
        }
        if (arr_return_array.length !== 0) {
            checkUniqueNames(arr_return_array, "return value");
        }
        if (arr_locals_array.length !== 0) {
            checkUniqueNames(arr_locals_array, "local variable");
        }

        const all = [...arr_func_parameters, ...arr_return_array, ...arr_locals_array];
        if (all.length > 0) {
            checkUniqueNames(all, "variable");
        }

        const declared = new Set<string>();
        for (const i of arr_func_parameters) {
            declared.add(i.name);
        }
        for (const i of arr_return_array) {
            declared.add(i.name);
        }
        for (const i of arr_locals_array) {
            declared.add(i.name);
        }
        const used_in_body = new Set<string>();
        const parsedStatement = statement.parse() as Statement;
        collectNamesInNode(parsedStatement, used_in_body);
        for (const name of used_in_body) {
            if (!declared.has(name)) {
                throw new Error("Function: локальная переменная " + name + " не объявлена");
            }
        }

        const funcLoc = intervalToLoc(this.source);
        

        return { type: "fun", 
            name: func_name, 
            parameters: arr_func_parameters, 
            returns: arr_return_array, 
            locals: arr_locals_array, 
            precondition: preopt_ast,
            postcondition: postopt_ast,
            body: parsedStatement,
            loc: funcLoc 
        } as AnnotatedFunctionDef;
        },
} satisfies FunnierActionDict<any>;

export const semantics: FunnySemanticsExt = grammar.Funnier.createSemantics() as FunnySemanticsExt;
semantics.addOperation("parse()", getFunnierAst);
export interface FunnySemanticsExt extends Semantics
{
    (match: MatchResult): FunnyActionsExt
}

interface FunnyActionsExt 
{
    parse(): AnnotatedModule;
}

export function parseFunnier(source: string, origin?: string): AnnotatedModule
{
    const matchResult = grammar.Funnier.match(source, "Module");

    if (!matchResult.succeeded()) {
        throw new SyntaxError(matchResult.message);
    }

    const ast_module = semantics(matchResult).parse();
    checkFunctionCalls(ast_module);
    return ast_module;
}